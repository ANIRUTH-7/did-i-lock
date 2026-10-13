'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const { db, hashPassword, verifyPassword } = require('./db');

const webpush = require('web-push');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, '..', 'public');
const DATA_DIR = process.env.DIL_DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const SECRET_FILE = path.join(DATA_DIR, '.secret');
let SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  if (fs.existsSync(SECRET_FILE)) SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();
  else {
    SECRET = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SECRET_FILE, SECRET, { mode: 0o600 });
  }
}

// ---- Web Push (VAPID) ----
const VAPID_FILE = path.join(DATA_DIR, '.vapid.json');
let VAPID;
if (fs.existsSync(VAPID_FILE)) VAPID = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
else {
  VAPID = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_FILE, JSON.stringify(VAPID), { mode: 0o600 });
}
webpush.setVapidDetails('mailto:admin@didilock.app', VAPID.publicKey, VAPID.privateKey);

// ---- optional integrations (activate via env, demo fallbacks otherwise) ----
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const DEMO_MODE = process.env.DIL_SEED_DEMO === '1'; // demo helpers (seed users, OTP echo) — NEVER enable on a production deploy
const TWILIO = {
  sid: process.env.TWILIO_ACCOUNT_SID || '',
  token: process.env.TWILIO_AUTH_TOKEN || '',
  from: process.env.TWILIO_FROM || '',
};
function originOf(req) {
  return `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers['x-forwarded-host'] || req.headers.host}`;
}

const app = express();
app.use(express.json({ limit: '256kb' }));
app.disable('x-powered-by');
app.use((req, res, next) => { // security headers (no CSP yet: the PWA is inline-script heavy — revisit with a build step)
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()',
  });
  if (req.secure || String(req.headers['x-forwarded-proto'] || '') === 'https') {
    res.set('Strict-Transport-Security', 'max-age=15552000'); // 180 days, https-only responses
  }
  next();
});

const now = () => Date.now();

// ---------------- tiny per-IP rate limiter (sliding window) ----------------
const ipHits = new Map();
const PRIVATE_IP = /^(10\.\d+\.+\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|127\.\d+\.\d+\.\d+|::1|f[cd][0-9a-f:]*|fe80:)/i;
function ipOf(req) {
  const f = req.headers['x-forwarded-for'];
  if (typeof f === 'string' && f.trim()) {
    const hops = f.split(',').map(s => s.trim()).filter(Boolean);
    // walk from the last hop backwards: the edge proxy (Render) appends the real client IP last,
    // but a stray internal hop may also trail — private ranges are never a real visitor
    for (let i = hops.length - 1; i >= 0; i--) if (!PRIVATE_IP.test(hops[i])) return hops[i];
    return hops[hops.length - 1];
  }
  return (req.socket && req.socket.remoteAddress) || 'local';
}
// 30-second deploy check (see DEPLOY.md): open /api/whoip from two different networks —
// the IPs must differ. That proves the rate limiter sees real visitors, not one shared proxy hop.
app.get('/api/whoip', (req, res) => res.json({ ip: ipOf(req), hops: (req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean) }));
function hitBucket(key, max, windowMs) {
  const t = now();
  const e = ipHits.get(key);
  if (!e || t - e.at > windowMs) {
    ipHits.set(key, { n: 1, at: t });
    if (ipHits.size > 4000) for (const [k, v] of ipHits) if (t - v.at > windowMs) ipHits.delete(k);
    return false;
  }
  e.n += 1;
  return e.n > max;
}

// ---------------- auth ----------------
function signToken(uid) {
  return jwt.sign({ uid }, SECRET, { expiresIn: '7d' });
}
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : (req.query.token || '');
  try {
    const payload = jwt.verify(token, SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);
    if (!user) return res.status(401).json({ error: 'Account not found' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Please sign in' });
  }
}
function publicUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone || null,
    provider: u.provider || 'password', google_linked: !!u.google_id,
    home_lat: u.home_lat, home_lng: u.home_lng, home_label: u.home_label,
    geo_radius_m: u.geo_radius_m, followup_minutes: u.followup_minutes,
    notify_inapp: !!u.notify_inapp, created_at: u.created_at,
  };
}
function normalizePhone(p) {
  const digits = String(p || '').replace(/[^\d]/g, '');
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}
function insertStarterItems(uid) {
  const ins = db.prepare('INSERT INTO items (user_id, label, icon, sort_order, created_at) VALUES (?,?,?,?,?)');
  [['Front door locked', 'door'], ['Stove off', 'flame'], ['Iron unplugged', 'iron'], ['Windows closed', 'window']]
    .forEach(([label, icon], i) => ins.run(uid, label, icon, i, now()));
}

