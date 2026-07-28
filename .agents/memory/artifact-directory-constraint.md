---
name: Replit artifact directory constraint
description: Artifacts must live under artifacts/ or the proxy routing breaks — moving them elsewhere deregisters them and causes 404.
---

# Replit Artifact Directory Constraint

Replit's proxy gateway only routes preview traffic to artifacts whose `artifact.toml` lives inside `artifacts/`. Moving an artifact outside that directory (e.g. to a top-level `client/` or `server/`) causes the platform to deregister it and return "404 — no previewable artifacts", even if the workflow is running and the port responds with 200.

**Why:** The platform scans `artifacts/*/` for `.replit-artifact/artifact.toml` files to build its routing table. Paths outside that glob are not picked up for routing, even if `verifyAndReplaceArtifactToml` registers them.

**How to apply:** When a user asks to reorganise the project into `client/` and `server/` folders, use `artifacts/client/` and `artifacts/server/` instead of top-level `client/` and `server/`. This preserves the naming convention the user wants while keeping the proxy routing intact.

**Additional notes:**
- After any directory move, the old workflow processes keep holding their ports. Kill them by PID (`kill -9 <pids>`) before restarting workflows — `fuser -k` is not always sufficient if the process ignores SIGTERM.
- After moving a pnpm workspace package, delete `node_modules` inside the moved directory and run `pnpm install` again. Stale symlinks cause Vite to fail with `ERR_MODULE_NOT_FOUND` even though the root `node_modules` looks correct.
