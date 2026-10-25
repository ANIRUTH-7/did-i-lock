'use strict';
const path = require('path');
const fs = require('fs');
// honour a local .env BEFORE anything reads process.env (db.js reads its data dir at require
// time) — real environment variables always win; supports `KEY=value # comment`
try {
  for (const line of fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8').split('\n')) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || m[1] in process.env) continue;
    let v = m[2];
    const q = /^(["'])(.*)\1(?:\s|$)/.exec(v); // fully quoted value keeps # inside it
    if (q) v = q[2];
    else v = v.replace(/\s+#[^#]*$/, '').trimEnd(); // bare value: strip an inline comment
    process.env[m[1]] = v;
  }
} catch { /* no .env — fine */ }
const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const { db, hashPassword, verifyPassword } = require('./db');

const webpush = require('web-push');
const compression = require('compression');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, '..', 'public');
const DATA_DIR = process.env.DIL_DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const SECRET_FILE = path.join(DATA_DIR, '.secret');
let SECRET = process.env.JWT_SECRET;
if (SECRET === 'change-me-to-a-long-random-string' || (SECRET && SECRET.length < 16)) {
  console.warn('[auth] JWT_SECRET is a placeholder/too short — ignoring it (using the persisted secret file instead)');
  SECRET = undefined;
}
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
const BASE_URL = process.env.BASE_URL || ''; // set in prod to pin the OAuth redirect origin
const DEMO_MODE = process.env.DIL_SEED_DEMO === '1';
const otpHash = (phone, code) => crypto.createHmac('sha256', SECRET).update(`${phone}:${code}`).digest('hex'); // codes never touch the disk in plaintext
function otpEquals(stored, phone, code) {
  const a = Buffer.from(String(stored), 'hex');
  const b = Buffer.from(otpHash(phone, code), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
} // demo helpers (seed users, OTP echo) — NEVER enable on a production deploy
const TWILIO = {
  sid: process.env.TWILIO_ACCOUNT_SID || '',
  token: process.env.TWILIO_AUTH_TOKEN || '',
  from: process.env.TWILIO_FROM || '',
};
if (process.env.NODE_ENV === 'production' && !process.env.DIL_DATA_DIR)
  console.warn('[data] DIL_DATA_DIR is not set — using ./data which is EPHEMERAL on Render. Set it to your mounted disk path or all user data is lost on redeploy.');
const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(compression()); // gzip for HTML/JS/CSS/JSON — big win on Indian mobile data
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }); // personal data is never cacheable
app.disable('x-powered-by');
app.use((req, res, next) => { // security headers (no CSP yet: the PWA is inline-script heavy — revisit with a build step)
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  });
  if (req.secure || String(req.headers['x-forwarded-proto'] || '') === 'https') {
    res.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains'); // 2 years, covers subdomains
  }
  next();
});

const now = () => Date.now();

// ---------------- tiny per-IP rate limiter (sliding window) ----------------
const ipHits = new Map();
const PRIVATE_IP = /^(10\.\d+\.+\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|127\.\d+\.\d+\.\d+|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+|169\.254\.\d+\.\d+|::1|f[cd][0-9a-f:]*|fe80:)/i; // includes CGNAT 100.64/10 + link-local — proxies there would lump every visitor into one bucket, and clients could rotate the hop to dodge limits
function ipOf(req) {
  const sock = String((req.socket && req.socket.remoteAddress) || '').replace(/^::ffff:/, '');
  // Trust X-Forwarded-For only when the TCP peer is private — i.e. we sit behind the edge.
  // A directly-connected public client can spoof XFF freely (rotating it defeats per-IP limits);
  // its socket address IS the client.
  const peerPrivate = !sock || sock === '::' || PRIVATE_IP.test(sock);
  const f = peerPrivate ? req.headers['x-forwarded-for'] : '';
  if (typeof f === 'string' && f.trim()) {
    const hops = f.split(',').map(s => s.trim()).filter(Boolean);
    // walk from the last hop backwards: the edge proxy (Render) appends the real client IP last,
    // but a stray internal hop may also trail — private ranges are never a real visitor
    for (let i = hops.length - 1; i >= 0; i--) if (!PRIVATE_IP.test(hops[i])) return hops[i];
    return hops[hops.length - 1];
  }
  return sock || 'local';
}
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
  const row = db.prepare('SELECT COALESCE(token_version, 0) AS v FROM users WHERE id = ?').get(uid);
  return jwt.sign({ uid, tv: row ? row.v : 0 }, SECRET, { expiresIn: '7d' }); // tv = session generation; bumps kill old tokens
}
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : ''; // bearer-only — tokens in URLs land in access logs and Referer headers
  try {
    const payload = jwt.verify(token, SECRET, { algorithms: ['HS256'] }); // pin — never let a token negotiate its own algorithm
    if (db.prepare('SELECT 1 FROM deleted_ids WHERE id = ?').get(payload.uid)) return res.status(401).json({ error: 'Account not found' });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);
    if (!user) return res.status(401).json({ error: 'Account not found' });
    if ((payload.tv || 0) < (user.token_version || 0)) return res.status(401).json({ error: 'Signed out elsewhere — sign in again' }); // reset / signout-all killed this session
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Please sign in' });
  }
}
function publicUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone || null,
    provider: u.provider || 'password', google_linked: !!u.google_id, email_verified: !!(u.email_verified || u.provider === 'google'),
    home_lat: u.home_lat, home_lng: u.home_lng, home_label: u.home_label,
    geo_radius_m: u.geo_radius_m, followup_minutes: u.followup_minutes, lang: u.lang || 'en', xp: u.xp || 0,
    notify_inapp: !!u.notify_inapp, created_at: u.created_at,
  };
}
function normalizePhone(p) {
  let digits = String(p || '').replace(/[^\d]/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) digits = '91' + digits; // Indian mobile without country code → deterministic full form
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
function closeUserSSE(uid) { // M5: end every live stream for a user — used by signout-all, password reset and account deletion
  const set = sseClients.get(uid);
  if (!set) return;
  for (const res of set) { try { res.end(); } catch { /* ignore */ } }
  sseClients.delete(uid);
}

const sseTickets = new Map(); // one-time, 60s: EventSource cannot send headers, so the JWT must never ride in a URL
app.get('/api/events/ticket', auth, (req, res) => {
  const t = crypto.randomBytes(24).toString('hex');
  sseTickets.set(t, { uid: req.user.id, exp: now() + 60000 });
  if (sseTickets.size > 500) for (const [k, v] of sseTickets) if (v.exp < now()) sseTickets.delete(k);
  res.json({ ticket: t });
});
app.get('/api/events', (req, res) => {
  const tk = sseTickets.get(String(req.query.ticket || ''));
  sseTickets.delete(String(req.query.ticket || '')); // one-time use
  if (!tk || tk.exp < now()) return res.status(401).json({ error: 'Stream ticket invalid — reload' });
  req.user = db.prepare('SELECT * FROM users WHERE id = ?').get(tk.uid);
  if (!req.user) return res.status(401).json({ error: 'Please sign in' });
  if ((sseClients.get(req.user.id) || new Set()).size >= 6) return res.status(429).json({ error: 'Too many live connections for this account' }); // stream-cap: one busy tab must not starve the user
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
  const epUrl = (() => { try { return new URL(((req.body || {}).subscription || {}).endpoint || ''); } catch { return null; } })();
  if (!epUrl || !PUSH_HOST_OK.test(epUrl.hostname)) return res.status(400).json({ error: 'Invalid push endpoint' });
  const { subscription } = req.body || {};
  if (!subscription || typeof subscription.endpoint !== 'string' || !subscription.endpoint) return res.status(400).json({ error: 'Missing subscription' });
  const subJson = JSON.stringify(subscription);
  if (subscription.endpoint.length > 500 || subJson.length > 4096) return res.status(400).json({ error: 'Subscription too large' });
  const owned = db.prepare('SELECT user_id FROM push_subscriptions WHERE endpoint = ?').get(subscription.endpoint);
  if (owned && owned.user_id !== req.user.id) return res.status(409).json({ error: 'This device is already registered to another account — sign out there first' });
  db.prepare(`INSERT INTO push_subscriptions (user_id, endpoint, subscription, created_at) VALUES (?,?,?,?)
    ON CONFLICT(endpoint) DO UPDATE SET subscription = excluded.subscription`)
    .run(req.user.id, subscription.endpoint, subJson, now());
  res.json({ ok: true });
});
app.post('/api/push/unsubscribe', auth, (req, res) => {
  const { endpoint } = (req.body || {}).subscription || {};
  if (typeof endpoint === 'string' && endpoint && endpoint.length <= 500)
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').run(endpoint, req.user.id);
  res.json({ ok: true });
});
const PUSH_HOST_OK = /(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|web\.push\.apple\.com)$/i;
const pushFails = new Map(); // endpoint -> consecutive non-fatal failures
async function sendPush(uid, payload) {
  const rows = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(uid);
  for (const row of rows) {
    try {
      const ep = (() => { try { return new URL(JSON.parse(row.subscription).endpoint).hostname; } catch { return ''; } })();
      if (!PUSH_HOST_OK.test(ep)) { db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(row.id); continue; } // SSRF guard: only real push providers
      await webpush.sendNotification(JSON.parse(row.subscription), JSON.stringify(payload), { urgency: 'high', TTL: 600 });
    } catch (e) {
      if ([404, 410, 400, 401, 403].includes(e.statusCode)) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(row.id); // gone, or keys no longer match — dead weight
        pushFails.delete(row.endpoint);
      } else {
        const n = (pushFails.get(row.endpoint) || 0) + 1; // transient failures get 3 strikes, then we stop pretending
        if (n >= 3) { db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(row.id); pushFails.delete(row.endpoint); }
        else pushFails.set(row.endpoint, n);
        console.error('[push] send failed', e.statusCode || '', e.message);
      }
    }
  }
}