// ---------------- SSE (server push channel) ----------------
const sseClients = new Map(); // uid -> Set<res>
function sseSend(uid, payload) {
  const set = sseClients.get(uid);
  if (!set) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) { try { res.write(data); } catch { /* ignore */ } }
}

app.get('/api/events', auth, (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders && res.flushHeaders();
  res.write('retry: 4000\n\n');
  res.write(`data: ${JSON.stringify({ type: 'hello', ts: now() })}\n\n`);
  if (!sseClients.has(req.user.id)) sseClients.set(req.user.id, new Set());
  sseClients.get(req.user.id).add(res);
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* ignore */ } }, 25000);
  req.on('close', () => {
    clearInterval(ping);
    const set = sseClients.get(req.user.id);
    if (set) { set.delete(res); if (!set.size) sseClients.delete(req.user.id); }
  });
});

// ---------------- web push ----------------
app.get('/api/push/vapid', (req, res) => res.json({ publicKey: VAPID.publicKey }));
app.post('/api/push/subscribe', auth, (req, res) => {
  const { subscription } = req.body || {};
  if (!subscription || !subscription.endpoint) return res.status(400).json({ error: 'Missing subscription' });
  db.prepare(`INSERT INTO push_subscriptions (user_id, endpoint, subscription, created_at) VALUES (?,?,?,?)
    ON CONFLICT(endpoint) DO UPDATE SET subscription = excluded.subscription, user_id = excluded.user_id`)
    .run(req.user.id, subscription.endpoint, JSON.stringify(subscription), now());
  res.json({ ok: true });
});
app.post('/api/push/unsubscribe', auth, (req, res) => {
  const { endpoint } = (req.body || {}).subscription || {};
  if (endpoint) db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').run(endpoint, req.user.id);
  res.json({ ok: true });
});
async function sendPush(uid, payload) {
  const rows = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(uid);
  for (const row of rows) {
    try {
      await webpush.sendNotification(JSON.parse(row.subscription), JSON.stringify(payload));
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(row.id); // subscription expired
      } else console.error('[push] send failed', e.message);
    }
  }
}

