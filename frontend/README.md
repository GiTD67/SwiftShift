# SwiftShift Frontend

**Project:** SwiftShift — The Workday Killer  
**Team:** DoesItWorkday  
**Members:** tdixon@teachx.ai, shsingh@teachx.ai

---

## Overview

SwiftShift is an xAI enterprise HR platform — the Workday killer. This React + TypeScript frontend delivers a full HR suite: one-tap clock in/out, 14-day timesheets, AI assistant (Grokky), jobs posting, admin panel, and more. Zero 47-click workflows. Zero training manuals.

The mission: **precision attendance, intelligent insights, zero friction.** Built with cosmic glassmorphism (iOS 26 Liquid Glass) on pure black with neon green accents.

---

## Directory Structure

```
frontend/
├── src/
│   ├── components/       # All React components (.tsx) — ONE FILE PER COMPONENT
│   │   ├── ClockWidget.tsx
│   │   ├── QuickAdd.tsx
│   │   ├── EntryRow.tsx
│   │   ├── WeeklyGrid.tsx
│   │   ├── Summary.tsx
│   │   ├── Timeline.tsx
│   │   ├── Rewards.tsx
│   │   ├── Vault.tsx
│   │   ├── LootDrop.tsx
│   │   └── Odometer.tsx
│   ├── hooks/            # Custom React hooks (.ts)
│   │   ├── useClock.ts
│   │   └── useTimesheet.ts
│   ├── utils/            # Pure utility functions (.ts) + tests (.test.ts)
│   │   ├── format.ts
│   │   ├── format.test.ts
│   │   ├── sampleData.ts
│   │   └── sampleData.test.ts
│   ├── types.ts          # Shared TypeScript interfaces (TimeEntry, ClockState, etc.)
│   ├── App.tsx           # Main app (sidebar nav, 12 views, auth gates, API calls)
│   ├── main.tsx          # React root + Toaster
│   ├── App.css
│   └── index.css         # Master aesthetic styles (glass, neon, crystal, iOS 26)
├── public/               # Static assets (logo.png, favicon.svg)
├── templates/            # Deployment templates (single-file build)
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

**IMPORTANT:** Strictly follow this structure.
- All components go in `src/components/` — one component per file.
- All hooks go in `src/hooks/` — named `useXxx.ts`.
- All utilities go in `src/utils/`.
- All shared types go in `src/types.ts`.
- App.tsx contains all views (clock, timesheet, rewards, admin, profile, orgchart, etc.) inline.
- Do NOT create new top-level folders under `src/` without team agreement.

---

## Code Conventions

When adding new code to this project:

- Create TS/JS files inside `src/`
- If a file exceeds 500 lines, break it into smaller files stored in `components/{component_name}/`

---

## How to Run

### Development
```bash
cd frontend
npm install
npm run dev
```

The dev server runs on **port 8000** (configured in `vite.config.ts`).

### Build
```bash
npm run build
```

Outputs to `frontend/dist/` (served by Flask backend at `/`).

### Preview Production Build
```bash
npm run preview
```

Also runs on port 8000.

### Run Tests
```bash
npm test
```

Uses Vitest.

---

## Tech Stack

- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite 5
- **Styling:** Tailwind CSS 3 + custom glassmorphism (index.css)
- **Animations:** Framer Motion
- **Date Handling:** native Date + ISO strings
- **Toasts:** Sonner
- **Confetti:** canvas-confetti
- **API:** fetch to Flask backend (clock-sessions, grok/chat, users, jobs)
- **Testing:** Vitest + jsdom

---

## Components

All components are in `src/components/` (reusable UI widgets):

| Component | Purpose |
|-----------|---------|
| `ClockWidget.tsx` | One-tap clock in/out button with live timer. Green glass button when clocked out, elapsed timer + clock out when clocked in. |
| `QuickAdd.tsx` | Quick time entry form (Cmd/Ctrl+K). Selects project, task, times, description. |
| `EntryRow.tsx` | Displays a single time entry with edit/delete controls. |
| `WeeklyGrid.tsx` | Weekly calendar grid showing entries per day. |
| `Summary.tsx` | Weekly hours total with progress bar vs 40h goal. Shows overtime status. |
| `Timeline.tsx` | Monthly calendar heatmap with hours per day. Hover shows popup. |
| `Rewards.tsx` | Earnings calculator (hourly rate × hours). Live earnings with confetti on milestones. Includes **Gork's Prediction Markets** powered by Kalshi API — stake paychecks on real-world events (sports, crypto, politics, AI). |
| `Vault.tsx` | Document storage UI (paystubs, tax forms, benefits, contracts). |
| `LootDrop.tsx` | Confetti celebration modal when clocking out. Shows earnings + PTO accrued. |
| `Odometer.tsx` | Mechanical flip-digit counter used for numbers (hours, dollars). |

**Note:** The main app UI (sidebar nav, views, auth pages) lives in `App.tsx` (inline components). These reusable widgets are imported where needed.

---

## Views (in App.tsx)

| View | Purpose |
|------|---------|
| `clock` | Time Clock dashboard: greeting, live clock, clock in/out + break controls, 8h target ring with confetti, streak counter |
| `timesheet` | 14-day pay period grid with editable hours, regular/OT calc, certification + submit |
| `rewards` | Earnings calculator (hourly × hours) + **Gork's Prediction Markets** powered by Kalshi API — stake on sports, crypto, politics, AI |
| `insurance` | Insurance & Benefits view (placeholder UI) |
| `orgchart` | Interactive Organization Chart tree with expand/collapse, search, team size |
| `taxes` | Files view for tax forms, paystubs, etc. (Vault integration) |
| `groktax` | Grok Tax AI assistant for tax questions |
| `applications` | 1 Click Apply For Jobs (job browsing + quick apply) |
| `jobs` | Post a Job form (description, salary, location, expiry) |
| `admin` | Admin panel: list/edit users (job_role, manager_name, pay, salary) via `/api/users` |
| `grokky` | Grokky AI Assistant chat (calls `/api/grok/chat` with xAI Grok-3-mini-fast) |
| `profile` | User profile info (from localStorage user) |

**Auth pages:** `LoginPage` and `SignupPage` render when unauthenticated (premium xAI portal style).

---

## Hooks

| Hook | Purpose |
|------|---------|
| `useClock.ts` | Manages clock in/out state, live elapsed timer, localStorage persistence. |
| `useTimesheet.ts` | Manages time entries (add/update/delete), sample data seeding. Calls backend APIs on mount. |

**Note:** App.tsx also manages significant state inline (clock, streak, chat, org chart, pay periods) and calls backend APIs directly via fetch.

---

## Utilities

| File | Purpose |
|------|---------|
| `utils/format.ts` | `formatDuration`, `calculateDuration`, `formatTime`, week date helpers. |
| `utils/sampleData.ts` | Generates sample TimeEntry records for demo. |

---

## How to Add New Code

### Adding a Component

1. Create `src/components/YourComponent.tsx`
2. Export a named function: `export function YourComponent(props: YourProps) { ... }`
3. Use Tailwind + existing glass/neon CSS classes from `index.css`
4. Follow the cosmic glassmorphism aesthetic (see Design Aesthetic below)
5. Use hooks from `src/hooks/` for state/logic
6. Import shared types from `src/types.ts`

### Adding a Hook

1. Create `src/hooks/useYourHook.ts`
2. Export: `export function useYourHook() { ... }`
3. Use React hooks (`useState`, `useEffect`, `useCallback`) internally
4. Persist to `localStorage` if state should survive reloads (follow `useClock.ts` pattern)
5. Return `{ state, actions }` object for consumers

### Adding a Utility

1. Create `src/utils/yourUtil.ts` (and optional `yourUtil.test.ts`)
2. Keep functions pure — no React, no side effects except I/O helpers
3. Export named functions; add Vitest tests if non-trivial

**Strictly follow:** one component per file, hooks named `useXxx.ts`, no new `src/` folders without team agreement.

---

## Data Types (`src/types.ts`)

- `TimeEntry` — id, date, project, task, startTime, endTime, duration (min), description
- `ClockState` — isClockedIn, clockInTime, lastActionTime
- `TimesheetState` — entries[], clock, submitted

**App.tsx inline types:**
- `View` — union of 12 views: clock | timesheet | rewards | admin | profile | insurance | orgchart | taxes | groktax | grokky | applications | jobs
- User object from `/api/auth/signin` — id, first_name, last_name, email, job_role, manager_name, etc.

---

## Design Aesthetic

- **Background:** Pure black (#000000) — deep space canvas
- **Accent:** Electric neon green (#00FF00 / #D7FE51) — all glows, buttons, active states
- **Glass:** `.glass` panels with inner glows, neon edge refraction, specular highlights (iOS 26 Liquid Glass)
- **Typography:** Inter / SF Pro geometric sans-serif
- **Layout:** Left sidebar nav, top navbar with brand + user (streak counter, theme switcher, logout)
- **Auth Pages:** Premium xAI/SpaceX portal style — radial grid, shockwave ripples, glowing control panels
- **Views:** 12 views accessible via sidebar: Time Clock, Timesheet, Rewards, Insurance & Benefits, Organization Chart, Files, Grok Tax, 1 Click Apply, Post a Job, Admin, Grokky AI Assistant

---

## Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main app: auth gates (LoginPage/SignupPage), sidebar nav, 12 views (clock, timesheet, rewards, admin, profile, orgchart, grokky, jobs, etc.), API calls to backend, streak counter, theme switcher |
| `src/main.tsx` | React root render + Sonner Toaster |
| `src/index.css` | Master aesthetic styles (glass, neon, crystal, iOS 26 Liquid Glass) |
| `vite.config.ts` | Dev server on port 8000, base path `/hackathon/preview/doesitworkday` |
| `single.html` | Single-file build source (for proxy deployment) |

---

## Deployment Note

The production build is served via Flask backend at `/hackathon/preview/doesitworkday/` on `autoqa.teachx.ai`. The app is built to `dist/` and served statically with SPA fallback.

Preview URL: `https://autoqa.teachx.ai/hackathon/preview/doesitworkday/`

**Auth flow:** Unauthenticated users see LoginPage/SignupPage. After signin, localStorage stores user and app renders full HR suite. Logout clears localStorage and redirects to login.

---

## Scripts Reference

| Script | Command |
|--------|---------|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Preview | `npm run preview` |
| Test | `npm test` |

**Note:** Backend must be running on port 8000 for full functionality (API calls to /api/*). Frontend dev server also uses 8000 — run one at a time or use different ports.
