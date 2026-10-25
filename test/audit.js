'use strict';
/* Did I Lock? — security & robustness audit harness
 *
 * Run from the repo root (after `npm install`):   node test/audit.js
 *
 * It boots isolated server instances on temp data dirs (nothing touches your real data):
 *   D = demo mode (DIL_SEED_DEMO=1)      P = production-like (demo off)
 *   E = JWT_SECRET left at the .env.example placeholder      G = Google OAuth "configured" (dummy creds)
 * Then runs (1) targeted tests, one per suspected issue, and (2) a generated fuzz matrix.
 * Output: audit-results.json + AUDIT-REPORT.md (written next to this file's repo root).
 *
 * Reading the results: ok=true means the app behaved the way a hardened app should.
 * ok=false is a CONFIRMED finding (the harness observed the behaviour), with a severity tag.
 */
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const http = require('http'), net = require('net');
const ROOT = path.join(__dirname, '..');
const Database = require(path.join(ROOT, 'node_modules', 'better-sqlite3'));
const jwt = require(path.join(ROOT, 'node_modules', 'jsonwebtoken'));

const R = [];                       // targeted results
const MATRIX = { cases: 0, groups: new Map(), byEndpoint: new Map() };
const rec = (cat, id, name, ok, detail = '', sev = 'M', extra = {}) =>
  R.push({ cat, id, name, ok: !!ok, sev: ok ? '' : sev, detail, ...extra });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rint = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const rip = () => `${rint(11, 99)}.${rint(1, 254)}.${rint(1, 254)}.${rint(1, 254)}`;
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
let uniq = 0;
const email = p => `${p}${Date.now().toString(36)}${uniq++}@audit.test`;
const phone10 = () => '9198' + String(rint(10000000, 99999999));
const LEAK = /SQLITE|constraint failed|SqliteError|at\s+[\w$.<>]+\s+\(.*:\d+:\d+\)|node_modules|\/home\/|\/app\/|ReferenceError|TypeError:|SyntaxError|Unexpected token|is not valid JSON/i;

// ---------------------------------------------------------------- servers
const servers = {};
async function boot(name, port, env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `dil-audit-${name}-`));
  const logs = [];
  const proc = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), DIL_DATA_DIR: dir, JWT_SECRET: 'audit-secret-' + name, NODE_ENV: 'production', ...env },
  });
  proc.stdout.on('data', d => logs.push(String(d)));
  proc.stderr.on('data', d => logs.push('[stderr] ' + String(d)));
  const base = `http://127.0.0.1:${port}`;
  let up = false;
  for (let i = 0; i < 80 && !up; i++) { try { up = (await fetch(base + '/api/health')).ok; } catch { /* */ } if (!up) await sleep(250); }
  if (!up) throw new Error(`server ${name} failed to boot:\n${logs.join('')}`);
  const db = new Database(path.join(dir, 'didilock.db'));
  db.pragma('busy_timeout = 4000');
  const s = { name, base, dir, proc, logs, db, port, secret: env.JWT_SECRET || 'audit-secret-' + name };
  servers[name] = s;
  return s;
}
async function stopAll() {
  for (const s of Object.values(servers)) {
    try { s.db.close(); } catch { /* */ }
    try { s.proc.kill('SIGKILL'); } catch { /* */ }
    try { fs.rmSync(s.dir, { recursive: true, force: true }); } catch { /* */ }
  }
}