// ---------------- follow-up engine ----------------
// Every few seconds: any "leaving" session whose 5-minute window has passed
// flips to "followup_pending" and pushes a notification to the user's device(s).
setInterval(() => {
  let due = [];
  try {
    due = db.prepare("SELECT * FROM sessions WHERE status = 'leaving' AND followup_at IS NOT NULL AND followup_at <= ?").all(now());
  } catch (e) { console.error('[tick]', e.message); return; }
  const flip = db.prepare("UPDATE sessions SET status = 'followup_pending' WHERE id = ? AND status = 'leaving'");
  for (const s of due) {
    if (flip.run(s.id).changes === 0) continue;
    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(s.user_id);
    const body = `You left home ${Math.max(1, Math.round((now() - s.followup_at) / 60000)) || 5} minutes ago. Door, stove, iron, windows — did you really check them?`;
    db.prepare('INSERT INTO notifications (user_id, type, title, body, session_id, read, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(s.user_id, 'followup', 'Did you check everything?', body, s.id, 0, now());
    sseSend(s.user_id, { type: 'followup_due', session_id: s.id, ts: now() });
    sseSend(s.user_id, { type: 'notification', ts: now() });
    // reach the device even when the tab is closed
    sendPush(s.user_id, {
      title: 'Did you check everything? 🚪',
      body: 'A few minutes have passed since you left home. Door, stove, iron, windows — tap to confirm.',
      url: '/#/dashboard',
    });
    console.log(`[push] follow-up for user ${s.user_id} (session ${s.id})`);
  }
}, 4000).unref?.();

// ---------------- serializers ----------------
function serializeSession(row) {
  const items = db.prepare('SELECT item_id, label, checked FROM session_items WHERE session_id = ?').all(row.id);
  return { ...row, items };
}

// ---------------- auth routes ----------------
app.get('/api/health', (req, res) => res.json({ ok: true, ts: now() }));

// capabilities (client adapts: real Google OAuth vs simulated, SMS vs demo)
app.get('/api/config', (req, res) => res.json({
  googleOauth: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
  sms: !!(TWILIO.sid && TWILIO.token && TWILIO.from),
  push: true,
  demo: DEMO_MODE,
}));

const loginAttempts = new Map(); // email -> { n, at }
app.post('/api/auth/login', (req, res) => {
  if (hitBucket('login:' + ipOf(req), 30, 15 * 60000)) return res.status(429).json({ error: 'Too many attempts — try again shortly' });
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const key = String(email).trim().toLowerCase();
  const att = loginAttempts.get(key) || { n: 0, at: now() };
  if (att.at < now() - 15 * 60000) { att.n = 0; att.at = now(); }
  if (att.n >= 10) return res.status(429).json({ error: 'Too many failed attempts — try again in a few minutes' });
  loginAttempts.set(key, att);
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(key);
  if (!user || !verifyPassword(password, user.password_hash)) {
    att.n++;
    return res.status(401).json({ error: 'Wrong email or password' });
  }
  loginAttempts.delete(key);
  res.json({ token: signToken(user.id), user: publicUser(user) });
});

app.post('/api/auth/register', (req, res) => {
  if (hitBucket('reg:' + ipOf(req), 5, 60 * 60000)) return res.status(429).json({ error: 'Too many sign-up attempts from this network — try again later' });
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!/^\S+@\S+\.\S+$/.test(String(email))) return res.status(400).json({ error: 'That email does not look right' });
  const exists = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(String(email).trim());
  if (exists) return res.status(409).json({ error: 'An account with this email already exists — try signing in' });
  const id = db.prepare('INSERT INTO users (name, email, provider, password_hash, followup_minutes, geo_radius_m, notify_inapp, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(String(name).trim(), String(email).trim().toLowerCase(), 'password', hashPassword(password), 5, 250, 1, now()).lastInsertRowid;
  insertStarterItems(id); // sensible starter checklist so the app is useful on first launch
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.json({ token: signToken(id), user: publicUser(user), created: true });
});

// ---------- phone OTP (real SMS via Twilio when configured, demo SMS otherwise) ----------
async function deliverSms(to, body) {
  if (TWILIO.sid && TWILIO.token && TWILIO.from) {
    try {
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO.sid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + Buffer.from(`${TWILIO.sid}:${TWILIO.token}`).toString('base64'),
        },
        body: `To=+${to}&From=${TWILIO.from}&Body=${encodeURIComponent(body)}`,
      });
      if (!r.ok) console.error('[sms] twilio error', r.status, await r.text());
      else return 'sent';
    } catch (e) { console.error('[sms] twilio failed', e.message); }
    return 'failed';
  }
  return 'demo';
}
app.post('/api/auth/phone/request', async (req, res) => {
  const phone = normalizePhone(req.body && req.body.phone);
  const purpose = (req.body && req.body.purpose) === 'reset' ? 'reset' : 'login';
  if (!phone) return res.status(400).json({ error: 'Enter a valid phone number (8–15 digits)' });
  if (purpose === 'reset' && !db.prepare('SELECT id FROM users WHERE phone = ?').get(phone))
    return res.status(404).json({ error: 'No account found for this number' });
  if (hitBucket('otpg:' + ipOf(req), 10, 60 * 60000) || hitBucket('num:' + phone, 5, 60 * 60000)) // per-IP AND per-number: rotating IPs cannot buy extra codes for a target number
    return res.status(429).json({ error: 'Too many code requests — please wait a few minutes' });
  db.prepare('DELETE FROM login_codes WHERE expires_at < ?').run(now()); // housekeeping: drop stale codes
  otpAttempts.delete(phone); // a fresh code resets the wrong-attempt counter
  const code = String(crypto.randomInt(100000, 1000000));
  db.prepare('DELETE FROM login_codes WHERE phone = ? AND purpose = ?').run(phone, purpose);
  db.prepare('INSERT INTO login_codes (phone, code, purpose, expires_at, created_at) VALUES (?,?,?,?,?)')
    .run(phone, code, purpose, now() + 5 * 60000, now());
  const body = purpose === 'reset'
    ? `DIL: ${code} is your Did I Lock? password reset code. It expires in 5 minutes.`
    : `DIL: ${code} is your Did I Lock? code. It expires in 5 minutes.`;
  const delivery = await deliverSms(phone, body);
  if (delivery === 'sent') return res.json({ ok: true, delivery }); // code travels by SMS only — never in the response
  if (delivery === 'failed') return res.status(502).json({ error: 'SMS delivery failed — please try again' });
  if (!DEMO_MODE) return res.status(503).json({ error: 'SMS login is not configured on this server' });
  res.json({ ok: true, delivery, demo_sms: { to: '+' + phone, body } }); // demo mode only: code shown in-app
});

