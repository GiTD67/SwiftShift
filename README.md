# GrokClock

**The Workday Killer** — A lightning-fast, zero-friction timesheet app for modern teams.

---

## What is GrokClock?

GrokClock is an xAI enterprise HR platform — the Workday killer. Built for the xAI Hackathon, it combines one-tap time tracking with a full HR suite: timesheets, payroll insights, AI assistant (Grokky), job postings, and admin tools. No 47-click workflows. No training manuals.

The mission: **precision attendance, intelligent insights, zero friction.**

---

## Core Principles (System Tenets)

These are the rules and principles we hold dearly. They guide every design and engineering decision.

1. **First principles thinking** — Find the *best possible* solution, not just a good one. Start from fundamentals, not existing patterns.

2. **Question every assumption** — Shake up established processes. If something has always been done a certain way, that's exactly where opportunity lives.

3. **Delete the unnecessary** — Remove parts of the process that are standard procedure but add no value (like taxi medallions that Uber made obsolete). If a step can be eliminated, eliminate it.

4. **Simplify and optimize** — Difficult problems require simple solutions. Complexity is a bug, not a feature.

5. **Accelerate 5×** — Don't aim for 10% better. Ask: *how can this be 5× faster or better?* Think in orders of magnitude.

6. **Automate everything** — Reduce manual effort to zero. Manual work is the biggest bottleneck. If it can be automated, it must be.

---

## Key Features

- **Clock In/Out** — One-tap clock with live session timer, break support, and today total.
- **Timesheet** — 14-day pay period grid. Editable hours, overtime calc, certification, submit.
- **Grokky AI Assistant** — Chat with Grok-3-mini-fast. Context-aware: hours, PTO, policies, team.
- **Admin Panel** — Manage users: edit name, email, role, manager in-place.
- **Jobs** — Post and browse jobs. Stored in DB, visible to all users.
- **InstaApply** — Upload resume once → semantic match against open roles. Jobs sort by fit: Best Match (≥90), Strong Match (≥80), Good Match (≥70). Powered by Grok + resume text extraction (PDF/DOCX).
- **Profile & HR Views** — Profile, Insurance, Org Chart, Taxes — enterprise-ready navigation.
- **Cosmic Liquid Glass** — iOS 26 style glass panels, neon green glows on pure black.

---

## AI Workflows

### Grokky — RAG (Retrieval-Augmented Generation)

Grokky uses ChromaDB to index user documents in vector space. When you chat with Grokky via `/api/grok/chat`, it:

1. Queries your ChromaDB collection for the top 5 relevant chunks (cosine similarity, distance < 1.5)
2. Injects this context into the system prompt for Grok-4.20-0309-reasoning
3. The model answers using both its training knowledge and your uploaded documents

This enables context-aware responses about your hours, PTO, policies, and any uploaded files. Documents are chunked (~4000 chars, 400 overlap) and reindexed on upload.

### Grok Tax — Agentic Workflow

Grok Tax (`/api/grok/tax/fill-1040`) uses a true agentic workflow with tool calling:

1. Agent receives user request to fill Form 1040
2. Agent has access to tools: `list_files`, `extract_file`, `reconcile`, `web_search`, `calculate_tax`
3. Agent loop runs up to 8 steps, autonomously calling tools as needed
4. Tools extract data from tax documents, reconcile totals, search for current tax brackets, calculate final 1040
5. Returns structured JSON form fields

The agent reasons step-by-step, deciding which tools to invoke without human guidance — a full agentic loop.

### InstaApply — Semantic Job Matching

InstaApply (`/api/grok/match-jobs`) ranks jobs against your uploaded resume:

1. Resume text extracted from `s3/{user_id}/resume.{pdf,docx,txt}` (pypdf + python-docx)
2. Grok scores each job 0–100 for fit: "Best Match" ≥90, "Strong Match" ≥80, "Good Match" ≥70, "Fair Match" ≥50
3. Frontend sorts jobs by score and renders colored match badges

---

## Design Aesthetic

GrokClock uses the **Cosmic Crystal** aesthetic with iOS 26 Liquid Glass:

