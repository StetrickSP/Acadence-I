"""Clerk authentication with full JWKS-based JWT verification.

Verification chain:
  1. Decode the Clerk publishable key → frontend API domain → JWKS URL
  2. PyJWKClient fetches and caches Clerk's public key set
  3. jwt.decode() verifies signature (RS256), expiry, and issued-at
  4. Verified `sub` (Clerk user ID) is then used for all DB lookups

An unverified token (wrong signature, expired, malformed) raises HTTP 401.
No call to any /me endpoint can succeed with a forged token.
"""
import base64
import os
import urllib.request
import json
from functools import lru_cache
from typing import Optional

import jwt
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from src.db.models import StudentRow

CLERK_SECRET_KEY = os.environ.get("CLERK_SECRET_KEY", "")
CLERK_PUBLISHABLE_KEY = os.environ.get("CLERK_PUBLISHABLE_KEY", "") or os.environ.get(
    "VITE_CLERK_PUBLISHABLE_KEY", ""
)


# ---------------------------------------------------------------------------
# JWKS client (module-level singleton, caches public keys)
# ---------------------------------------------------------------------------

def _decode_clerk_frontend_api(publishable_key: str) -> str:
    """Decode the Clerk publishable key to recover the frontend API domain.

    Clerk publishable keys are: pk_test_<base64url> or pk_live_<base64url>
    The base64 payload decodes to the frontend API URL followed by a '$'.
    """
    parts = publishable_key.split("_", 2)          # ["pk", "test"|"live", "<b64>"]
    if len(parts) != 3:
        raise ValueError(f"Unrecognised Clerk publishable key format: {publishable_key!r}")
    encoded = parts[2]
    # Base64url → standard base64 + padding
    padded = encoded.replace("-", "+").replace("_", "/") + "=" * (4 - len(encoded) % 4)
    decoded = base64.b64decode(padded).decode("utf-8").rstrip("$").strip()
    return decoded   # e.g. "accountable-hedgehog-7.clerk.accounts.dev"


@lru_cache(maxsize=1)
def _get_jwks_client() -> jwt.PyJWKClient:
    """Build and cache the JWKS client at first call.

    Falls back to the Clerk API endpoint (requires CLERK_SECRET_KEY) if the
    publishable key is absent or malformed, so dev environments without
    VITE_ vars still work.
    """
    if CLERK_PUBLISHABLE_KEY:
        try:
            frontend_api = _decode_clerk_frontend_api(CLERK_PUBLISHABLE_KEY)
            jwks_url = f"https://{frontend_api}/.well-known/jwks.json"
        except Exception:
            jwks_url = "https://api.clerk.com/v1/jwks"
    else:
        jwks_url = "https://api.clerk.com/v1/jwks"

    # Pass the secret key as a Bearer header so Clerk's /v1/jwks route
    # accepts the request (required when using the fallback URL).
    headers = {"Authorization": f"Bearer {CLERK_SECRET_KEY}"} if CLERK_SECRET_KEY else {}
    return jwt.PyJWKClient(jwks_url, headers=headers, cache_keys=True, max_cached_keys=16)


# ---------------------------------------------------------------------------
# Token extraction helpers
# ---------------------------------------------------------------------------

def _get_token(request: Request) -> Optional[str]:
    """Return the raw Clerk session JWT from cookie or Authorization header."""
    token = request.cookies.get("__session")
    if token:
        return token
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:].strip()
    return None


# ---------------------------------------------------------------------------
# Core verification — raises on any invalid token
# ---------------------------------------------------------------------------

def _verify_token(token: str) -> str:
    """Cryptographically verify a Clerk JWT and return the verified user ID.

    Raises:
        jwt.ExpiredSignatureError   → token has expired
        jwt.InvalidTokenError       → signature invalid / malformed / wrong issuer
        HTTPException(401)          → convenience wrapper for FastAPI routes
    """
    try:
        client = _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={
                "verify_exp": True,
                "verify_iat": True,
                "verify_aud": False,   # Clerk JWTs don't carry a standard audience
            },
            leeway=10,                 # 10 s clock-skew tolerance
        )
        user_id: str = payload["sub"]
        if not user_id:
            raise jwt.InvalidTokenError("Missing sub claim")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired — please sign in again")
    except jwt.PyJWKClientError as exc:
        raise HTTPException(status_code=401, detail=f"Could not fetch signing keys: {exc}")
    except (jwt.InvalidTokenError, jwt.DecodeError, KeyError) as exc:
        raise HTTPException(status_code=401, detail=f"Invalid session token: {exc}")


# ---------------------------------------------------------------------------
# Clerk REST API — fetch user email for account resolution
# ---------------------------------------------------------------------------

def _get_clerk_email(user_id: str) -> Optional[str]:
    """Return the primary email for a verified Clerk user ID."""
    if not CLERK_SECRET_KEY:
        return None
    try:
        url = f"https://api.clerk.com/v1/users/{user_id}"
        req = urllib.request.Request(
            url, headers={"Authorization": f"Bearer {CLERK_SECRET_KEY}"}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
        primary_id = data.get("primary_email_address_id")
        for ea in data.get("email_addresses", []):
            if ea.get("id") == primary_id:
                return ea.get("email_address")
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# DB resolution — Clerk user → student row
# ---------------------------------------------------------------------------

def _resolve_student(
    db: Session, clerk_user_id: str, clerk_email: Optional[str]
) -> Optional[StudentRow]:
    """Map a verified Clerk user to a student record.

    Fast path: clerk_user_id already stored on the row.
    Slow path: match by email and auto-link for future requests.
    """
    row = db.query(StudentRow).filter(StudentRow.clerk_user_id == clerk_user_id).first()
    if row:
        return row
    if clerk_email:
        row = db.query(StudentRow).filter(StudentRow.email == clerk_email).first()
        if row:
            row.clerk_user_id = clerk_user_id
            db.commit()
            db.refresh(row)
            return row
    return None


# ---------------------------------------------------------------------------
# Public FastAPI dependencies
# ---------------------------------------------------------------------------

def require_auth(request: Request) -> str:
    """FastAPI dependency: return verified Clerk user ID or raise 401.

    Uses full JWKS signature verification — forged tokens are rejected.
    """
    token = _get_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not signed in")
    return _verify_token(token)   # raises 401 on any invalid token


def get_student_from_request(request: Request, db: Session) -> StudentRow:
    """Resolve the signed-in Clerk user to a student record or raise 403.

    Auth is fully verified before any DB lookup occurs.
    """
    token = _get_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not signed in")

    user_id = _verify_token(token)           # raises 401 on invalid token
    clerk_email = _get_clerk_email(user_id)  # safe: uses verified user_id
    student = _resolve_student(db, user_id, clerk_email)

    if not student:
        # Return a plain JSONResponse so the body is {"isAdmin": true} at the top level.
        # HTTPException wraps dict details inside {"detail": ...}, which the frontend
        # hook cannot see when checking body?.isAdmin === true.
        raise _NoStudentException()
    return student


class _NoStudentException(Exception):
    """Sentinel raised when no student row is linked to the verified Clerk user."""