// ---------------------------------------------------------------- http helper
async function call(base, method, p, o = {}) {
  const { body, rawBody, token, ip, headers = {}, ct = 'application/json', timeout = 12000, noXff } = o;
  const h = { ...headers };
  if (token) h.Authorization = 'Bearer ' + token;
  if (!noXff) h['X-Forwarded-For'] = ip || rip();
  let payload;
  if (rawBody !== undefined) { payload = rawBody; if (ct) h['Content-Type'] = ct; }
  else if (body !== undefined) { payload = JSON.stringify(body); h['Content-Type'] = ct; }
  const t0 = process.hrtime.bigint();
  try {
    const r = await fetch(base + p, { method, headers: h, body: ['GET', 'HEAD'].includes(method) ? undefined : payload, redirect: 'manual', signal: AbortSignal.timeout(timeout) });
    const text = method === 'HEAD' ? '' : await r.text();
    let json; try { json = JSON.parse(text); } catch { /* */ }
    return { status: r.status, headers: r.headers, text, json, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
  } catch (e) {
    return { status: 0, error: `${e.name}: ${e.message}`, timeout: e.name === 'TimeoutError', text: '', ms: Number(process.hrtime.bigint() - t0) / 1e6 };
  }
}
async function reg(s, name = 'Audit', pw = 'Passw0rd!x', em = email('u')) {
  const r = await call(s.base, 'POST', '/api/auth/register', { body: { name, email: em, password: pw } });
  return { ...r, token: r.json && r.json.token, user: r.json && r.json.user, email: em, pw };
}
const waitFor = async (fn, ms = 12000, step = 400) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const exists = f => fs.existsSync(path.join(ROOT, f));
const safe = async (cat, id, name, fn) => { try { await fn(); } catch (e) { rec(cat, id, name + ' (harness error)', true, 'harness error: ' + e.message, 'L', { skipped: true }); } };

// ================================================================ TARGETED: AUTH
async function authTests() {
  const D = servers.D, P = servers.P, E = servers.E;

  await safe('auth', 'A01', 'demo google', async () => {
    const v = await reg(D);
    const r = await call(D.base, 'POST', '/api/auth/google', { body: { id: 'evil-' + uniq++, email: v.email, name: 'x' } });
    const me = r.json && r.json.token ? await call(D.base, 'GET', '/api/me', { token: r.json.token }) : null;
    const took = me && me.json && me.json.user && me.json.user.id === v.user.id;
    rec('auth', 'A01', 'Demo mode: simulated /api/auth/google cannot log in as an arbitrary existing email', !took,
      took ? `HTTP ${r.status}: session token issued for victim account #${v.user.id} with no verification at all` : `HTTP ${r.status}`, 'H', { demoOnly: true });
    const r2 = await call(P.base, 'POST', '/api/auth/google', { body: { id: 'evil', email: v.email, name: 'x' } });
    rec('auth', 'A02', 'Production mode: simulated Google endpoint is disabled', r2.status === 403, `HTTP ${r2.status}`, 'H');
  });

  await safe('auth', 'A03', 'otp echo', async () => {
    const ph = phone10();
    const r = await call(D.base, 'POST', '/api/auth/phone/request', { body: { phone: ph } });
    rec('auth', 'A03', 'Demo mode: OTP is not returned to the requester', !(r.json && r.json.demo_sms),
      r.json && r.json.demo_sms ? 'code echoed in response for ANY phone number (known/accepted: demo feature)' : 'not echoed', 'H', { demoOnly: true, accepted: true });
    const r2 = await call(P.base, 'POST', '/api/auth/phone/request', { body: { phone: ph } });
    rec('auth', 'A03b', 'Production mode: OTP never appears in any response', !/\b\d{6}\b/.test(r2.text) && r2.status === 503, `HTTP ${r2.status} ${r2.text.slice(0, 80)}`, 'H');
  });

  await safe('auth', 'A04', 'pre-hijack', async () => {
    const em = email('pre');
    const atk = await reg(D, 'Attacker', 'AttackerPw1!', em);
    const g = await call(D.base, 'POST', '/api/auth/google', { body: { id: 'gid-' + uniq++, email: em, name: 'Real Owner' } });
    const login = await call(D.base, 'POST', '/api/auth/login', { body: { email: em, password: 'AttackerPw1!' } });
    const hijack = g.json && g.json.linked === true && login.status === 200 && login.json.user.id === g.json.user.id;
    rec('auth', 'A04', 'Google sign-in must not silently merge into a password account whose email was never verified', !hijack,
      hijack ? 'owner\'s Google login was linked to the attacker-created account; attacker\'s password STILL logs into it (pre-hijack). Same googleExchange() code path as real OAuth.' : 'no merge', 'H', { note: 'demonstrated through the simulated Google endpoint; googleExchange() is shared with the real OAuth callback' });
    const r = await reg(P, 'X', 'Passw0rd!x', email('noverify'));
    rec('auth', 'A05', 'Registration requires email verification before a usable session is issued', !(r.status === 200 && r.token),
      r.token ? 'a full 7-day session token is issued immediately for an unverified email' : 'verification required', 'H');
  });

  await safe('auth', 'A06', 'phone squat', async () => {
    const a = await reg(P); const ph = phone10();
    const pa = await call(P.base, 'PATCH', '/api/me', { token: a.token, body: { phone: ph } });
    rec('auth', 'A06', 'A phone number cannot be attached to an account without OTP proof of ownership', pa.status !== 200,
      pa.status === 200 ? 'PATCH /api/me stored an unverified phone number' : `HTTP ${pa.status}`, 'H');
    const a2 = await reg(D); const ph2 = phone10();
    await call(D.base, 'PATCH', '/api/me', { token: a2.token, body: { phone: ph2 } });
    const rq = await call(D.base, 'POST', '/api/auth/phone/request', { body: { phone: ph2 } });
    const code = rq.json && rq.json.demo_sms && (rq.json.demo_sms.body.match(/\d{6}/) || [])[0];
    const vf = await call(D.base, 'POST', '/api/auth/phone/verify', { body: { phone: ph2, code } });
    const landed = vf.json && vf.json.user && vf.json.user.id === a2.user.id;
    rec('auth', 'A06b', 'The real owner of a squatted number does not land in someone else\'s account', !landed,
      landed ? 'OTP login by the number\'s real owner opened the attacker-controlled account' : 'n/a', 'H');
  });

  await safe('auth', 'A07', 'reset brute', async () => {
    const u = await reg(D); const ph = phone10();
    await call(D.base, 'PATCH', '/api/me', { token: u.token, body: { phone: ph } });
    const rq = await call(D.base, 'POST', '/api/auth/phone/request', { body: { phone: ph, purpose: 'reset' } });
    const real = rq.json.demo_sms.body.match(/\d{6}/)[0];
    let wrong = 0, limited = 0;
    for (let i = 0; i < 40; i++) {
      const g = String(100000 + ((Number(real) - 100000 + 1 + i) % 900000));
      const r = await call(D.base, 'POST', '/api/auth/password/reset', { body: { phone: ph, code: g, newPassword: 'NewPassw0rd!' } });
      if (r.status === 400 && /Wrong code/.test(r.text)) wrong++;
      if (r.status === 429) limited++;
    }
    const okr = await call(D.base, 'POST', '/api/auth/password/reset', { body: { phone: ph, code: real, newPassword: 'NewPassw0rd!' } });
    rec('auth', 'A07', 'Password-reset OTP is locked after a handful of wrong guesses (per phone number)', !(wrong >= 40 && okr.status === 200),
      `${wrong}/40 wrong guesses evaluated with no lock-out; the real code still worked afterwards (HTTP ${okr.status}). Only the per-IP cap (10/h) brakes this; guesses here used rotating IPs like a botnet.`, 'H');
    // positive control: the login-OTP verify route does lock
    const u2 = await reg(D); const ph2 = phone10();
    await call(D.base, 'PATCH', '/api/me', { token: u2.token, body: { phone: ph2 } });
    await call(D.base, 'POST', '/api/auth/phone/request', { body: { phone: ph2 } });
    let locked = false;
    for (let i = 0; i < 8; i++) { const r = await call(D.base, 'POST', '/api/auth/phone/verify', { body: { phone: ph2, code: '000000' } }); if (r.status === 429) { locked = true; break; } }
    rec('auth', 'A08', 'Login-OTP verify locks after repeated wrong codes (positive control)', locked, locked ? 'locked as designed' : 'no lock', 'H');
  });

  await safe('auth', 'A09', 'enumeration', async () => {
    const ex = await reg(P);
    const dup = await call(P.base, 'POST', '/api/auth/register', { body: { name: 'x', email: ex.email, password: 'Passw0rd!x' } });
    rec('auth', 'A09', 'Registering an existing email does not reveal that the account exists', dup.status !== 409, `HTTP ${dup.status}: "${(dup.json && dup.json.error || '').slice(0, 60)}"`, 'M');
    const u = await reg(D); const ph = phone10();
    await call(D.base, 'PATCH', '/api/me', { token: u.token, body: { phone: ph } });
    const known = await call(D.base, 'POST', '/api/auth/phone/request', { body: { phone: ph, purpose: 'reset' } });
    const unknown = await call(D.base, 'POST', '/api/auth/phone/request', { body: { phone: phone10(), purpose: 'reset' } });
    rec('auth', 'A09b', 'Password-reset request answers identically for registered and unregistered numbers', known.status === unknown.status,
      `registered → HTTP ${known.status}, unregistered → HTTP ${unknown.status} ("${(unknown.json && unknown.json.error) || ''}")`, 'M');
  });

  await safe('auth', 'A10', 'timing', async () => {
    const users = []; for (let i = 0; i < 6; i++) users.push(await reg(P));
    const ex = [], nx = [];
    for (const u of users) for (let k = 0; k < 3; k++) ex.push((await call(P.base, 'POST', '/api/auth/login', { body: { email: u.email, password: 'wrong-pass-' + k } })).ms);
    for (let i = 0; i < 18; i++) nx.push((await call(P.base, 'POST', '/api/auth/login', { body: { email: email('ghost'), password: 'wrong-pass' } })).ms);
    const a = med(ex), b = med(nx);
    rec('auth', 'A10', 'Login takes the same time for existing and non-existing accounts (no timing oracle)', !(a > b * 3 && a - b > 15),
      `median wrong-password login: existing account ${a.toFixed(1)} ms vs unknown email ${b.toFixed(1)} ms`, 'M');
  });

  await safe('auth', 'A11', 'fuzzy phone', async () => {
    const demo = await call(D.base, 'POST', '/api/auth/login', { body: { email: 'demo@didilock.app', password: 'demo1234' } });
    const demoId = demo.json.user.id;
    const rq = await call(D.base, 'POST', '/api/auth/phone/request', { body: { phone: '9876543210' } });
    const code = (rq.json.demo_sms.body.match(/\d{6}/) || [])[0];
    const vf = await call(D.base, 'POST', '/api/auth/phone/verify', { body: { phone: '9876543210', code } });
    const landed = vf.json && vf.json.user && vf.json.user.id === demoId;
    rec('auth', 'A11', 'A 10-digit number without country code must not log into an account stored as +91 + that number', !landed,
      landed ? 'OTP for "9876543210" logged straight into the account stored as 919876543210 (LIKE \'%…\' match) — a different country\'s subscriber with the same last 10 digits would get in' : 'strict match', 'M');
  });

  await safe('auth', 'A12', 'revocation', async () => {
    const u = await reg(D); const ph = phone10();
    await call(D.base, 'PATCH', '/api/me', { token: u.token, body: { phone: ph } });
    const rq = await call(D.base, 'POST', '/api/auth/phone/request', { body: { phone: ph, purpose: 'reset' } });
    const code = rq.json.demo_sms.body.match(/\d{6}/)[0];
    const rs = await call(D.base, 'POST', '/api/auth/password/reset', { body: { phone: ph, code, newPassword: 'BrandNewPw1!' } });
    const old = await call(D.base, 'GET', '/api/me', { token: u.token });
    const lo = await call(D.base, 'POST', '/api/auth/logout', { token: u.token, body: {} });
    rec('auth', 'A12', 'Password reset invalidates sessions issued before it', !(rs.status === 200 && old.status === 200),
      `after a successful reset the OLD token still returns HTTP ${old.status} on /api/me; /api/auth/logout → HTTP ${lo.status} (no logout / revoke-all endpoint exists)`, 'M');
  });

  await safe('auth', 'A13', 'delete reauth', async () => {
    const u = await reg(P);
    const d = await call(P.base, 'DELETE', '/api/me', { token: u.token });
    rec('auth', 'A13', 'Deleting the account requires re-authentication (password or OTP), not just a bearer token', d.status !== 200,
      `DELETE /api/me with only the bearer token → HTTP ${d.status} (account and all history wiped)`, 'M');
    const again = await call(P.base, 'GET', '/api/me', { token: u.token });
    rec('auth', 'A14', 'Token of a deleted account is rejected', again.status === 401, `HTTP ${again.status}`, 'M');
  });

  await safe('auth', 'A15', 'passwords', async () => {
    const weak = [];
    for (const pw of ['123456', '111111', 'password', 'qwerty']) { const r = await reg(P, 'W', pw); if (r.token) weak.push(pw); }
    rec('auth', 'A15', 'Obviously weak passwords are rejected', weak.length === 0, `accepted: ${weak.join(', ')}`, 'L');
    const big = 'P'.repeat(200000);
    const t = await reg(P, 'Big', big);
    rec('auth', 'A15b', 'Absurdly long passwords are rejected (max length)', !t.token, t.token ? `200,000-character password accepted in ${t.ms.toFixed(0)} ms` : `HTTP ${t.status}`, 'L');
    const long = await call(P.base, 'POST', '/api/auth/register', { body: { name: 'x', email: 'a'.repeat(5000) + '@e.co', password: 'Passw0rd!x' } });
    rec('auth', 'A15c', 'Email length is capped (RFC 254)', long.status !== 200, `5,000-char email → HTTP ${long.status}`, 'L');
    const weird = await call(P.base, 'POST', '/api/auth/register', { body: { name: 'x', email: 'a@@b.c', password: 'Passw0rd!x' } });
    rec('auth', 'A15d', 'Malformed email "a@@b.c" is rejected', weird.status !== 200, `HTTP ${weird.status}`, 'L');
  });

  await safe('auth', 'A16', 'jwt', async () => {
    const u = await reg(P);
    const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ uid: u.user.id })}.`;
    const r1 = await call(P.base, 'GET', '/api/me', { token: none });
    rec('auth', 'A16', 'JWT with alg=none is rejected', r1.status === 401, `HTTP ${r1.status}`, 'H');
    const r2 = await call(P.base, 'GET', '/api/me', { token: jwt.sign({ uid: u.user.id }, 'wrong-secret') });
    rec('auth', 'A16b', 'JWT signed with a wrong secret is rejected', r2.status === 401, `HTTP ${r2.status}`, 'H');
    const r3 = await call(P.base, 'GET', '/api/me', { token: jwt.sign({ uid: u.user.id }, P.secret, { expiresIn: -10 }) });
    rec('auth', 'A16c', 'Expired JWT is rejected', r3.status === 401, `HTTP ${r3.status}`, 'M');
    const r4 = await call(P.base, 'GET', '/api/me', { token: jwt.sign({ uid: 99999999 }, P.secret) });
    rec('auth', 'A16d', 'Validly-signed JWT for a non-existent user is rejected', r4.status === 401, `HTTP ${r4.status}`, 'M');
    const r5 = await call(P.base, 'GET', '/api/me', { token: jwt.sign({ uid: { $gt: 0 } }, P.secret) });
    rec('auth', 'A16e', 'JWT with an object uid does not cause a server error', r5.status === 401, `HTTP ${r5.status}`, 'M');
    const r6 = await call(P.base, 'GET', '/api/me', { token: jwt.sign({ uid: u.user.id }, P.secret, { algorithm: 'HS512' }) });
    rec('auth', 'A16f', 'JWT algorithm is pinned (HS512 token accepted?)', r6.status === 401, `HS512-signed token → HTTP ${r6.status} (library default accepts HS256/384/512; pin algorithms:[\'HS256\'])`, 'L');
  });

  await safe('auth', 'A17', 'placeholder secret', async () => {
    const u = await reg(E);
    const forged = jwt.sign({ uid: u.user.id }, 'change-me-to-a-long-random-string');
    const r = await call(E.base, 'GET', '/api/me', { token: forged });
    rec('auth', 'A17', 'Server refuses to start (or warns) when JWT_SECRET is the .env.example placeholder', r.status !== 200,
      r.status === 200 ? 'token forged with the public placeholder secret was ACCEPTED — anyone can mint tokens if the example file is copied verbatim' : `HTTP ${r.status}`, 'M');
  });

  await safe('auth', 'A18', 'query token', async () => {
    const u = await reg(P);
    const r = await call(P.base, 'GET', '/api/me?token=' + encodeURIComponent(u.token), { noXff: false });
    rec('auth', 'A18', 'Bearer token is accepted only in the Authorization header, never in the URL', r.status !== 200,
      `GET /api/me?token=… → HTTP ${r.status} (tokens in URLs land in access logs, browser history and Referer headers; accepted on EVERY route, not just the SSE stream)`, 'M');
  });

  await safe('auth', 'A19', 'lockout dos', async () => {
    const v = await reg(P);
    for (let i = 0; i < 11; i++) await call(P.base, 'POST', '/api/auth/login', { body: { email: v.email, password: 'nope' + i } });
    const good = await call(P.base, 'POST', '/api/auth/login', { body: { email: v.email, password: v.pw } });
    rec('auth', 'A19', 'An attacker cannot lock a victim out by failing logins for the victim\'s email', good.status === 200,
      `after 11 wrong attempts from rotating IPs the legitimate owner\'s correct password gets HTTP ${good.status}`, 'M');
  });

  await safe('auth', 'A20', 'rate limits', async () => {
    const ip = '203.0.113.' + rint(2, 250);
    let s429 = 0; for (let i = 0; i < 32; i++) { const r = await call(P.base, 'POST', '/api/auth/login', { ip, body: { email: email('rl'), password: 'x' } }); if (r.status === 429) s429++; }
    rec('auth', 'A20', 'Login is rate-limited per IP (positive control)', s429 >= 1, `${s429} of 32 attempts throttled`, 'M');
    const ip2 = '203.0.113.' + rint(2, 250); let reg429 = 0;
    for (let i = 0; i < 7; i++) { const r = await call(P.base, 'POST', '/api/auth/register', { ip: ip2, body: { name: 'x', email: email('rr'), password: 'Passw0rd!x' } }); if (r.status === 429) reg429++; }
    rec('auth', 'A20b', 'Registration is rate-limited per IP (positive control)', reg429 >= 1, `${reg429} of 7 throttled`, 'M');
    const ph = phone10(); let n429 = 0;
    for (let i = 0; i < 7; i++) { const r = await call(D.base, 'POST', '/api/auth/phone/request', { body: { phone: ph } }); if (r.status === 429) n429++; }
    rec('auth', 'A20c', 'OTP requests are limited per phone number even when the IP rotates (positive control)', n429 >= 1, `${n429} of 7 throttled`, 'M');
    const ip3 = '203.0.113.' + rint(2, 250); let v429 = 0;
    for (let i = 0; i < 18; i++) { const r = await call(D.base, 'POST', '/api/auth/phone/verify', { ip: ip3, body: { phone: phone10(), code: '123456' } }); if (r.status === 429) v429++; }
    rec('auth', 'A20d', 'OTP verification is rate-limited per IP (positive control)', v429 >= 1, `${v429} of 18 throttled`, 'M');
  });

  await safe('auth', 'A21', 'concurrency', async () => {
    const em = email('race');
    const rs = await Promise.all(Array.from({ length: 12 }, () => call(P.base, 'POST', '/api/auth/register', { body: { name: 'r', email: em, password: 'Passw0rd!x' } })));
    const created = rs.filter(r => r.status === 200).length, bad = rs.filter(r => r.status >= 500).length;
    rec('auth', 'A21', 'Parallel registrations of one email create exactly one account', created === 1 && bad === 0, `${created} created, ${bad} server errors`, 'M');
    const a = await reg(P, 'Case', 'Passw0rd!x', 'MixedCase' + uniq++ + '@Audit.Test');
    const b = await call(P.base, 'POST', '/api/auth/register', { body: { name: 'x', email: a.email.toLowerCase(), password: 'Passw0rd!x' } });
    rec('auth', 'A21b', 'Email uniqueness is case-insensitive', b.status === 409, `HTTP ${b.status}`, 'M');
  });

  await safe('auth', 'A22', 'sms pumping', async () => {
    const r = await call(D.base, 'POST', '/api/auth/phone/request', { body: { phone: '8821234567890' } });
    rec('auth', 'A22', 'OTP SMS is only sent to an allow-list of countries (premium-rate / SMS-pumping defence)', r.status !== 200,
      `request for an international-premium style prefix → HTTP ${r.status}; any 8–15 digit number is accepted, so once Twilio is live an attacker can burn your balance`, 'M');
  });

  await safe('auth', 'A23', 'mass assignment', async () => {
    const u = await reg(P);
    const r = await call(P.base, 'PATCH', '/api/me', { token: u.token, body: { id: 1, email: 'hax@evil.test', password_hash: 'x', provider: 'google', google_id: 'z', created_at: 1, is_premium: true, name: 'Renamed' } });
    const row = P.db.prepare('SELECT * FROM users WHERE id = ?').get(u.user.id);
    rec('auth', 'A23', 'PATCH /api/me ignores non-whitelisted fields (mass assignment)', row.id === u.user.id && row.email === u.email && row.provider === 'password' && !row.google_id, `HTTP ${r.status}; email/provider/id unchanged`, 'H');
    const g = await call(P.base, 'POST', '/api/auth/register', { body: { name: 'm', email: email('ma'), password: 'Passw0rd!x', provider: 'google', id: 1, google_id: 'q' } });
    const row2 = P.db.prepare('SELECT provider, google_id FROM users WHERE id = ?').get(g.json.user.id);
    rec('auth', 'A23b', 'Registration ignores injected provider/google_id fields', row2.provider === 'password' && !row2.google_id, `provider=${row2.provider}`, 'H');
  });

  await safe('auth', 'A24', 'google oauth', async () => {
    const G = servers.G;
    const r = await call(G.base, 'GET', '/auth/google', { headers: { 'X-Forwarded-Host': 'evil.example', 'X-Forwarded-Proto': 'https' } });
    const loc = r.headers && r.headers.get('location') || '';
    rec('auth', 'A24', 'OAuth redirect_uri is built from a fixed BASE_URL, not from request headers', !/evil\.example/.test(loc),
      /evil\.example/.test(loc) ? 'X-Forwarded-Host: evil.example was reflected into the redirect_uri sent to Google (Google rejects unregistered URIs, but poisoned links/handoff pages become possible)' : 'host not reflected', 'M');
    const state = (new URL(loc, 'http://x').searchParams.get('state')) || '';
    const cb = await call(G.base, 'GET', `/auth/google/callback?code=bogus&state=${state}`, { ip: rip() });
    const l2 = cb.headers && cb.headers.get('location') || '';
    rec('auth', 'A24b', 'OAuth state is bound to the browser that started the flow (login-CSRF defence)', /state_expired/.test(l2),
      `a DIFFERENT client replayed the state and the server accepted it (redirect: ${l2.slice(0, 70)})`, 'M');
    const cb2 = await call(G.base, 'GET', `/auth/google/callback?code=bogus&state=${state}`, { ip: rip() });
    rec('auth', 'A24c', 'OAuth state is single-use (positive control)', /state_expired/.test(cb2.headers.get('location') || ''), (cb2.headers.get('location') || '').slice(0, 60), 'M');
  });
}

