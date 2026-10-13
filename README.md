# Did I Lock? 🚪

A one-tap, pre-departure checklist for the people who keep wondering *"did I turn the stove off?"* halfway to work.

You tap each check (door, stove, iron, windows) in about 10 seconds, walk out the door, and **5 minutes later the app checks in on you** with *"Did you check everything?"* — so you can confirm, close the mental loop, and stop spiraling on the commute.

It's also an installable **PWA**: a service worker keeps it launchable, and **Web Push** delivers the follow-up even when the tab is closed. And it's built to be *wanted* for its looks: an animated aurora-glass interface with a light game layer (XP, levels, streak flame, confetti, sound) — see **Design system** below.

## Demo account (3 ways in)

The login page offers **three sign-in methods** — each restores the same demo data:

| Method | Details |
|---|---|
| 📧 Email + password | create your own account — free, unlimited |
| 📱 Phone OTP | `+91 98765 43210` — with a Twilio account configured a real SMS is sent; otherwise the 6-digit code is delivered as a **demo SMS** card in the app. 30s resend timer, 5-min code expiry, 5 wrong codes lock the code out. |
| 🔵 Google | With `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` set, this is a **real OAuth 2.0 flow** (auth code + PKCE-less server-to-server token exchange, redirect handled by `/auth/google/callback` and a one-time handoff token). Without credentials it falls back to a Google-style account chooser (simulated handshake, real account linking) — picking **Ash R.** links it to the demo account. |

**Forgot your password?** "Forgot password?" on the sign-in screen resets it via **phone OTP** — request a code to your linked number, enter it with the new password, done.

The demo account is seeded with a full checklist, two weeks of departure history (including two "went back" moments with notes), and an activity feed — so the app feels alive on first load.

## Run it

```bash
npm install
npm start          # http://localhost:3000
npm test           # API unit suite (node:test, isolated temp DB)
node test/ui.js    # full UI e2e in headless Chrome (needs the server running)
```

Stack: **Node.js + Express 5 + SQLite (better-sqlite3) + JWT + web-push**, with a dependency-free vanilla-JS SPA frontend. No build step.

## Design system — "Aurora Glass"

A hand-written design system (`public/styles.css`, no framework), rebuilt to be screenshot-worthy:

- **Identity** — cinematic aurora-night artwork (generated, consistent series in `public/img/`): a full-bleed aurora hero on the auth screen, a glass padlock celebration render, a dreamy-cloud empty state, and a 3D glow-lock app icon. UI palette is deep indigo → violet → teal aurora gradients on glass surfaces.
- **Living backdrop** — an animated aurora backdrop (four drifting gradient orbs + twinkling stars) sits behind the whole app; cards, topbar and sheets are frosted glass (`backdrop-filter`) floating above it.
- **Game feel** — checklist taps get a pop-and-draw tick + a tiny WebAudio click (zero audio assets, synthesized at runtime); finishing a checklist fires confetti + a success chime; every safe launch, check-in and streak day awards **XP** (floating `+25 XP` counter in the top bar) with **levels** (Newcomer → Gatekeeper → Guardian → Lock Legend → Aurora Master), a level-up fanfare, a streak-flame chip on the dashboard, and a level progress bar in the hero. Sound can be toggled off in Settings.
- **Light & dark themes** — full token-based dark palette (the aurora truly comes alive at night); top-bar sun/moon toggle + Settings switch, persisted, defaults to `prefers-color-scheme`.
- **Motion — calm profile (deliberate, never blocking)** — tick-draw checkbox (~200 ms), one-time progress glow at 100 %, a small confetti drift + soft shockwave on completion (sparser and slower since v1.1), fade-and-slide view transitions, staggered list entrances, a slow pulse on the schedule dot only while a check-in is pending, bell nudge when it lands. No looping animations anywhere (the hero sheen and streak flame were retired in v1.1); the aurora backdrop drifts over ~50 s cycles. All motion is disabled under `prefers-reduced-motion`.
- **Accessibility** — visible `:focus-visible` rings, AA contrast in both themes, 44 px touch targets, reduced-motion support, synthesized sounds only after a user gesture.
- **Guest mode ("Try it first")** — one tap explores the whole app with a local starter checklist; on sign-up the guest checklist and tasks merge into the new account automatically.
- **Google-Tasks-style Tasks module** — personal tasks with lists, due dates (Today/Tomorrow/overdue badges), notes and subtasks; satisfying circle completion, per-task detail editor, filter chips, mobile bottom tab bar, and a pending-tasks card on the dashboard.
- **Cinematic page backgrounds** — each view sits on its own photographic backdrop (home at dusk, rainy-window history, misty-mountain settings, aurora activity, sunrise tasks, interior checks) with frosted-glass cards above.
- **Retention surfaces** — XP/levels/streak flame, "This week" 7-day activity strip on the dashboard (tz-aware, from `/api/stats?week`), checklist **templates** (Home / Work / Travel / Night — preview then replace), **milestones** badges in Settings, and a **Share** row (Web Share API with clipboard fallback).