app.post('/api/auth/phone/verify', (req, res) => {
  if (hitBucket('otpv:' + ipOf(req), 15, 15 * 60000)) return res.status(429).json({ error: 'Too many attempts — try again shortly' });
  const phone = normalizePhone(req.body && req.body.phone);
  const code = String((req.body || {}).code || '').trim();
  if (!phone || !code) return res.status(400).json({ error: 'Phone number and code required' });
  // simple brute-force guard: 5 failed attempts locks the current code
  const attempts = otpAttempts.get(phone) || { n: 0, at: now() };
  if (attempts.at < now() - 10 * 60000) { attempts.n = 0; attempts.at = now(); }
  attempts.n++;
  otpAttempts.set(phone, attempts);
  if (attempts.n >= 5) {
    db.prepare('DELETE FROM login_codes WHERE phone = ?').run(phone);
    return res.status(429).json({ error: 'Too many wrong attempts — send a new code' });
  }
  const row = db.prepare("SELECT * FROM login_codes WHERE phone = ? AND purpose = 'login' ORDER BY created_at DESC LIMIT 1").get(phone);
  if (!row || row.used) return res.status(400).json({ error: 'No active code for this number — send a new one' });
  if (row.expires_at < now()) return res.status(400).json({ error: 'That code expired — send a new one' });
  if (row.code !== code) return res.status(400).json({ error: 'Wrong code — check the message and try again' });
  db.prepare('UPDATE login_codes SET used = 1 WHERE id = ?').run(row.id);
  otpAttempts.delete(phone);
  // exact match first; then tolerate international-format differences (e.g. "+91 98765 43210" vs "9876543210")
  let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user && phone.length === 10) {
    const matches = db.prepare('SELECT * FROM users WHERE phone LIKE ? AND length(phone) > 10').all('%' + phone);
    if (matches.length === 1) user = matches[0];
  }
  let created = false;
  if (!user) {
    created = true;
    const id = db.prepare('INSERT INTO users (name, phone, provider, followup_minutes, geo_radius_m, notify_inapp, created_at) VALUES (?,?,?,?,?,?,?)')
      .run('New traveler', phone, 'phone', 5, 250, 1, now()).lastInsertRowid;
    insertStarterItems(id);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }
  res.json({ token: signToken(user.id), user: publicUser(user), created });
});
const otpAttempts = new Map();

