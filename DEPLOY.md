# 🚀 Publishing "Did I Lock?" — from this folder to the world

Three stages, in order. Each one makes the app reachable by more people.
Total cost to reach the **Google Play Store**: ~₹2,200 (one-time). iOS later: ₹8,300/year.

---

## Stage 1 — Put the web app online (do this first, ~30 minutes)

The web app **is** the product — it's an installable PWA. Once it's on HTTPS, anyone can
install it from Chrome: **⋮ → Add to Home screen**. Push notifications, location, and
offline launch all work. Everything else (Play Store) is a wrapper around this.

### 1. Push the code to GitHub

```bash
cd did-i-lock
git init
git add -A
git commit -m "Did I Lock? v1 — Aurora Glass"
# create an empty repo named did-i-lock on github.com first, then:
git remote add origin https://github.com/<your-username>/did-i-lock.git
git branch -M main
git push -u origin main
```

> `data/` is git-ignored — your demo DB and secret keys stay local. Fresh servers auto-seed.

### 2. Deploy on Render

**Option A — ₹0 Free plan (no card needed; perfect for testing & first users):**
1. **render.com** → sign up **with GitHub** → authorize access to your repo.
2. **New + → Web Service** (NOT Blueprint — the blueprint includes a paid disk).
3. Pick **ANIRUTH-7/did-i-lock**.
4. Render pre-fills most fields; make sure:
   - **Runtime:** Node
   - **Build Command:** `npm install --omit=dev`
   - **Start Command:** `npm start`
   - **Instance Type:** **Free**
5. Under **Advanced → Add Environment Variable**: key `PUPPETEER_SKIP_DOWNLOAD`, value `1`.
6. **Create Web Service** → first build ~5 min → you get `https://did-i-lock.onrender.com`.

Free-plan honesty (fine for now, upgrade when you have real users):
- **Sleeps after ~15 min idle** → first visitor waits ~50 s for the wake-up.
- **Storage is temporary** → user accounts & history reset on every redeploy (and the
  demo seed re-creates itself). Push subscriptions reset too.
- When you're ready for real users: upgrade to Starter ($7/mo) + add a 1 GB disk mounted
  at `/var/data`, set `DIL_DATA_DIR=/var/data` — data then survives forever.
- **Session secret:** set `JWT_SECRET` to a long random string so logins survive redeploys
  (without it, tokens are re-signed with a fresh secret each boot and users must log in again).
- **Keep-alive:** free plans sleep after ~15 idle minutes; a free UptimeRobot ping on
  `/api/health` every 5 minutes keeps scheduled follow-up pushes on time.
- **Client IPs behind proxies (verify once after deploying):** the limiter walks `X-Forwarded-For`
  from the LAST hop backwards, skipping private ranges — correct when Render appends the real
  visitor last, and immune to an extra internal hop after it. To confirm on YOUR deployment:
  open `https://YOUR-URL/api/whoip` from your phone on MOBILE DATA, then on HOME WIFI. The `ip`
  must differ between the two. If both show the same (private) IP, tell the app owner — the proxy
  chain is unusual and the picker needs a tweak. Limit constants live in `server/index.js`
  (`hitBucket` calls) if you ever need to tune them.

**Option B — Starter plan with persistent disk (₹600/mo, for real users):**
Use **New + → Blueprint** — Render reads `render.yaml` (disk, region, secret) automatically.


### 3. Custom domain (optional but worth it)

Buy a domain (~₹800/yr on Namecheap/Cloudflare, e.g. `didilock.app`) → in Render:
*Settings → Custom Domains* → add it, point the DNS `CNAME` as instructed. HTTPS is automatic.

### 4. First real test — your own phone

Open the URL on Android Chrome → **Add to Home screen** → launch it like an app →
run a check → lock the phone → the 5-minute push should arrive (accept the notification
permission when asked).

