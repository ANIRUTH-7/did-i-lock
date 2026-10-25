# 💼 BUYER-GUIDE.md — what you're buying (or selling)

**"Did I Lock?"** is a feature-complete, security-hardened (v1.5.13), installable web app (PWA) that solves a universal problem — *"did I lock the door / turn off the stove?"* — with a 10-second pre-departure checklist and an automatic 5-minute check-in that closes the mental loop. It ships as a complete, tested, white-label-ready codebase.

---

## Why this product is sellable

- **Universal pain, zero education needed** — everyone knows the 3 PM door-doubt. The login page explains it in one screen.
- **Not "another to-do app"** — the timed check-in loop (scheduled server-side, delivered via Web Push even when the phone is locked) is a real mechanism, not a checklist skin.
- **Screenshot-first design** — aurora-glass dark mode, a 3D front door that bolts shut when you leave, confetti-and-sound completion, XP/levels/streaks. Marketing writes itself.
- **Runs anywhere for ~$7/mo** — no app-store fees to launch; Play Store optional (TWA via PWABuilder), iOS via home-screen install.

## What's included

| | |
|---|---|
| **Full source** | Vanilla-JS SPA frontend (no framework, no build step) + Node/Express 5 + SQLite backend |
| **Design system** | "Aurora Glass" — light & dark themes, motion profile, all CSS variables documented |
| **Original AI artwork** | Login hero, success render, empty state, full icon set (master + 192/512/maskable + SVG) — regenerate or keep |
| **3 auth methods** | Email+password (scrypt), Phone OTP (Twilio-ready, in-app demo SMS fallback), Google OAuth 2.0 (code flow) |
| **The engine** | Departure sessions, server-scheduled follow-ups, SSE live events, Web Push, tz-aware streaks, weekly stats |
| **Retention layer** | XP, 5 levels, streak flame, milestones, 5 routine templates, shareable streak card (canvas-generated PNG) |
| **Quality gates** | 16 API integration tests + 76 browser e2e checks — all passing; two independent security audit rounds, all findings fixed & regression-tested |
| **Honest scope** | PWA evaluates location while open (foreground) + server-scheduled follow-up push; continuous background geofencing would need a native app — priced accordingly |
| **Ops kit** | `render.yaml` (one-click deploy), `Dockerfile`, `.env.example`, `DEPLOY.md`, `HOW-IT-WORKS.md`, `REBRAND.md`, `API.md` |

## Buyer launch path (about 1 hour to live under your brand)

1. **Deploy** — Render/Railway/Fly/Docker (`DEPLOY.md`, ~15 min)
2. **Rebrand** — `REBRAND.md` checklist: ~6 files of text + optional art swap (~45 min)
3. **Keys** — Google OAuth + Twilio (optional; demo fallbacks work without them)
4. **Persist** — attach a disk to `DIL_DATA_DIR` (~$7/mo tier) so accounts survive redeploys
5. **Verify** — run the test suites, install on a phone, done

## Honest limits (disclosed up front)

- Free-tier hosting wipes local storage on redeploy — the paid disk tier is the production config (documented).
- SQLite is single-node; comfortable for thousands of users, Postgres migration is the documented path beyond that.
- Phone OTP needs a Twilio account for real SMS (demo mode otherwise); Google login needs API keys (chooser fallback otherwise).
- No billing/paywall inside yet — a buyer adding subscriptions owns 100% of the upside.
- iOS = home-screen PWA (push requires Add-to-Home-Screen, iOS 16.4+); native App Store wrapper (Capacitor) is a straightforward follow-up, not included.

## Dependency licensing

All runtime dependencies (express, better-sqlite3, jsonwebtoken, web-push, sharp) are MIT/ISC — **commercial use, modification and resale are permitted with no obligations beyond retaining their license notices**. All artwork in `/public/img` was AI-generated for this project and transfers with it.

## Suggested demo script (10 minutes)

1. Login screen (aurora art) → create your own account (email + password), or sign in with Google if the host configured OAuth keys
2. Toggle dark mode — this is the "people install it for the UI" moment
3. Start a check → tap items with sound on → watch the ring fill → "lock it in" → door bolts, confetti, +25 XP
4. Let the 5-minute push arrive on a real phone → answer "All good" → streak updates
5. Settings → Streak card → share the generated PNG
6. Show `HOW-IT-WORKS.md` + passing tests → close

---

## Security posture (v1.5.13)

Audited and fixed — the four issues a production audit would find first:

1. **OTP codes never leak via the API.** `/api/auth/phone/request` returns the code in the response ONLY when the server is explicitly in demo mode (`DIL_SEED_DEMO=1`) and no Twilio keys are configured. With real SMS configured the code travels by SMS only; failures return honest `502`s.
2. **Demo Google linking is locked down.** `POST /api/auth/google` (the trust-the-client chooser) returns `403` outside demo mode and `410` once real OAuth keys are configured — production uses only the verified OAuth redirect flow.
3. **Rate limits on expensive endpoints.** Registration: 5/hour per IP. OTP sends: 3/10 min per IP+number and 10/hour per IP — protects the Twilio bill from abuse.
4. **No public demo credentials.** The demo account is opt-in (`DIL_SEED_DEMO=1`); its credentials print to the server log on first boot, not to the README. Session tokens expire in 7 days (matches API.md).
5. **Spoof-proof rate limits (v1.2.2).** Client identity is taken from the last `X-Forwarded-For` hop (the value the reverse proxy appends), so rotating fake header hops cannot bypass limits. Caps: register 5/h per IP; OTP 10/h per IP **and** 5/h per phone number (rotating IPs cannot drain an SMS budget or brute a number); verify 15/15min per IP; login 30/15min per IP; password reset 10/h per IP.
6. **Google sign-in requires a verified email (v1.2.2).** The OAuth callback rejects accounts whose Google email is not verified before creating or linking a user.
7. **OTP confidentiality (v1.5).** SMS codes are stored as HMAC-SHA-256 hashes with constant-time comparison — a database leak no longer yields usable codes. Session streams use one-time short-lived tickets instead of URL tokens. A strict CSP (`script-src 'self'`), gzip compression, sane cache headers, nightly database snapshots and a GitHub Actions CI (tests + audit + secret scan) ship in the box.
7. **XSS posture.** All user-controlled text (checklist labels, task titles/notes/lists, names, emails) is HTML-escaped at render time; a sink audit found no unescaped interpolation paths.
9. **Trust & compliance (v1.3.2).** Privacy Policy and Terms of Service ship with the app (DPDP-aware; data collected, third parties, deletion path stated). In-app account deletion lives in Settings → Danger zone. Home coordinates are never exposed in URLs and never shared.
10. **Authorization (IDOR) verified.** Every owned-resource query (items, sessions, tasks, subscriptions) is scoped `WHERE id = ? AND user_id = ?`; all 24 data routes sit behind the auth middleware. No CORS headers are emitted — the API is same-origin only.
8. **Deliberate trade-offs (stated, not hidden).** Registration answers `409` for an existing email — a mild account-enumeration signal most apps accept for usability. The per-account login strike counter (10 failed attempts locks the current window) is deliberately per-account rather than per-IP so shared-office NATs don't lock everyone out; the per-IP caps back it up. Standard security headers (nosniff, DENY-framing, referrer, permissions-policy, HSTS on https) are set; a strict CSP would require a build step and is left as a documented follow-up.