// ---------- password reset (via phone OTP) ----------
app.post('/api/auth/password/reset', (req, res) => {
  if (hitBucket('reset:' + ipOf(req), 10, 60 * 60000)) return res.status(429).json({ error: 'Too many attempts — try again later' });
  const phone = normalizePhone(req.body && req.body.phone);
  const code = String((req.body || {}).code || '').trim();
  const newPassword = String((req.body || {}).newPassword || '');
  if (!phone || !code || !newPassword) return res.status(400).json({ error: 'Phone, code and new password required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  const row = db.prepare("SELECT * FROM login_codes WHERE phone = ? AND purpose = 'reset' ORDER BY created_at DESC LIMIT 1").get(phone);
  if (!row || row.used) return res.status(400).json({ error: 'No active reset code — request a new one' });
  if (row.expires_at < now()) return res.status(400).json({ error: 'That code expired — request a new one' });
  if (row.code !== code) return res.status(400).json({ error: 'Wrong code — check the message and try again' });
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user) return res.status(404).json({ error: 'No account found for this number' });
  db.prepare('UPDATE login_codes SET used = 1 WHERE id = ?').run(row.id);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), user.id);
  res.json({ ok: true });
});

// ---------- Google (real OAuth when configured, simulated handshake otherwise) ----------
function googleExchange(googleId, email, name) {
  let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
  let created = false, linked = false;
  if (!user) {
    user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(String(email).trim());
    if (user) {
      db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(googleId, user.id);
      linked = true;
    } else {
      created = true;
      const gid = db.prepare('INSERT INTO users (name, email, google_id, provider, password_hash, followup_minutes, geo_radius_m, notify_inapp, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(String(name || 'Google user').trim(), String(email).trim().toLowerCase(), googleId, 'google',
          hashPassword(crypto.randomBytes(16).toString('hex')), 5, 250, 1, now()).lastInsertRowid;
      insertStarterItems(gid);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(gid);
    }
  }
  return { user, created, linked };
}

// simulated path (demo mode) — same linking semantics as the real OAuth flow
app.post('/api/auth/google', (req, res) => {
  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) return res.status(410).json({ error: 'Use the Sign in with Google button (the verified OAuth flow)' });
  if (!DEMO_MODE) return res.status(403).json({ error: 'Demo Google linking is disabled on this server' });
  const { id, email, name } = req.body || {};
  if (!id || !email) return res.status(400).json({ error: 'Google account details missing' });
  const { user, created, linked } = googleExchange(id, email, name);
  res.json({ token: signToken(user.id), user: publicUser(user), created, linked });
});

// ---- real Google OAuth (active when GOOGLE_CLIENT_ID/SECRET are set) ----
const oauthStates = new Map(); // state -> exp
const googleHandoffs = new Map(); // handoff id -> { token, user, exp }
app.get('/auth/google', (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return res.status(404).json({ error: 'Google OAuth is not configured on this server' });
  const state = crypto.randomBytes(16).toString('hex');
  oauthStates.set(state, now() + 5 * 60000);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${originOf(req)}/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  }).toString();
  res.redirect(url);
});
app.get('/auth/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect('/#google-error=' + encodeURIComponent(error));
  const exp = oauthStates.get(String(state || ''));
  oauthStates.delete(String(state || ''));
  if (!exp || exp < now()) return res.redirect('/#google-error=state_expired');
  try {
    const tok = await (await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code), client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: `${originOf(req)}/auth/google/callback`, grant_type: 'authorization_code',
      }),
    })).json();
    const info = await (await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    })).json();
    const emailVerified = info.email_verified === true || info.email_verified === 'true';
    if (!info.email || !emailVerified) return res.redirect('/#google-error=unverified_email'); // never link accounts to an unverified address
    const { user, created, linked } = googleExchange(info.sub, info.email, info.name);
    const handoff = crypto.randomBytes(16).toString('hex');
    googleHandoffs.set(handoff, { token: signToken(user.id), user: publicUser(user), created, linked, exp: now() + 60000 });
    res.redirect('/handoff.html#' + handoff);
  } catch (e) {
    console.error('[google-oauth]', e.message);
    res.redirect('/#google-error=' + encodeURIComponent(e.message));
  }
});
app.post('/api/auth/google/handoff', (req, res) => {
  const { id } = req.body || {};
  const entry = googleHandoffs.get(String(id || ''));
  if (!entry || entry.exp < now()) return res.status(404).json({ error: 'Handoff expired — try again' });
  googleHandoffs.delete(String(id));
  res.json(entry);
});

// ---------------- profile ----------------
app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

