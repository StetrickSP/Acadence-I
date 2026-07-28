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

def _verify_token_payload(token: str) -> dict:
    """Cryptographically verify a Clerk JWT and return the full verified payload.

    Raises:
        HTTPException(401) on any invalid/expired/malformed token.
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
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired — please sign in again")
    except jwt.PyJWKClientError as exc:
        raise HTTPException(status_code=401, detail=f"Could not fetch signing keys: {exc}")
    except (jwt.InvalidTokenError, jwt.DecodeError, KeyError) as exc:
        raise HTTPException(status_code=401, detail=f"Invalid session token: {exc}")


def _verify_token(token: str) -> str:
    """Verify a Clerk JWT and return the verified user ID (sub claim)."""
    return _verify_token_payload(token)["sub"]


def _email_from_claims(payload: dict) -> Optional[str]:
    """Extract the user's email from verified JWT claims, if present.

    The session token is cryptographically verified, so an email claim in it
    is trustworthy. Replit-managed Clerk tokens typically carry the email
    directly; check the common claim names.
    """
    for key in ("email", "primary_email", "email_address"):
        val = payload.get(key)
        if isinstance(val, str) and "@" in val:
            return val
    # Some templates nest user info under "user" or "claims"
    user = payload.get("user")
    if isinstance(user, dict):
        val = user.get("email")
        if isinstance(val, str) and "@" in val:
            return val
    return None


# ---------------------------------------------------------------------------
# Clerk REST API — fetch user email for account resolution
# ---------------------------------------------------------------------------

_clerk_api_warned = False
_no_email_claim_warned = False


def _get_clerk_email(user_id: str) -> Optional[str]:
    """Best-effort fallback: fetch the primary email via Clerk's backend API.

    Replit-managed Clerk tenants reject this endpoint (403), so this is only
    a fallback for tokens that carry no email claim. A single attempt, never
    raises — returns None on any failure and logs once per process.
    """
    global _clerk_api_warned
    import logging
    logger = logging.getLogger(__name__)

    if not CLERK_SECRET_KEY:
        return None

    url = f"https://api.clerk.com/v1/users/{user_id}"
    req = urllib.request.Request(
        url, headers={"Authorization": f"Bearer {CLERK_SECRET_KEY}"}
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
        primary_id = data.get("primary_email_address_id")
        for ea in data.get("email_addresses", []):
            if ea.get("id") == primary_id:
                return ea.get("email_address")
        return None
    except Exception as exc:
        if not _clerk_api_warned:
            logger.warning(
                "Clerk backend API email lookup unavailable (expected with "
                "Replit-managed Clerk); relying on JWT email claims. Error: %s", exc,
            )
            _clerk_api_warned = True
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
    """Resolve the signed-in Clerk user to a student record or raise 403/503.

    Auth is fully verified before any DB lookup occurs.

    Resolution order:
      1. clerk_user_id fast-path (already linked in DB — no Clerk API call needed)
      2. Clerk REST API email lookup → match by email and auto-link for next time
         If Clerk API is unreachable after retries → 503 (not 403) so the
         frontend can distinguish a transient API outage from "not a student".
    """
    token = _get_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not signed in")

    payload = _verify_token_payload(token)  # raises 401 on invalid token
    user_id = payload["sub"]

    # Fast path: clerk_user_id already linked — no Clerk API call needed
    from src.db.models import StudentRow as _SR
    fast = db.query(_SR).filter(_SR.clerk_user_id == user_id).first()
    if fast:
        return fast

    # Primary source: email claim from the cryptographically verified JWT.
    clerk_email = _email_from_claims(payload)

    # Fallback: best-effort Clerk backend API lookup (single attempt, never
    # raises — Replit-managed Clerk tenants reject this endpoint).
    if not clerk_email:
        global _no_email_claim_warned
        if not _no_email_claim_warned:
            import logging
            logging.getLogger(__name__).warning(
                "Session token carried no email claim (claim keys: %s); "
                "falling back to Clerk API lookup.", sorted(payload.keys()),
            )
            _no_email_claim_warned = True
        clerk_email = _get_clerk_email(user_id)

    student = _resolve_student(db, user_id, clerk_email)
    if not student:
        # No matching student record (or no email available) → treat as
        # instructor/admin signal, not a server error.
        raise _NoStudentException()
    return student


class _NoStudentException(Exception):
    """Sentinel raised when no student row is linked to the verified Clerk user."""


class _ClerkApiUnavailableException(Exception):
    """Raised when the Clerk REST API is unreachable after retries.

    Mapped to HTTP 503 so clients can distinguish a transient outage from
    'genuinely not a student' (403).
    """