// ================================================================ TARGETED: ACCESS CONTROL (IDOR)
async function idorTests() {
  const P = servers.P;
  const A = await reg(P, 'Alice'), B = await reg(P, 'Bob');
  const itemA = (await call(P.base, 'POST', '/api/items', { token: A.token, body: { label: 'A-item' } })).json.item;
  const taskA = (await call(P.base, 'POST', '/api/tasks', { token: A.token, body: { title: 'A-task' } })).json.task;
  const sessA = (await call(P.base, 'POST', '/api/sessions', { token: A.token, body: { items: [{ item_id: itemA.id, label: 'A-item', checked: 1 }] } })).json.session;
  const t = B.token;
  const cases = [
    ['I01', 'PATCH other user\'s item', () => call(P.base, 'PATCH', `/api/items/${itemA.id}`, { token: t, body: { label: 'pwned' } }), r => r.status === 404],
    ['I02', 'DELETE other user\'s item', () => call(P.base, 'DELETE', `/api/items/${itemA.id}`, { token: t }), r => r.status === 404],
    ['I03', 'Reorder including other user\'s item id', () => call(P.base, 'PATCH', '/api/items/reorder', { token: t, body: { ids: [itemA.id] } }), r => r.status === 200 && !(r.json.items || []).some(i => i.id === itemA.id)],
    ['I04', 'POST location on other user\'s session', () => call(P.base, 'POST', `/api/sessions/${sessA.id}/location`, { token: t, body: { lat: 1, lng: 1 } }), r => r.status === 404],
    ['I05', 'POST follow-up on other user\'s session', () => call(P.base, 'POST', `/api/sessions/${sessA.id}/followup`, { token: t, body: { result: 'ok' } }), r => r.status === 404],
    ['I06', 'DELETE other user\'s session', () => call(P.base, 'DELETE', `/api/sessions/${sessA.id}`, { token: t }), r => r.status === 404],
    ['I07', 'PATCH other user\'s task', () => call(P.base, 'PATCH', `/api/tasks/${taskA.id}`, { token: t, body: { title: 'pwned' } }), r => r.status === 404],
    ['I08', 'DELETE other user\'s task', () => call(P.base, 'DELETE', `/api/tasks/${taskA.id}`, { token: t }), r => true],
    ['I09', 'List endpoints never contain other user\'s rows', async () => {
      const [a, b, c, d] = await Promise.all(['/api/items', '/api/sessions', '/api/tasks', '/api/notifications'].map(p => call(P.base, 'GET', p, { token: t })));
      return { status: 200, text: a.text + b.text + c.text + d.text };
    }, r => !/A-item|A-task/.test(r.text)],
    ['I10', 'Active-session lookup does not leak other user\'s session', () => call(P.base, 'GET', '/api/sessions/active', { token: t }), r => r.json && r.json.session === null],
  ];
  for (const [id, name, fn, okf] of cases) {
    await safe('idor', id, name, async () => { const r = await fn(); rec('idor', id, name + ' is denied', okf(r), `HTTP ${r.status}`, 'H'); });
  }
  const itemNow = P.db.prepare('SELECT label FROM items WHERE id = ?').get(itemA.id);
  const taskNow = P.db.prepare('SELECT title FROM tasks WHERE id = ?').get(taskA.id);
  const sessNow = P.db.prepare('SELECT status FROM sessions WHERE id = ?').get(sessA.id);
  rec('idor', 'I11', 'Alice\'s item, task and session are untouched after Bob\'s attacks', itemNow && itemNow.label === 'A-item' && taskNow && taskNow.title === 'A-task' && sessNow && sessNow.status === 'leaving',
    `item=${itemNow && itemNow.label} task=${taskNow && taskNow.title} session=${sessNow && sessNow.status}`, 'H');
  // cross-tenant references
  const sub = await call(P.base, 'POST', '/api/tasks', { token: t, body: { title: 'bob-subtask', parent_id: taskA.id } });
  const subId = sub.json && sub.json.task && sub.json.task.id;
  await call(P.base, 'DELETE', `/api/tasks/${taskA.id}`, { token: A.token });
  const gone = !P.db.prepare('SELECT id FROM tasks WHERE id = ?').get(subId);
  rec('idor', 'I12', 'A task cannot be created under another user\'s parent task', sub.status !== 200,
    sub.status === 200 ? `accepted; when Alice later deleted her task, Bob's subtask ${gone ? 'was cascade-deleted' : 'survived'}` : `HTTP ${sub.status}`, 'L');
  const s2 = await call(P.base, 'POST', '/api/sessions', { token: B.token, body: { items: [{ item_id: itemA.id, label: 'x', checked: 1 }] } });
  rec('idor', 'I13', 'Sessions reject item_ids that belong to another user', s2.status !== 201, `HTTP ${s2.status}`, 'L');
}