> **iOS note:** iPhone users must install to the Home Screen (Share → Add to Home Screen)
> for push to work — Safari doesn't allow web push from inside a tab.

### 5. Turn on the real integrations (all optional, graceful fallbacks today)

| Feature | Where to get keys | What to do |
|---|---|---|
| Real Google sign-in | console.cloud.google.com → *OAuth client* (Web) | Set `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`; authorized redirect: `https://your-domain/auth/google/callback` |
| Real SMS OTP | twilio.com (buy an Indian-capable number or use their sender ID) | Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` |
| Push notifications | nothing to buy — VAPID keys auto-generate on first boot into the data dir | none |

---

## Stage 2 — Google Play Store (~₹2,200 once, a few hours)

Publish the PWA as a **Trusted Web Activity (TWA)** — a real Play Store app that opens your
site in full screen with no browser UI. PWABuilder does the heavy lifting.

1. **Google Play Developer account** — play.google.com/console, one-time $25 (~₹2,200).
2. Go to **pwabuilder.com** → paste your deployed URL → *Package for Android*.
   It will score your manifest (this app passes: icons, maskable icon, standalone display, name ✓).
3. Download the `.aab` / `.apk` bundle. PWABuilder also shows you a **`assetlinks.json`**
   snippet — serve it. Easiest way: put the file in `public/.well-known/assetlinks.json`
   on your server so it's live at `https://your-domain/.well-known/assetlinks.json`.
4. Play Console → *Create app* → upload the `.aab` → fill the store listing:
   - **Title:** Did I Lock? — door & stove checks
   - **Short description:** A 10-second pre-departure checklist with a 5-minute check-in.
   - **Screenshots:** you already have them in `shots-review/` (use the phone-sized one)
   - **Privacy policy URL:** *required by Google* — host a simple page (see below)
5. Internal testing track first: add 10–20 friends as testers, iterate, then promote to
   production.

### Privacy policy (Play requires it even for free apps)

State: what you store (account, checklist items, departure history, home coordinates, push
tokens), that you never sell data, that location stays on the user's own account, and a
contact email. I can generate a `/privacy` page in the app if you want — ask.

---

## Stage 3 — Apple App Store (₹8,300/year — only after Android proves out)

Apple requires a native shell and a build on macOS:

1. **Apple Developer account** ($99/yr).
2. Wrap the app with **Capacitor** (`npm i @capacitor/core @capacitor/cli` → `npx cap init`)
   pointing `server.url` at your deployed site — the whole UI is already mobile-perfect.
3. For push inside the wrapper, later swap Web Push → FCM/APNs via Capacitor Push plugin.
4. Build via Xcode (needs a Mac) or a CI service (Codemagic free tier builds iOS without one).
5. Submit through App Store Connect; review takes 1–3 days.

---

## What I'd do this week (the 80/20 order)

1. ✅ GitHub push → Render deploy with disk (30 min) — **the app is now globally installable**
2. ✅ Install it on your own phone, run one real departure (today)
3. ✅ Buy the domain, connect it (1 hr)
4. ✅ Share the link with 10 friends; watch them use it (free user research)
5. ⬜ Register the Play developer account, package via PWABuilder, submit to *Internal testing*
6. ⬜ Add a privacy policy page
7. ⬜ Only then: iOS

## Production notes (small but important)

- **Backups:** the disk holds `didilock.db`. Turn on Render disk snapshots, or add a nightly
  cron that copies the file to object storage.
- **Scaling:** SQLite is perfect up to thousands of users on one node. If you ever need
  multiple server instances, move to Postgres first.
- **Demo data (opt-in):** set `DIL_SEED_DEMO=1` on personal/demo installs to seed the demo
  account on first boot — credentials are printed to the server log, never published. Do NOT
  set it on a production deploy.
- **Service worker cache** is versioned (see `public/sw.js`); bump that string in
  `public/sw.js` whenever you ship visual changes so returning users get the update.
