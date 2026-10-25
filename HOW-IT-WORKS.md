# 🧠 How "Did I Lock?" actually works

Two layers: what **you** experience, and what the **machine** does underneath.

---

## 1. The idea (one sentence)

You spend 10 seconds telling the app *"I checked everything"* before you leave — so that 5 minutes later, when the doubt hits, the app already knows the answer and closes the loop for you.

The app isn't really about doors. It's about **closing a mental loop at exactly the moment anxiety shows up** — which is always ~5 minutes into your commute, never at the door.

## 2. A ride through the app (what you do)

```
   YOU LEAVE IN 3 STEPS                     THE LOOP CLOSES ITSELF
┌─────────────────────────┐          ┌──────────────────────────────┐
│ 1. Tap "Start my check" │          │ 4. 5 min later: notification │
│ 2. Tap each item once   │  leave ➜ │    "Did you check            │
│    (door, stove, iron…) │          │    everything?"              │
│ 3. "I'm leaving"        │          │ 5. One tap: "All good ✅"    │
│    → confetti, +25 XP   │          │ 6. History & streak update   │
└─────────────────────────┘          └──────────────────────────────┘
```

- **Dashboard** — your "am I ready?" answer at a glance: the 3D door (locked = you're safe to go), streak flame, XP bar, this-week strip.
- **The checklist sheet** — one tap per item. The progress bar glows at 100%.
- **"I'm leaving — lock it in"** — the app records a *departure*: what you checked, when, where (if you allow location). The bolt slams. A timer starts.
- **The follow-up** — after your chosen wait (default 5 min), the app pings you: in-app, browser notification, or a real **Web Push** even when the tab/phone is closed. You answer "All good" or "I went back" (with an optional note — the demo account has two of those, because everyone has that one morning).
- **History (Departures)** — every departure is a card: date, what was checked/missed, your note. Filterable.
- **Activity** — the timeline of notifications: reminders, confirmations, tips.
- **Settings** — profile, home zone (coordinates + radius), the follow-up delay, push toggles, dark mode, sound, language (English/हिन्दी), milestones, share.

## 3. What happens under the hood (the machine)

This is a classic **client–server app**, small enough to understand end-to-end:

```
 YOUR PHONE / BROWSER                       SERVER (Node.js on Render)
┌──────────────────────────┐               ┌────────────────────────────┐
│ public/ (the PWA)        │  HTTPS + JWT  │ server/index.js (Express)  │
│  index.html   → shell    │ ◄───────────► │  /api/auth/…   login, OTP, │
│  app.js       → all UI   │               │                Google      │
│  styles.css   → design   │               │  /api/items    checklist   │
│  sw.js        → offline, │               │  /api/sessions departures  │
│     install, fast launch │               │  /api/stats    streaks,    │
│                          │               │                week, XP-able│
│  Service Worker +        │ ◄── Web Push ─│  /api/push     the nudges  │
│  Notifications API       │               │                            │
└──────────────────────────┘               │ server/db.js (SQLite)      │
                                           │  users, items, sessions,   │
                                           │  notifications, push subs  │
                                           └────────────────────────────┘
```

**Step by step, one "leave":**

1. **You tap an item** → nothing hits the server yet. The checklist sheet is instant because it lives entirely in your browser (that's why taps feel like a game).
2. **"I'm leaving"** → the browser sends one `POST /api/sessions` with your 7 checked items + timestamp + (optional) GPS coordinates. The server saves a **session** row in SQLite and immediately schedules the follow-up time.
3. **Scheduling** — the server keeps a live countdown for your session. When it expires it:
   - pushes an event over **SSE** (a live browser connection) → the app opens the follow-up card if you're looking at it, and
   - fires a **Web Push** through the browser's push service → reaches your locked phone. (Real SMS via Twilio works the same way for OTP codes.)
4. **You answer** → `POST /api/sessions/:id/followup` marks the session `confirmed_ok` or `went_back`, files a notification in your Activity feed, and updates your stats.
5. **Stats** → `GET /api/stats` computes your all-good rate, went-back count, current streak (timezone-aware, so midnight in India is midnight *for you*), and the 7-day "This week" strip.

**Why it's a PWA (installable app without an app store):** the *manifest* gives your phone a name + icon + fullscreen mode; the *service worker* caches the app shell so it launches offline-fast and can receive background pushes. One codebase → installs on Android and iPhone.

**Security basics:** passwords hashed (scrypt), logins issued a **JWT token**, every `/api/*` route checks it, location is stored only on your own account row, and rate-limiting slows down brute-force login/OTP attempts.

**The fun layer:** XP, levels, streaks, confetti and sounds live entirely in the browser (`app.js` + `styles.css`), cost zero server load, and respect your reduced-motion setting.

## 4. Where things live (file map)

| Path | What it is |
|---|---|
| `public/index.html` | The single page shell (login + app) |
| `public/app.js` | All UI logic, XP/game layer, WebAudio sounds |
| `public/styles.css` | The whole "Aurora Glass" design system |
| `public/sw.js` | Service worker — install/offline/push |
| `public/img/` | Generated aurora artwork |
| `server/index.js` | Express API + scheduler + push sender |
| `server/db.js` | SQLite tables + demo seed |
| `test/api.js` · `test/ui.js` | 12 API tests · 57 browser tests |

## 5. How updates ship

Edit files → GitHub Desktop shows the changes → **Commit** → **Push origin** → Render notices, rebuilds, and your live URL updates in ~2 minutes. That's the entire release process.
