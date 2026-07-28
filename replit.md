# Acadence

A university grade-management platform for instructors and students. Instructors create courses, manage rosters, enter grades, import CSVs, and view analytics and ML-based predictions. Students see their enrolled courses, grade breakdowns, GPA, and at-risk status.

## Run & Operate

- `pnpm --filter @workspace/grade-tracker run dev` — start the React/Vite frontend (port from `$PORT`)
- `uvicorn main:app --host 0.0.0.0 --port ${PORT} --reload` — start the FastAPI backend (run from `artifacts/server/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Required Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (frontend auth) |
| `CLERK_SECRET_KEY` | Clerk secret key (backend token verification) |
| `DEMO_AUTH_KEY` | Optional bypass key for demo/test environments |

## Stack

- **Frontend**: React 18, Vite, TypeScript, Wouter (routing), Radix UI, Lucide icons
- **Backend**: Python 3.11, FastAPI, SQLAlchemy, Pandas, scikit-learn, Matplotlib
- **Database**: PostgreSQL (SQLAlchemy ORM)
- **Auth**: Clerk (JWT, OpenID Connect)
- **Monorepo**: pnpm workspaces, Node.js 24

## Where Things Live

| Path | Purpose |
|---|---|
| `artifacts/client/` | React/Vite frontend (`@workspace/grade-tracker`) |
| `artifacts/server/` | FastAPI backend — routes, models, services |
| `artifacts/server/src/db/` | SQLAlchemy models and session factory |
| `artifacts/server/src/routes/` | One file per API domain (grades, courses, …) |
| `artifacts/server/src/services/` | Business logic: analytics, predictions, CSV I/O |
| `artifacts/server/src/domain/` | Grading-scheme classes (Weighted, Curved, Pass/Fail) |
| `artifacts/server/src/auth/` | Clerk JWT verification middleware |
| `docs/` | System reference and user manual |

## Architecture Decisions

- Python backend is the single source of truth for all grade calculations; the frontend never derives final grades client-side.
- ML predictions use scikit-learn linear regression trained per-course; the model is ephemeral (in-memory, re-trained on each request batch).
- Grading schemes (Weighted, Curved, Pass/Fail) are implemented as a class hierarchy in `src/domain/`; adding a new scheme requires only a new subclass.
- Clerk handles all authentication; the backend verifies JWTs on every request and maps `clerk_user_id → student_id` for student-role endpoints.
- Report charts (PNG) are generated server-side with Matplotlib and streamed directly; no file storage is required.

## Product

Acadence is aimed at university faculties managing dozens of courses and hundreds of students. Key capabilities: bulk CSV grade import, weighted/curved/pass-fail grading schemes, per-course analytics, ML-based at-risk detection, and downloadable PNG/JSON reports.

## User Preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always restart both the `artifacts/server` and `artifacts/client` workflows after changing environment variables.
- The Python backend is **not** auto-discovered by the pnpm workspace; run it with `uvicorn` directly from `artifacts/server/`.
- Demo auth (`DEMO_AUTH_KEY`) bypasses Clerk; never enable it in production.

## Pointers

- Full API docs (Swagger UI): `/api/docs` (served by FastAPI when the server is running)
- System reference: `docs/SYSTEM_REFERENCE.md`
- User manual: `docs/USER_MANUAL.md`
- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
