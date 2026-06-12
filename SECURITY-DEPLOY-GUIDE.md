# SwiftShift — Security Update: Deploy Checklist

This deploys two things together: **(1)** real login sessions + the password-reset fix, and
**(2)** every personal-data endpoint now keyed to the logged-in user. They depend on each other,
so upload **all** of these in one sitting, then redeploy.

> I checked your live site: `https://swiftshift.work/api/users` currently returns data with **no
> login required** — so the security changes are not live yet. After this deploy, that same URL will
> return "authentication required" unless you're logged in. That's how you'll know it worked.

## What to upload (10 files, 3 folders on GitHub)

Upload in this order so there's no broken window. Each folder is its own commit.

**1 — repo ROOT** (replaces the existing file)
- `render.yaml`  → adds a `SECRET_KEY` (signs login cookies) and locks CORS to your domain.

**2 — the `backend` folder**
On GitHub, open the **`backend`** folder first, then Add file → Upload files:
- `app.py`   → sets the secure login cookie + requires login on all `/api` data routes.
- `auth.py`  → starts the session at sign-in/sign-up, adds logout, and stops leaking the reset token.

**3 — the `backend/routes` folder**
Open **`backend`** → **`routes`**, then Add file → Upload files, and drop all 7:
- `availability.py`, `clock_sessions.py`, `time_entries.py`, `timesheet_submissions.py`,
  `pto.py`, `shift_swaps.py`, `grok.py`

After the last commit, Render redeploys (~5–10 min).

## One-time step after it's live

**Log out and log back in.** Your browser has an old login saved but not the new secure cookie, so
data won't load until you re-login once. Brand-new visitors won't notice anything.

## What this fixes

- **Real login sessions** — signing in sets a secure, http-only cookie; all data endpoints require it.
- **No more reset-token leak** — "forgot password" no longer hands back the reset link.
- **Personal data is keyed to you** — timesheets, time clock, PTO balance/requests, availability,
  direct deposit, work schedule, and your Grok document/tax uploads now use *your* identity from the
  session. Nobody can read or change another person's data by swapping an id in the request.

## Still open (needs a "manager" role — I can build this next)

These are legitimate manager/admin actions, so I left them working rather than break them — but right
now **any** logged-in user can do them:

- Approve/deny PTO requests and accept/deny shift swaps.
- Edit or delete other users via the manager screens.
- The team/leaderboard list (`/api/users`) shows everyone's profile, including pay/salary, to any
  logged-in user.

The proper fix is a manager/admin role flag on each account, checked on these endpoints. Say the word
and I'll add it.

## Quick way to confirm it worked

After re-login, the app should load your data normally. To check the lock-down: open
`https://swiftshift.work/api/users` in a private/incognito window (not logged in) — it should now say
`{"error":"authentication required"}` instead of returning data.
