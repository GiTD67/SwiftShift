# SwiftShift — Project Handoff / Current State

_Last updated: 2026-06-08_

A running record of how SwiftShift is built, hosted, and deployed, plus what's
done and what's still open. Start here.

## What it is
A gamified time-tracking / workforce web app: time clock, timesheets, PTO,
availability, direct deposit, shift swaps, jobs board, leaderboard, manager hub,
and a Grok-powered document/tax assistant.

## Stack
- **Frontend:** React + TypeScript + Vite (in `frontend/`). Built to `frontend/dist`,
  served by the backend. Styling: Tailwind + a custom "liquid glass" CSS system.
- **Backend:** Python Flask + gunicorn (in `backend/`), served at `/api/*`; also
  serves the built frontend SPA.
- **Database:** PostgreSQL via `DATABASE_URL` (psycopg2).
- **AI:** xAI / Grok via `XAI_API_KEY` (per-user document RAG uses ChromaDB +
  local file storage under `backend/s3/<user_id>/`).

## Hosting (current)
- **App:** Render — Docker web service, **free** plan. Live URL:
  `https://swiftshift-jh43.onrender.com`.
- **Database:** Neon — serverless Postgres, **free** plan.
- **Keep-warm:** UptimeRobot pings `/api/health` every 5 min so the free instance
  doesn't sleep.
- **Domain:** `swiftshift.work` on **Cloudflare** (DNS-only / grey cloud) →
  CNAME to `swiftshift-jh43.onrender.com`. `www` CNAME to the same. TLS by Render.
- **Cost:** $0/mo.
- **Previously:** Railway (30-day trial expired June 2026 → migrated off).

## Deploy workflow
Push to GitHub `main` → **Render auto-deploys**. (Same one-step flow as before;
the target is Render now, not Railway.) Build is defined by `Dockerfile`
(Node builds the frontend, Python serves it); config in `render.yaml`.

## Environment variables (set in Render)
- `DATABASE_URL` — Neon connection string (pooled).
- `XAI_API_KEY` — xAI / Grok key.
- `ALLOWED_ORIGINS` — `https://swiftshift.work,https://www.swiftshift.work`.
- `SECRET_KEY` — signs login-session cookies (Render generates via `render.yaml`).
- `WEB_CONCURRENCY` — `1` (fits the free 512 MB instance).
- `PORT` — set automatically by Render.

## Files added during the migration / hardening
- `Dockerfile`, `.dockerignore`, `render.yaml` — Render deploy config.
- `DEPLOY-TO-RENDER-GUIDE.md`, `LAUNCH-swiftshift-work-GUIDE.md`,
  `SECURITY-DEPLOY-GUIDE.md` — step-by-step guides.
- Security update: `backend/app.py`, `backend/auth.py`, and the personal-data
  route files in `backend/routes/`.
- `frontend/src/animated-bg.css` + `frontend/src/main.tsx` — subtle ambient
  background motion on the Default appearance.

## Security model (after the security deploy)
- **Login sessions:** sign in/up sets a secure, http-only session cookie; a
  `before_request` guard in `app.py` requires it on all `/api/*` data routes
  (public: `/api/health`, `/api/auth/*`, `/api/kalshi/*`).
- **Per-user identity:** timesheets, time clock, PTO, availability, direct
  deposit, work schedule, and Grok uploads derive identity from `session["uid"]`
  — a client can't read/modify another user's data by changing an id.
- **Password reset:** the reset token is no longer returned by the API.

## Still open (recommended next steps)
1. **Manager/admin role.** These are still allowed for ANY logged-in user:
   approve/deny PTO + shift swaps, edit/delete other users, and the team list
   (`/api/users`) exposes everyone's profile incl. pay/salary. Add an
   `is_manager`/role flag and gate these endpoints.
2. **Email delivery for password reset.** The reset flow creates a token but no
   longer returns it; wire up an email provider (e.g. Resend) to actually send
   the link.
3. **Persistent storage for Grok uploads.** On Render free the disk is ephemeral,
   so uploaded documents + the Chroma index reset on each restart/redeploy. Move
   to object storage (e.g. Cloudflare R2) or a paid disk if that feature matters.
4. **Cost/perf:** free tier sleeps (keep-warm mitigates) and has no persistent
   disk. Upgrading Render (~$7/mo) removes cold starts and enables a disk.

## Automation
- **Nightly improvements:** `.github/workflows/nightly-improve.yml` runs ~30
  agents at 03:00 MT to find + fix issues and auto-push to `main` (gated on
  build/lint/test; security invariants protected).
- **On-demand:** comment `@claude` on a GitHub issue/PR (`claude.yml`); PRs get an
  automated review (`claude-code-review.yml`).
- **Local chat:** double-click `Talk to Claude (SwiftShift).command` to open a
  terminal Claude Code session in this folder (auto commit + push → Render deploy).

## Notes
- `CLAUDE.md` is the working agreement for the coding agent (local-only; gitignored).
- Local working copy may sit behind `origin/main`; the live site always builds
  from GitHub `main`.
