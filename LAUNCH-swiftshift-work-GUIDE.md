# SwiftShift — Launch Guide: Connect swiftshift.work + Tighten Settings

Your app is live and healthy at **https://swiftshift-jh43.onrender.com**.
This guide points **swiftshift.work** at it and tightens a couple of settings.

- Your domain's DNS is managed at **Cloudflare** (that's where the changes happen).
- **Time:** ~10 minutes of clicking, then up to ~1 hour for the secure padlock to appear.
- As always: stuck on a step? Tell me the step number and what you see.

---

## Part A — Point swiftshift.work at Render

### Step 1 — Add the domains in Render (do this first)

1. Go to **render.com** → open your **swiftshift** service.
2. Click the **`Settings`** tab → scroll to **`Custom Domains`**.
3. Click **`Add Custom Domain`** → type **`swiftshift.work`** → **`Save`**.
4. Click **`Add Custom Domain`** again → type **`www.swiftshift.work`** → **`Save`**.

Render now lists both as **"unverified"** and shows the target to point to
(it will be **`swiftshift-jh43.onrender.com`**). Leave this tab open.

### Step 2 — Update DNS in Cloudflare

1. Go to **cloudflare.com** → log in → click **`swiftshift.work`** → open **`DNS`** → **`Records`**.
2. **Edit the existing root record** (the one currently sending the site to Railway — Type `A` or
   `CNAME`, Name `swiftshift.work` or `@`):
   - **Type:** `CNAME`
   - **Name:** `@`
   - **Target:** `swiftshift-jh43.onrender.com`
   - **Proxy status:** click the orange cloud so it turns **grey ("DNS only")**
   - **Save**
   - *(If Cloudflare won't let you change the type, delete that record and click `+ Add record`
     to create the CNAME above.)*
3. **Add the www record** — click **`+ Add record`**:
   - **Type:** `CNAME` · **Name:** `www` · **Target:** `swiftshift-jh43.onrender.com`
   - **Proxy status:** **grey ("DNS only")** · **Save**
4. If you see any **`AAAA`** records for `@` or `www`, **delete them** (Render doesn't use those).

> Why "DNS only" (grey cloud): it lets Render confirm the domain and issue the free HTTPS
> certificate. You can switch Cloudflare's proxy back on later if you want — just ask me first,
> because it needs one extra setting to avoid breaking HTTPS.

### Step 3 — Verify in Render

1. Back on the Render **Custom Domains** screen, click **`Verify`** next to each domain.
2. Wait a few minutes (occasionally up to an hour) until both show **"Verified"** and a certificate
   is issued.

### Step 4 — Test

Visit **https://swiftshift.work** — it should load your site with a secure 🔒 padlock.
(`www.swiftshift.work` should work too.)

---

## Part B — Tighten the settings

1. **Lock down CORS to your real domain.** I've already updated **`render.yaml`** so the app only
   accepts your real domains instead of "anyone." To apply it, **re-upload `render.yaml` to GitHub**
   (same as before: your repo → **`Add file`** → **`Upload files`** → drag **`render.yaml`** →
   **`Commit changes`** to `main`). Render will auto-redeploy with the tighter setting.
2. **HTTPS:** nothing to do — Render issues the certificate and forces HTTPS automatically.
3. **Debug off:** in Render → **`Environment`**, just confirm there is **no** variable named
   `FLASK_DEBUG` set to `1`. (It's off by default; only act if you see it set to 1.)

---

## ⚠️ Two things to know before you promote the site to real users

**1. Uploaded files don't persist on the free plan.**
The AI document feature saves uploads and its search index to the server's temporary disk, which
**resets every time the app restarts or redeploys.** Totally fine for testing. But if real users
upload documents they expect to keep, we'll need a small add-on (a persistent store — minor monthly
cost, or a code change to use free object storage). Tell me if that feature matters and I'll set it up.

**2. Two login-security fixes I'd recommend before real signups.**
I read your current `auth.py`. Two items stand out:
- **Password reset:** the "forgot password" step returns the reset link/token *directly in the
  response* instead of emailing it — so someone could reset another person's password.
- **Sessions:** signing in doesn't issue a real session token, so the API isn't strongly protected
  on the server side.

These are quick app-code fixes (not settings). I'd strongly suggest doing them before you advertise
the site. **Want me to fix both next?**

---

## When you're done

Tell me once the Cloudflare records are saved, and I'll confirm swiftshift.work is correctly pointed
at Render with a valid certificate. Also — did you set up the **UptimeRobot keep-warm** (Part 4 of the
first guide)? If not, add it so the site doesn't fall asleep.
