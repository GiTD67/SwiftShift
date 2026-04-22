# SwiftShift — Project Context

> **For future agents:** This file summarizes the project state as of the end of the conversation. Use this to understand architecture, design decisions, and how to run/deploy.

---

## Project Overview

**Name:** SwiftShift  
**Team:** DoesItWorkday  
**Members:** tdixon@teachx.ai, shsingh@teachx.ai

**Mission:** "Workday Killer" — xAI enterprise HR platform. Zero-friction one-tap time tracking + full HR suite: timesheets, payroll, AI assistant (Grokky), job postings, admin tools, tax filing. No 47-click workflows.

**Current State:** Full React + Flask production app. 12 views, sidebar nav, auth, Kalshi prediction markets, RAG-powered Grokky, agentic Grok Tax.

---

## Key Features (Current)

### Frontend (React + TypeScript)
- **Auth Pages** — Premium xAI/SpaceX portal style: radial grid, shockwave ripples, glowing control panels. LoginPage/SignupPage with biometric/encrypted hints.
- **Sidebar Navigation** — 12 views: Time Clock, Timesheet, Rewards, Insurance & Benefits, Organization Chart, Files, Grok Tax, InstaApply, Admin, Grokky AI Assistant.
- **Time Clock** — Greeting (Good morning/afternoon/evening), live clock, clock in/out + break controls, 8h target ring with confetti, streak counter.
- **Timesheet** — 14-day pay period grid, editable hours (decimals), regular/OT×1.5 calc, certification + submit. Auto-populated from clock_sessions DB.
- **Rewards** — Earnings calculator (hourly × hours). Live Odometer. **Gork's Prediction Markets** powered by Kalshi API — stake paychecks on sports, crypto, politics, AI events.
- **LootDrop** — Clock-out celebration: vault animation, falling coins, confetti, PTO accrual, "Deposited to your vault".
- **Odometer** — Mechanical slot-machine flip-digit counter (dark recessed window, top shine, center gloss).
- **Org Chart** — Interactive tree with expand/collapse, search, team size, highlight.
- **Grokky AI** — Chat with xAI Grok, RAG-enabled (ChromaDB document context).
- **Grok Tax** — Agentic 1040 filing workflow (tool calling: list_files, extract, reconcile, calculate).
- **InstaApply** — Upload resume → semantic job match (Best/Strong/Good/Fair Match badges).

### Backend (Flask + PostgreSQL)
- **Auth** — `/api/auth/signup|signin` with password hashing (werkzeug).
- **Users** — CRUD + DELETE for admin panel.
- **Clock Sessions** — `/api/clock-sessions` GET/POST/PUT (clock in/out, duration calc).
- **Time Entries** — `/api/time-entries` GET/POST.
- **Grokky** — `/api/grok/chat` (RAG), `/api/grok/upload` (document → ChromaDB).
- **Grok Tax** — `/api/grok/tax/upload|extract|fill-1040` (agentic workflow).
- **InstaApply** — `/api/grok/match-jobs` (semantic scoring 0-100).
- **Jobs** — `/api/jobs` GET/POST.
- **Kalshi** — `/api/kalshi/markets|events` proxy to Kalshi API.
- **S3/Chroma** — `backend/s3/{user_id}/chroma/` stores vector DB + uploaded PDFs (W2, 1099, resumes).

