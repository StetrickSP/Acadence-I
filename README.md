# Acadence

> University grade management for instructors and students — built on FastAPI, React/Vite, PostgreSQL, and Clerk.

Acadence lets instructors create courses, manage student rosters, enter and import grades, read analytics dashboards, and get ML-powered at-risk predictions. Students log in to see their enrolled courses, grade breakdowns, weighted GPA, and at-risk status.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Wouter, Radix UI |
| Backend | Python 3.11, FastAPI, SQLAlchemy |
| Data / ML | Pandas, scikit-learn, Matplotlib |
| Database | PostgreSQL |
| Auth | Clerk (JWT / OpenID Connect) |
| Monorepo | pnpm workspaces, Node.js 24 |

---

## Prerequisites

- **Node.js 24** and **pnpm 9+**
- **Python 3.11+** with `pip`
- A running **PostgreSQL** instance
- A **Clerk** application ([clerk.com](https://clerk.com)) for authentication

---

## Local Setup

### 1. Clone and install JS dependencies

```bash
git clone <repo-url> acadence
cd acadence
pnpm install
```

### 2. Install Python dependencies

```bash
cd artifacts/server
pip install fastapi uvicorn sqlalchemy psycopg2-binary pandas scikit-learn matplotlib python-multipart httpx pydantic
```

### 3. Configure environment variables

Copy the template and fill in real values:

```bash
cp .env.example .env   # or set secrets in the Replit Secrets panel
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql://user:pass@localhost/acadence` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (exposed to the browser) |
| `CLERK_SECRET_KEY` | Clerk secret key (backend only — never expose to the browser) |
| `DEMO_AUTH_KEY` | Optional demo bypass key; omit in production |

### 4. Start the development servers

**Backend** (from `artifacts/server/`):

```bash
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

**Frontend** (from the monorepo root):

```bash
pnpm --filter @workspace/grade-tracker run dev
```

The frontend proxies `/api/*` requests to the backend. Interactive API docs are available at **`http://localhost:8080/api/docs`** (Swagger UI).

### 5. Seed demo data (optional)

```bash
cd artifacts/server
python seed.py     # if a seed script is present
```

---

## Repo Map

```
acadence/
├── artifacts/
│   ├── client/                  # React/Vite frontend (@workspace/grade-tracker)
│   │   └── src/
│   │       ├── pages/           # One file per route/view
│   │       ├── components/      # Shared UI components
│   │       └── hooks/           # API and auth hooks
│   └── server/                  # FastAPI backend
│       └── src/
│           ├── auth/            # Clerk JWT verification
│           ├── db/              # SQLAlchemy models + session factory
│           ├── domain/          # Grading-scheme class hierarchy
│           ├── routes/          # One router per API domain
│           └── services/        # Analytics, ML predictions, CSV I/O
├── docs/
│   ├── SYSTEM_REFERENCE.md      # Developer technical reference (all SP modules)
│   └── USER_MANUAL.md           # Step-by-step guide for instructors and students
├── replit.md                    # Project overview + dev preferences
└── package.json                 # Monorepo root
```

---

## Documentation

| Document | Description |
|---|---|
| [`docs/SYSTEM_REFERENCE.md`](docs/SYSTEM_REFERENCE.md) | Technical reference for all seven SP modules: architecture, key files, API endpoints, and known limitations |
| [`docs/USER_MANUAL.md`](docs/USER_MANUAL.md) | Step-by-step user guide for instructors and students |
| `/api/docs` | Auto-generated Swagger UI (live when the backend is running) |
| `/api/redoc` | ReDoc alternative for the same OpenAPI spec |

---

## Contributing

1. Run `pnpm typecheck` before submitting a PR.
2. Backend changes go in `artifacts/server/`; all routes must be registered in `main.py`.
3. Keep grading logic inside `src/domain/` — never compute final grades on the frontend.
4. Authentication is handled by Clerk; do not roll custom auth.