// ---------------- follow-up engine ----------------
// Every few seconds: any "leaving" session whose 5-minute window has passed
// flips to "followup_pending" and pushes a notification to the user's device(s).
setInterval(() => {
  let due = [];
  try {
    closeStaleSessions(); // global sweep: any user's stale check auto-closes
    due = db.prepare("SELECT * FROM sessions WHERE status = 'leaving' AND followup_at IS NOT NULL AND followup_at <= ?").all(now());
  } catch (e) { console.error('[tick]', e.message); return; }
  const flip = db.prepare("UPDATE sessions SET status = 'followup_pending' WHERE id = ? AND status = 'leaving'");
  const markMissed = db.prepare("UPDATE sessions SET status = 'missed', resolved_at = ? WHERE id = ?");
  for (const s of due) {
    if (now() - s.followup_at > 15 * 60000) { // server slept or the ping couldn't fire in time — a "did you check?" hours late is noise
      markMissed.run(now(), s.id);
      continue;
    }
    if (flip.run(s.id).changes === 0) continue;
    const user = db.prepare('SELECT name, lang FROM users WHERE id = ?').get(s.user_id);
    const hi = user && user.lang === 'hi';
    const mins = Math.max(1, Math.round((now() - (s.started_at || s.followup_at)) / 60000));
    const body = hi
      ? `${mins} मिनट पहले घर से निकले। दरवाज़ा, गैस, आयरन, खिड़कियाँ — सच में जाँच लिया?`
      : `You left home ${mins} minute${mins === 1 ? '' : 's'} ago. Door, stove, iron, windows — did you really check them?`;
    db.prepare('INSERT INTO notifications (user_id, type, title, body, session_id, read, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(s.user_id, 'followup', hi ? 'सब कुछ जाँच लिया?' : 'Did you check everything?', body, s.id, 0, now());
    sseSend(s.user_id, { type: 'followup_due', session_id: s.id, ts: now() });
    sseSend(s.user_id, { type: 'notification', ts: now() });
    // reach the device even when the tab is closed
    sendPush(s.user_id, {
      title: hi ? 'सब कुछ जाँच लिया? 🚪' : 'Did you check everything? 🚪',
      body: hi ? 'घर से निकले कुछ मिनट हो गए। दरवाज़ा, गैस, आयरन, खिड़कियाँ — टैप करके पक्का करें।' : 'A few minutes have passed since you left home. Door, stove, iron, windows — tap to confirm.',
      lang: hi ? 'hi' : 'en',
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
  ts: now(), // client clocks drift — timers compare against SERVER time via this
}));

const loginAttempts = new Map(); // email|ip -> { n, at }
const accountAttempts = new Map(); // lower-email -> { n, at, warned, slot } — failures across ALL IPs
const resetLastSent = new Map(); // lower-email -> ts of the last reset email ACTUALLY sent (flood cap talks to this)
const trustedIPs = new Map(); // 'lower-email|ip' -> ts of the last SUCCESSFUL login from that IP — the owner's usual networks keep access during an attack
// the classic leaked-password set (exact match only) — patterns (repeats/sequences) are caught separately below
function passwordProblem(pw) { // N: one shared rulebook — sign-up, phone reset and email reset enforce exactly the same strength rules
  if (pw.length < 8 || pw.length > 128) return 'Password must be 8–128 characters';
  const lowPw = pw.toLowerCase();
  const noTail = lowPw.replace(/\d+$/, ''); // iloveyou1 → iloveyou
  if (COMMON_PASSWORDS.has(lowPw) || COMMON_PASSWORDS.has(noTail))
    return 'That password is too common — pick a stronger one';
  if (/(.)\1{3}/.test(lowPw)) // aaaa, 1111, .... — 4+ repeats of one character
    return 'That password is too predictable — avoid repeated characters';
  for (let i = 0; i + 5 <= lowPw.length; i++) { // abcde / 54321 — runs of 5+ ascending or descending
    let up = 0, dn = 0;
    for (let j = i + 1; j < i + 5; j++) {
      const d = lowPw.charCodeAt(j) - lowPw.charCodeAt(j - 1);
      if (d === 1) up++; else if (d === -1) dn++;
    }
    if (up >= 4 || dn >= 4) return 'That password is too predictable — avoid sequences';
  }
  for (const row of ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']) { // keyboard walks: only LONG runs are patterns — 'werty' inside Wertyman is just a word
    for (let i = 0; i + 6 <= row.length; i++) {
      const seg = row.slice(i, i + 6);
      if (lowPw.includes(seg) || lowPw.includes([...seg].reverse().join('')))
        return 'That password is too predictable — avoid long keyboard runs (like "qwertyu")';
    }
  }
  return '';
}
const BAD_EMAIL_CHARS = /["<>\\\u0000-\u001f]/; // " < > \ and control chars never belong in an address (' is fine: o'brien@example.com)
const EMAIL_OK = e => e.length <= 254 && !BAD_EMAIL_CHARS.test(e) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); // RFC length cap — giant strings must never become map keys
const COMMON_PASSWORDS = new Set(('123456 password 123456789 12345678 12345 qwerty 111111 1234567 dragon ' +
  '123123 qwerty123 000000 iloveyou 654321 admin welcome monkey 121212 login abc123 azerty ' +
  'sunshine princess football letmein master dragon1 freedom whatever qazwsx trustno1 batman ' +
  'superman jordan harley ranger buster hunter thomas robert charlie daniel hannah maggie ' +
  'summer ashley andrew joshua matthew access flower please shadow michael jennifer jordan23 ' +
  'computer samsung google reader qwe123 zaq12wsx alibaba candy choco chocolate cookie lovelove ' +
  'asdfgh zxcvbnm 1q2w3e4r q2w3e4r 1234qwer qwer1234 hello123 welcome1 welcome123 admin123 ' +
  'passw0rd p@ssword p@ssw0rd internet samsung1 amazon microsoft facebook instagram snapchat ' +
  'pokémon pokemon starwars chewbacca princess1 danielle matrix tigger pepper ginger angel ' +
  'killer soccer hockey baseball softball vikings raiders chelsea liverpool arsenal ' +
  'password1 password12 password123 password1234 iloveyou2 secreto').split(/\s+/));
app.post('/api/auth/login', async (req, res) => {
  if (hitBucket('login:' + ipOf(req), 30, 15 * 60000)) return res.status(429).json({ error: 'Too many attempts — try again shortly' });
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const em = String(email).trim().toLowerCase();
  if (em.length > 254) return res.status(401).json({ error: 'Wrong email or password' }); // no account can exist past the RFC cap — refuse WITHOUT making it a map key
  const key = em + '|' + ipOf(req); // per email+IP: an attacker's failures never lock the victim's own IP out
  // per-ACCOUNT protection: a distributed attack (unique IPs) must not outpace password strength
  const accKey = em;
  const acc = accountAttempts.get(accKey) || { n: 0, at: now(), warned: false, slot: 0 };
  if (acc.at < now() - 3600000) { acc.n = 0; acc.at = now(); acc.warned = false; acc.slot = 0; }
  const tkey = accKey + '|' + ipOf(req);
  const trusted = (trustedIPs.get(tkey) || 0) > now() - 7 * 86400000; // an IP that signed in successfully recently is the owner's own network
  if (acc.n >= 20 && !trusted) { // 20+ failures in the last hour from ANYWHERE: guesses must take SHARED time slots —
    // parallel bursts each used to sleep on their own clock, so throughput never dropped. Now every
    // guess claims the next slot: serveAt = max(slot, now), and a claim more than 5 s out is refused.
    // The owner's usual IPs skip the queue entirely — the attack must never lock THEM out.
    const t = now();
    const serveAt = Math.max(acc.slot, t);
    if (serveAt - t > 5000) return res.status(429).json({ error: 'Too many attempts on this account — try again shortly' }); // refused WITHOUT claiming a slot
    acc.slot = serveAt + 1200; // the next guess, whoever sends it, waits behind this one
    accountAttempts.set(accKey, acc);
    if (serveAt > t) await new Promise(r => setTimeout(r, serveAt - t));
    const holder = db.prepare("SELECT id FROM users WHERE lower(email) = lower(?) AND provider = 'password'").get(accKey);
    if (!acc.warned && holder && RESEND_KEY && mailBase()) { // one-time heads-up to the OWNER — a non-existent address must never receive mail from us
      acc.warned = true;
      sendMail(accKey, 'Security notice for your Did I Lock? account',
        '<p>There have been many failed sign-in attempts on your account in the last hour.</p><p>If that was you, ignore this email. If not, change your password from the app or reset it — your data stays safe either way.</p>').catch(e => console.error('[mail]', e.message));
    }
  }
  accountAttempts.set(accKey, acc);
  const att = loginAttempts.get(key) || { n: 0, at: now() };
  if (att.at < now() - 15 * 60000) { att.n = 0; att.at = now(); }
  if (att.n >= 10) return res.status(429).json({ error: 'Too many failed attempts — try again in a few minutes' });
  loginAttempts.set(key, att);
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(key.slice(0, key.lastIndexOf('|'))); // strip the IP suffix — lastIndexOf, so emails containing | still work
  if (!user) await hashPassword('timing-equalizer'); // burn the same scrypt time — no cheap user-exists oracle
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    att.n++;
    acc.n++;
    return res.status(401).json({ error: 'Wrong email or password' });
  }
  loginAttempts.delete(key);
  accountAttempts.delete(accKey); // a correct password ends the protective mode at once
  trustedIPs.set(tkey, now()); // this network keeps queue-free access for a week of attacks
  res.json({ token: signToken(user.id), user: publicUser(user) });
});

app.post('/api/auth/register', async (req, res) => {
  if (hitBucket('reg:' + ipOf(req), 10, 60 * 60000)) return res.status(429).json({ error: 'Too many sign-up attempts from this network — try again later' });
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
  const pw = String(password);
  const pwErr = passwordProblem(pw);
  if (pwErr) return res.status(400).json({ error: pwErr });
  const em = String(email).trim();
  if (em.length > 254 || !EMAIL_OK(em)) return res.status(400).json({ error: 'That email does not look right' });
  const exists = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(String(email).trim());
  if (exists) return res.status(409).json({ error: 'An account with this email already exists — try signing in' });
  const lang = ['en', 'hi'].includes((req.body || {}).lang) ? req.body.lang : 'en';
  let id;
  try {
    id = db.prepare('INSERT INTO users (name, email, provider, password_hash, followup_minutes, geo_radius_m, notify_inapp, lang, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(String(name).trim().slice(0, 40), String(email).trim().toLowerCase(), 'password', await hashPassword(pw), 5, 250, 1, lang, now()).lastInsertRowid;
  } catch (e) { // two sign-ups raced the same email: the loser gets the same friendly answer as the early check
    if (/UNIQUE/i.test(String(e.message))) return res.status(409).json({ error: 'An account with this email already exists — try signing in' });
    throw e;
  }
  db.prepare('DELETE FROM deleted_ids WHERE id = ?').run(id); // id reused by a genuinely new account
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
const SMS_CC_OK = (process.env.DIL_SMS_CCS || '91').split(',').map(s => s.trim()); // India-only by default — SMS pumping burns real money
function mailBase() { // emailed links must point at the CONFIGURED domain — request headers are attacker-chosen input
  return BASE_URL ? BASE_URL.replace(/\/+$/, '') : '';
}
function oauthBase(req) { // OAuth redirect targets must never come from Host/X-Forwarded-Host — that is attacker-chosen input
  if (BASE_URL) return BASE_URL.replace(/\/+$/, '');
  if (DEMO_MODE) return `${req.protocol}://${req.headers.host || 'localhost'}`; // demo servers have no configured domain
  return null; // production without BASE_URL: OAuth is refused, not header-reflected
}
app.post('/api/auth/phone/request', async (req, res) => {
  const phone = normalizePhone(req.body && req.body.phone);
  const purpose = (req.body && req.body.purpose) === 'reset' ? 'reset' : 'login';
  if (!phone) return res.status(400).json({ error: 'Enter a valid phone number (8–15 digits)' });
  if (!SMS_CC_OK.some(cc => phone.startsWith(cc))) return res.status(400).json({ error: 'This region is not supported for SMS codes yet' });
  if (purpose === 'reset' && !db.prepare('SELECT id FROM users WHERE phone = ?').get(phone))
    return res.status(404).json({ error: 'No account found for this number' });
  if (hitBucket('otpg:' + ipOf(req), 10, 60 * 60000) || hitBucket('num:' + phone, 5, 60 * 60000)) // per-IP AND per-number: rotating IPs cannot buy extra codes for a target number
    return res.status(429).json({ error: 'Too many code requests — please wait a few minutes' });
  db.prepare('DELETE FROM login_codes WHERE expires_at < ?').run(now()); // housekeeping: drop stale codes
  otpAttempts.delete(phone); // a fresh code resets the wrong-attempt counter — guesses are still bounded by the per-phone 5 codes/hour cap
  const code = String(crypto.randomInt(100000, 1000000));
  db.prepare('DELETE FROM login_codes WHERE phone = ? AND purpose = ?').run(phone, purpose);
  db.prepare('INSERT INTO login_codes (phone, code, purpose, expires_at, created_at) VALUES (?,?,?,?,?)')
    .run(phone, otpHash(phone, code), purpose, now() + 5 * 60000, now());
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
  if (!otpEquals(row.code, phone, code)) return res.status(400).json({ error: 'Wrong code — check the message and try again' });
  db.prepare('UPDATE login_codes SET used = 1 WHERE id = ?').run(row.id);
  otpAttempts.delete(phone);
  // exact match first; then tolerate international-format differences (e.g. "+91 98765 43210" vs "9876543210")
  let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user && phone.length === 10) {
    const matches = db.prepare('SELECT * FROM users WHERE phone = ?').all(phone); // exact international match only
    if (matches.length === 1) user = matches[0];
  }
  let created = false;
  if (!user) {
    created = true;
    const id = db.prepare('INSERT INTO users (name, phone, provider, followup_minutes, geo_radius_m, notify_inapp, created_at) VALUES (?,?,?,?,?,?,?)')
      .run('New traveler', phone, 'phone', 5, 250, 1, now()).lastInsertRowid;
    db.prepare('DELETE FROM deleted_ids WHERE id = ?').run(id); // reused id — fresh legitimate account
    insertStarterItems(id);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }
  res.json({ token: signToken(user.id), user: publicUser(user), created });
});
const otpAttempts = new Map();

// ---------- password reset (via phone OTP) ----------
app.post('/api/auth/password/reset', async (req, res) => {
  if (hitBucket('reset:' + ipOf(req), 10, 60 * 60000)) return res.status(429).json({ error: 'Too many attempts — try again later' });
  const phone = normalizePhone(req.body && req.body.phone);
  const code = String((req.body || {}).code || '').trim();
  const newPassword = String((req.body || {}).newPassword || '');
  if (!phone || !code || !newPassword) return res.status(400).json({ error: 'Phone, code and new password required' });
  const pwErrPhone = passwordProblem(newPassword);
  if (pwErrPhone) return res.status(400).json({ error: pwErrPhone }); // same rules as sign-up — a reset is not a loophole
  const row = db.prepare("SELECT * FROM login_codes WHERE phone = ? AND purpose = 'reset' ORDER BY created_at DESC LIMIT 1").get(phone);
  if (!row || row.used) return res.status(400).json({ error: 'No active reset code — request a new one' });
  if (row.expires_at < now()) return res.status(400).json({ error: 'That code expired — request a new one' });
  const att = otpAttempts.get(phone) || { n: 0, at: now() };
  if (att.n >= 5) return res.status(429).json({ error: 'Too many wrong attempts — request a new code' });
  if (!otpEquals(row.code, phone, code)) { att.n++; otpAttempts.set(phone, att); return res.status(400).json({ error: 'Wrong code — check the message and try again' }); }
  otpAttempts.delete(phone);
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user) return res.status(404).json({ error: 'No account found for this number' });
  db.prepare('UPDATE login_codes SET used = 1 WHERE id = ?').run(row.id);
  db.prepare('UPDATE users SET password_hash = ?, token_version = COALESCE(token_version,0) + 1 WHERE id = ?').run(await hashPassword(newPassword), user.id);
  const ownerEmail = String(user.email || '').toLowerCase(); // phone-only accounts have NO email — never touch the map without one
  if (ownerEmail) for (const k of [...trustedIPs.keys()]) if (k.startsWith(ownerEmail + '|')) trustedIPs.delete(k); // the secret changed — network exemptions end
  res.json({ ok: true });
});

// ---------- Google (real OAuth when configured, simulated handshake otherwise) ----------
async function googleExchange(googleId, email, name, { allowPasswordLink = false } = {}) { // allowPasswordLink lets the demo chooser link; production requires a VERIFIED email
  let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
  let created = false, linked = false;
  if (!user) {
    user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(String(email).trim());
    if (user && user.provider === 'password' && !allowPasswordLink && !user.email_verified) {
      return { conflict: true }; // password account with unverified email — refusing auto-link blocks pre-hijacking (demo mode may allow it for the simulated chooser)
    }
    if (user) {
      db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(googleId, user.id);
      linked = true;
    } else {
      created = true;
      const gid = db.prepare('INSERT INTO users (name, email, google_id, provider, password_hash, followup_minutes, geo_radius_m, notify_inapp, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(String(name || 'Google user').trim().slice(0, 40), String(email).trim().toLowerCase(), googleId, 'google',
          await hashPassword(crypto.randomBytes(16).toString('hex')), 5, 250, 1, now()).lastInsertRowid;
      db.prepare('DELETE FROM deleted_ids WHERE id = ?').run(gid);
      insertStarterItems(gid);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(gid);
    }
  }
  return { user, created, linked };
}

// simulated path (demo mode) — same linking semantics as the real OAuth flow
app.post('/api/auth/google', async (req, res) => {
  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) return res.status(410).json({ error: 'Use the Sign in with Google button (the verified OAuth flow)' });
  if (!DEMO_MODE) return res.status(403).json({ error: 'Demo Google linking is disabled on this server' });
  const { id, email, name } = req.body || {};
  if (typeof id !== 'string' || !id.trim() || id.length > 128 || typeof email !== 'string' || !email.includes('@'))
    return res.status(400).json({ error: 'Google account details missing' });
  const gx = await googleExchange(id, email, name, { allowPasswordLink: DEMO_MODE }); // simulated chooser keeps its demo-linking story; real users go through verified OAuth
  if (gx.conflict) return res.status(409).json({ error: 'This email already has a password account. Sign in with the password to use it.' });
  const { user, created, linked } = gx;
  res.json({ token: signToken(user.id), user: publicUser(user), created, linked });
});

// ---- real Google OAuth (active when GOOGLE_CLIENT_ID/SECRET are set) ----
const oauthStates = new Map(); // state -> exp
const googleHandoffs = new Map(); // handoff id -> { token, user, exp }
app.get('/auth/google', (req, res) => {
  if (!oauthBase(req)) return res.redirect('/#google-error=not_configured');
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return res.status(404).json({ error: 'Google OAuth is not configured on this server' });
  const state = crypto.randomBytes(16).toString('hex');
  oauthStates.set(state, now() + 5 * 60000);
  res.setHeader('Set-Cookie', `dil_ost=${state}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=600`); // binds the flow to this browser (login-CSRF guard)
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${oauthBase(req)}/auth/google/callback`, // fixed configured origin — request headers are attacker-chosen
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  }).toString();
  res.redirect(url);
});
app.get('/auth/google/callback', async (req, res) => {
  if (!oauthBase(req)) return res.redirect('/#google-error=not_configured');
  const { code, state, error } = req.query;
  if (error) return res.redirect('/#google-error=' + encodeURIComponent(error));
  const exp = oauthStates.get(String(state || ''));
  oauthStates.delete(String(state || ''));
  const ostMatch = /dil_ost=([^;]+)/.exec(req.headers.cookie || '');
  const ostOk = ostMatch && ostMatch[1] === state;
  if (ostMatch) res.setHeader('Set-Cookie', 'dil_ost=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0');
  if (!ostOk) return res.redirect('/#google-error=state_mismatch');
  if (!exp || exp < now()) return res.redirect('/#google-error=state_expired');
  try {
    const tokRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code), client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: `${oauthBase(req)}/auth/google/callback`, grant_type: 'authorization_code',
      }),
    });
    if (!tokRes.ok) return res.redirect('/#google-error=google_server'); // L: an exchange failure must not masquerade as "unverified email"
    const tok = await tokRes.json();
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${tok.access_token}` } });
    if (!infoRes.ok) return res.redirect('/#google-error=google_server');
    const info = await infoRes.json();
    const emailVerified = info.email_verified === true || info.email_verified === 'true';
    if (!info.email || !emailVerified) return res.redirect('/#google-error=unverified_email'); // never link accounts to an unverified address
    const gx = await googleExchange(info.sub, info.email, info.name);
    if (gx.conflict) return res.redirect('/#google-error=email_taken');
    const { user, created, linked } = gx;
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
app.post('/api/me/phone/request', auth, async (req, res) => {
  const phone = normalizePhone((req.body || {}).phone);
  if (!phone) return res.status(400).json({ error: 'Phone must be 8–15 digits' });
  if (!SMS_CC_OK.some(cc => phone.startsWith(cc))) return res.status(400).json({ error: 'This region is not supported for SMS codes yet' });
  const taken = db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(phone, req.user.id);
  if (taken) return res.status(409).json({ error: 'That phone number is linked to another account' });
  if (hitBucket('otpg:' + ipOf(req), 10, 60 * 60000) || hitBucket('num:' + phone, 5, 60 * 60000)) return res.status(429).json({ error: 'Too many code requests — wait a few minutes' });
  db.prepare('DELETE FROM login_codes WHERE phone = ? AND purpose = ?').run(phone, 'link');
  const code = String(crypto.randomInt(100000, 1000000));
  db.prepare('INSERT INTO login_codes (phone, code, purpose, expires_at, created_at) VALUES (?,?,?,?,?)').run(phone, otpHash(phone, code), 'link', now() + 5 * 60000, now());
  const delivery = await deliverSms(phone, `DIL: ${code} verifies this phone for your Did I Lock? account. It expires in 5 minutes.`);
  if (delivery === 'sent') return res.json({ ok: true, delivery });
  if (delivery === 'failed') return res.status(502).json({ error: 'SMS delivery failed — try again' });
  if (!DEMO_MODE) return res.status(503).json({ error: 'SMS is not configured on this server' });
  res.json({ ok: true, delivery, demo_sms: { to: '+' + phone, body: `DIL: ${code} verifies this phone.` } });
});
app.post('/api/me/phone/verify', auth, (req, res) => {
  const code = String((req.body || {}).code || '').trim();
  const key = 'link:' + req.user.id;
  const att = otpAttempts.get(key) || { n: 0, at: now() };
  if (att.n >= 5) return res.status(429).json({ error: 'Too many wrong attempts — request a new code' });
  const row = db.prepare("SELECT * FROM login_codes WHERE purpose = 'link' AND expires_at > ? AND used = 0").all(now())
    .find(r => normalizePhone(r.phone) && otpEquals(r.code, r.phone, code) && !db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(r.phone, req.user.id));
  if (!row) { att.n++; otpAttempts.set(key, att); return res.status(400).json({ error: 'Wrong or expired code' }); }
  otpAttempts.delete(key);
  db.prepare('UPDATE login_codes SET used = 1 WHERE id = ?').run(row.id);
  db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(row.phone, req.user.id);
  res.json({ ok: true, user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});
app.post('/api/me/signout-all', auth, (req, res) => {
  db.prepare('UPDATE users SET token_version = COALESCE(token_version,0) + 1 WHERE id = ?').run(req.user.id);
  closeUserSSE(req.user.id); // M5: a signed-out-everywhere tab must not keep receiving push events
  { const em = String(req.user.email || '').toLowerCase(); if (em) for (const k of [...trustedIPs.keys()]) if (k.startsWith(em + '|')) trustedIPs.delete(k); } // suspected break-in: revoke network exemptions too (safe by default)
  res.json({ ok: true });
});
const MAIL_FROM = process.env.MAIL_FROM || '';
const RESEND_KEY = process.env.RESEND_API_KEY || '';
async function sendMail(email, subject, html) { // H4: generic sender — verification and password-reset share it
  if (!RESEND_KEY) return 'unavailable';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: MAIL_FROM || 'Did I Lock? <onboarding@resend.dev>', to: email, subject, html }),
    });
    return r.ok ? 'sent' : 'failed';
  } catch { return 'failed'; }
}
app.post('/api/verify-email/start', auth, async (req, res) => {
  if (hitBucket('vmail:' + ipOf(req), 5, 60 * 60000)) return res.status(429).json({ error: 'Too many requests — try later' });
  const email = String(req.user.email || '').trim().toLowerCase(); // H2: the ACCOUNT address only — a body "email" must never redirect someone else's verification
  if (!email || !EMAIL_OK(email)) return res.status(400).json({ error: 'Enter a valid email' });
  if (req.user.email_verified) return res.json({ ok: true, already: true });
  if (!RESEND_KEY || !mailBase()) { // config problems answer identically for every address — no enumeration tell
    if (DEMO_MODE) {
      const token = crypto.randomBytes(24).toString('hex');
      db.prepare('INSERT INTO email_tokens (token_hash, user_id, expires_at, used, created_at, purpose) VALUES (?,?,?,?,?,?)')
        .run(crypto.createHash('sha256').update(token).digest('hex'), req.user.id, now() + 24 * 3600000, 0, now(), 'verify');
      return res.json({ ok: true, delivery: 'demo', token }); // demo hands the link back so the flow is walkable without a mail sender
    }
    return res.status(503).json({ error: 'This server cannot send email yet — the operator must set BASE_URL and RESEND_API_KEY' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO email_tokens (token_hash, user_id, expires_at, used, created_at, purpose) VALUES (?,?,?,?,?,?)')
    .run(crypto.createHash('sha256').update(token).digest('hex'), req.user.id, now() + 24 * 3600000, 0, now(), 'verify');
  sendMail(email, 'Verify your Did I Lock? email', `<p>Tap to verify your email: <a href="${mailBase()}/verify.html#${token}">Verify my email</a></p><p>The link expires in 24 hours.</p>`).catch(e => console.error('[mail]', e.message)); // background — response shape/timing must not leak account existence
  res.json({ ok: true });
});
// ---- H4: forgot-password via EMAIL (password accounts without a linked phone) ----
app.post('/api/auth/email/reset/request', async (req, res) => {
  if (hitBucket('pwreset:' + ipOf(req), 5, 60 * 60000)) return res.status(429).json({ error: 'Too many requests — try later' });
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  if (!email || !EMAIL_OK(email)) return res.status(400).json({ error: 'Enter a valid email' });
  // flood guard WITHOUT refusing anyone: past 3 sends/hour, the answer stays a uniform 200 and
  // we simply send nothing — an earlier link is still valid for a whole hour, so the real victim
  // is never locked out (attackers burning the cap just produce silence). One fresh send per
  // 10 min keeps even a fully-burned hour survivable for the owner.
  const lastSent = resetLastSent.get(email) || 0;
  const overCap = hitBucket('pwreset-em:' + email, 3, 60 * 60000);
  const canSend = !overCap || now() - lastSent >= 10 * 60000;
  const finish = (extra = {}) => res.json({ ok: true, delivery: 'demo', ...extra });
  if (!RESEND_KEY || !mailBase()) { // config check FIRST — it must answer identically for every address (no enumeration tell)
    if (DEMO_MODE) {
      const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!u || u.provider !== 'password' || !canSend) return finish(); // demo echoes nothing for unknown, non-password, or capped-and-recent requests
      const token = crypto.randomBytes(24).toString('hex');
      db.prepare('INSERT INTO email_tokens (token_hash, user_id, expires_at, used, created_at, purpose) VALUES (?,?,?,?,?,?)')
        .run(crypto.createHash('sha256').update(token).digest('hex'), u.id, now() + 3600000, 0, now(), 'reset'); // 1 h — shorter than verify links
      resetLastSent.set(email, now());
      return finish({ token }); // demo echoes so the flow stays walkable without a mail sender
    }
    return res.status(503).json({ error: 'This server cannot send email yet — the operator must set BASE_URL and RESEND_API_KEY' });
  }
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  await new Promise(r => setTimeout(r, 6 + Math.random() * 12)); // flat timing jitter — the lookup difference must not be readable by clock
  if (!u || u.provider !== 'password') return res.json({ ok: true }); // identical shape+status to the success answer — no enumeration
  if (!canSend) return res.json({ ok: true }); // silence — the earlier link is still good; never a 429 for the victim
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO email_tokens (token_hash, user_id, expires_at, used, created_at, purpose) VALUES (?,?,?,?,?,?)')
    .run(crypto.createHash('sha256').update(token).digest('hex'), u.id, now() + 3600000, 0, now(), 'reset'); // 1 h — shorter than verify links
  resetLastSent.set(email, now());
  sendMail(email, 'Reset your Did I Lock? password',
    `<p>Someone (hopefully you) asked to reset your password.</p><p><a href="${mailBase()}/reset.html#${token}">Choose a new password</a></p><p>The link expires in 1 hour. If this wasn't you, ignore this email — your password is unchanged.</p>`).catch(e => console.error('[mail]', e.message)); // background + uniform {ok:true} — no timing or shape tell
  res.json({ ok: true });
});
app.post('/api/auth/email/reset/confirm', async (req, res) => {
  const b = req.body || {};
  const token = String(b.token || '');
  const newPassword = typeof b.newPassword === 'string' ? b.newPassword : '';
  const pwErrReset = passwordProblem(newPassword);
  if (pwErrReset) return res.status(400).json({ error: pwErrReset }); // same rules as sign-up — a reset is not a loophole
  const row = db.prepare('SELECT * FROM email_tokens WHERE token_hash = ? AND purpose = \'reset\'').get(crypto.createHash('sha256').update(token).digest('hex')); // purpose: reset links only
  if (!row || row.used || row.expires_at < now()) return res.status(400).json({ error: 'This link is invalid or has expired — request a fresh one' });
  db.prepare('UPDATE email_tokens SET used = 1 WHERE token_hash = ?').run(row.token_hash); // single-use, even on failure paths below
  const { hashPassword } = require('./db');
  db.prepare('UPDATE users SET password_hash = ?, token_version = COALESCE(token_version,0) + 1 WHERE id = ?')
    .run(await hashPassword(newPassword), row.user_id); // bump token_version: a thief holding an old session is signed out everywhere
  { const u2 = db.prepare('SELECT email FROM users WHERE id = ?').get(row.user_id); const em2 = u2 && String(u2.email || '').toLowerCase(); if (em2) for (const k of [...trustedIPs.keys()]) if (k.startsWith(em2 + '|')) trustedIPs.delete(k); } // the secret changed — network exemptions end
  closeUserSSE(row.user_id);
  res.json({ ok: true });
});
app.post('/api/verify-email/confirm', (req, res) => {
  const token = String((req.body || {}).token || '');
  const h = crypto.createHash('sha256').update(token).digest('hex');
  const row = db.prepare('SELECT * FROM email_tokens WHERE token_hash = ? AND used = 0 AND expires_at > ? AND purpose = \'verify\'').get(h, now()); // purpose: a verify link must never work as a password reset
  if (!row) return res.status(400).json({ error: 'Invalid or expired link' });
  db.prepare('UPDATE email_tokens SET used = 1 WHERE token_hash = ?').run(h);
  db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(row.user_id);
  res.json({ ok: true });
});
app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));
app.get('/api/me/export', auth, (req, res) => { // one-click data portability (DPDP-friendly)
  const u = req.user;
  res.set('Content-Disposition', 'attachment; filename="didilock-export.json"');
  res.json({
    exported_at: new Date().toISOString(),
    profile: publicUser(u),
    items: db.prepare('SELECT * FROM items WHERE user_id = ?').all(u.id),
    sessions: db.prepare('SELECT * FROM sessions WHERE user_id = ?').all(u.id).map(serializeSession),
    tasks: db.prepare('SELECT * FROM tasks WHERE user_id = ?').all(u.id),
    notifications: db.prepare('SELECT * FROM notifications WHERE user_id = ?').all(u.id),
  });
});