### Design Aesthetic
- **Background:** Pure black (#000000) — deep space.
- **Accent:** Electric neon green (#00FF00 / #D7FE51) — all glows, buttons, active states.
- **Glassmorphism:** `.glass` panels with inner glows, neon edge refraction, specular highlights (iOS 26 Liquid Glass).
- **Typography:** Inter / SF Pro geometric sans-serif.
- **Layout:** Left sidebar nav, top navbar with brand + user (streak counter, logout).

---

## Architecture

| Layer | Tech |
|-------|------|
| **Frontend** | React 18 + TypeScript, Vite, Tailwind CSS, Framer Motion, canvas-confetti, Sonner toasts |
| **Backend** | Flask (Python), blueprints in `routes/`, PostgreSQL (psycopg2, RealDictCursor) |
| **AI** | OpenAI SDK → xAI Grok-3-mini-fast, ChromaDB RAG, agentic tool calling |
| **Data** | PostgreSQL tables: users, employees, clock_sessions, time_entries, jobs |
| **RAG Storage** | ChromaDB per user in `backend/s3/{user_id}/chroma/` |
| **Deployment** | Flask serves `frontend/dist` as SPA on port 8000. Subpath `/hackathon/preview/doesitworkday` |

---

## Key Files

| File | Purpose |
|------|---------|
| `frontend/src/App.tsx` | Main app: auth gates, sidebar nav, 12 views, API calls, streak counter |
| `frontend/src/components/Rewards.tsx` | Earnings + Kalshi Prediction Markets UI |
| `frontend/src/components/LootDrop.tsx` | Clock-out vault animation + confetti |
| `frontend/src/components/Odometer.tsx` | Slot-machine digit counter |
| `backend/app.py` | Flask entrypoint, Kalshi proxy, serves frontend/dist |
| `backend/routes/grok.py` | RAG chat, upload, tax agentic endpoints, match-jobs |
| `backend/db.py` | PostgreSQL connection (get_db context manager) |
| `backend/auth.py` | Signup/signin routes + DB table init |
| `backend/s3/` | Per-user ChromaDB + uploaded documents (PDFs) |

---

## Build & Deploy

### Frontend
```bash
cd frontend
npm install
npm run build
```
Outputs to `frontend/dist/`.

### Backend
```bash
cd backend
pip install -r requirements.txt
python app.py
```
Runs on `http://0.0.0.0:8000`. Serves frontend/dist as SPA.

### Preview
- `https://autoqa.teachx.ai/hackathon/preview/doesitworkday/`

---

## Database Schema

| Table | Key Columns |
|-------|-------------|
| **users** | id, first_name, last_name, email, password_hash, job_role, manager_name, pay, salary |
| **clock_sessions** | id, employee_id, clock_in, clock_out, duration_minutes, notes |
| **time_entries** | id, employee_id, date, project, task, start_time, end_time, duration_minutes |
| **jobs** | job_id, description, hiring_manager_id, date_posted, salary, location |

---

## Recent Additions (This Session)

- **Kalshi Prediction Markets** — Rewards view now includes "Gork's Prediction Markets" powered by `/api/kalshi/markets|events`. Users can stake paychecks on real-world events.
- **Grok Tax Agentic Workflow** — `/api/grok/tax/fill-1040` runs up to 8-step tool-calling loop (list_files, extract_file, reconcile, web_search, calculate_tax).
- **InstaApply** — `/api/grok/match-jobs` extracts resume text (PDF/DOCX) and scores jobs 0-100 for fit.
- **RAG Document Upload** — `/api/grok/upload` chunks PDFs into ChromaDB per user for context-aware Grokky chat.

---

## Quick Reference

- **Main view logic:** `src/App.tsx` → `activeView` state, sidebar `ta-nav-btn` buttons
- **API base:** Dynamically detected from `/hackathon/preview/...` path prefix
- **Clock state:** `useClock` hook (localStorage persisted) + backend `/api/clock-sessions`
- **Timesheet data:** Populated from DB clock_sessions on load
- **Colors:** Background `#000000`, Neon `#00FF00` / `#D7FE51`, Glass `rgba(18,24,15,0.8)`

---

*Generated/updated to match current codebase (React SPA + Flask API + Kalshi + RAG + Agentic Tax).*







---



---


| `frontend/src/index.css` | Master Aesthetic styles (neon green, crystal glass) |
| `frontend/src/components/Odometer.tsx` | Split-flip mechanical odometer counter |
| `frontend/vite.config.ts` | Build config |

---



### Run backend
```bash
cd backend
python app.py
```
- Runs on `http://0.0.0.0:5000`
- Serves `frontend/dist` as SPA
- REST API at `/api/*`

---



---



---



---

*Generated at end of conversation. Update this file if architecture or design changes significantly.*

---


- Time: floating glass segment showing exact time (h:mm a)
- Center: prominent polished clear glass **"CLOCK IN"** button (#00FF00 glow)
- Bottom nav: floating translucent glass capsule, **3 icons** (🕐 Clock, 💵 Paystub, 👤 Profile), paystub center glowing
- Background: **#000000** pure black night sky, subtle white stars, sleek shooting stars
- Glass: Liquid Glass — transparent frosted panels, edge refraction, specular highlights, soft caustics
- Palette: **#00FF00 electric green only + #000000 black** — no yellow
- Quick Insights: **Removed**
- Intro: glowing X-hourglass SVG logo for 1.2s, then "Hi, Elon! Clock in?"

**Logo/Favicon (user-provided):**
- Squircle (rounded-square) of polished dark-tinted Liquid Glass
- Background: #000000 with microscopic neural-net nodes (green dots/lines)
- Symbol: two sleek #CFF64E light-trails intersecting to form **"X"**
- Top/bottom of X enclosed by frosted glass curves → hourglass illusion
- Caustics, specular highlights on glass edges
- SVG at `public/favicon.svg`, embedded as data URI in single-file HTML

**Files (current):**
- `templates/index.html` — single-file app (~230KB, all inline)
- `src/App.tsx` — "Hi, Elon! Clock in?", time segment, 3-icon nav, intro logo
- `src/index.css` — iOS 26 Liquid Glass, black+green only, shooting stars
- `public/favicon.svg` — X-hourglass brand icon

**Deployment:**
- Flask `app.py` serves `templates/index.html` at `/` and `/hackathon/preview/doesitworkday/`
- Port 8000. Preview: https://autoqa.teachx.ai/hackathon/preview/doesitworkday/

---



### Bottom Navigation Refinement
- **Icons:** Changed to translucent SVG icons (no emojis)
  - Left: ⏳ Hourglass (timesheet)
  - Center: 🏠 Home (clock view, glowing)
  - Right: 💵 Dollar sign (rewards view)
- **Labels:** Removed all text labels ("Hourglass", "Home", "Dollar") — icons only
- **Settings:** Top-right icon changed from 👤 to ⚙️ (gear SVG)
- **Clock button:** Resized smaller → `py-12`, `text-4xl`, icon `text-6xl` (was overwhelming)

### Rewards Tab (Dollar Icon)
- **View switching:** Bottom nav now toggles `view` state (`'clock'` | `'rewards'`)
- **Rewards.tsx** (pre-built component) wired in:
  - **Card 1 — Earned Today:** Live Odometer showing gross pay ticking every second (`$247.18 → $247.19 → ...`) while clocked in. Uses `elapsedSeconds * hourlyRate`.
  - **Card 2 — Available PTO:** Live Odometer showing accrued PTO hours (`120.501 → 120.502 hrs`). Progress bar to next full day off (8h). `PTO_ACCRUAL_RATE = 0.0385 hrs/hour`.
  - **Confetti burst:** Electric green (#00FF00) from bottom on tab switch. Uses `canvas-confetti`.
  - **Haptic ticker:** `navigator.vibrate(10)` micro-click every cent earned (device-dependent).
  - **Overtime Overdrive:** If `totalHours > 40`, accent → gold (`text-yellow-400`), odometer `speed=1.5x`, shows "⚡ OVERTIME — 1.5× pay".
  - **Weekly total:** Summary glass card showing `$totalEarnings` + hours.
- **LootDrop.tsx** (pre-built) wired to clockOut:
  - On CLOCK OUT → darkens screen, 3D vault animation, falling coins (💵), floating PTO numbers, confetti.
  - Shows session earnings + PTO accrued + duration.
  - "✓ Deposited to your vault" settled state.
- **Props passed to Rewards:**
  - `totalHours` = weeklyHours + live session hours
  - `elapsedSeconds` = live timer
  - `isClockedIn`
  - `onFocus` (fires confetti)

### Desktop Glass Panel Removed
- Main content container no longer has `md:bg-[#12180F]/80 md:backdrop-blur-xl md:rounded-3xl md:p-12 md:border md:border-white/10 md:shadow-2xl`
- Clock view content ("Hi, Elon! Clock in?", time, CLOCK IN button) floats directly on black background
- Rewards view still has its internal glass cards (Earnings, PTO)

### Key Files Updated
| File | Change |
|------|--------|
| `src/App.tsx` | Added `view` state, `handleToggleClock` (triggers LootDrop on clockOut), Rewards + LootDrop imports, bottom nav onClick handlers, conditional rendering by view |
| `templates/index.html` | Regenerated single-file with Rewards + LootDrop bundled |
| `single.html` | Same as templates/index.html |
| `src/components/Rewards.tsx` | Pre-existing (Odometer, confetti, overtime, haptic) — no changes needed |
| `src/components/LootDrop.tsx` | Pre-existing (vault animation) — no changes needed |



### Preview
- Refresh `https://autoqa.teachx.ai/hackathon/preview/doesitworkday/`
- Tap 💵 → Rewards view with live odometers + confetti
- Tap ⏳ / 🏠 → Clock view
- CLOCK OUT → Loot Drop vault animation

### Color Note
- User confirmed: **#00FF00** electric green (not #CFF64E). Background #000000.
- All neon glows, button, confetti, progress bars use #00FF00.

---



### Greeting Text
- Changed from `"Hi, Elon! Clock in?"` → `"Hi, Elon."` (period, no exclamation, no "Clock in?")

### Clock Button Sizing
- Button was too tall, text didn't fit — fixed:
  - `py-12` → `py-8` (shorter)
  - `gap-3` → `gap-2` (tighter)
  - `w-full` kept for full width

### Bottom Nav Icon Fixes
- **Hourglass** (left): Was broken — fixed to proper shape (top/bottom bars + two V-triangles meeting at center + small center dot)
- **Dollar sign** (right): Was broken — fixed to proper $ (vertical line + two S-curve arcs + center circle)

### Active Tab Highlight
- Dollar sign (Rewards) icon now glows green when that tab is active
- Logic: `view === targetView` applies `glass-btn-green px-8 py-3 rounded-full -mt-2 scale-110 shadow-[0_0_40px_-4px_#00FF00]`
- All three icons (hourglass, house, dollar) highlight when active — not just center

### Odometer Slot Machine Aesthetic
- Earned Today and PTO odometers now look like mechanical slot machine reels:
  - Dark recessed window background: `rgba(10,12,18,0.9)` with inset shadow
  - Top gloss shine gradient: `from-white/25 to-transparent`
  - Bottom vignette shadow: `from-black/40 to-transparent`
  - Center horizontal gloss line across each digit
  - Rounded bezel frame border
- Spring-spin animation with blur during transitions (already present)

### Rewards Tab Scroll Fix
- Content was too tall, no scroll — added `overflow-y-auto` to main content container
- Users can now scroll the Rewards view (3 cards + weekly total)

### Bottom Nav Icon Redesign (Futuristic Minimal)
- All three icons redone with clean, thin, sci-fi aesthetic:
  - `strokeWidth="1.25"` (thin, precise)
  - Stroke-only, no fills (except tiny accent dots)
  - Geometric, minimal paths
- **Hourglass:** Top/bottom bars, two V-triangles meeting, center dot
- **House:** Clean roof V, square body, door line, dot at apex
- **Dollar:** Vertical line, two smooth S-arcs (Q-curves), center circle outline

### Logo Upload (Pending Integration)
- User uploaded `logo background removed.png` (2.1MB PNG)
- File exists at root but NOT yet wired into:
  - Favicon (currently still `public/favicon.svg`)
  - Intro splash logo (currently still inline SVG X-hourglass)
- **TODO for future agent:** Base64-encode PNG and replace SVG intro + favicon data URI in single-file build

### Key Files Updated
| File | Change |
|------|--------|
| `src/App.tsx` | Greeting text, button py-8/gap-2, fixed hourglass/dollar SVGs, active highlight logic, overflow-y-auto, new futuristic nav icons |
| `src/components/Odometer.tsx` | Added slot machine styling: dark bg, top shine, bottom vignette, center gloss, bezel frame |
| `templates/index.html` | Regenerated single-file |
| `single.html` | Same |