app.patch('/api/me', auth, (req, res) => {
  const b = req.body || {};
  const fields = ['name', 'phone', 'home_lat', 'home_lng', 'home_label', 'geo_radius_m', 'followup_minutes', 'notify_inapp'];
  const sets = [];
  const vals = [];
  for (const f of fields) {
    if (b[f] === undefined) continue;
    if (f === 'name' && !String(b[f]).trim()) return res.status(400).json({ error: 'Name cannot be empty' });
    if (f === 'phone') {
      if (b[f] === null || b[f] === '') { sets.push('phone = NULL'); continue; }
      const p = normalizePhone(b[f]);
      if (!p) return res.status(400).json({ error: 'Phone must be 8–15 digits' });
      const taken = db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(p, req.user.id);
      if (taken) return res.status(409).json({ error: 'That phone number is linked to another account' });
      sets.push('phone = ?'); vals.push(p); continue;
    }
    sets.push(`${f} = ?`);
    vals.push(f === 'notify_inapp' ? (b[f] ? 1 : 0) : (f === 'home_lat' || f === 'home_lng' || f === 'geo_radius_m' || f === 'followup_minutes' ? Number(b[f]) : b[f]));
  }
  if (!sets.length) return res.json({ user: publicUser(req.user) });
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.user.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

app.delete('/api/me', auth, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  res.json({ ok: true });
});

// ---------------- checklist items (CRUD) ----------------
app.get('/api/items', auth, (req, res) => {
  res.json({ items: db.prepare('SELECT * FROM items WHERE user_id = ? ORDER BY sort_order, id').all(req.user.id) });
});

app.post('/api/items', auth, (req, res) => {
  const { label, icon } = req.body || {};
  if (!label || !String(label).trim()) return res.status(400).json({ error: 'Give this check a name' });
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM items WHERE user_id = ?').get(req.user.id).m;
  const id = db.prepare('INSERT INTO items (user_id, label, icon, sort_order, created_at) VALUES (?,?,?,?,?)')
    .run(req.user.id, String(label).trim(), icon || 'door', max + 1, now()).lastInsertRowid;
  res.status(201).json({ item: db.prepare('SELECT * FROM items WHERE id = ?').get(id) });
});

app.patch('/api/items/reorder', auth, (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids required' });
  const up = db.prepare('UPDATE items SET sort_order = ? WHERE id = ? AND user_id = ?');
  const tx = db.transaction(() => ids.forEach((id, i) => up.run(i, id, req.user.id)));
  tx();
  res.json({ items: db.prepare('SELECT * FROM items WHERE user_id = ? ORDER BY sort_order, id').all(req.user.id) });
});

app.patch('/api/items/:id', auth, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!item) return res.status(404).json({ error: 'Check not found' });
  const b = req.body || {};
  const label = b.label !== undefined ? String(b.label).trim() : item.label;
  const icon = b.icon !== undefined && b.icon ? b.icon : item.icon;
  if (!label) return res.status(400).json({ error: 'Label cannot be empty' });
  db.prepare('UPDATE items SET label = ?, icon = ? WHERE id = ?').run(label, icon, item.id);
  res.json({ item: db.prepare('SELECT * FROM items WHERE id = ?').get(item.id) });
});