### Optional environment variables (all have graceful demo fallbacks)

| Variable | Effect when set |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Real Google OAuth 2.0 (authorization-code flow) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Real SMS delivery for phone OTP + password reset |
| `JWT_SECRET` | Token signing secret (otherwise one is generated and cached in `data/.secret`) |
| `PORT` | HTTP port (default 3000) |

## What's inside

- **Authentication** — sign in with **email + password** (scrypt-hashed, 30-day JWT sessions), **phone OTP** (request → verify; new numbers auto-create an account; cross-format tolerance — `98765 43210` and `+91 98765 43210` are the same account), **real or simulated Google OAuth** (first Google sign-in with a known email *links* to the existing account, otherwise it creates one). **Forgot password** via phone OTP. Rate limiting: 10 failed logins / 15 min per email (429), 5 wrong OTP codes locks the code out until resend (429). All data lives server-side against your account, so **signing back in — with any of the three methods — after any reinstall restores your checks, history and home zone**.
- **Push notifications** — two layers: (1) **Server-Sent Events** to open tabs (real-time follow-up modal + toasts), and (2) **Web Push** via a service worker + VAPID keys — the follow-up arrives as a system notification **even with the tab closed** (Chromium). Enable it in Settings → "Push notifications". The app is a fully installable PWA (manifest + icons + offline shell).
- **Dashboard** — hero "Start my check" flow with scheduled/due check-in indicators, live stats (this week, all-good rate, went-back count, **day streak computed in your timezone** via `?tz=`), a **7-day "This week" activity strip**, recent departures, activity feed — plus a proactive **"You're away from home — run a check?"** banner when GPS first crosses the home radius (once per visit, dismissible).
- **My checks (full CRUD + templates)** — add, edit (label + icon), delete, drag-to-reorder or arrow buttons. All optimistic with rollback. Start from **Home / Work / Travel / Night templates** (preview, then replace).
- **The 10-second check** — bottom-sheet checklist with progress bar, "Mark all", and a big *I'm leaving — lock it in* button. Times how long the ritual took.
- **The 5-minute follow-up** — a server-side scheduler flips each departure to `followup_pending` when its window passes and **pushes it in real time** over SSE *and* Web Push; you get a toast, a modal ("Did you check everything?"), and — if enabled — a system notification. You can answer *Yes, everything's good* or *I need to double-check* (re-open the checklist, add a note, log "went back").
- **Live location** — Geolocation API shows At-home / Away status, attaches live coordinates to the in-flight departure, and drives the away-from-home prompt. "Home" point and away-radius are configurable in Settings. Falls back to fully manual mode when location is unavailable.
- **Departures** — filterable history (all / all good / went back / pending), expandable per-item detail, notes, delete.
- **Activity** — every reminder and check-in result.
- **Settings** — profile, **dark-mode switch**, home point (manual or "Use GPS"), away radius, check-in delay (1–60 min), notification toggles, **EN / हिन्दी language switcher** (whole UI, persisted), **milestones**, **Share** row, push-enable row, a **preview of the follow-up nudge**, sign out, and delete account.
- **Polish** — empty states everywhere, skeleton loading states, optimistic updates with rollback, toasts, responsive layout (sidebar → slide-over + stacked grids on mobile).

