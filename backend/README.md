# GrokClock Backend

Flask API server for the GrokClock HR platform (Workday killer).

## Overview

This backend provides REST endpoints for:
- **Auth** — signup and signin with password hashing
- **Users** — list, create, update, delete users (admin panel)
- **Employees** — legacy employee list/create + enter_time/exit_time
- **Time Entries** — log hours with project, task, duration
- **Clock Sessions** — clock in/out with live duration tracking
- **Grokky AI** — RAG chat + document upload (ChromaDB) + InstaApply job matching + Grok Tax agentic 1040 filing
- **Kalshi** — prediction markets API proxy (`/api/kalshi/markets`, `/api/kalshi/events`)
- **Jobs** — post and browse job listings
- **Health check** — simple liveness probe

The server also serves the built frontend (`frontend/dist`) as a static SPA on port 8000.

## Directory Structure

```
backend/
├── app.py              # Flask app entrypoint — registers all blueprints, serves frontend
├── auth.py             # Auth routes (signup, signin) + DB table init for users/jobs
├── db.py               # Database connection (get_db context manager)
├── check.py            # Health/debug helpers
├── requirements.txt    # Python dependencies
├── routes/
│   ├── __init__.py     # Exports all blueprints (REQUIRED for new routes)
│   ├── health.py       # /api/health
│   ├── employees.py    # /api/employees
│   ├── time_entries.py # /api/time-entries
│   ├── clock_sessions.py # /api/clock-sessions
│   ├── users.py        # /api/users (admin CRUD)
│   ├── grok.py         # /api/grok/* (chat, upload, tax/*, match-jobs) — RAG + agentic workflows
│   └── jobs.py         # /api/jobs (post/list jobs)
└── README.md
```

**IMPORTANT:** Strictly follow this structure. All new API endpoints MUST go in `routes/` (except auth.py which lives at root). Do not add routes directly to `app.py`.

## Adding a New API Endpoint

1. **Create a route file** in `routes/{resource}.py`:
   ```python
   from flask import Blueprint, jsonify, request
   from db import get_db

   bp = Blueprint("resource_name", __name__)

   @bp.route("/api/resource", methods=["GET"])
   def list_resource():
       with get_db() as db:
           rows = db.execute("SELECT * FROM table").fetchall()
       return jsonify([dict(r) for r in rows])
   ```

2. **Export the blueprint** in `routes/__init__.py`:
   ```python
   from .resource_name import bp as resource_bp
   __all__ = [..., "resource_bp"]
   ```

3. **Register in** `app.py`:
   ```python
   from routes import ..., resource_bp
   app.register_blueprint(resource_bp)
   ```

**Patterns to follow:**
- Use `Blueprint` with name matching the file
- Prefix all routes with `/api/`
- Use `with get_db() as db:` for queries (RealDictCursor returns dicts)
- Return `jsonify(...)` for responses
- Use 201 for created, 400 for validation errors, 404 for not found

## Code Conventions

- **Strictly follow** the existing directory structure — no new top-level files without team agreement.
- Database access: always use `get_db()` context manager from `db.py`.
- Timestamps: store as ISO strings (`.isoformat()`), compute durations in minutes.
- Error responses: `{"error": "message"}` with appropriate status code.
- All new endpoints should be documented in this README under API Endpoints.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check → `{"status":"healthy"}` |
| POST | `/api/auth/signup` | Create account `{first_name, last_name, email, password}` |
| POST | `/api/auth/signin` | Login `{email, password}` → returns user object |
| GET | `/api/users` | List all users (admin panel) |
| POST | `/api/users` | Create user (admin) |
| GET | `/api/users/<id>` | Get single user |
| PUT | `/api/users/<id>` | Update user fields (job_role, manager_name, pay, etc.) |
| DELETE | `/api/users/<id>` | Delete user (admin) |
| GET | `/api/employees` | List all employees (legacy) |
| POST | `/api/employees/enter_time` | Clock in (legacy) |
| POST | `/api/employees/exit_time` | Clock out (legacy) |
| POST | `/api/employees` | Create employee `{name, email?}` |
| GET | `/api/time-entries?employee_id=` | List time entries (optional filter) |
| POST | `/api/time-entries` | Create entry `{date, start_time, end_time, employee_id?, project?, task?, description?}` |
| GET | `/api/clock-sessions?employee_id=&active=1` | List sessions (optionally filter active) |
| POST | `/api/clock-sessions` | Clock in `{employee_id, notes?}` |
| PUT | `/api/clock-sessions/<id>` | Clock out (sets `clock_out`, computes `duration_minutes`) |
| GET | `/api/kalshi/markets` | Kalshi prediction markets (status, limit, event_ticker filters) |
| GET | `/api/kalshi/events` | Kalshi events (status, limit filters) |
| POST | `/api/grok/upload` | Upload document for RAG (PDF/DOCX/TXT → ChromaDB) |
| POST | `/api/grok/chat` | Grokky AI assistant `{message}` → `{response}` (RAG-enabled) |
| POST | `/api/grok/match-jobs` | InstaApply: semantic job match from resume `{user_id}` → scored jobs |
| POST | `/api/grok/tax/upload` | Upload tax forms (W2, 1099, etc.) |
| POST | `/api/grok/tax/extract` | Extract structured data from uploaded tax docs |
| POST | `/api/grok/tax/fill-1040` | Agentic 1040 filing workflow (tool-calling loop) |
| GET | `/api/jobs` | List all jobs (newest first) |
| POST | `/api/jobs` | Post a job `{description, hiring_manager_id?, salary?, location?, date_expiry?}` |
| GET | `/*` | Serves `frontend/dist` (SPA fallback to `index.html`) |

## Database

Uses PostgreSQL at `postgresql://root@localhost:5432/devdb`.

**Tables** (auto-created on first import via auth.py):

```sql
-- Users (auth + admin panel)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  job_role TEXT,
  manager_name TEXT,
  is_fulltime INTEGER DEFAULT 1,
  pay REAL,
  salary REAL
);

-- Legacy employees (kept for compatibility)
CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT
);

CREATE TABLE time_entries (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER,
  date TEXT,
  project TEXT,
  task TEXT,
  start_time TEXT,
  end_time TEXT,
  duration_minutes INTEGER,
  description TEXT
);

CREATE TABLE clock_sessions (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER,
  clock_in TEXT,
  clock_out TEXT,
  duration_minutes INTEGER,
  notes TEXT
);

-- Jobs (posting + browsing)
CREATE TABLE jobs (
  job_id SERIAL PRIMARY KEY,
  description TEXT,
  hiring_manager_id INTEGER,
  date_posted TEXT,
  date_expiry TEXT,
  salary TEXT,
  location TEXT
);
```

## Setup

```bash
cd backend
pip install -r requirements.txt
python app.py
```

Server runs on `http://0.0.0.0:8000` and serves the built React frontend at `/`.

## Dependencies

- Flask >= 2.0.0
- flask-cors
- psycopg2
- werkzeug (password hashing)
- openai (xAI Grok integration)
- requests (Kalshi API proxy)

## Frontend

- Built assets expected at `../frontend/dist`
- Run `npm run build` in `frontend/` first if serving SPA
- Dev: `npm run dev` in `frontend/` for hot-reload (separate port 8000)

## Notes

- Duration auto-computed from HH:MM strings if not provided on POST
- Clock-out calculates minutes since clock-in (UTC)
- All timestamps stored as ISO strings
- Row factory returns dicts (RealDictCursor)