app.delete('/api/items/:id', auth, (req, res) => {
  const info = db.prepare('DELETE FROM items WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'Check not found' });
  res.json({ ok: true });
});

// ---------------- sessions ----------------
app.get('/api/sessions', auth, (req, res) => {
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const rows = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT ?').all(req.user.id, limit);
  res.json({ sessions: rows.map(serializeSession) });
});

app.get('/api/sessions/active', auth, (req, res) => {
  const row = db.prepare("SELECT * FROM sessions WHERE user_id = ? AND status IN ('leaving','followup_pending') ORDER BY started_at DESC LIMIT 1").get(req.user.id);
  res.json({ session: row ? serializeSession(row) : null });
});

app.post('/api/sessions', auth, (req, res) => {
  const { items, durationSeconds, lat, lng, mode } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Nothing to check — add at least one check first' });
  const active = db.prepare("SELECT id, status FROM sessions WHERE user_id = ? AND status IN ('leaving','followup_pending') LIMIT 1").get(req.user.id);
  if (active) return res.status(409).json({ error: active.status === 'followup_pending' ? 'You have a check-in waiting — answer it before starting a new check' : 'You already have an active check in progress — answer its check-in first' });
  const followupAt = now() + Math.max(1, req.user.followup_minutes || 5) * 60000;
  const id = db.prepare(`
    INSERT INTO sessions (user_id, status, started_at, followup_at, note, duration_seconds, lat, lng, mode)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(req.user.id, 'leaving', now(), followupAt, null,
    Math.round(Number(durationSeconds) || 0),
    lat != null ? Number(lat) : null, lng != null ? Number(lng) : null,
    mode === 'geo' ? 'geo' : 'manual').lastInsertRowid;
  const ins = db.prepare('INSERT INTO session_items (session_id, item_id, label, checked) VALUES (?,?,?,?)');
  for (const it of items) {
    ins.run(id, it.item_id || null, String(it.label || 'Untitled check'), it.checked ? 1 : 0);
  }
  db.prepare('INSERT INTO notifications (user_id, type, title, body, session_id, read, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(req.user.id, 'reminder', 'Reminder scheduled',
      `We will check in with you ${req.user.followup_minutes} minutes after you left, to make sure everything is really done.`, id, 0, now());
  const session = serializeSession(db.prepare('SELECT * FROM sessions WHERE id = ?').get(id));
  sseSend(req.user.id, { type: 'session_created', session_id: id, ts: now() });
  res.status(201).json({ session });
});

app.post('/api/sessions/:id/location', auth, (req, res) => {
  const s = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });
  const { lat, lng } = req.body || {};
  if (lat == null || lng == null) return res.status(400).json({ error: 'lat/lng required' });
  db.prepare('UPDATE sessions SET lat = ?, lng = ?, mode = ? WHERE id = ?').run(Number(lat), Number(lng), 'geo', s.id);
  res.json({ ok: true });
});

app.post('/api/sessions/:id/followup', auth, (req, res) => {
  const s = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });
  if (!['leaving', 'followup_pending'].includes(s.status)) return res.status(409).json({ error: 'This check-in was already handled' });
  const { result, note } = req.body || {};
  if (!['ok', 'went_back'].includes(result)) return res.status(400).json({ error: 'result must be ok or went_back' });
  const status = result === 'ok' ? 'confirmed_ok' : 'went_back';
  db.prepare('UPDATE sessions SET status = ?, resolved_at = ?, note = COALESCE(?, note) WHERE id = ?')
    .run(status, now(), note ? String(note).slice(0, 500) : null, s.id);
  db.prepare('INSERT INTO notifications (user_id, type, title, body, session_id, read, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(req.user.id, status === 'confirmed_ok' ? 'ok' : 'went_back',
      status === 'confirmed_ok' ? 'All good — loop closed' : 'Good thing you went back',
      status === 'confirmed_ok'
        ? 'You confirmed everything. No spiraling required on the commute.'
        : 'You double-checked. That is exactly what this app is for — the spiral ends here.',
      s.id, 0, now());
  sseSend(req.user.id, { type: 'notification', ts: now() });
  res.json({ session: serializeSession(db.prepare('SELECT * FROM sessions WHERE id = ?').get(s.id)) });
});

app.delete('/api/sessions/:id', auth, (req, res) => {
  const info = db.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'Session not found' });
  res.json({ ok: true });
});

// ---------------- notifications ----------------
app.get('/api/notifications', auth, (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 30);
  res.json({
    notifications: db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(req.user.id, limit),
    unread: db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0').get(req.user.id).c,
  });
});

app.post('/api/notifications/read', auth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true, unread: 0 });
});

// ---------------- stats ----------------
app.get('/api/stats', auth, (req, res) => {
  const all = db.prepare('SELECT status, started_at, duration_seconds FROM sessions WHERE user_id = ?').all(req.user.id);
  const total = all.length;
  const ok = all.filter(s => s.status === 'confirmed_ok').length;
  const wentBack = all.filter(s => s.status === 'went_back').length;
  const pending = all.filter(s => ['leaving', 'followup_pending'].includes(s.status)).length;
  const weekAgo = now() - 7 * 86400000;
  const weekCount = all.filter(s => s.started_at >= weekAgo).length;
  const resolved = all.filter(s => s.duration_seconds);
  const avgDuration = resolved.length ? Math.round(resolved.reduce((a, s) => a + s.duration_seconds, 0) / resolved.length) : null;

  // streak: consecutive days (ending today or yesterday) with >= 1 session.
  // computed in the client's timezone via ?tz=<minutes-east-of-utc>
  const tzMin = Math.max(-840, Math.min(840, Number(req.query.tz) || 0));
  const dayKey = t => new Date(t + tzMin * 60000).toDateString(); // local-date, derived from UTC
  const days = new Set(all.map(s => dayKey(s.started_at)));
  const todayKey = dayKey(now());
  let streak = 0;
  let cursor = new Date();
  if (!days.has(todayKey)) cursor.setDate(cursor.getDate() - 1); // allow "yesterday counts"
  while (days.has(dayKey(cursor.getTime()))) { streak++; cursor.setDate(cursor.getDate() - 1); }

  // last 7 local days (ending today) for the "this week" strip — ISO local-date keys
  const isoDay = t => new Date(t + tzMin * 60000).toISOString().slice(0, 10);
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const k = isoDay(now() - i * 86400000);
    week.push({ k, n: all.filter(x => isoDay(x.started_at) === k).length, today: i === 0 });
  }

  res.json({ stats: { total, ok, wentBack, pending, weekCount, avgDuration, streak, week } });
});

// ---------------- TASKS (Google-Tasks-style personal tasks) ----------------
const taskOut = t => ({ id: t.id, parentId: t.parent_id, list: t.list, title: t.title, notes: t.notes, dueAt: t.due_at, done: !!t.done, sort: t.sort, createdAt: t.created_at });
app.get('/api/tasks', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY sort, id').all(req.user.id);
  const tops = rows.filter(t => !t.parent_id).map(taskOut);
  for (const p of tops) p.subtasks = rows.filter(t => t.parent_id === p.id).map(taskOut);
  res.json({ tasks: tops });
});
app.post('/api/tasks', auth, (req, res) => {
  const title = String((req.body || {}).title || '').trim().slice(0, 120);
  if (!title) return res.status(400).json({ error: 'Task needs a title' });
  const b = req.body || {};
  const info = db.prepare('INSERT INTO tasks (user_id,parent_id,list,title,notes,due_at,sort,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(req.user.id, b.parent_id || null, String(b.list || 'General').slice(0, 24), title,
         String(b.notes || '').slice(0, 500), Number(b.due_at) || null, 0, now());
  res.json({ task: { ...taskOut(db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid)), subtasks: [] } });
});
app.patch('/api/tasks/:id', auth, (req, res) => {
  const t = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!t) return res.status(404).json({ error: 'Task not found' });
  const p = req.body || {};
  db.prepare('UPDATE tasks SET title = ?, notes = ?, due_at = ?, list = ?, done = ? WHERE id = ?')
    .run(p.title !== undefined ? (String(p.title).trim().slice(0, 120) || t.title) : t.title,
         p.notes !== undefined ? String(p.notes).slice(0, 500) : t.notes,
         p.due_at !== undefined ? (Number(p.due_at) || null) : t.due_at,
         p.list !== undefined ? String(p.list).slice(0, 24) : t.list,
         p.done !== undefined ? (p.done ? 1 : 0) : t.done,
         t.id);
  res.json({ task: taskOut(db.prepare('SELECT * FROM tasks WHERE id = ?').get(t.id)) });
});
app.delete('/api/tasks/:id', auth, (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ---------------- static SPA ----------------
app.use(express.static(PUBLIC));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(PUBLIC, 'index.html')));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

function start(port = PORT, host = '0.0.0.0') {
  return app.listen(port, host, () => {
    console.log(`Did I Lock? server running on http://${host}:${port}`);
  });
}
if (require.main === module) start();

module.exports = { app, start };