## Project layout

```
server/
  db.js         schema, scrypt password helpers, demo seed
  data/         SQLite database + VAPID keys + JWT secret (created on first run)
  index.js      Express API + SSE + Web Push + follow-up scheduler + OAuth routes
public/
  index.html    auth screen (incl. forgot-password panel) + app shell
  styles.css    design system v2 — tokens, light/dark themes, motion (no framework)
  img/          custom illustrations (auth, success, empty state)
  app.js        SPA: routing, state, i18n (EN/हिन्दी), optimistic CRUD, SSE, geolocation, push
  sw.js         service worker: offline shell cache + Web Push wake-up
  manifest.webmanifest  PWA manifest (installable)
  icon-*.png / icon-*.svg   app + maskable icons
  handoff.html  OAuth handoff page (one-time token → app)
test/
  api.js        node:test API suite — 12 tests, isolated temp DB (npm test)
  ui.js         puppeteer end-to-end — 46 checks, full user flows
```

## API (all JSON, `Authorization: Bearer <token>` unless noted)

| Method & path | Purpose |
|---|---|
| `GET /api/health` · `GET /api/config` | health probe · feature flags (`push`, `googleOauth`, `sms`) |
| `POST /api/auth/register` · `POST /api/auth/login` | email + password (login rate-limited) |
| `POST /api/auth/phone/request` · `POST /api/auth/phone/verify` | phone OTP (`purpose: 'reset'` for resets; real SMS or in-app demo SMS) |
| `POST /api/auth/password/reset` | phone-code → new password |
| `POST /api/auth/google` | demo-mode Google sign-in / linking |
| `GET /auth/google` · `GET /auth/google/callback` · `POST /api/auth/google/handoff` | real OAuth flow + one-time handoff token |
| `GET/PATCH/DELETE /api/me` | profile, home zone, check-in settings (phone changes are conflict-checked) |
| `GET/POST /api/items` · `PATCH /api/items/:id` · `PATCH /api/items/reorder` · `DELETE /api/items/:id` | checklist CRUD |
| `GET /api/sessions` · `GET /api/sessions/active` · `POST /api/sessions` | departures (409 while one is active) |
| `POST /api/sessions/:id/followup` · `POST /api/sessions/:id/location` · `DELETE /api/sessions/:id` | resolve / track / delete |
| `GET /api/notifications` · `POST /api/notifications/read` | activity feed |
| `GET /api/stats?tz=<min>` | dashboard metrics (streak + last-7-day `week` array, in the client's timezone) |
| `GET /api/events` | SSE stream (`followup_due`, `notification`, `session_created`) |
| `GET /api/push/vapid` · `POST /api/push/subscribe` · `POST /api/push/unsubscribe` | Web Push (no auth on vapid; subscribe is upserted per endpoint) |

## Test

```bash
npm test           # 12 node:test API tests — register, login + rate limit, CRUD, session lifecycle,
                   #                OTP brute-force guard, password reset, OAuth linking, push upsert,
                   #                tz-aware stats, profile update, delete account
node test/ui.js    # 57 puppeteer checks — all three sign-in methods, wrong-password/429 paths,
                   #                dark-mode toggle, this-week strip, checklist CRUD + template preview,
                   #                departures, SSE follow-up modal, share/milestones, language switch,
                   #                forgot-password round-trip, mobile viewport
```

## Honest limitations

- **Web Push** works in Chromium-family browsers and requires the user to enable it in Settings; on iOS Safari the follow-up still arrives via in-app notifications/SSE when the app is open. A native shell (Capacitor) would add APNs/FCM for true offline mobile push.
- **SMS & Google** are real when the env vars above are configured; without them the app degrades to clearly-labelled demo equivalents (in-app "demo SMS" card, simulated Google chooser) so every flow stays testable.
- Location uses the browser Geolocation API; where it's denied the app degrades to manual "I'm leaving" mode, which is the primary flow anyway.