app.patch('/api/me', auth, (req, res) => {
  const b = req.body || {};
  const fields = ['name', 'phone', 'home_lat', 'home_lng', 'home_label', 'geo_radius_m', 'followup_minutes', 'notify_inapp', 'lang', 'xp'];
  const sets = [];
  const vals = [];
  const isNum = v => typeof v === 'number' && Number.isFinite(v);
  for (const f of fields) {
    if (b[f] === undefined) continue;
    if (f === 'name') { if (typeof b[f] !== 'string' || !b[f].trim()) return res.status(400).json({ error: 'Name cannot be empty' }); }
    else if (f === 'phone') {
      if (b[f] === null || b[f] === '') { sets.push('phone = NULL'); continue; }
      return res.status(400).json({ error: 'Phone changes need SMS verification — use Settings → Verify by code' });
    }
    else if (f === 'lang') { if (!['en', 'hi'].includes(b[f])) return res.status(400).json({ error: 'Language must be en or hi' }); }
    else if (f === 'home_label') { if (b[f] !== null && typeof b[f] !== 'string') return res.status(400).json({ error: 'Invalid home label' }); }
    else if (f === 'home_lat' || f === 'home_lng' || f === 'geo_radius_m' || f === 'followup_minutes') {
      if (!isNum(b[f])) return res.status(400).json({ error: `Invalid ${f}` }); // numbers must be real numbers — no coercing garbage into the DB
    }
    else if (f === 'notify_inapp') { if (typeof b[f] !== 'boolean') return res.status(400).json({ error: 'Invalid notify_inapp' }); }
    else if (f === 'xp') { if (!Number.isInteger(b[f]) || b[f] < 0 || b[f] > 10000000) return res.status(400).json({ error: 'Invalid xp' }); }
    sets.push(`${f} = ?`);
    if (f === 'name') vals.push(b[f].trim().slice(0, 40));
    else if (f === 'home_label') vals.push(b[f] === null ? null : String(b[f]).slice(0, 60));
    else if (f === 'home_lat') vals.push(Math.max(-90, Math.min(90, b[f])));
    else if (f === 'home_lng') vals.push(Math.max(-180, Math.min(180, b[f])));
    else if (f === 'geo_radius_m') vals.push(Math.max(50, Math.min(5000, b[f])));
    else if (f === 'followup_minutes') vals.push(Math.max(1, Math.min(60, b[f])));
    else if (f === 'xp') vals.push(Math.max(req.user.xp || 0, b[f])); // XP only ever goes up — no losing progress
    else vals.push(f === 'notify_inapp' ? (b[f] ? 1 : 0) : b[f]);
  }
  if (!sets.length) return res.json({ user: publicUser(req.user) });
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.user.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

app.delete('/api/me', auth, async (req, res) => { // a stolen 7-day token must not be able to erase a life's history
  const b = req.body || {};
  if (req.user.provider === 'password') { // H1: gate on HOW the account signs in — google/phone users never knew a password
    const { verifyPassword } = require('./db');
    if (!b.password || !(await verifyPassword(String(b.password), req.user.password_hash))) {
      return res.status(403).json({ error: 'Enter your password to delete the account' });
    }
  } else if (b.confirm !== 'DELETE') { // L (accepted by design): google/phone users hold no other secret; the real
    return res.status(403).json({ error: 'Send confirm: "DELETE" to erase the account' }); // mitigations are the 7-day token, token_version rotation and the delete tombstone
  }
  const uid = req.user.id;
  const wipe = db.transaction(id => {
    db.prepare('DELETE FROM session_items WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)').run(id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM items WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM tasks WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM email_tokens WHERE user_id = ?').run(id);
    if (req.user.phone) db.prepare('DELETE FROM login_codes WHERE phone = ?').run(req.user.phone);
    db.prepare('INSERT OR REPLACE INTO deleted_ids (id, deleted_at) VALUES (?,?)').run(id, now()); // tombstone: SQLite reuses freed rowids — an old token must never become someone else's session
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  });
  closeUserSSE(uid); // M5: no stream outlives its account
  wipe(uid);
  res.json({ ok: true });
});

// ---------------- checklist items (CRUD) ----------------
app.get('/api/items', auth, (req, res) => {
  res.json({ items: db.prepare('SELECT * FROM items WHERE user_id = ? ORDER BY sort_order, id').all(req.user.id) });
});

app.post('/api/items', auth, (req, res) => {
  const { label, icon } = req.body || {};
  if (typeof label !== 'string' || !label.trim() || label.trim().length > 80) return res.status(400).json({ error: 'Give this check a name (up to 80 characters)' });
  if (icon && (typeof icon !== 'string' || icon.length > 24)) return res.status(400).json({ error: 'Invalid icon' });
  if (db.prepare('SELECT COUNT(*) AS c FROM items WHERE user_id = ?').get(req.user.id).c >= 50)
    return res.status(400).json({ error: 'Checklist holds up to 50 items — remove one first' }); // free tier stays lean and fast
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM items WHERE user_id = ?').get(req.user.id).m;
  const id = db.prepare('INSERT INTO items (user_id, label, icon, sort_order, created_at) VALUES (?,?,?,?,?)')
    .run(req.user.id, label.trim().slice(0, 80), (typeof icon === 'string' && icon) ? icon.slice(0, 24) : 'door', max + 1, now()).lastInsertRowid;
  res.status(201).json({ item: db.prepare('SELECT * FROM items WHERE id = ?').get(id) });
});

app.patch('/api/items/reorder', auth, (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length > 200 || !ids.every(Number.isInteger)) return res.status(400).json({ error: 'ids must be a list of item ids' });
  const up = db.prepare('UPDATE items SET sort_order = ? WHERE id = ? AND user_id = ?');
  const tx = db.transaction(() => ids.forEach((id, i) => up.run(i, id, req.user.id)));
  tx();
  res.json({ items: db.prepare('SELECT * FROM items WHERE user_id = ? ORDER BY sort_order, id').all(req.user.id) });
});

app.patch('/api/items/:id', auth, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!item) return res.status(404).json({ error: 'Check not found' });
  const b = req.body || {};
  if (b.label !== undefined && (typeof b.label !== 'string' || !b.label.trim() || b.label.trim().length > 80))
    return res.status(400).json({ error: 'Give this check a name (up to 80 characters)' });
  if (b.icon !== undefined && b.icon && (typeof b.icon !== 'string' || b.icon.length > 24))
    return res.status(400).json({ error: 'Invalid icon' });
  const label = b.label !== undefined ? b.label.trim() : item.label;
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
  const limit = Math.max(1, Math.min(200, Math.floor(Number(req.query.limit) || 50)));
  const rows = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT ?').all(req.user.id, limit);
  res.json({ sessions: rows.map(serializeSession) });
});

