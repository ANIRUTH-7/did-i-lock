# 🔌 API Reference

Base URL: `https://<your-domain>` · All request/response bodies are JSON.
Auth: send `Authorization: Bearer <JWT>` on every call except the public ones marked 🔓.
JWTs are issued by the auth endpoints, expire in 7 days, and are stored client-side.

## Public (no auth)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness probe (`{ok:true}`) — use for uptime checks |
| GET | `/api/config` | Which auth methods are enabled (`google: bool`), follow-up defaults |
| GET | `/api/push/vapid` | VAPID public key for Web Push subscribe |
| POST | `/api/auth/login` | `{email, password}` → `{token, user}` — 10 fails/15 min = 429 |
| POST | `/api/auth/register` | `{name, email, password}` → `{token, user}` |
| POST | `/api/auth/phone/request` | `{phone, purpose?}` sends OTP via Twilio. The response NEVER contains the code in production — demo echo only with `DIL_SEED_DEMO=1`. `503` when SMS unconfigured, `502` on delivery failure, `429` rate-limited per IP **and per phone number** |
| POST | `/api/auth/phone/verify` | `{phone, code}` → `{token, user, created}` — creates account on first login |
| POST | `/api/auth/password/reset` | `{phone, code, newPassword}` |
| POST | `/api/auth/google` | Demo-mode Google linking only — `403` unless `DIL_SEED_DEMO=1`, `410` when real OAuth keys are configured |
| GET | `/auth/google` → `/auth/google/callback` | Real OAuth 2.0 redirect flow (needs `GOOGLE_CLIENT_ID/SECRET`) |
| POST | `/api/auth/google/handoff` | One-time token exchange after OAuth callback |

## Account

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/me` | Current profile (includes home zone, follow-up prefs) |
| PATCH | `/api/me` | Update name/phone/home coords/label/radius(150–1000 m)/followup_minutes(1–60)/notify_inapp |
| DELETE | `/api/me` | **Permanently deletes the account and all its rows** |

## Checklist items

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/items` | Ordered checklist items |
| POST | `/api/items` | `{label, icon}` add |
| PATCH | `/api/items/reorder` | `{ids: [...]}` set order |
| PATCH | `/api/items/:id` | `{label?, icon?}` rename/re-icon |
| DELETE | `/api/items/:id` | Remove item |

## Departure sessions (the core loop)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/sessions` | History (newest first, with items) |
| GET | `/api/sessions/active` | Current `leaving`/`followup_pending` session, if any |
| POST | `/api/sessions` | Start departure `{items:[{item_id,label,checked}], durationSeconds, lat?, lng?, mode}` — 409 if one is active |
| POST | `/api/sessions/:id/location` | Attach/refresh GPS coordinates |
| POST | `/api/sessions/:id/followup` | `{result: "ok"\|"back"}` closes the loop → status `confirmed_ok`/`went_back` + notification |
| DELETE | `/api/sessions/:id` | Cancel/delete an entry |

## Notifications & stats

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/notifications` | Activity feed |
| POST | `/api/notifications/read` | Mark all read |
| GET | `/api/stats` | `{total, ok, wentBack, pending, weekCount, avgDuration, streak, week:[{k,n,today}]}` — streak & week are timezone-aware |
| GET | `/api/events` | **SSE stream** — live events: `followup` (opens the check-in card), session updates |
| POST | `/api/push/subscribe` · `/api/push/unsubscribe` | Web Push subscription management |

## Data model (SQLite, `DIL_DATA_DIR/didilock.db`)

`users` · `items` · `sessions` · `session_items` · `notifications` · `push_subscriptions` · `login_codes`
All user-owned rows cascade on account deletion. Passwords: scrypt (`salt:hash`).

## Testing

`npm test` → 12 API integration tests (isolated temp DB).
`node test/ui.js` → 60 headless-Chrome e2e checks (needs the server running).
Both are brand-agnostic — they keep passing after a rebrand.