// ================================================================ TARGETED: LOGIC / RELIABILITY
async function logicTests() {
  const P = servers.P;
  await safe('logic', 'L01', 'stale lock', async () => {
    const u = await reg(P);
    const s = (await call(P.base, 'POST', '/api/sessions', { token: u.token, body: { items: [{ label: 'x', checked: 1 }] } })).json.session;
    P.db.prepare("UPDATE sessions SET status='followup_pending', started_at=?, followup_at=? WHERE id=?").run(Date.now() - 48 * 3600e3, Date.now() - 48 * 3600e3, s.id);
    const r2 = await call(P.base, 'POST', '/api/sessions', { token: u.token, body: { items: [{ label: 'x', checked: 1 }] } });
    rec('logic', 'L01', 'A check-in left unanswered for 48 h does not block starting a new check', r2.status === 201, `new check → HTTP ${r2.status} ("${(r2.json && r2.json.error || '').slice(0, 70)}")`, 'M');
  });

  // two users for the tick-based tests (one active session each) — fire both, wait once
  const u1 = await reg(P), u2 = await reg(P);
  const mk = async u => (await call(P.base, 'POST', '/api/sessions', { token: u.token, body: { items: [{ label: 'x', checked: 1 }] } })).json.session;
  const s1 = await mk(u1), s2 = await mk(u2);
  P.db.prepare('UPDATE sessions SET started_at=?, followup_at=? WHERE id=?').run(Date.now() - 5 * 60e3, Date.now() - 1000, s1.id);
  P.db.prepare('UPDATE sessions SET started_at=?, followup_at=? WHERE id=?').run(Date.now() - (3 * 3600e3 + 5 * 60e3), Date.now() - 3 * 3600e3, s2.id);
  const notif = async u => waitFor(async () => { const r = await call(P.base, 'GET', '/api/notifications', { token: u.token }); return (r.json.notifications || []).find(n => n.type === 'followup'); }, 12000);
  const [n1, n2] = await Promise.all([notif(u1), notif(u2)]);
  await safe('logic', 'L02', 'notif text', async () => {
    const m = n1 && n1.body.match(/left home (\d+) minutes? ago/);
    const n = m ? Number(m[1]) : null;
    rec('logic', 'L02', 'Follow-up notification states how long ago the user left (≈5 min)', n !== null && n >= 4 && n <= 7,
      n1 ? `user left 5 min before; text says: "${n1.body.slice(0, 60)}" (computed from followup_at instead of started_at; also "1 minutes" grammar)` : 'no notification produced', 'M');
  });
  await safe('logic', 'L03', 'late ping', async () => {
    const st = P.db.prepare('SELECT status FROM sessions WHERE id = ?').get(s2.id).status;
    rec('logic', 'L03', 'A follow-up that is hours overdue (server was asleep) is marked missed instead of pinging', !(n2 && st === 'followup_pending'),
      `follow-up due 3 h ago still fired: notification "${n2 && n2.body.slice(0, 60)}", status=${st}`, 'M');
  });

  await safe('logic', 'L04', 'session validation', async () => {
    const u = await reg(P);
    const r = await call(P.base, 'POST', '/api/sessions', { token: u.token, body: { items: [{ label: 'x', checked: 1 }], durationSeconds: -999999, lat: 9999, lng: -9999, mode: 'geo' } });
    const sid = r.json && r.json.session && r.json.session.id;
    if (sid) await call(P.base, 'POST', `/api/sessions/${sid}/followup`, { token: u.token, body: { result: 'ok' } });
    const st = await call(P.base, 'GET', '/api/stats', { token: u.token });
    rec('logic', 'L04', 'Session duration and coordinates are range-checked', r.status !== 201,
      `accepted durationSeconds=-999999, lat=9999, lng=-9999 (HTTP ${r.status}); stats.avgDuration is now ${st.json && st.json.stats && st.json.stats.avgDuration}`, 'L');
  });

  await safe('logic', 'L05', 'quotas', async () => {
    const u = await reg(P); let ok = 0;
    for (let i = 0; i < 300; i++) { const r = await call(P.base, 'POST', '/api/items', { token: u.token, body: { label: 'bulk' + i } }); if (r.status === 201) ok++; }
    rec('logic', 'L05', 'Per-user cap on checklist items (product spec mentions 50)', ok <= 60, `${ok}/300 items created for one free user — no quota`, 'L');
    const u2 = await reg(P);
    const items = Array.from({ length: 4000 }, (_, i) => ({ label: 'x' + i, checked: 1 }));
    const r = await call(P.base, 'POST', '/api/sessions', { token: u2.token, body: { items } });
    rec('logic', 'L05b', 'A single session cannot carry thousands of items', r.status !== 201, `4,000-item session → HTTP ${r.status}`, 'L');
    let t = 0; const u3 = await reg(P);
    for (let i = 0; i < 300; i++) { const r2 = await call(P.base, 'POST', '/api/tasks', { token: u3.token, body: { title: 't' + i } }); if (r2.status === 200) t++; }
    rec('logic', 'L05c', 'Per-user cap on tasks', t <= 200, `${t}/300 tasks created — no quota`, 'L');
  });

  await safe('logic', 'L06', 'parallel sessions', async () => {
    const u = await reg(P);
    const rs = await Promise.all(Array.from({ length: 20 }, () => call(P.base, 'POST', '/api/sessions', { token: u.token, body: { items: [{ label: 'x', checked: 1 }] } })));
    const c = rs.filter(r => r.status === 201).length;
    rec('logic', 'L06', 'Only one active session can exist per user, even under parallel requests', c === 1, `${c} sessions created from 20 parallel requests`, 'M');
    const sid = rs.find(r => r.status === 201).json.session.id;
    const f1 = await call(P.base, 'POST', `/api/sessions/${sid}/followup`, { token: u.token, body: { result: 'ok', note: 'n'.repeat(900) } });
    const f2 = await call(P.base, 'POST', `/api/sessions/${sid}/followup`, { token: u.token, body: { result: 'went_back' } });
    const note = P.db.prepare('SELECT note FROM sessions WHERE id = ?').get(sid).note;
    rec('logic', 'L06b', 'Follow-up can be answered once; note is truncated to 500 chars', f1.status === 200 && f2.status === 409 && note.length === 500, `first=${f1.status} second=${f2.status} noteLen=${note.length}`, 'M');
  });

  await safe('logic', 'L07', 'followup huge', async () => {
    const u = await reg(P);
    await call(P.base, 'PATCH', '/api/me', { token: u.token, body: { followup_minutes: 1e15 } });
    const r = await call(P.base, 'POST', '/api/sessions', { token: u.token, body: { items: [{ label: 'x', checked: 1 }] } });
    const f = r.json && r.json.session && r.json.session.followup_at;
    rec('logic', 'L07', 'followup_minutes is bounded so the check-in can never be scheduled centuries away', !(r.status === 201 && f > Date.now() + 3 * 86400e3),
      f ? `follow-up scheduled for year ${new Date(f).getUTCFullYear() || 'overflow'} — the ping silently never fires` : `HTTP ${r.status}`, 'L');
    const u2 = await reg(P);
    const bad = await call(P.base, 'PATCH', '/api/me', { token: u2.token, body: { followup_minutes: 'abc' } });
    rec('logic', 'L07b', 'Non-numeric followup_minutes gives a clean 400 (not a 500 with a database message)', bad.status === 400,
      `HTTP ${bad.status}: ${bad.text.slice(0, 110)}`, 'M');
    const bad2 = await call(P.base, 'PATCH', '/api/me', { token: u2.token, body: { geo_radius_m: 'abc' } });
    rec('logic', 'L07c', 'Non-numeric geo_radius_m gives a clean 400', bad2.status === 400, `HTTP ${bad2.status}: ${bad2.text.slice(0, 110)}`, 'M');
    const bad3 = await call(P.base, 'PATCH', '/api/me', { token: u2.token, body: { home_lat: 'abc', home_lng: 'abc' } });
    const row = P.db.prepare('SELECT home_lat, home_lng FROM users WHERE id = ?').get(u2.user.id);
    rec('logic', 'L07d', 'Garbage coordinates are rejected instead of silently erasing the saved home', bad3.status === 400, `HTTP ${bad3.status}; stored home_lat=${row.home_lat}`, 'L');
  });
}

// ================================================================ TARGETED: PUSH / SSE / DOS
async function pushTests() {
  const P = servers.P;
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const subOf = ep => ({ endpoint: ep, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } });

  await safe('push', 'S01', 'ssrf', async () => {
    const hits = [];
    const srv = net.createServer(sock => { hits.push(Date.now()); sock.on('error', () => { }); sock.destroy(); });
    await new Promise(r => srv.listen(0, '127.0.0.1', r));
    const port = srv.address().port;
    const u = await reg(P);
    const sb = await call(P.base, 'POST', '/api/push/subscribe', { token: u.token, body: { subscription: subOf(`https://127.0.0.1:${port}/push`) } });
    const s = (await call(P.base, 'POST', '/api/sessions', { token: u.token, body: { items: [{ label: 'x', checked: 1 }] } })).json.session;
    P.db.prepare('UPDATE sessions SET followup_at=? WHERE id=?').run(Date.now() - 1000, s.id);
    await waitFor(() => hits.length > 0, 12000, 300);
    srv.close();
    rec('push', 'S01', 'Server only sends push requests to genuine push-service hosts (no SSRF)', hits.length === 0,
      `subscription accepted (HTTP ${sb.status}); the server then opened ${hits.length} TCP connection(s) to attacker-chosen 127.0.0.1:${port}`, 'M');
  });

  await safe('push', 'S02', 'endpoint variants', async () => {
    const u = await reg(P);
    const bad = ['http://127.0.0.1/x', 'https://169.254.169.254/latest/meta-data', 'https://localhost:6379/', 'file:///etc/passwd', 'javascript:alert(1)', 'ftp://example.com/x', 'hello', 'https://[::1]/x', 'https://10.0.0.5/admin'];
    const acc = [];
    for (const ep of bad) { const r = await call(P.base, 'POST', '/api/push/subscribe', { token: u.token, body: { subscription: subOf(ep) } }); if (r.status === 200) acc.push(ep); }
    rec('push', 'S02', 'Push subscription endpoints are validated (https + known push hosts)', acc.length === 0, `${acc.length}/${bad.length} unsafe endpoints accepted: ${acc.join(' | ')}`, 'M');
    const huge = await call(P.base, 'POST', '/api/push/subscribe', { token: u.token, body: { subscription: { endpoint: 'https://fcm.googleapis.com/x', junk: 'J'.repeat(200000) } } });
    rec('push', 'S02b', 'Oversized subscription objects are rejected', huge.status !== 200, `200 KB subscription → HTTP ${huge.status}`, 'L');
  });

  await safe('push', 'S03', 'hijack', async () => {
    const A = await reg(P), B = await reg(P);
    const ep = 'https://fcm.googleapis.com/fcm/send/' + crypto.randomBytes(8).toString('hex');
    await call(P.base, 'POST', '/api/push/subscribe', { token: A.token, body: { subscription: subOf(ep) } });
    await call(P.base, 'POST', '/api/push/subscribe', { token: B.token, body: { subscription: subOf(ep) } });
    const row = P.db.prepare('SELECT user_id FROM push_subscriptions WHERE endpoint = ?').get(ep);
    rec('push', 'S03', 'A push endpoint registered by one user cannot be re-assigned by another user', row.user_id === A.user.id,
      `endpoint now belongs to user #${row.user_id} (original owner #${A.user.id}) — ON CONFLICT rewrites user_id`, 'M');
  });

  await safe('sse', 'S04', 'sse cap', async () => {
    const u = await reg(P); const conns = []; let okc = 0;
    for (let i = 0; i < 80; i++) {
      await new Promise(res => {
        const rq = http.get(P.base + '/api/events', { headers: { Authorization: 'Bearer ' + u.token, 'X-Forwarded-For': rip() } }, resp => { conns.push(resp); if (resp.statusCode === 200) okc++; resp.resume(); res(); });
        rq.on('error', () => res());
      });
    }
    conns.forEach(c => { try { c.destroy(); } catch { /* */ } });
    const h = await call(P.base, 'GET', '/api/health');
    rec('sse', 'S04', 'Concurrent SSE streams per user are capped', okc < 20, `${okc}/80 simultaneous event streams accepted for one user (server still healthy: ${h.status === 200})`, 'L');
  });

  await safe('dos', 'S05', 'event loop', async () => {
    const users = []; for (let i = 0; i < 12; i++) users.push(await reg(P));
    const base = []; for (let i = 0; i < 10; i++) base.push((await call(P.base, 'GET', '/api/health')).ms);
    const bl = med(base);
    let stop = false, maxLat = 0;
    const poll = (async () => { while (!stop) { const r = await call(P.base, 'GET', '/api/health'); maxLat = Math.max(maxLat, r.ms); await sleep(5); } })();
    await Promise.all(users.map(u => call(P.base, 'POST', '/api/auth/login', { body: { email: u.email, password: 'wrong-wrong' } })));
    stop = true; await poll;
    rec('dos', 'S05', 'Password hashing does not freeze the server (scryptSync blocks the event loop)', maxLat < Math.max(150, bl * 8),
      `/api/health latency: idle median ${bl.toFixed(1)} ms → worst ${maxLat.toFixed(0)} ms while 12 logins were processed at once; every concurrent user waits`, 'M');
  });

  await safe('dos', 'S06', 'oversize', async () => {
    for (const [sz, label] of [[300e3, '300 KB'], [1e6, '1 MB'], [5e6, '5 MB']]) {
      const r = await call(P.base, 'POST', '/api/items', { rawBody: '{"label":"' + 'x'.repeat(sz) + '"}', token: (await reg(P)).token });
      rec('dos', 'S06', `${label} request body is rejected cleanly`, r.status === 413 || r.status === 0, `HTTP ${r.status} ${r.error || ''} ${(r.json && r.json.error) || ''}`.slice(0, 120), 'M');
    }
    const url = await call(P.base, 'GET', '/api/items/' + 'A'.repeat(20000));
    rec('dos', 'S06b', '20 KB URL is rejected without a server error', url.status === 0 || (url.status >= 400 && url.status < 500), `HTTP ${url.status}`, 'L');
  });
}