- **Background:** Pure black (#000000) — deep space canvas
- **Accent:** Electric neon green — all glows, buttons, active states
- **Glass:** `.glass` panels with inner glows, neon edge refraction, specular highlights
- **Typography:** Inter / SF Pro geometric sans-serif
- **Layout:** Left sidebar nav, top navbar with brand + user, full-width content
- **Auth Pages:** Premium xAI/SpaceX portal style — radial grid, shockwave ripples, glowing control panels

---

## Tech Stack

| Layer | Tech |
|-------|------|
| **Frontend** | React 18 + TypeScript, Vite, Tailwind CSS |
| **UI Components** | Framer Motion, canvas-confetti, Sonner toasts |
| **AI** | OpenAI SDK → xAI Grok-3-mini-fast (`api/grok/chat`) |
| **Backend** | Flask (Python) with PostgreSQL (psycopg2) |
| **Data** | RealDictCursor, REST API blueprints |
| **Deployment** | Flask serves built React app on port 8000 |

---

## Project Structure

```
/
├── backend/            # Flask API server
│   ├── app.py          # Main entrypoint (serves frontend/dist)
│   ├── routes/         # API blueprints (auth, users, clock_sessions, grok, jobs, etc.)
│   └── db.py           # PostgreSQL connection (psycopg2)
├── frontend/           # React + TypeScript app
│   ├── src/
│   │   ├── App.tsx     # Sidebar nav, auth gates, views (clock, timesheet, grokky, admin, jobs...)
│   │   ├── components/ # ClockWidget, Odometer, Rewards, LootDrop, etc.
│   │   ├── hooks/      # useTimesheet
│   │   └── index.css   # Cosmic Crystal / iOS 26 Liquid Glass styles
│   └── public/         # logo.png, favicon.svg
└── README.md
```

---

## Database Schema

| Table | Columns |
|-------|---------|
| **users** | `id` (SERIAL PK), `first_name` (TEXT NOT NULL), `last_name` (TEXT NOT NULL), `email` (TEXT UNIQUE NOT NULL), `password_hash` (TEXT NOT NULL), `job_role` (TEXT), `manager_name` (TEXT) |
| **employees** | `id` (INTEGER PK), `name` (TEXT NOT NULL), `email` (TEXT) |
| **clock_sessions** | `id` (INTEGER PK), `employee_id` (INTEGER), `clock_in` (TEXT), `clock_out` (TEXT), `duration_minutes` (INTEGER), `notes` (TEXT) |
| **time_entries** | `id` (INTEGER PK), `employee_id` (INTEGER), `date` (TEXT), `project` (TEXT), `task` (TEXT), `start_time` (TEXT), `end_time` (TEXT), `duration_minutes` (INTEGER), `description` (TEXT) |
| **jobs** | `job_id` (SERIAL PK), `description` (TEXT), `hiring_manager_id` (INTEGER), `date_posted` (TEXT), `date_expiry` (TEXT), `salary` (TEXT), `location` (TEXT) |

---

## Getting Started

### 1. Install Dependencies

```bash
# Frontend
cd frontend
npm install

# Backend
cd backend
pip install -r requirements.txt
```

### 2. Build Frontend

```bash
cd frontend
npm run build
```

### 3. Run Backend

```bash
cd backend
python app.py
```

Server runs on `http://0.0.0.0:8000` and serves the React app.

### 4. Preview

Visit `https://autoqa.teachx.ai/hackathon/preview/doesitworkday/`

---

## Why Workday Sucks

| Workday Pain | GrokClock Fix |
|--------------|---------------|
| 47 clicks to log 2 hours | One-tap clock in, live timer, break support |
| "Where do I find my payslip?" | Timesheet shows hours, OT, submit — instant |
| Manager approvals buried in menus | Grokky AI answers hours/PTO/policies instantly |
| Confusing org chart | Sidebar nav: Clock, Timesheet, Admin, Profile, Jobs |
| 3-hour training sessions | Zero training — login, clock in, done |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signin` | Login |
| POST | `/api/auth/signup` | Create account |
| GET | `/api/users` | List users |
| PUT | `/api/users/<id>` | Update user |
| GET/POST | `/api/clock-sessions` | Clock in/out, list sessions |
| POST | `/api/grok/chat` | Grokky AI assistant |
| GET/POST | `/api/jobs` | Post and list jobs |
| GET | `/api/health` | Health check |

See [backend/routes/](backend/routes/) for full API docs.

---

## Team

**DoesItWorkday** — Trevor Dixon CFA & Shubham Singh

Built with ❤️ for the xAI Hackathon.
