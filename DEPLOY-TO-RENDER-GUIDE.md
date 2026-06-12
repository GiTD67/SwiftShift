# SwiftShift → Free Hosting (Render + Neon): Click-by-Click Guide

This moves your site off Railway and onto **Render** (runs the app, free) + **Neon**
(hosts the database, free) + **UptimeRobot** (keeps it awake, free).

- **Cost:** $0. No credit card required for any of the three.
- **Time:** about 30–40 minutes, most of it waiting for the first build.
- **Order:** GitHub → Neon → Render → UptimeRobot. Do them top to bottom.
- **If you get stuck on any step**, tell me the step number and what you see on screen, and I'll get you unstuck.

---

## Before you start — grab two things

1. **Your GitHub login** — the account that owns SwiftShift (GiTD67).
2. **Your xAI / Grok API key.** To find it: go to **railway.com**, open your **SwiftShift**
   project, click the **Variables** tab, and copy the value next to `XAI_API_KEY`.
   (The service is paused, but you can still see this.) Keep it handy — you'll paste it once, in Part 3.

---

## Part 1 — Put the two new files on GitHub  (~5 min)

I created two files in your SwiftShift folder — **`Dockerfile`** and **`render.yaml`**.
They need to be on GitHub so Render can use them.

1. Go to **github.com** and sign in.
2. Open your repo: **github.com/GiTD67/SwiftShift**
3. Above the file list (top-left), make sure the branch button says **`main`**.
4. Click the **`Add file`** button (top-right of the file list) → choose **`Upload files`**.
5. Open a **Finder** window → go to **Documents → SwiftShift**.
6. Drag **`Dockerfile`** and **`render.yaml`** from Finder into the upload area on the GitHub page.
7. Scroll down. Leave **"Commit directly to the `main` branch"** selected, then click the green **`Commit changes`** button.

✅ You should now see `Dockerfile` and `render.yaml` in your repo's file list.

> *Optional tidy-up:* there's also a hidden file named **`.dockerignore`**. It's optional — the
> app deploys fine without it. To include it anyway: in Finder press **Shift + Command + Period**
> to show hidden files, then repeat steps 4–7 and also drag `.dockerignore`.

---

## Part 2 — Create your free database on Neon  (~5 min)

1. Go to **neon.tech** → click **`Sign up`** → choose **`Continue with GitHub`** and approve.
2. It asks you to create a project:
   - **Project name:** `SwiftShift`
   - **Postgres version:** leave the default
   - **Database name:** leave the default (e.g. `neondb`)
   - **Region:** pick the one closest to you
   - Click **`Create project`**.
3. On the project page, click the **`Connect`** button (near the top).
4. A box appears with a **connection string** — a long line starting with `postgresql://`.
   If there's a dropdown, choose **`Pooled connection`**.
5. Click the **copy icon** to copy it, and paste it into a temporary note — you'll need it in Part 3.

> ⚠️ That string contains your database password. Keep it private (don't post it anywhere public).

---

## Part 3 — Deploy on Render  (~10 min + build time)

1. Go to **render.com** → **`Get Started`** / **`Sign in`** → choose **`GitHub`** and approve.
2. If Render asks which repositories it can access, choose **`Only select repositories`** and pick
   **`SwiftShift`**, then approve.
3. In the Render dashboard, click **`New +`** (top-right) → choose **`Blueprint`**.
4. Find **`SwiftShift`** in the repo list → click **`Connect`**.
5. Render reads your `render.yaml` and shows a blueprint to create:
   - **Blueprint/Service name:** `swiftshift` (fine as-is)
   - **Branch:** `main`
6. Render prompts you for two secret values — paste them in:
   - **`DATABASE_URL`** → the Neon connection string you copied in Part 2
   - **`XAI_API_KEY`** → your xAI / Grok key from "Before you start"
7. Click **`Apply`** / **`Deploy Blueprint`**.
8. Render now builds your app. **The first build takes about 5–10 minutes** (it builds the website
   and installs everything). Scrolling logs are normal.
9. When it finishes, the status turns green (**`Live`**) and a URL appears near the top, like
   **`https://swiftshift.onrender.com`**.
10. Click that URL — **your SwiftShift site should load.** 🎉
    (The very first open can take ~30–60 seconds while the free server wakes up. Part 4 fixes that.)

> **If the build turns red (failed):** don't worry. Copy the last ~20 lines of the red log text,
> paste them to me, and I'll give you the one-line fix. The usual cause is a small typo in one of
> the two pasted values.

---

## Part 4 — Keep it awake (the "keep-warm" ping)  (~5 min)

Free Render apps fall asleep after 15 minutes with no visitors. A free pinger keeps yours awake.

1. Go to **uptimerobot.com** → sign up (free).
2. Click **`+ New monitor`** (or **`Add New Monitor`**).
3. Set:
   - **Monitor Type:** `HTTP(s)`
   - **Friendly Name:** `SwiftShift`
   - **URL:** your Render URL **plus `/api/health`**, e.g.
     `https://swiftshift.onrender.com/api/health`
   - **Monitoring interval:** `5 minutes`
4. Click **`Create Monitor`**.

✅ It now pings every 5 minutes, so the site stays awake. (Bonus: it'll email you if the site ever goes down.)

---

## Part 5 — Wind down Railway  (optional, ~2 min)

Once Render is working:

- **Easiest:** just ignore Railway. With no credit card on file, the trial lapses and never charges you.
- **Tidy:** log into **railway.com** → SwiftShift project → **Settings** → **Delete project**.
  Only do this *after* Render works. (Nothing to save — the site has no live data yet.)

---

## When you're done, tell me:

- Your new Render URL (the `…onrender.com` one) and whether the site loaded.
- If anything turned red, or a button wasn't where I described — which step, and what you saw.

**Good news for later:** your old workflow still works — editing the site and saving to GitHub's
`main` branch will now auto-deploy to **Render** instead of Railway. And when you're ready to launch,
we'll point **swiftshift.work** at Render and tighten a couple of settings. Just say the word.