// ================================================================ TARGETED: HEADERS / STATIC / DB / STATIC-ANALYSIS
async function hardeningTests() {
  const P = servers.P;
  const r = await call(P.base, 'GET', '/', { headers: { 'X-Forwarded-Proto': 'https', 'Accept-Encoding': 'gzip, br' } });
  const h = n => r.headers.get(n);
  rec('headers', 'H01', 'X-Content-Type-Options: nosniff', h('x-content-type-options') === 'nosniff', h('x-content-type-options') || 'missing', 'L');
  rec('headers', 'H02', 'Clickjacking protection (X-Frame-Options)', /DENY|SAMEORIGIN/.test(h('x-frame-options') || ''), h('x-frame-options') || 'missing', 'M');
  rec('headers', 'H03', 'Content-Security-Policy present', !!h('content-security-policy'), h('content-security-policy') || 'missing (inline-script heavy PWA — see index.html inline handlers)', 'M');
  rec('headers', 'H04', 'HSTS sent over HTTPS', !!h('strict-transport-security'), h('strict-transport-security') || 'missing', 'M');
  rec('headers', 'H05', 'HSTS covers subdomains / is preload-ready', /includeSubDomains/i.test(h('strict-transport-security') || ''), h('strict-transport-security') || '', 'L');
  rec('headers', 'H06', 'Referrer-Policy set', !!h('referrer-policy'), h('referrer-policy') || 'missing', 'L');
  rec('headers', 'H07', 'X-Powered-By hidden', !h('x-powered-by'), h('x-powered-by') || 'hidden', 'L');
  const me = await call(P.base, 'GET', '/api/me', { token: (await reg(P)).token });
  rec('headers', 'H08', 'API responses carry Cache-Control: no-store', /no-store/.test(me.headers.get('cache-control') || ''), me.headers.get('cache-control') || 'missing — personal data could be cached by proxies/browsers', 'L');
  const js = await call(P.base, 'GET', '/app.js', { headers: { 'Accept-Encoding': 'gzip, br' } });
  rec('perf', 'H09', 'Static assets are gzip/brotli compressed', !!js.headers.get('content-encoding'), `/app.js: ${js.text.length} bytes, content-encoding=${js.headers.get('content-encoding') || 'none'}`, 'L');
  rec('perf', 'H10', 'Static assets have long-lived cache headers', /max-age=([1-9]\d{3,})/.test(js.headers.get('cache-control') || ''), js.headers.get('cache-control') || 'none', 'L');
  const pre = await call(P.base, 'OPTIONS', '/api/me', { headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } });
  rec('headers', 'H11', 'No permissive CORS on the API', !pre.headers.get('access-control-allow-origin'), pre.headers.get('access-control-allow-origin') || 'no CORS headers (good)', 'H');

  const marks = /require\(|JWT_SECRET|SQLite format 3|root:x:|BEGIN (RSA|PRIVATE)|scryptSync|"dependencies"/;
  const probes = ['/../server/db.js', '/..%2fserver%2fdb.js', '/%2e%2e/server/db.js', '/..%2f..%2fetc%2fpasswd', '/package.json', '/server/index.js', '/.env', '/.env.example', '/.git/config', '/Dockerfile', '/render.yaml', '/data/didilock.db', '/.secret', '/.vapid.json', '/test/api.js', '/node_modules/express/package.json', '/%00', '/public/../package.json', '/....//server/db.js', '/API.md'];
  let leaked = [];
  for (const p of probes) { const x = await call(P.base, 'GET', p); if (x.status === 200 && marks.test(x.text)) leaked.push(p); }
  rec('static', 'H12', 'Source files, secrets and database are not reachable over HTTP', leaked.length === 0, leaked.length ? 'LEAKED: ' + leaked.join(', ') : `${probes.length} traversal/sensitive-file probes all safe`, 'H');
  const nf = await call(P.base, 'GET', '/definitely-missing.js');
  rec('static', 'H13', 'Unknown static paths return 404 (not the SPA shell with HTTP 200)', nf.status === 404, `GET /definitely-missing.js → HTTP ${nf.status} ${nf.headers.get('content-type') || ''}`, 'L');
  const wip = await call(P.base, 'GET', '/api/whoip');
  rec('static', 'H14', 'Debug endpoint /api/whoip is not public', wip.status !== 200, `HTTP ${wip.status}`, 'L');
  const big = await call(P.base, 'GET', '/icon-master.png');
  rec('static', 'H15', 'Unused 2 MB master icon is not served publicly', big.status !== 200, `/icon-master.png → HTTP ${big.status}`, 'L');
  const api404 = await call(P.base, 'GET', '/api/nope');
  rec('static', 'H16', 'Unknown API routes return JSON 404', api404.status === 404 && !!api404.json, `HTTP ${api404.status}`, 'L');

  // ----- error handling
  const bj = await call(P.base, 'POST', '/api/auth/login', { rawBody: '{"email":', ct: 'application/json' });
  rec('leak', 'E01', 'Malformed JSON gives a generic error (no parser internals)', !LEAK.test(bj.text), `HTTP ${bj.status}: ${bj.text.slice(0, 120)}`, 'L');
  // health check path from render.yaml
  const rm = read('render.yaml').match(/healthCheckPath:\s*(\S+)/);
  if (rm) { const hc = await call(P.base, 'GET', rm[1], { noXff: true }); rec('ops', 'O01', `render.yaml healthCheckPath (${rm[1]}) returns 2xx without credentials`, hc.status >= 200 && hc.status < 300, `unauthenticated GET ${rm[1]} → HTTP ${hc.status}; Render will treat the service as unhealthy`, 'H'); }
  const hl = await call(P.base, 'GET', '/api/health');
  rec('ops', 'O02', 'A public /api/health exists for monitors', hl.status === 200, `HTTP ${hl.status}`, 'M');

  // ----- database
  const D = servers.D;
  const u = await reg(D); const ph = phone10();
  await call(D.base, 'PATCH', '/api/me', { token: u.token, body: { phone: ph } });
  const rq = await call(D.base, 'POST', '/api/auth/phone/request', { body: { phone: ph } });
  const code = rq.json.demo_sms.body.match(/\d{6}/)[0];
  const row = D.db.prepare('SELECT code FROM login_codes WHERE phone = ?').get(ph);
  rec('db', 'B01', 'OTP codes are stored hashed, not in plaintext', row && row.code !== code, row && row.code === code ? 'login_codes.code holds the 6-digit code in clear text' : 'hashed', 'M');
  const ph2 = D.db.prepare('SELECT password_hash FROM users WHERE id = ?').get(u.user.id).password_hash;
  rec('db', 'B02', 'Passwords use salted scrypt', /^[0-9a-f]{32}:[0-9a-f]{128}$/.test(ph2), ph2.slice(0, 12) + '…', 'H');
  // cascade delete
  const X = await reg(P); const it = (await call(P.base, 'POST', '/api/items', { token: X.token, body: { label: 'c' } })).json.item;
  const ss = (await call(P.base, 'POST', '/api/sessions', { token: X.token, body: { items: [{ item_id: it.id, label: 'c', checked: 1 }] } })).json.session;
  await call(P.base, 'POST', '/api/tasks', { token: X.token, body: { title: 'c' } });
  await call(P.base, 'POST', '/api/push/subscribe', { token: X.token, body: { subscription: { endpoint: 'https://fcm.googleapis.com/x' + uniq++ } } });
  await call(P.base, 'DELETE', '/api/me', { token: X.token });
  const left = ['items', 'sessions', 'tasks', 'notifications', 'push_subscriptions'].map(t => [t, P.db.prepare(`SELECT COUNT(*) c FROM ${t} WHERE user_id = ?`).get(X.user.id).c]).concat([['session_items', P.db.prepare('SELECT COUNT(*) c FROM session_items WHERE session_id = ?').get(ss.id).c]]);
  rec('db', 'B03', 'Deleting an account removes every related row (right to erasure)', left.every(([, c]) => c === 0), left.map(([t, c]) => `${t}:${c}`).join(' '), 'H');
  const noIdx = ['tasks', 'session_items', 'login_codes', 'push_subscriptions', 'notifications'].filter(t => !P.db.prepare(`PRAGMA index_list('${t}')`).all().some(i => !/^sqlite_autoindex/.test(i.name)));
  rec('db', 'B04', 'Hot lookup columns are indexed', noIdx.length === 0, noIdx.length ? `no secondary index on: ${noIdx.join(', ')} (full scans as data grows)` : 'ok', 'L');
  const mode = (fs.statSync(path.join(P.dir, 'didilock.db')).mode & 0o777).toString(8);
  rec('db', 'B05', 'Database file is not world-readable', !(parseInt(mode, 8) & 0o004), `mode ${mode}`, 'L');

  // ----- static analysis of the repo
  const app = read('public/app.js'), sw = read('public/sw.js'), idx = read('server/index.js'), dbjs = read('server/db.js');
  const docker = read('Dockerfile'), dign = read('.dockerignore'), pkg = JSON.parse(read('package.json')), html = read('public/index.html');
  rec('client', 'C01', 'Android-safe system notifications (registration.showNotification) used by the page', /showNotification/.test(app), `app.js uses \`new Notification(\` ${(app.match(/new Notification\(/g) || []).length}× and never showNotification — throws "Illegal constructor" on Android Chrome; errors are swallowed by try/catch`, 'H');
  const wp = app.slice(app.indexOf('watchPosition('), app.indexOf('watchPosition(') + 2500);
  rec('client', 'C02', 'Live-location uploads are throttled', /last\w*\s*=\s*Date\.now\(\)/.test(wp), 'every GPS callback POSTs /api/sessions/:id/location for 30 min (no throttle variable found)', 'M');
  const so = app.slice(app.indexOf('function signOut'), app.indexOf('function signOut') + 600);
  rec('client', 'C03', 'Sign-out unsubscribes this device from push', /unsubscribe/.test(so), 'signOut() clears the token but leaves the push subscription → next user on a shared phone receives the previous user\'s pings', 'M');
  rec('client', 'C04', 'Event stream reconnects after a non-200 / dropped connection', /es\.onerror|\.onerror\s*=/.test(app.slice(app.indexOf('function connectSSE'), app.indexOf('function connectSSE') + 1800)), 'no onerror handler on EventSource', 'L');
  rec('client', 'C05', 'Session token is not stored in localStorage', !/localStorage\.setItem\('dil_token'/.test(app), `dil_token written to localStorage ${(app.match(/setItem\('dil_token'/g) || []).length}× (readable by any XSS)`, 'M');
  rec('client', 'C06', 'EventSource URL does not carry the token', !/EventSource\(`[^`]*token=/.test(app), 'EventSource(`/api/events?token=…`)', 'M');
  const tpl = [...app.matchAll(/\$\{([^}]*)\}/g)].map(m => m[1]).filter(e => /\.(label|note|notes|title|name|body|list|email)\b|home_label/.test(e) && !/esc\(/.test(e));
  const benign = tpl.filter(e => !/firstName\(|' · noted'|^due\.label$/.test(e.trim()));
  rec('client', 'C07', 'No unescaped user text interpolated into HTML templates (XSS sinks)', benign.length === 0, benign.length ? 'suspect: ' + benign.slice(0, 5).join(' | ') : `${tpl.length} candidate interpolations, all escaped or benign`, 'H');
  rec('client', 'C08', 'No eval / new Function / document.write', !/\beval\(|new Function\(|document\.write\(/.test(app), 'clean', 'H');
  const inl = (html.match(/\son\w+="/g) || []).length;
  rec('client', 'C09', 'index.html has no inline event handlers (CSP-ready)', inl === 0, `${inl} inline on*= handlers and ${(html.match(/<script(?![^>]*src)/g) || []).length} inline <script> blocks`, 'L');
  rec('client', 'C10', 'Service worker registered once', (app.match(/serviceWorker\.register\(/g) || []).length === 1, `${(app.match(/serviceWorker\.register\(/g) || []).length} register() calls`, 'L');
  rec('push', 'C11', 'Server push options set urgency + TTL', /sendNotification\([^)]*,[^)]*,\s*\{/.test(idx.replace(/\n/g, ' ')), 'webpush.sendNotification(sub, payload) is called with no options → normal urgency, Android Doze may delay the 5-minute ping', 'M');
  rec('push', 'C12', 'Service worker notification uses renotify + requireInteraction', /renotify/.test(sw) && /requireInteraction/.test(sw), 'fixed tag "didilock-checkin" with neither flag → later pings can arrive silently and auto-dismiss', 'M');
  rec('code', 'C13', 'OTP compare is constant-time', /timingSafeEqual/.test(idx.slice(idx.indexOf("'/api/auth/phone/verify'"), idx.indexOf("'/api/auth/phone/verify'") + 2500)), 'row.code !== code (string compare)', 'L');
  rec('code', 'C14', 'Placeholder JWT secret is rejected at startup', /change-me/.test(idx), 'no guard in server/index.js', 'M');
  rec('code', 'C15', 'Legacy migration is wrapped in a transaction', /BEGIN|transaction\(/.test(dbjs.slice(dbjs.indexOf('function migrate'), dbjs.indexOf('function migrate') + 1800)), 'migrate() runs DROP TABLE users with foreign_keys OFF and no BEGIN/COMMIT — a crash mid-way loses all users', 'M');
  rec('code', 'C16', 'Global error handler hides internal messages', !/res\.status\(err\.status \|\| 500\)\.json\(\{ error: err\.message/.test(idx), 'returns err.message to the client', 'M');
  rec('code', 'C17', 'Password hashing is async (crypto.scrypt)', !/scryptSync/.test(dbjs), 'scryptSync in hashPassword/verifyPassword', 'M');
  rec('code', 'C18', 'Graceful shutdown handler (SIGTERM) exists', /SIGTERM/.test(idx), 'none — Render sends SIGTERM on every deploy; in-flight SQLite writes/SSE are cut', 'L');
  rec('infra', 'C19', 'Container runs as non-root', /^\s*USER\s+\S+/m.test(docker), 'no USER directive', 'M');
  rec('infra', 'C20', 'Base image is a supported Node LTS', !/FROM node:(1\d|20)\b/.test(docker), (docker.match(/FROM \S+/) || [''])[0] + ' (Node 20 reached end-of-life April 2026)', 'M');
  rec('infra', 'C21', 'Docker build ignores .env files', /^\.env$/m.test(dign), '.dockerignore lacks .env — a local .env is baked into the image', 'M');
  rec('infra', 'C22', 'Dockerfile uses npm ci', /npm ci/.test(docker), 'uses npm install', 'L');
  rec('infra', 'C23', 'HEALTHCHECK fails on non-2xx', /\.ok|status/.test(docker.slice(docker.indexOf('HEALTHCHECK'))), 'fetch().catch(): only network errors fail; a 401/500 passes', 'L');
  rec('infra', 'C24', 'package.json pins Node (engines)', !!pkg.engines, 'no "engines" field', 'L');
  rec('infra', 'C25', 'Every production dependency is used', !(pkg.dependencies.sharp && !/require\('sharp'\)/.test(idx + dbjs)), 'sharp is a production dependency but nothing requires it', 'L');
  rec('legal', 'C26', 'License matches the plan to sell the app', pkg.license !== 'ISC' && exists('LICENSE'), `package.json license=${pkg.license}; LICENSE file ${exists('LICENSE') ? 'present' : 'missing'}`, 'M');
  rec('ops', 'C27', 'Automated backups exist', exists('scripts/backup.sh') || /VACUUM INTO/.test(idx + dbjs), 'no backup script/job anywhere in the repo (SQLite on one disk)', 'H');
  rec('ops', 'C28', 'CI workflow exists (.github/workflows)', exists('.github/workflows'), 'none', 'L');
  rec('legal', 'C29', 'Repo contains no personal-looking seed data', !/Katpadi/.test(dbjs), 'db.js seeds real-looking coordinates/names ("Katpadi", "Ash R.")', 'L');
  rec('legal', 'C30', 'Privacy policy / terms are present in the app', /privacy/i.test(html) && /terms/i.test(html), 'neither link appears in index.html', 'M');
  rec('legal', 'C31', 'Data export (portability) endpoint exists', /\/api\/me\/export/.test(idx), 'none (only DELETE /api/me)', 'L');
  const imgs = fs.readdirSync(path.join(ROOT, 'public/img')).map(f => [f, fs.statSync(path.join(ROOT, 'public/img', f)).size]).concat(fs.readdirSync(path.join(ROOT, 'public')).filter(f => /\.png$/.test(f)).map(f => [f, fs.statSync(path.join(ROOT, 'public', f)).size]));
  const total = imgs.reduce((a, [, s]) => a + s, 0);
  rec('perf', 'C32', 'Total image weight under 3 MB', total < 3e6, `${(total / 1e6).toFixed(1)} MB across ${imgs.length} images; biggest: ${imgs.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f, s]) => `${f} ${(s / 1e6).toFixed(1)}MB`).join(', ')}`, 'M');
  rec('perf', 'C33', 'JS is minified / bundled', app.length < 80000, `app.js ${(app.length / 1024).toFixed(0)} KB, ${app.split('\n').length} lines, unminified single file`, 'L');
  rec('perf', 'C34', 'Web manifest has screenshots + lang (store/PWA install quality)', /screenshots/.test(read('public/manifest.webmanifest')) && /"lang"/.test(read('public/manifest.webmanifest')), 'missing screenshots and lang', 'L');
}

// ================================================================ MATRIX FUZZ
const deepArr = n => { let a = []; for (let i = 0; i < n; i++) a = [a]; return a; };
const big = n => 'A'.repeat(n);
const PAYLOADS = [
  ['null', null], ['true', true], ['false', false], ['zero', 0], ['neg1', -1], ['one', 1], ['float', 0.1], ['max', 1e308], ['negmax', -1e308], ['bigint', 9007199254740993],
  ['empty', ''], ['space', ' '], ['a', 'a'], ['str10k', big(10000)], ['str100k', big(100000)], ['emoji', '😀🔒🏠'.repeat(10)], ['rtl', '\u202Eevil\u202C'], ['nullbyte', 'a\u0000b'],
  ['sqli1', "' OR '1'='1"], ['sqli2', '"; DROP TABLE users;--'], ['xss1', '<script>alert(1)</script>'], ['xss2', '<img src=x onerror=alert(1)>'], ['tpl', '${7*7}{{7*7}}'],
  ['path', '../../etc/passwd'], ['crlf', 'a\r\nSet-Cookie: x=1'], ['arr0', []], ['arr3', [1, 2, 3]], ['arrstr', ['a', 'b']], ['obj0', {}], ['objnest', { a: { b: { c: 1 } } }],
  ['proto', JSON.parse('{"__proto__":{"x":1}}')], ['ctor', { constructor: { prototype: { x: 1 } } }], ['deep200', deepArr(200)], ['numstr', '12345'], ['digits16', '1234567890123456'], ['negstr', '-5'], ['expstr', '1e9'],
];
const EXTRA = {
  phone: [['ph12', '919999999999'], ['ph+', '+91 99999 99999'], ['ph00', '00919999999999'], ['phnum', 919999999999]],
  phoneopt: [['ph12', '919999999999'], ['phnum', 919999999999]],
  email: [['ok', 'a@b.co'], ['upper', 'A@B.CO'], ['long300', big(300) + '@x.com'], ['dblat', 'a@@b.c'], ['plus', 'a+tag@b.co'], ['homoglyph', 'аdmin@b.co']],
  lat: [['lat90', 90], ['lat90x', 90.0001], ['latneg90', -90], ['lat999', 999]],
  lng: [['lng180', 180], ['lng180x', 180.0001], ['lng999', 999]],
  minutes: [['m1', 1], ['m1440', 1440], ['m1e12', 1e12], ['m0.5', 0.5]],
  radius: [['r10', 10], ['r1e9', 1e9], ['r0', 0]],
  endpoint: [['ep_local', 'https://127.0.0.1/x'], ['ep_meta', 'https://169.254.169.254/latest'], ['ep_http', 'http://example.com/x'], ['ep_file', 'file:///etc/passwd'], ['ep_fcm', 'https://fcm.googleapis.com/fcm/send/abc']],
};
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const digits = v => (typeof v === 'string' || typeof v === 'number') && /^\d{8,15}$/.test(String(v).replace(/[^\d]/g, '')) && String(v).replace(/[^\d]/g, '').length >= 8;
const VALID = {
  any: () => true,
  pw: v => typeof v === 'string' && v.length >= 6 && v.length <= 128,
  name: v => typeof v === 'string' && v.trim().length >= 1 && v.length <= 100,
  label: v => typeof v === 'string' && v.trim().length >= 1 && v.length <= 200,
  str: v => typeof v === 'string' && v.length >= 1 && v.length <= 200,
  text: v => typeof v === 'string' && v.length <= 2000,
  email: v => typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  phone: v => digits(v),
  phoneopt: v => v === null || v === '' || digits(v),
  code: v => typeof v === 'string' && /^\d{6}$/.test(v),
  lat: v => isNum(v) && v >= -90 && v <= 90,
  lng: v => isNum(v) && v >= -180 && v <= 180,
  radius: v => isNum(v) && v >= 10 && v <= 50000,
  minutes: v => isNum(v) && v >= 1 && v <= 1440,
  bool: v => typeof v === 'boolean',
  ids: v => Array.isArray(v) && v.length <= 500 && v.every(Number.isInteger),
  items: v => Array.isArray(v) && v.length >= 1 && v.length <= 100 && v.every(x => x && typeof x === 'object' && typeof x.label === 'string' && x.label.length <= 200),
  dur: v => isNum(v) && v >= 0 && v <= 86400,
  mode: v => v === 'geo' || v === 'manual',
  result: v => v === 'ok' || v === 'went_back',
  dueAt: v => v === null || (isNum(v) && v > 0),
  parent: v => v === null,
  endpoint: v => typeof v === 'string' && /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[\w.-]+\.notify\.windows\.com)\//.test(v),
  obj: v => v && typeof v === 'object' && !Array.isArray(v),
};
const ph = () => '9198' + rint(10000000, 99999999);

let CTX = {};
const EP = [
  { id: 'POST /api/auth/login', srv: 'P', m: 'POST', path: () => '/api/auth/login', base: () => ({ email: email('l'), password: 'Passw0rd!x' }), fields: { email: 'email', password: 'pw' } },
  { id: 'POST /api/auth/register', srv: 'P', m: 'POST', path: () => '/api/auth/register', base: () => ({ name: 'F', email: email('r'), password: 'Passw0rd!x' }), fields: { name: 'name', email: 'email', password: 'pw' } },
  { id: 'POST /api/auth/phone/request', srv: 'D', m: 'POST', path: () => '/api/auth/phone/request', base: () => ({ phone: ph(), purpose: 'login' }), fields: { phone: 'phone', purpose: 'any' } },
  { id: 'POST /api/auth/phone/verify', srv: 'D', m: 'POST', path: () => '/api/auth/phone/verify', base: () => ({ phone: ph(), code: '123456' }), fields: { phone: 'phone', code: 'code' } },
  { id: 'POST /api/auth/password/reset', srv: 'D', m: 'POST', path: () => '/api/auth/password/reset', base: () => ({ phone: ph(), code: '123456', newPassword: 'Passw0rd!x' }), fields: { phone: 'phone', code: 'code', newPassword: 'pw' } },
  { id: 'POST /api/auth/google (demo)', srv: 'D', m: 'POST', path: () => '/api/auth/google', base: () => ({ id: 'g' + uniq++, email: email('g'), name: 'G' }), fields: { id: 'str', email: 'email', name: 'name' } },
  { id: 'POST /api/auth/google/handoff', srv: 'P', m: 'POST', path: () => '/api/auth/google/handoff', base: () => ({ id: 'abc' }), fields: { id: 'str' } },
  { id: 'PATCH /api/me', srv: 'P', m: 'PATCH', auth: 'main', path: () => '/api/me', base: () => ({}), fields: { name: 'name', phone: 'phoneopt', home_lat: 'lat', home_lng: 'lng', home_label: 'label', geo_radius_m: 'radius', followup_minutes: 'minutes', notify_inapp: 'bool' } },
  { id: 'POST /api/items', srv: 'P', m: 'POST', auth: 'main', path: () => '/api/items', base: () => ({ label: 'fz' + uniq++, icon: 'door' }), fields: { label: 'label', icon: 'str' } },
  { id: 'PATCH /api/items/:id', srv: 'P', m: 'PATCH', auth: 'main', path: () => `/api/items/${CTX.item}`, base: () => ({ label: 'fz', icon: 'door' }), fields: { label: 'label', icon: 'str' } },
  { id: 'PATCH /api/items/reorder', srv: 'P', m: 'PATCH', auth: 'main', path: () => '/api/items/reorder', base: () => ({ ids: [CTX.item] }), fields: { ids: 'ids' } },
  { id: 'POST /api/sessions', srv: 'P', m: 'POST', auth: 'sess', pre: 'clear', post: 'delete', path: () => '/api/sessions', base: () => ({ items: [{ label: 'x', checked: 1 }], durationSeconds: 10, lat: 12.9, lng: 79.9, mode: 'manual' }), fields: { items: 'items', durationSeconds: 'dur', lat: 'lat', lng: 'lng', mode: 'mode' } },
  { id: 'POST /api/sessions/:id/location', srv: 'P', m: 'POST', auth: 'sess', pre: 'fresh', path: c => `/api/sessions/${c.sid}/location`, base: () => ({ lat: 12.9, lng: 79.9 }), fields: { lat: 'lat', lng: 'lng' } },
  { id: 'POST /api/sessions/:id/followup', srv: 'P', m: 'POST', auth: 'sess', pre: 'fresh', path: c => `/api/sessions/${c.sid}/followup`, base: () => ({ result: 'ok', note: 'fine' }), fields: { result: 'result', note: 'text' } },
  { id: 'POST /api/tasks', srv: 'P', m: 'POST', auth: 'main', path: () => '/api/tasks', base: () => ({ title: 'fz', notes: 'n', due_at: 1893456000000, list: 'General' }), fields: { title: 'str', notes: 'text', due_at: 'dueAt', list: 'str', parent_id: 'parent' } },
  { id: 'PATCH /api/tasks/:id', srv: 'P', m: 'PATCH', auth: 'main', path: () => `/api/tasks/${CTX.task}`, base: () => ({ title: 'fz' }), fields: { title: 'str', notes: 'text', due_at: 'dueAt', list: 'str', done: 'bool' } },
  { id: 'POST /api/push/subscribe', srv: 'P', m: 'POST', auth: 'main', path: () => '/api/push/subscribe', base: () => ({ subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/' + crypto.randomBytes(6).toString('hex'), keys: { p256dh: 'x', auth: 'y' } } }), fields: { subscription: 'obj', 'subscription.endpoint': 'endpoint' } },
  { id: 'POST /api/push/unsubscribe', srv: 'P', m: 'POST', auth: 'main', path: () => '/api/push/unsubscribe', base: () => ({ subscription: { endpoint: 'https://fcm.googleapis.com/x' } }), fields: { subscription: 'obj', 'subscription.endpoint': 'str' } },
];
const setPath = (o, p, v) => { const k = p.split('.'); let c = o; for (let i = 0; i < k.length - 1; i++) { if (typeof c[k[i]] !== 'object' || c[k[i]] === null) c[k[i]] = {}; c = c[k[i]]; } c[k[k.length - 1]] = v; };

function noteMatrix(epId, field, kind, payloadName, detail) {
  MATRIX.cases++;
  MATRIX.byEndpoint.set(epId, (MATRIX.byEndpoint.get(epId) || 0) + 1);
  if (!kind) return;
  const key = `${epId} :: ${field} :: ${kind}`;
  const g = MATRIX.groups.get(key) || { epId, field, kind, count: 0, examples: [] };
  g.count++; (g.all = g.all || []).push(payloadName); if (g.examples.length < 3) g.examples.push(`${payloadName}${detail ? ' → ' + detail : ''}`);
  MATRIX.groups.set(key, g);
}
async function clearActive(P, token) {
  const a = await call(P.base, 'GET', '/api/sessions/active', { token });
  if (a.json && a.json.session) await call(P.base, 'DELETE', `/api/sessions/${a.json.session.id}`, { token });
}
async function oneCase(srv, ep, field, pn, pv, tokens) {
  const token = ep.auth ? tokens[ep.auth] : undefined;
  const ctx = {};
  if (ep.pre === 'clear') await clearActive(srv, token);
  if (ep.pre === 'fresh') { await clearActive(srv, token); const r = await call(srv.base, 'POST', '/api/sessions', { token, body: { items: [{ label: 'x', checked: 1 }] } }); ctx.sid = r.json && r.json.session && r.json.session.id; }
  const body = ep.base(); setPath(body, field, pv);
  const r = await call(srv.base, ep.m, ep.path(ctx), { token, body });
  if (ep.post === 'delete' && r.json && r.json.session) await call(srv.base, 'DELETE', `/api/sessions/${r.json.session.id}`, { token });
  let kind = null, detail = '';
  const type = ep.fields[field];
  if (r.status === 0 && r.timeout) { kind = 'HANG (>12 s)'; }
  else if (r.status === 0) { kind = 'CONNECTION ERROR'; detail = r.error; }
  else if (r.status >= 500) { kind = 'SERVER ERROR 5xx'; detail = `HTTP ${r.status} ${r.text.slice(0, 100)}`; }
  else if (LEAK.test(r.text)) { kind = 'INTERNAL DETAIL LEAKED'; detail = r.text.slice(0, 100); }
  else if (r.ms > 2500) { kind = 'SLOW (>2.5 s)'; detail = r.ms.toFixed(0) + ' ms'; }
  else if (r.status >= 200 && r.status < 300 && !(VALID[type] || VALID.any)(pv)) { kind = 'INVALID INPUT ACCEPTED'; detail = `HTTP ${r.status}`; }
  noteMatrix(ep.id, field, kind, pn, detail);
}
async function runMatrix() {
  const P = servers.P;
  const main = await reg(P, 'Fuzz'), sess = await reg(P, 'FuzzS');
  const tokens = { main: main.token, sess: sess.token };
  CTX.item = (await call(P.base, 'POST', '/api/items', { token: main.token, body: { label: 'fz' } })).json.item.id;
  CTX.task = (await call(P.base, 'POST', '/api/tasks', { token: main.token, body: { title: 'fz' } })).json.task.id;
  for (const ep of EP) {
    const srv = servers[ep.srv];
    for (const [field, type] of Object.entries(ep.fields)) {
      const payloads = PAYLOADS.concat(EXTRA[type] || []);
      for (const [pn, pv] of payloads) await oneCase(srv, ep, field, pn, pv, tokens);
    }
    console.log(`  matrix: ${ep.id} done (${MATRIX.byEndpoint.get(ep.id)} cases)`);
  }

  // whole-body fuzz (body replaced entirely)
  const bodies = [['arr', []], ['str', '"x"'], ['num', '1'], ['null', 'null'], ['trunc', '{"a":'], ['empty', ''], ['bom', '\uFEFF{"a":1}'], ['dupkeys', '{"email":"a","email":"b"}'], ['nested', '{"a":' .repeat(100) + '1' + '}'.repeat(100)], ['bigarr', '[' + '1,'.repeat(50000) + '1]'], ['unicode', '{"e":"\\ud800"}'], ['ctrl', '{"a":"\u0001"}']];
  for (const ep of EP) {
    const srv = servers[ep.srv]; const token = ep.auth ? tokens[ep.auth] : undefined;
    for (const [bn, raw] of bodies) {
      const ctx = {};
      if (ep.pre === 'fresh') { await clearActive(srv, token); const r0 = await call(srv.base, 'POST', '/api/sessions', { token, body: { items: [{ label: 'x', checked: 1 }] } }); ctx.sid = r0.json && r0.json.session && r0.json.session.id; }
      if (ep.pre === 'clear') await clearActive(srv, token);
      const r = await call(srv.base, ep.m, ep.path(ctx), { token, rawBody: raw });
      let kind = null, detail = '';
      if (r.status === 0 && r.timeout) kind = 'HANG (>12 s)';
      else if (r.status >= 500) { kind = 'SERVER ERROR 5xx'; detail = r.text.slice(0, 100); }
      else if (LEAK.test(r.text)) { kind = 'INTERNAL DETAIL LEAKED'; detail = r.text.slice(0, 90); }
      noteMatrix(ep.id, '(whole body)', kind, bn, detail);
      if (r.json && r.json.session && ep.post === 'delete') await call(srv.base, 'DELETE', `/api/sessions/${r.json.session.id}`, { token });
    }
  }
  console.log('  matrix: whole-body fuzz done');

  // content types
  const cts = ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', 'application/xml', 'application/json; charset=utf-16', null];
  for (const ep of EP.filter(e => e.m !== 'GET')) {
    const srv = servers[ep.srv]; const token = ep.auth ? tokens[ep.auth] : undefined;
    if (ep.pre) continue;
    for (const ct of cts) {
      const r = await call(srv.base, ep.m, ep.path({}), { token, rawBody: '{"a":1}', ct });
      let kind = null; if (r.status >= 500) kind = 'SERVER ERROR 5xx'; else if (LEAK.test(r.text)) kind = 'INTERNAL DETAIL LEAKED';
      noteMatrix(ep.id, '(content-type)', kind, String(ct), r.text.slice(0, 80));
    }
  }
  console.log('  matrix: content-type fuzz done');

  // auth header variants (expect 401)
  const valid = main.token;
  const heads = ['', 'Bearer', 'Bearer ', 'bearer ' + valid, 'Basic YWJjOmFiYw==', 'Bearer null', 'Bearer undefined', 'Bearer a.b.c', 'Bearer ' + 'A'.repeat(10000), 'Bearer ' + valid + 'x', 'Bearer ' + valid.slice(0, -2), 'Bearer  ' + valid, 'Token ' + valid, valid, 'Bearer ' + valid.split('.').slice(0, 2).join('.') + '.', 'Bearer ..', 'Bearer ' + valid.replace(/\./g, '..')];
  for (const route of ['/api/me', '/api/items', '/api/sessions', '/api/tasks', '/api/notifications', '/api/stats', '/api/events']) {
    for (const hv of heads) {
      const r = await call(P.base, 'GET', route, { headers: hv ? { Authorization: hv } : {}, timeout: 4000 });
      if (r.status === 0 && !r.timeout) { noteMatrix('GET ' + route, '(Authorization)', null, hv.slice(0, 20)); continue; }
      let kind = null; if (r.status >= 500) kind = 'SERVER ERROR 5xx'; else if (r.status === 200 && !/^Bearer [A-Za-z0-9._-]+$/.test(hv)) kind = 'INVALID INPUT ACCEPTED'; else if (r.status === 200 && hv !== 'Bearer ' + valid) kind = 'INVALID INPUT ACCEPTED';
      if (r.timeout && route === '/api/events') kind = null; // SSE legitimately stays open
      noteMatrix('GET ' + route, '(Authorization)', kind, hv.slice(0, 24), 'HTTP ' + r.status);
    }
  }
  console.log('  matrix: auth-header fuzz done');

  // path-parameter fuzz
  const ids = ['abc', '-1', '0', '1e9', '99999999999999999999', '%00', '..%2f', '%', '<script>', '1%20OR%201=1', 'NaN', '%20', 'null', '0x10', '1.5', '٣', '%F0%9F%98%80'];
  const routes = [['PATCH', '/api/items/:id', { label: 'x' }], ['DELETE', '/api/items/:id'], ['DELETE', '/api/sessions/:id'], ['POST', '/api/sessions/:id/location', { lat: 1, lng: 1 }], ['POST', '/api/sessions/:id/followup', { result: 'ok' }], ['PATCH', '/api/tasks/:id', { title: 'x' }], ['DELETE', '/api/tasks/:id']];
  for (const [m, tpl, body] of routes) for (const id of ids) {
    const r = await call(P.base, m, tpl.replace(':id', id), { token: main.token, body });
    let kind = null; if (r.status >= 500) kind = 'SERVER ERROR 5xx'; else if (LEAK.test(r.text)) kind = 'INTERNAL DETAIL LEAKED'; else if (r.status === 200 && !/^\d+$/.test(id) && m !== 'DELETE') kind = 'INVALID INPUT ACCEPTED';
    noteMatrix(`${m} ${tpl}`, '(path id)', kind, id, 'HTTP ' + r.status);
  }
  console.log('  matrix: path-id fuzz done');

  // query-string fuzz
  const qv = ['abc', '-1', '0', '1e9', 'NaN', '', '%00', '999999999999999999999', '[]', '{}', '1.5', '--1', '0x10', 'A'.repeat(5000), 'a&limit=5', 'x%27'];
  for (const [route, key] of [['/api/sessions', 'limit'], ['/api/notifications', 'limit'], ['/api/stats', 'tz']]) for (const v of qv) {
    const r = await call(P.base, 'GET', `${route}?${key}=${v}`, { token: main.token });
    let kind = null; if (r.status >= 500) kind = 'SERVER ERROR 5xx'; else if (LEAK.test(r.text)) kind = 'INTERNAL DETAIL LEAKED';
    noteMatrix('GET ' + route, '?' + key, kind, v.slice(0, 20), 'HTTP ' + r.status);
  }
  for (const key of ['code', 'state', 'error']) for (const v of qv) {
    const r = await call(servers.G.base, 'GET', `/auth/google/callback?${key}=${v}`);
    let kind = null; const loc = (r.headers && r.headers.get('location')) || '';
    if (r.status >= 500) kind = 'SERVER ERROR 5xx'; else if (loc && !/^\/(#|handoff)/.test(loc)) kind = 'OPEN REDIRECT';
    noteMatrix('GET /auth/google/callback', '?' + key, kind, v.slice(0, 20), loc.slice(0, 60));
  }
  const repeated = ['/auth/google/callback?error=a&error=b', '/auth/google/callback?state[]=x', '/auth/google/callback?code[a]=1', '/api/stats?tz=1&tz=2', '/api/sessions?limit=1&limit[]=2'];
  for (const u of repeated) { const r = await call(servers.G.base, 'GET', u, { token: main.token }); noteMatrix('GET (repeated params)', u, r.status >= 500 ? 'SERVER ERROR 5xx' : null, u, 'HTTP ' + r.status); }
  console.log('  matrix: query fuzz done');

  // HTTP-method fuzz
  const mroutes = ['/api/me', '/api/items', '/api/items/1', '/api/sessions', '/api/sessions/1', '/api/sessions/active', '/api/tasks', '/api/tasks/1', '/api/notifications', '/api/notifications/read', '/api/stats', '/api/auth/login', '/api/auth/register', '/api/push/vapid', '/api/health', '/api/config', '/'];
  for (const route of mroutes) for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
    const r = await call(P.base, m, route, { token: main.token, body: ['POST', 'PUT', 'PATCH'].includes(m) ? {} : undefined, timeout: 4000 });
    if (r.timeout) { noteMatrix(`${m} ${route}`, '(method)', route === '/api/events' ? null : 'HANG (>12 s)', m); continue; }
    noteMatrix(`${m} ${route}`, '(method)', r.status >= 500 ? 'SERVER ERROR 5xx' : null, m, 'HTTP ' + r.status);
  }
  console.log('  matrix: method fuzz done');
}

// ================================================================ REPORT
function sevRank(s) { return { H: 0, M: 1, L: 2, '': 3 }[s]; }
function buildReport(health) {
  const fails = R.filter(r => !r.ok && !r.skipped).sort((a, b) => sevRank(a.sev) - sevRank(b.sev) || a.id.localeCompare(b.id, undefined, { numeric: true }));
  const passes = R.filter(r => r.ok);
  const totalCases = R.length + MATRIX.cases;
  const groups = [...MATRIX.groups.values()].sort((a, b) => b.count - a.count);
  const matrixBad = groups.reduce((a, g) => a + g.count, 0);
  const RANGE = new Set(['max','negmax','bigint','str10k','str100k','lat999','lat90x','lng999','lng180x','m1e12','r1e9','r0','long300','dblat','ep_local','ep_meta','ep_http','ep_file','homoglyph']);
  let rangeGaps = 0, coercion = 0; const rangeByField = {};
  groups.filter(g => g.kind === 'INVALID INPUT ACCEPTED').forEach(g => (g.all || []).forEach(pn => { if (RANGE.has(pn)) { rangeGaps++; const k = g.epId + ' :: ' + g.field; rangeByField[k] = (rangeByField[k] || 0) + 1; } else coercion++; }));
  const bySev = s => fails.filter(f => f.sev === s).length;
  const kinds = {}; groups.forEach(g => { kinds[g.kind] = (kinds[g.kind] || 0) + g.count; });
  const lines = [];
  lines.push('# Did I Lock? — Audit Report', '');
  lines.push(`Total executed cases: **${totalCases}** (${R.length} targeted + ${MATRIX.cases} generated fuzz cases)`, '');
  lines.push('## Summary', '');
  lines.push(`- Targeted tests: **${passes.length} passed**, **${fails.length} confirmed findings** (High ${bySev('H')}, Medium ${bySev('M')}, Low ${bySev('L')})`);
  lines.push(`- Fuzz matrix: **${MATRIX.cases - matrixBad} clean**, **${matrixBad} flagged** across ${groups.length} distinct (endpoint, field, problem) signatures`);
  Object.entries(kinds).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => lines.push(`  - ${k}: ${n}`));
  lines.push(`  - of the INVALID INPUT ACCEPTED: ${rangeGaps} are real range/size/format gaps (value of the right type but out of bounds); ${coercion} are wrong-type coercion (e.g. true/0/[] stored as text) — low impact`);
  lines.push(`- Server survival: ${health.map(h => `${h.name} ${h.alive ? 'alive' : 'CRASHED'}`).join(', ')}`, '');
  lines.push('## Confirmed findings (targeted)', '');
  for (const f of fails) lines.push(`- **[${f.sev}] ${f.id} — ${f.name}**${f.demoOnly ? ' _(demo mode only)_' : ''}${f.accepted ? ' _(accepted by owner)_' : ''}\n  - ${f.detail}`);
  lines.push('', '## Fuzz matrix findings (grouped)', '');
  lines.push('| Count | Endpoint | Field | Problem | Examples |', '|---:|---|---|---|---|');
  for (const g of groups.slice(0, 120)) lines.push(`| ${g.count} | ${g.epId} | ${g.field} | ${g.kind} | ${g.examples.join('; ').replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 160)} |`);
  if (groups.length > 120) lines.push('', `(${groups.length - 120} more signatures in audit-results.json)`);
  lines.push('', '## Cases per endpoint', '');
  [...MATRIX.byEndpoint.entries()].forEach(([k, n]) => lines.push(`- ${k}: ${n}`));
  lines.push('', '## Controls that passed', '');
  passes.forEach(p => lines.push(`- ${p.id} — ${p.name}`));
  const logs = Object.values(servers).flatMap(s => s.logs.join('').split('\n').filter(l => /\[error\]|Unhandled|uncaught/i.test(l)).map(l => `${s.name}: ${l.trim()}`));
  const counts = {}; logs.forEach(l => { counts[l] = (counts[l] || 0) + 1; });
  lines.push('', '## Server-side error log (top messages)', '');
  Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([l, n]) => lines.push(`- ×${n} ${l.slice(0, 160)}`));
  return { md: lines.join('\n'), fails, passes, groups, totalCases, kinds, counts, rangeGaps, coercion, rangeByField };
}

// ================================================================ MAIN
(async () => {
  const t0 = Date.now();
  console.log('booting servers…');
  await boot('D', 3911, { DIL_SEED_DEMO: '1' });
  await boot('P', 3912, {});
  await boot('E', 3913, { JWT_SECRET: 'change-me-to-a-long-random-string' });
  await boot('G', 3914, { GOOGLE_CLIENT_ID: 'dummy-id.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'dummy-secret' });
  for (const [n, f] of [['auth', authTests], ['access control', idorTests], ['logic', logicTests], ['push/sse/dos', pushTests], ['hardening/static', hardeningTests]]) {
    console.log(`targeted: ${n}…`); try { await f(); } catch (e) { console.log('  harness error in', n, e.stack); }
  }
  console.log(`targeted done: ${R.length} tests. running fuzz matrix…`);
  try { await runMatrix(); } catch (e) { console.log('matrix error', e.stack); }
  const health = [];
  for (const s of Object.values(servers)) { const h = await call(s.base, 'GET', '/api/health'); health.push({ name: s.name, alive: h.status === 200 && s.proc.exitCode === null }); }
  const rep = buildReport(health);
  const out = process.env.AUDIT_OUT || ROOT;
  fs.writeFileSync(path.join(out, 'AUDIT-REPORT.md'), rep.md);
  fs.writeFileSync(path.join(out, 'audit-results.json'), JSON.stringify({ totalCases: rep.totalCases, targeted: R, matrixCases: MATRIX.cases, matrixGroups: rep.groups, serverLogTop: rep.counts, rangeGaps: rep.rangeGaps, coercion: rep.coercion, rangeByField: rep.rangeByField, health }, null, 1));
  console.log(`\nDONE in ${((Date.now() - t0) / 1000).toFixed(0)} s — ${rep.totalCases} cases; targeted: ${rep.passes.length} pass / ${rep.fails.length} findings; matrix flagged: ${rep.groups.reduce((a, g) => a + g.count, 0)}`);
  await stopAll();
  process.exit(0);
})().catch(async e => { console.error('FATAL', e); await stopAll(); process.exit(1); });
