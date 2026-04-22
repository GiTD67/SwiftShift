# Welcome to The Guild

**Team:** DoesItWorkday
**Project:** SwiftShift
**Members:** tdixon@teachx.ai, shsingh@teachx.ai

---

## Your Links

| What | URL |
|------|-----|
| **Terminal** | https://autoqa.teachx.ai/hackathon/t/doesitworkday/ |
| **IDE** | https://autoqa.teachx.ai/hackathon/ide/doesitworkday/ |
| **Canvas** | https://autoqa.teachx.ai/hackathon/canvas/doesitworkday/ |
| **Preview (port 8000)** | https://autoqa.teachx.ai/hackathon/preview/doesitworkday/ |
| **Spectator (read-only)** | https://autoqa.teachx.ai/hackathon/watch/doesitworkday/ |
| **Dashboard** | https://autoqa.teachx.ai/hackathon/dashboard/ |

## Quick Start

**Option 1: Use Grok Build (AI agent)**
Open a terminal and type `grok` to start coding with AI.

**Option 2: Start from a template**
Run `hackathon-menu` then press **3** to pick a template:
- **Flask API** — Python web API
- **FastAPI + HTMX** — Modern Python web app
- **React App** — Vite + React frontend
- **Express API** — Node.js web API
- **Static Site** — Plain HTML/CSS/JS
- **Python CLI** — Command-line tool

## Preview Your App

Start a server on any of these ports and it is live:

| Port | Framework | How to start |
|------|-----------|-------------|
| 8000 | FastAPI / uvicorn | `uvicorn main:app --host 0.0.0.0 --port 8000` |
| 3000 | Express / Node | `npm start` |
| 5000 | Flask | `python app.py` |
| 5173 | Vite / React | `npm run dev` |

**Important:** Always use `--host 0.0.0.0`, not localhost.

## Databases (pre-configured)

| Database | Connection |
|----------|-----------|
| PostgreSQL | `postgresql://root@localhost:5432/devdb` |
| Redis | `redis://localhost:6379` |
| SQLite | Just create a .db file |

## Git

Your code auto-saves every 10 minutes. To sync with GitHub:
- **Push:** `git push`
- **Pull:** `git pull`
- **Branch:** `team/doesitworkday`

## Grok Build Auth

Run `grok-login` to authenticate. It will give you a URL to open in your browser.
After signing in, paste the callback URL back into the terminal.

## Important Tips

- **After running `grok-login`, open a new terminal** for all models to appear in `/model`.
- **Always use `--host 0.0.0.0`** when starting web servers, not `localhost`.

Happy building!