app.get('/api/sessions/active', auth, (req, res) => {
  const row = db.prepare("SELECT * FROM sessions WHERE user_id = ? AND status IN ('leaving','followup_pending') ORDER BY started_at DESC LIMIT 1").get(req.user.id);
  res.json({ session: row ? serializeSession(row) : null });
});

const STALE_SESSION_MS = 2 * 60 * 60000; // an unanswered check auto-closes as 'missed' after 2 hours
function closeStaleSessions(userId) {
  return userId
    ? db.prepare("UPDATE sessions SET status = 'missed', resolved_at = ? WHERE user_id = ? AND status IN ('leaving','followup_pending') AND started_at < ?").run(now(), userId, now() - STALE_SESSION_MS)
    : db.prepare("UPDATE sessions SET status = 'missed', resolved_at = ? WHERE status IN ('leaving','followup_pending') AND started_at < ?").run(now(), now() - STALE_SESSION_MS);
}
app.post('/api/sessions', auth, (req, res) => {
  const { items, durationSeconds, lat, lng, mode } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Nothing to check — add at least one check first' });
  closeStaleSessions(req.user.id); // never lock a user out over an ignored check-in
  const active = db.prepare("SELECT id, status FROM sessions WHERE user_id = ? AND status IN ('leaving','followup_pending') LIMIT 1").get(req.user.id);
  if (active) return res.status(409).json({ error: active.status === 'followup_pending' ? 'You have a check-in waiting — answer it before starting a new check' : 'You already have an active check in progress — answer its check-in first' });
  const dur = Math.round(Number(durationSeconds) || 0);
  if (dur && (dur < 1 || dur > 86400)) return res.status(400).json({ error: 'Duration looks wrong' });
  if (lat != null && (!Number.isFinite(Number(lat)) || Number(lat) < -90 || Number(lat) > 90)) return res.status(400).json({ error: 'Invalid latitude' });
  if (lng != null && (!Number.isFinite(Number(lng)) || Number(lng) < -180 || Number(lng) > 180)) return res.status(400).json({ error: 'Invalid longitude' });
  if (items.length > 100) return res.status(400).json({ error: 'That is too many checks for one trip' });
  const ownItem = db.prepare('SELECT id FROM items WHERE id = ? AND user_id = ?');
  for (const it of items) if (it && it.item_id != null && !ownItem.get(it.item_id, req.user.id))
    return res.status(400).json({ error: 'One of those checks is not on your list' });
  const followupAt = now() + Math.max(1, req.user.followup_minutes || 5) * 60000;
  const id = db.prepare(`
    INSERT INTO sessions (user_id, status, started_at, followup_at, note, duration_seconds, lat, lng, mode)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(req.user.id, 'leaving', now(), followupAt, null,
    dur,
    lat != null ? Number(lat) : null, lng != null ? Number(lng) : null,
    mode === 'geo' ? 'geo' : 'manual').lastInsertRowid;
  const ins = db.prepare('INSERT INTO session_items (session_id, item_id, label, checked) VALUES (?,?,?,?)');
  for (const it of items) {
    const o = it || {};
    ins.run(id, Number.isInteger(o.item_id) ? o.item_id : null, String(o.label || 'Untitled check').slice(0, 80), o.checked ? 1 : 0);
  }
  db.prepare('INSERT INTO notifications (user_id, type, title, body, session_id, read, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(req.user.id, 'reminder', 'Reminder scheduled',
      `We will check in with you ${req.user.followup_minutes} minutes after you left, to make sure everything is really done.`, id, 0, now());
  const session = serializeSession(db.prepare('SELECT * FROM sessions WHERE id = ?').get(id));
  sseSend(req.user.id, { type: 'session_created', session_id: id, ts: now() });
  res.status(201).json({ session });
});

const lastGeoPing = new Map(); // sessionId -> ts: GPS pings throttled server-side (battery + API friendly)
app.post('/api/sessions/:id/location', auth, (req, res) => {
  const s = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });
  const lastT = lastGeoPing.get(s.id) || 0;
  if (now() - lastT < 30000) return res.json({ ok: true, throttled: true }); // accept quietly, skip the write
  const { lat, lng } = req.body || {};
  if (lat == null || lng == null) return res.status(400).json({ error: 'lat/lng required' });
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) || Number(lat) < -90 || Number(lat) > 90 || Number(lng) < -180 || Number(lng) > 180) return res.status(400).json({ error: 'Invalid coordinates' });
  db.prepare('UPDATE sessions SET lat = ?, lng = ?, mode = ? WHERE id = ?').run(Number(lat), Number(lng), 'geo', s.id);
  lastGeoPing.set(s.id, now());
  if (lastGeoPing.size > 2000) for (const [k, v] of lastGeoPing) if (now() - v > 3600000) lastGeoPing.delete(k);
  res.json({ ok: true });
});

app.post('/api/sessions/:id/followup', auth, (req, res) => {
  const s = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });
  if (!['leaving', 'followup_pending'].includes(s.status)) return res.status(409).json({ error: 'This check-in was already handled' });
  const { result, note, items } = req.body || {};
  if (!['ok', 'went_back'].includes(result)) return res.status(400).json({ error: 'result must be ok or went_back' });
  const status = result === 'ok' ? 'confirmed_ok' : 'went_back';
  if (Array.isArray(items) && items.length <= 100) { // the review step records reality: which things really weren't done
    const upd = db.prepare('UPDATE session_items SET checked = ? WHERE session_id = ? AND label = ?');
    for (const it of items) {
      if (!it || typeof it.label !== 'string' || !it.label.trim()) continue;
      upd.run(it.checked ? 1 : 0, s.id, it.label.trim().slice(0, 80));
    }
  }
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
  const limit = Math.max(1, Math.min(100, Math.floor(Number(req.query.limit) || 30)));
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
  const dayKey = t => new Date(t + tzMin * 60000).toISOString().slice(0, 10); // pure UTC math — the HOST timezone can never skew this
  const days = new Set(all.map(s => dayKey(s.started_at)));
  let streak = 0;
  let cursor = now();
  if (!days.has(dayKey(cursor))) cursor -= 86400000; // allow "yesterday counts"
  while (days.has(dayKey(cursor))) { streak++; cursor -= 86400000; }

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
  if (db.prepare('SELECT COUNT(*) AS c FROM tasks WHERE user_id = ?').get(req.user.id).c >= 200)
    return res.status(400).json({ error: 'Task list holds up to 200 tasks — clear a few first' });
  const b = req.body || {};
  let parent = null;
  if (b.parent_id) { if (!Number.isInteger(b.parent_id)) return res.status(400).json({ error: 'Invalid parent task' }); parent = db.prepare('SELECT id, parent_id FROM tasks WHERE id = ? AND user_id = ?').get(b.parent_id, req.user.id); if (!parent) return res.status(400).json({ error: 'Parent task not found' }); if (parent.parent_id) return res.status(400).json({ error: 'Subtasks can only go one level deep' }); }
  const info = db.prepare('INSERT INTO tasks (user_id,parent_id,list,title,notes,due_at,sort,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(req.user.id, parent ? parent.id : null, String(b.list || 'General').slice(0, 24), title,
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
  const gone = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (!gone.changes) return res.status(404).json({ error: 'Task not found' });
  res.json({ ok: true });
});

// ---------------- static SPA ----------------
app.use(express.static(PUBLIC, {
  maxAge: '7d', // hashed-ish assets cache long…
  setHeaders: (res, p) => { // images cache a week; ALL code (app.js, styles.css, pages, SW) revalidates every load so deploys land immediately
    if (/\.(png|jpe?g|webp|svg|ico|woff2?)$/i.test(p)) res.setHeader('Cache-Control', 'public, max-age=604800');
    else res.setHeader('Cache-Control', 'no-cache');
  },
}));
app.get(/^\/(?!api\/).*/, (req, res) => {
  if (path.extname(req.path)) return res.status(404).end(); // a missing real file (app.js, img, …) must 404 — never masquerade as the SPA shell
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err); // response already left — let Express close the socket instead of throwing ERR_HTTP_HEADERS_SENT
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) return res.status(400).json({ error: 'Invalid request body' }); // parser internals never reach the client
  if (String(err.code || '').startsWith('SQLITE_') || /constraint failed|can only bind|parameter values|bind numbers/i.test(err.message || '')) {
    console.error('[db]', req.method, req.url, err.message); // detail in the logs only
    return res.status(400).json({ error: 'Invalid request' });
  }
  const code = err.status || 500;
  if (code >= 500) console.error('[error]', req.method, req.url, err.message);
  res.status(code).json({ error: code >= 500 ? 'Something went wrong — please try again' : err.message });
});

function start(port = PORT, host = '0.0.0.0') {
  return app.listen(port, host, () => {
    console.log(`Did I Lock? server running on http://${host}:${port}`);
  });
}
function runBackup() { // nightly local snapshot — better than nothing; point a disk/volume at data/backups for real durability
  // SECURITY: these files include the login-signing and push keys. Copying them OFF the machine
  // (cloud sync, another host) requires encryption in transit and at rest — never ship them raw.
  try {
    const bdir = path.join(DATA_DIR, 'backups');
    fs.mkdirSync(bdir, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);
    const f = path.join(bdir, `dil-${stamp}.db`);
    if (!fs.existsSync(f)) db.exec(`VACUUM INTO '${f.replace(/'/g, "''")}'`);
    for (const extra of [SECRET_FILE, VAPID_FILE]) // M: a backup without the signing/VAPID keys restores a server that signs nobody in and pushes nothing
      if (fs.existsSync(extra)) fs.copyFileSync(extra, path.join(bdir, `dil-${stamp}${path.basename(extra)}`));
    for (const x of fs.readdirSync(bdir)) try { fs.chmodSync(path.join(bdir, x), 0o600); } catch { /* */ } // backups hold secrets — owner-only
    const all = fs.readdirSync(bdir).map(x => `dil-${x.slice(4, 14)}`).filter(x => /^dil-\d{4}-\d{2}-\d{2}$/.test(x)); // by date stamp, across all three file types
    const days = [...new Set(all)].sort();
    while (days.length > 7) { const d = days.shift(); for (const x of fs.readdirSync(bdir)) if (x.includes(d.slice(4))) fs.unlinkSync(path.join(bdir, x)); }
    console.log('[backup]', f, '+ keys');
  } catch (e) { console.error('[backup]', e.message); }
}
function sweepStale() { // housekeeping: nothing expired may linger in memory or the token/notification tables
  const t = now();
  for (const [k, v] of loginAttempts) if (t - v.at > 30 * 60000) loginAttempts.delete(k);
  for (const [k, v] of accountAttempts) if (t - v.at > 3600000) accountAttempts.delete(k);
  for (const [k, v] of resetLastSent) if (t - v > 3600000) resetLastSent.delete(k);
  for (const [k, v] of trustedIPs) if (t - v > 7 * 86400000) trustedIPs.delete(k);
  for (const [k, v] of otpAttempts) if (t - v.at > 30 * 60000) otpAttempts.delete(k);
  for (const [k, v] of oauthStates) if (v < t) oauthStates.delete(k);
  for (const [k, v] of sseTickets) if (v.exp < t) sseTickets.delete(k);
  for (const [k, v] of googleHandoffs) if (v.exp < t) googleHandoffs.delete(k); // unconsumed handoffs still hold a login token
  try { db.prepare('DELETE FROM email_tokens WHERE used = 1 OR expires_at < ?').run(t - 7 * 86400000); } catch { /* */ }
  try { db.prepare('DELETE FROM notifications WHERE read = 1 AND created_at < ?').run(t - 90 * 86400000); } catch { /* */ } // read notices older than 90 days
}
sweepStale();
setInterval(sweepStale, 10 * 60000).unref?.();

if (require.main === module) {
  setTimeout(runBackup, 15000);
  setInterval(runBackup, 24 * 3600000);
  const srv = start();
  process.on('SIGTERM', () => { try { srv.close(() => process.exit(0)); } catch { process.exit(0); } setTimeout(() => process.exit(0), 3000).unref?.(); });
}

module.exports = { app, start };
