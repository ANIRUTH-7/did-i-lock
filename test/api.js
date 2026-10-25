'use strict';
/* Server API tests — node --test test/api.js (isolated temp data dir) */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dil-test-'));
process.env.DIL_DATA_DIR = tmp;
process.env.JWT_SECRET = 'test-secret';
process.env.DIL_SEED_DEMO = '1'; // exercise demo helpers (OTP echo, demo login)

const { start } = require('../server');
const { db } = require('../server/db');

let server, base;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = (p, body, tok) => fetch(base + p, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
  body: JSON.stringify(body),
}).then(async r => ({ status: r.status, ...(await r.json()) }));
const patch = (p, body, tok) => fetch(base + p, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
  body: JSON.stringify(body),
}).then(async r => ({ status: r.status, ...(await r.json()) }));
const get = (p, tok) => fetch(base + p, { headers: tok ? { Authorization: 'Bearer ' + tok } : {} }).then(async r => ({ status: r.status, ...(await r.json()) }));
const del = (p, tok, body) => fetch(base + p, { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }).then(async r => ({ status: r.status, ...(await r.json()) }));

test.before(async () => {
  server = start(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => {
  try { server.close(); } catch { /* */ }
  try { db.close(); } catch { /* */ }
  fs.rmSync(tmp, { recursive: true, force: true });
});

let demoTok, demoEmail, newUser, newTok;

test('health + config', async () => {
  const h = await get('/api/health');
  assert.equal(h.status, 200);
  assert.equal(h.ok, true);
  const c = await get('/api/config');
  assert.equal(c.status, 200);
  assert.equal(c.push, true);
  assert.equal(c.googleOauth, false); // not configured in tests
});

test('register seeds a starter checklist', async () => {
  const r = await post('/api/auth/register', { name: 'Test User', email: 'new@test.dev', password: 'secret12' });
  assert.equal(r.status, 200);
  assert.ok(r.token);
  assert.equal(r.user.name, 'Test User');
  assert.equal(r.user.provider, 'password');
  newTok = r.token;
  const items = await get('/api/items', newTok);
  assert.equal(items.items.length, 4);
  assert.ok(items.items.some(i => i.label === 'Stove off'));
});

test('login: correct + wrong + rate limit', async () => {
  const bad = await post('/api/auth/login', { email: 'new@test.dev', password: 'nope' });
  assert.equal(bad.status, 401);
  const good = await post('/api/auth/login', { email: 'new@test.dev', password: 'secret12' });
  assert.equal(good.status, 200);
  assert.ok(good.token);
  for (let i = 0; i < 12; i++) await post('/api/auth/login', { email: 'new@test.dev', password: 'wrong' + i });
  const limited = await post('/api/auth/login', { email: 'new@test.dev', password: 'secret12' });
  assert.equal(limited.status, 429);
});

test('item CRUD + reorder', async () => {
  const created = await post('/api/items', { label: 'Garage door', icon: 'car' }, newTok);
  assert.equal(created.status, 201);
  const patched = await patch(`/api/items/${created.item.id}`, { label: 'Garage door locked' }, newTok);
  assert.equal(patched.item.label, 'Garage door locked');
  const items = await get('/api/items', newTok);
  const ids = items.items.map(i => i.id).reverse();
  const re = await patch('/api/items/reorder', { ids }, newTok);
  assert.equal(re.items[0].id, ids[0]);
  const gone = await del(`/api/items/${created.item.id}`, newTok);
  assert.equal(gone.status, 200);
  const after = await get('/api/items', newTok);
  assert.equal(after.items.length, 4);
});

test('sessions: create, active guard, follow-up tick, resolve', async () => {
  const items = await get('/api/items', newTok);
  const sess = await post('/api/sessions', { items: items.items.map(i => ({ item_id: i.id, label: i.label, checked: 1 })), durationSeconds: 11 }, newTok);
  assert.equal(sess.status, 201);
  assert.equal(sess.session.status, 'leaving');
  // double check-out must be rejected
  const dup = await post('/api/sessions', { items: [{ label: 'x', checked: 1 }] }, newTok);
  assert.equal(dup.status, 409);
  // force the follow-up window to be due; the 4s tick flips it
  db.prepare('UPDATE sessions SET followup_at = ? WHERE id = ?').run(Date.now() - 1000, sess.session.id);
  await sleep(6500);
  const active = await get('/api/sessions/active', newTok);
  assert.equal(active.session.status, 'followup_pending');
  const notifs = await get('/api/notifications', newTok);
  assert.ok(notifs.notifications.some(n => n.type === 'followup' && n.session_id === sess.session.id));
  // resolve ok
  const res = await post(`/api/sessions/${sess.session.id}/followup`, { result: 'ok' }, newTok);
  assert.equal(res.status, 200);
  assert.equal(res.session.status, 'confirmed_ok');
  const again = await post(`/api/sessions/${sess.session.id}/followup`, { result: 'ok' }, newTok);
  assert.equal(again.status, 409);
});

test('phone OTP: request, brute-force guard, verify, idempotent login', async () => {
  const req = await post('/api/auth/phone/request', { phone: '+91 90000 11111' });
  assert.equal(req.status, 200);
  assert.equal(req.delivery, 'demo');
  const code = req.demo_sms.body.match(/\d{6}/)[0];
  // wrong codes lock the code after 5 attempts
  for (let i = 0; i < 4; i++) {
    const w = await post('/api/auth/phone/verify', { phone: '919000011111', code: '000000' });
    assert.equal(w.status, 400);
  }
  const locked = await post('/api/auth/phone/verify', { phone: '919000011111', code: '000000' });
  assert.equal(locked.status, 429);
  // new code works (and format tolerance: request with +91, verify without)
  const req2 = await post('/api/auth/phone/request', { phone: '+91 90000 11111' });
  const code2 = req2.demo_sms.body.match(/\d{6}/)[0];
  const v = await post('/api/auth/phone/verify', { phone: '919000011111', code: code2 });
  assert.equal(v.status, 200);
  assert.equal(v.created, true);
  const v2 = await post('/api/auth/phone/verify', { phone: '919000011111', code: (await post('/api/auth/phone/request', { phone: '919000011111' })).demo_sms.body.match(/\d{6}/)[0] });
  assert.equal(v2.created, false); // same account via local format
});

test('password reset via phone OTP', async () => {
  // demo user (seeded) has phone 919876543210 / password demo1234
  const r1 = await post('/api/auth/phone/request', { phone: '919876543210', purpose: 'reset' });
  assert.equal(r1.status, 200);
  assert.match(r1.demo_sms.body, /password reset/);
  const code = r1.demo_sms.body.match(/\d{6}/)[0];
  const badPw = await post('/api/auth/password/reset', { phone: '919876543210', code, newPassword: 'short' });
  assert.equal(badPw.status, 400);
  const badCode = await post('/api/auth/password/reset', { phone: '919876543210', code: '000000', newPassword: 'newpass99' });
  assert.equal(badCode.status, 400);
  const ok = await post('/api/auth/password/reset', { phone: '919876543210', code, newPassword: 'newpass99' });
  assert.equal(ok.status, 200);
  const login = await post('/api/auth/login', { email: 'demo@didilock.app', password: 'newpass99' });
  assert.equal(login.status, 200);
  demoTok = login.token;
  demoEmail = 'demo@didilock.app';
});

test('unknown phone cannot request a reset', async () => {
  const r = await post('/api/auth/phone/request', { phone: '919999988888', purpose: 'reset' });
  assert.equal(r.status, 404);
});

test('google: create, idempotent, link by email', async () => {
  const a = await post('/api/auth/google', { id: 'g-alice', email: 'alice@gmail.com', name: 'Alice' });
  assert.equal(a.created, true);
  const b = await post('/api/auth/google', { id: 'g-alice', email: 'alice@gmail.com', name: 'Alice' });
  assert.equal(b.created, false);
  assert.equal(b.user.id, a.user.id);
  // a *different* google id with the same email links to the same account
  const c = await post('/api/auth/google', { id: 'g-alice2', email: 'alice@gmail.com', name: 'Alice' });
  assert.equal(c.linked, true);
  assert.equal(c.user.id, a.user.id);
});

test('push: vapid key + subscription upsert', async () => {
  const v = await get('/api/push/vapid');
  assert.ok(v.publicKey.length > 50);
  const sub = { endpoint: 'https://fcm.googleapis.com/abc123', keys: { p256dh: 'k', auth: 'a' } };
  const s1 = await post('/api/push/subscribe', { subscription: sub }, newTok);
  assert.equal(s1.status, 200);
  const s2 = await post('/api/push/subscribe', { subscription: { ...sub, endpoint: 'https://fcm.googleapis.com/abc123', keys: { p256dh: 'k2', auth: 'a2' } } }, newTok);
  assert.equal(s2.status, 200);
  const rows = db.prepare('SELECT * FROM push_subscriptions').all();
  const forUser = rows.filter(r => r.endpoint === sub.endpoint);
  assert.equal(forUser.length, 1); // upsert, not duplicate
});

test('stats: shape + tz-aware streak', async () => {
  demoTok = (await post('/api/auth/login', { email: 'demo@didilock.app', password: 'newpass99' })).token; // reset bumped the token version — fresh login required
  // a check-in RIGHT NOW: the seeded history anchors to UTC midnight, so depending on the wall
  // clock the newest seeded session can be 'yesterday' (or older) in some timezones — give every
  // timezone a guaranteed activity-today before asserting streaks
  const demoId = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@didilock.app').id;
  const t0 = Date.now();
  db.prepare(`INSERT INTO sessions (user_id, status, started_at, followup_at, resolved_at, duration_seconds, mode)
              VALUES (?,?,?,?,?,?,?)`)
    .run(demoId, 'confirmed_ok', t0 - 120000, t0 + 180000, t0 - 60000, 30, 'manual');
  const s0 = await get('/api/stats?tz=0', demoTok);
  assert.equal(s0.status, 200);
  const { stats } = s0;
  assert.ok(stats.total >= 13); // seeded demo history + test session
  assert.ok(stats.streak >= 10);
  const s330 = await get('/api/stats?tz=330', demoTok); // IST
  assert.equal(s330.status, 200);
  assert.equal(s330.stats.total, stats.total);
  // late-UTC seeded sessions shift to the next IST day, so the IST streak can be shorter
  assert.ok(s330.stats.streak >= 1);
});

test('me: profile update incl. OTP-verified phone + delete', async () => {
  const p = await patch('/api/me', { name: 'Renamed' }, newTok);
  assert.equal(p.user.name, 'Renamed');
  const direct = await patch('/api/me', { phone: '+91 98800 12345' }, newTok);
  assert.equal(direct.status, 400); // phone claims now REQUIRE SMS verification
  const req = await post('/api/me/phone/request', { phone: '+91 98800 12345' }, newTok);
  assert.equal(req.status, 200);
  const code = req.demo_sms.body.match(/\d{6}/)[0];
  const ver = await post('/api/me/phone/verify', { code }, newTok);
  assert.equal(ver.status, 200);
  assert.equal(ver.user.phone, '919880012345');
  const dup = await post('/api/me/phone/request', { phone: '919000011111' }, newTok);
  assert.equal(dup.status, 409); // taken by the OTP account
  const d = await del('/api/me', newTok, { password: 'secret12' });
  assert.equal(d.status, 200);
  const gone = await get('/api/me', newTok);
  assert.equal(gone.status, 401);
});

// ---- security hardening (v1.2.1) regression ----
test('security: OTP echo only in demo mode, JWT lifetime exactly 7 days', async () => {
  const otp = await post('/api/auth/phone/request', { phone: '915550001112' });
  assert.equal(otp.status, 200);
  assert.ok(otp.demo_sms && /DIL: \d{6}/.test(otp.demo_sms.body), 'demo mode shows the OTP in-app');
  const verify = await post('/api/auth/phone/verify', { phone: '915550001112', code: otp.demo_sms.body.match(/\d{6}/)[0] });
  assert.ok(verify.token, 'phone verify returns a session token');
  const payload = JSON.parse(Buffer.from(verify.token.split('.')[1], 'base64url').toString());
  assert.equal(payload.exp - payload.iat, 7 * 24 * 3600, 'JWT lifetime is exactly 7 days');
});

// ---- security v1.2.2 regression: XFF-rotation must NOT bypass the per-IP register limit ----
test('security v1.2.2: rotating fake X-Forwarded-For hops cannot bypass register limit', async () => {
  // behind a proxy, the edge APPENDS the real client IP after anything the client sent —
  // the attacker controls only the hops BEFORE it. Model that: rotating fakes + one real trailing hop.
  let ok = 0, limited = 0;
  for (let i = 0; i < 14; i++) {
    const st = await fetch(base + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `${11 + i}.${i}.${i}.${i + 3}, 10.0.0.9, 198.51.100.7` },
      body: JSON.stringify({ name: 'Burst ' + i, email: 'burst' + i + '@x.test', password: 'vx9-mKq2Lw' }),
    }).then(r => r.status);
    if (st === 429) limited += 1; else if (st === 200) ok += 1;
  }
  assert.ok(limited >= 1, 'burst eventually hits the limiter');
  assert.ok(ok <= 10, 'at most the register limit succeeds despite rotating client-supplied hops');
});

// ---- security v1.3.1: headers + client-IP selection ----
test('security v1.3.1: standard security headers are set', async () => {
  const r = await fetch(base + '/api/health');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.ok((r.headers.get('permissions-policy') || '').includes('geolocation=(self)'));
});

test('security v1.5: the whoip debug endpoint is gone (was an IP-reflection info leak)', async () => {
  const st = await fetch(base + '/api/whoip', { headers: { 'X-Forwarded-For': '203.0.113.7, 10.0.0.9' } }).then(r => r.status);
  assert.equal(st, 404, '/api/whoip must no longer exist');
});

// ---- security v1.4: cross-user access + account-takeover refusals ----
test('security v1.4: users cannot read, edit or delete another user\'s tasks (IDOR)', async () => {
  const a = await post('/api/auth/google', { id: 'g-idor-a', email: 'idor.a@x.test', name: 'Idor A' });
  const b = await post('/api/auth/google', { id: 'g-idor-b', email: 'idor.b@x.test', name: 'Idor B' });
  const mk = await post('/api/tasks', { title: 'A private task' }, a.token);
  const id = mk.task.id;
  assert.equal((await get('/api/tasks/' + id, b.token)).status, 404, 'read other user task');
  assert.equal((await patch('/api/tasks/' + id, { done: true }, b.token)).status, 404, 'edit other user task');
  assert.equal((await fetch(base + '/api/tasks/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + b.token } })).status, 404, 'delete other user task');
  const bList = await get('/api/tasks', b.token);
  assert.ok(!JSON.stringify(bList).includes('A private task'), 'other user task not in B list');
  const aList = await get('/api/tasks', a.token);
  assert.ok(JSON.stringify(aList).includes('A private task'), 'owner still has access via list');
});

test('security v1.4: Google auto-link — allowed only in demo mode, refused on production servers', async () => {
  // in THIS suite (demo mode) the simulated chooser may link the demo account:
  const demo = await post('/api/auth/google', { id: 'g-demolink', email: 'demo@didilock.app', name: 'Demo Link' });
  assert.equal(demo.status, 200);
  // a production-mode server (no DIL_SEED_DEMO) must refuse the endpoint outright:
  const { spawn } = require('child_process');
  const fs2 = require('fs'), os2 = require('os'), path2 = require('path');
  const tmp2 = fs2.mkdtempSync(path2.join(os2.tmpdir(), 'dil-prod-'));
  const child = spawn(process.execPath, ['-e',
    `process.env.DIL_DATA_DIR=${JSON.stringify(tmp2)};delete process.env.DIL_SEED_DEMO;process.env.PORT='3457';const {start}=require(${JSON.stringify(path.join(__dirname, '..', 'server', 'index.js'))});start(3457,'127.0.0.1');`],
    { stdio: 'ignore' });
  try {
    let status = 0;
    for (let i = 0; i < 20; i++) {
      await sleep(250);
      try { status = await fetch('http://127.0.0.1:3457/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'g-hijack', email: 'demo@didilock.app', name: 'Hijacker' }) }).then(r => r.status); break; } catch { /* not up yet */ }
    }
    assert.equal(status, 403, 'production server refuses demo Google linking');
  } finally { child.kill('SIGKILL'); }
});

// ---- security v1.5: OTP codes must be stored hashed, SSE needs a one-time ticket ----
test('security v1.5: login codes are hashed at rest; SSE rejects token-in-URL and accepts one-time tickets', async () => {
  await post('/api/auth/phone/request', { phone: '915550001113' });
  const rows = db.prepare("SELECT code FROM login_codes WHERE purpose = 'login' ORDER BY created_at DESC LIMIT 1").all();
  assert.ok(rows.length && !/^\d{6}$/.test(rows[0].code) && rows[0].code.length >= 32, 'code at rest is a hash, not 6 digits');
  const tk = demoTok; // reuse the suite's token — a fresh login here would trip the per-IP login limiter
  const bad = await fetch(base + '/api/events?token=' + tk).then(r => r.status);
  assert.equal(bad, 401, 'raw JWT no longer accepted in the SSE URL');
  const tick = await fetch(base + '/api/events/ticket', { headers: { Authorization: 'Bearer ' + tk } }).then(r => r.json());
  assert.ok(tick.ticket, 'ticket endpoint returns a ticket for a signed-in user');
  const ok1 = await fetch(base + '/api/events?ticket=' + tick.ticket).then(r => r.status);
  assert.equal(ok1, 200, 'valid ticket opens the stream');
  const ok2 = await fetch(base + '/api/events?ticket=' + tick.ticket).then(r => r.status);
  assert.equal(ok2, 401, 'ticket is one-time');
});

// ---- v1.5: soft email verification (demo echo) + language preference ----
test('v1.5: email verification walks end-to-end in demo (start → demo token → confirm → verified)', async () => {
  const reg = await post('/api/auth/register', { name: 'Mail Test', email: 'mail@test.dev', password: 'secret12', lang: 'hi' });
  assert.equal(reg.user.lang, 'hi', 'register honours the requested language');
  assert.equal(reg.user.email_verified, false, 'password accounts start unverified');
  const start = await post('/api/verify-email/start', { email: 'mail@test.dev' }, reg.token);
  assert.ok(start.token, 'demo mode echoes a verification token');
  const bad = await post('/api/verify-email/confirm', { token: 'deadbeef' });
  assert.equal(bad.error, 'Invalid or expired link', 'bogus tokens are refused');
  const ok = await post('/api/verify-email/confirm', { token: start.token });
  assert.equal(ok.ok, true, 'valid token verifies');
  const me = await get('/api/me', reg.token);
  assert.equal(me.user.email_verified, true, 'verification persists on the profile');
  const langBad = await patch('/api/me', { lang: 'fr' }, reg.token);
  assert.equal(langBad.error, 'Language must be en or hi', 'unknown languages rejected');
  const langOk = await patch('/api/me', { lang: 'en' }, reg.token);
  assert.equal(langOk.user.lang, 'en', 'language updates stick');
});

// ---- v1.5.1: audit-harness hardening regressions ----
test('v1.5.1: bearer-only auth, weak passwords, strict input types, quotas, data export', async () => {
  const qt = await fetch(base + '/api/me?token=' + demoTok).then(r => r.status);
  assert.equal(qt, 401, 'tokens in URLs are no longer accepted on any route');
  const weak = await post('/api/auth/register', { name: 'Weak', email: 'weak1@test.dev', password: 'password1' });
  assert.equal(weak.error, 'That password is too common — pick a stronger one', 'top-25 passwords rejected');
  const big = await post('/api/auth/register', { name: 'Big', email: 'big1@test.dev', password: 'x'.repeat(200) });
  assert.ok(/8–128/.test(big.error || ''), 'oversized password cleanly rejected');
  const lim = await get('/api/sessions?limit=1.5', demoTok);
  assert.ok(Array.isArray(lim.sessions), 'float limit no longer 500s');
  const badp = await post('/api/tasks', { title: 'x', parent_id: true }, demoTok);
  assert.equal(badp.error, 'Invalid parent task', 'non-integer parent_id is a clean 400');
  const badlat = await patch('/api/me', { home_lat: 'abc' }, demoTok);
  assert.equal(badlat.error, 'Invalid home_lat', 'non-numeric home_lat is a clean 400');
  const nu = await post('/api/auth/register', { name: 'Cap', email: 'cap@test.dev', password: 'secret99' });
  for (let i = 0; i < 50; i++) await post('/api/items', { label: 'item ' + i }, nu.token);
  const c51 = await post('/api/items', { label: 'overflow' }, nu.token);
  assert.equal(c51.error, 'Checklist holds up to 50 items — remove one first', '50-item quota enforced');
  const junk = await patch('/api/items/reorder', { ids: ['a', ['b']] }, nu.token);
  assert.equal(junk.error, 'ids must be a list of item ids', 'reorder validates id types');
  const ex = await fetch(base + '/api/me/export', { headers: { Authorization: 'Bearer ' + nu.token } });
  const exj = await ex.json();
  assert.ok(ex.ok && exj.profile && Array.isArray(exj.items) && Array.isArray(exj.sessions), 'data export endpoint works');
  const parse = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '"x"' }).then(r => r.json());
  assert.equal(parse.error, 'Invalid request body', 'malformed JSON does not echo parser internals');
});

// ---- v1.5.2: follow-up review persistence, clock-sync ts, XP sync ----
test('v1.5.2: review updates session items; config carries ts; xp is forward-only', async () => {
  const cfg = await fetch(base + '/api/config').then(r => r.json());
  assert.ok(Number.isInteger(cfg.ts) && Math.abs(cfg.ts - Date.now()) < 60000, 'config carries a server timestamp');

  const tok = demoTok; // reuse the suite token — a new register here would trip the 5/h sign-up bucket
  const act = await get('/api/sessions/active', tok);
  if (act.session) await fetch(base + '/api/sessions/' + act.session.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } });
  const made = await post('/api/items', { label: 'Window latch' }, tok);
  const sess = await post('/api/sessions', { items: [{ item_id: made.item.id, label: 'Window latch', checked: 1 }, { label: 'Stove', checked: 1 }] }, tok);
  assert.equal(sess.status, 201, 'session created for the review test');
  const fu = await post(`/api/sessions/${sess.session.id}/followup`, {
    result: 'went_back', note: 'window was open',
    items: [{ label: 'Window latch', checked: 0 }, { label: 'Stove', checked: 1 }],
  }, tok);
  const byLabel = Object.fromEntries(fu.session.items.map(x => [x.label, x.checked]));
  assert.equal(byLabel['Window latch'], 0, 'reviewed-unchecked item is persisted as unchecked');
  assert.equal(byLabel['Stove'], 1, 'checked item stays checked');
  const bad = await post(`/api/sessions/${sess.session.id}/followup`, { result: 'went_back', items: 'garbage' }, tok);
  assert.equal(bad.error, 'This check-in was already handled', 'second follow-up still refused (idempotency intact)');

  const x1 = await patch('/api/me', { xp: 40 }, tok);
  assert.equal(x1.user.xp, 40, 'xp set');
  const x2 = await patch('/api/me', { xp: 10 }, tok);
  assert.equal(x2.user.xp, 40, 'xp never goes backwards through the API');
  const x3 = await patch('/api/me', { xp: 'hundred' }, tok);
  assert.equal(x3.error, 'Invalid xp', 'garbage xp cleanly rejected');
  const me = await get('/api/me', tok);
  assert.equal(me.user.xp, 40, 'xp exposed on the profile');
});

// ---- v1.5.6: audit round — Google-account deletion, own-email-only verification, email password reset, caps & depth ----
test('v1.5.6: google account can delete itself; verify-email uses the account address only; email reset works; name cap; task depth', async () => {
  // H1: a Google-created account deletes itself with the typed confirmation (no password it ever knew)
  const g = await post('/api/auth/google', { id: 'g-del-1', email: 'gdel@test.dev', name: 'N'.repeat(5000) });
  assert.ok(g.user && g.user.name.length <= 40, 'M2: signup name capped at 40 (google path too)');
  const delRes = await del('/api/me', g.token, { confirm: 'DELETE' });
  assert.equal(delRes.ok, true, 'H1: google account deletes with confirm DELETE');
  assert.equal((await get('/api/me', g.token)).status, 401, 'token dead after deletion');

  // H4 + H2: email password reset end-to-end (demo); verification uses the ACCOUNT address even when the body lies
  const reg = await post('/api/auth/register', { name: 'Mailer', email: 'mailer@test.dev', password: 'secret12' });
  const vs = await post('/api/verify-email/start', { email: 'attacker@x.test' }, reg.token); // attacker-chosen address must be ignored
  assert.ok(vs.token, 'H2: demo token still issued (body address ignored, account address used)');
  const vc = await post('/api/verify-email/confirm', { token: vs.token });
  assert.equal(vc.ok, true, 'H2: confirm verifies the OWN account');
  const rq = await post('/api/auth/email/reset/request', { email: 'mailer@test.dev' });
  assert.ok(rq.token, 'H4: demo echoes a reset token');
  const cf = await post('/api/auth/email/reset/confirm', { token: rq.token, newPassword: 'fresh!pass9' });
  assert.equal(cf.ok, true, 'H4: reset confirmed');
  assert.equal((await post('/api/auth/login', { email: 'mailer@test.dev', password: 'secret12' })).status, 401, 'H4: old password dead');
  assert.ok((await post('/api/auth/login', { email: 'mailer@test.dev', password: 'fresh!pass9' })).token, 'H4: new password works');
  const shortPw = await post('/api/auth/email/reset/request', { email: 'mailer@test.dev' });
  const cf2 = await post('/api/auth/email/reset/confirm', { token: shortPw.token, newPassword: 'short' });
  assert.ok(/8–128/.test(cf2.error || ''), 'H4: reset enforces min 8');

  // M3: register rejects 6-char passwords now
  const six = await post('/api/auth/register', { name: 'Six', email: 'six2@test.dev', password: 'abcdef' });
  assert.ok(/8–128/.test(six.error || ''), 'M3: min password length is 8');

  // L7: subtasks cannot nest deeper than one level
  const t1 = await post('/api/tasks', { title: 'parent' }, demoTok);
  const t2 = await post('/api/tasks', { title: 'child', parent_id: t1.task.id }, demoTok);
  assert.ok(t2.task && t2.task.id, 'subtask created under a parent');
  const t3 = await post('/api/tasks', { title: 'grandchild', parent_id: t2.task.id }, demoTok);
  assert.equal(t3.error, 'Subtasks can only go one level deep', 'L7: depth capped at one level');
});

// ---- v1.5.7: audit round — token purposes, corrupt-hash safety, CGNAT proxies, uniform reset answers ----
test('v1.5.7: verify token is NOT a reset token; corrupt hash is 401 not 500; CGNAT proxy hops behave', async () => {
  // M: a verification link must never work as a password reset (and vice versa)
  const reg = await post('/api/auth/register', { name: 'Purpose', email: 'purpose@test.dev', password: 'purpose123' });
  const vs = await post('/api/verify-email/start', {}, reg.token);
  assert.ok(vs.token, 'demo still echoes the verify token');
  const stolen = await post('/api/auth/email/reset/confirm', { token: vs.token, newPassword: 'hijacked123' });
  assert.equal(stolen.status, 400, 'verify token rejected at the reset endpoint');

  // L: a corrupted stored hash reads as a wrong password — never a 500
  db.prepare("UPDATE users SET password_hash = 'deadbeef:zz-corrupt' WHERE email = 'purpose@test.dev'").run();
  const bad = await post('/api/auth/login', { email: 'purpose@test.dev', password: 'purpose123' });
  assert.equal(bad.status, 401, 'corrupt hash → 401, not 500');

  // M: visitors behind a CGNAT (100.64/10) proxy edge must NOT share one bucket, and a constant
  // client through such an edge must still hit the register limit
  let lumped = 0;
  for (let i = 0; i < 12; i++) {
    const st = await fetch(base + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `203.0.113.${50 + i}, 100.64.0.7` },
      body: JSON.stringify({ name: 'CGNAT ' + i, email: 'cgnat' + i + '@x.test', password: 'vx9-mKq2Lw' }),
    }).then(r => r.status);
    if (st === 429) lumped += 1;
  }
  assert.equal(lumped, 0, 'distinct visitors behind a CGNAT edge each get their own bucket');
  let limited = 0;
  for (let i = 0; i < 12; i++) {
    const st = await fetch(base + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `203.0.113.9, 100.64.0.7` },
      body: JSON.stringify({ name: 'CGNAT same ' + i, email: 'cgnatsame' + i + '@x.test', password: 'vx9-mKq2Lw' }),
    }).then(r => r.status);
    if (st === 429) limited += 1;
  }
  assert.ok(limited >= 1, 'one client behind a CGNAT edge is still rate-limited');
});

// ---- M/H: outside demo mode the reset endpoint answers IDENTICALLY for known and unknown
// addresses, ignores attacker headers, and refuses to send without BASE_URL — child server, no seed
test('v1.5.7: reset endpoint is enumeration-safe outside demo mode', async () => {
  const { execFile } = require('child_process');
  const util = require('util');
  const run = util.promisify(execFile);
  const boot = `
    delete process.env.DIL_SEED_DEMO;
    process.env.DIL_DATA_DIR = ${JSON.stringify(fs.mkdtempSync(path.join(os.tmpdir(), 'dil-prod-')))};
    process.env.JWT_SECRET = 'enum-test-secret-long-enough';
    process.env.PORT = '3459';
    const { start } = require(${JSON.stringify(path.join(__dirname, '..', 'server', 'index.js'))});
    start(3459, '127.0.0.1');`;
  const child = execFile(process.execPath, ['-e', boot], { cwd: __dirname + '/..' });
  await new Promise(r => setTimeout(r, 2500));
  try {
    const b2 = 'http://127.0.0.1:3459';
    await fetch(b2 + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Known', email: 'known@test.dev', password: 'known-pass-9' }) }).catch(() => {});
    const evil = { 'Content-Type': 'application/json', 'X-Forwarded-Host': 'evil.example' };
    const known = await fetch(b2 + '/api/auth/email/reset/request', { method: 'POST', headers: evil, body: JSON.stringify({ email: 'known@test.dev' }) }).then(async r => ({ s: r.status, b: await r.text() }));
    const unknown = await fetch(b2 + '/api/auth/email/reset/request', { method: 'POST', headers: evil, body: JSON.stringify({ email: 'ghost@test.dev' }) }).then(async r => ({ s: r.status, b: await r.text() }));
    assert.equal(known.s, 503, 'no mail config → uniform 503');
    assert.equal(known.b, unknown.b, 'known and unknown addresses get the byte-identical answer');
    assert.ok(!/evil\.example/.test(known.b + unknown.b), 'attacker headers are never reflected');
    child.kill();
  } catch (e) { child.kill(); throw e; }
});

// ---- v1.5.7b: verify-email with mail CONFIGURED must not crash after responding; .env must actually configure a server ----
test('v1.5.7b: verify-email/start with RESEND_KEY+BASE_URL responds cleanly and never hits the error handler', async () => {
  const { spawn } = require('child_process');
  const tmp3 = fs.mkdtempSync(path.join(os.tmpdir(), 'dil-mail-'));
  const child = spawn(process.execPath, ['-e',
    `delete process.env.DIL_SEED_DEMO;delete process.env.RESEND_API_KEY;
     process.env.DIL_DATA_DIR=${JSON.stringify(tmp3)};process.env.JWT_SECRET='mail-test-secret-long-enough';
     process.env.BASE_URL='http://127.0.0.1:3460';process.env.RESEND_API_KEY='test-fake-key';
     process.env.PORT='3460';const {start}=require(${JSON.stringify(path.join(__dirname, '..', 'server', 'index.js'))});start(3460,'127.0.0.1');`],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  let errLog = '';
  child.stderr.on('data', d => { errLog += d; });
  try {
    let reg;
    for (let i = 0; i < 20; i++) {
      await sleep(250);
      try { reg = await fetch('http://127.0.0.1:3460/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Mail', email: 'mail@test.dev', password: 'mailpass123' }) }).then(r => r.json()); break; } catch { /* booting */ }
    }
    assert.ok(reg && reg.token, 'child server up with mail configured');
    const vs = await fetch('http://127.0.0.1:3460/api/verify-email/start', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token }, body: '{}' }).then(async r => ({ s: r.status, b: await r.text() }));
    assert.equal(vs.s, 200, 'responds ok');
    assert.deepEqual(JSON.parse(vs.b), { ok: true }, 'uniform {ok:true} — no delivery shape');
    await sleep(1200); // give the background send (fake key → resend rejects) time to finish WITHOUT crashing
    assert.ok(!/delivery is not defined|ERR_HTTP_HEADERS_SENT/.test(errLog), 'no post-response crash in the child log');
    child.kill();
  } catch (e) { child.kill(); throw e; }
});

test('v1.5.7b: a .env file in the working directory configures the server (PORT, data dir, inline comments)', async () => {
  const { spawn } = require('child_process');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dil-envhome-'));
  const datadir = path.join(home, 'envdata');
  fs.writeFileSync(path.join(home, '.env'), [
    '# .env test file',
    'PORT=3461 # the port — inline comment must be stripped',
    `DIL_DATA_DIR=${datadir}`,
    "JWT_SECRET='env-file-secret-long-enough'",
    'DIL_SEED_DEMO=1',
  ].join('\n'));
  const cleanEnv = { ...process.env }; // the suite's own env vars must NOT leak in — .env wins only when the real env is silent
  delete cleanEnv.DIL_DATA_DIR; delete cleanEnv.JWT_SECRET; delete cleanEnv.PORT;
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], { cwd: home, env: cleanEnv, stdio: 'ignore' });
  try {
    let health = null;
    for (let i = 0; i < 20; i++) {
      await sleep(250);
      try { health = await fetch('http://127.0.0.1:3461/api/health').then(r => r.json()); break; } catch { /* booting */ }
    }
    assert.ok(health && health.ok, 'server came up on the PORT from .env (3461, not the default 3000)');
    await sleep(300);
    assert.ok(fs.existsSync(path.join(datadir, 'didilock.db')), 'database created in the DIL_DATA_DIR from .env');
    child.kill();
  } catch (e) { child.kill(); throw e; }
});

// ---- v1.5.8: per-account login throttle across IPs, predictable-password rejection, safer email characters ----
test('v1.5.8: 20 failures from 20 IPs slows the account but never locks the owner out', async () => {
  const email = 'sleeper@test.dev', goodPw = 'Str0ng!pass9';
  assert.ok((await post('/api/auth/register', { name: 'Sleeper', email, password: goodPw })).token, 'register with a strong password');
  // 21 wrong-password guesses, each from a different spoofed IP (the suite connects from localhost, so XFF is honoured)
  for (let i = 0; i < 21; i++) {
    const st = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.100.${i + 1}` },
      body: JSON.stringify({ email, password: 'wrong-guess-' + i }),
    }).then(r => r.status);
    assert.equal(st, 401, `guess ${i + 1} from a fresh IP still reads as wrong-password`);
  }
  const t0 = Date.now();
  const slow = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.99' },
    body: JSON.stringify({ email, password: 'wrong-again' }),
  }).then(r => r.status);
  const dt = Date.now() - t0;
  assert.equal(slow, 401, 'attempt past the threshold still verifies (not a blind 429)');
  assert.ok(dt >= 900, 'protective delay kicked in', `${dt} ms`);
  const t1 = Date.now();
  const owner = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.120' },
    body: JSON.stringify({ email, password: goodPw }),
  }).then(r => r.status);
  assert.equal(owner, 200, 'the REAL user can always sign in — delay, never lockout');
  const t2 = Date.now();
  await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.121' }, body: JSON.stringify({ email, password: 'x' }) }).then(r => r.status);
  assert.ok(Date.now() - t2 < 900, 'a correct login reset the protective mode instantly');
});

test("v1.5.8: predictable passwords rejected; hostile email characters rejected; o'Brien still welcome", async () => {
  let ipn = 0;
  const regFrom = (email, pw) => fetch(base + '/api/auth/register', { // rotating IPs: this block makes many register calls on one test IP
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `203.0.115.${++ipn}` },
    body: JSON.stringify({ name: 'Reg', email, password: pw }),
  }).then(r => r.status);
  const cases = [
    ['aaaaaaaaaaaa', 'repeats'],
    ['abcdefgh1', 'ascending run'],
    ['98765abcd', 'descending run'],
    ['password123', 'common list'],
  ];
  for (const [pw, why] of cases) {
    const st = await regFrom(`weak-${why.replace(/\W/g, '')}@x.test`, pw);
    assert.equal(st, 400, `${why} rejected`);
  }
  assert.equal(await regFrom('good-pw@x.test', 'G7!kQw2m'), 200, 'a strong password still passes');
  assert.equal(await regFrom('<script>@example.com', 'G7!kQw2m'), 400, 'angle brackets rejected');
  assert.equal(await regFrom('a"b@example.com', 'G7!kQw2m'), 400, 'double quotes rejected');
  assert.equal(await regFrom("o'brien@example.com", 'G7!kQw2m'), 200, "apostrophes stay valid (o'brien@ is a real address shape)");
});

// ---- v1.5.9: resets obey the full strength rulebook; one inbox cannot be flooded; keyboard/suffix patterns ----
test('v1.5.9: password resets enforce the same rules as sign-up (no loophole)', async () => {
  // email reset: repeats are rejected at confirm time
  const reg = await post('/api/auth/register', { name: 'Rulebook', email: 'rulebook@test.dev', password: 'Rule!book9' });
  const rq = await post('/api/auth/email/reset/request', { email: 'rulebook@test.dev' });
  assert.ok(rq.token, 'reset request still issues a demo token');
  const weak = await post('/api/auth/email/reset/confirm', { token: rq.token, newPassword: 'aaaaaaaa' });
  assert.equal(weak.status, 400, 'email reset rejects repeated characters');
  assert.ok(/repeated/.test(weak.error || ''), 'message explains the rule');
  const common = await post('/api/auth/email/reset/confirm', { token: rq.token, newPassword: '12345678' });
  assert.ok(/too common/.test(common.error || ''), 'email reset rejects classic common passwords');
  // phone reset: same rules
  const pr = await fetch(base + '/api/auth/phone/request', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.103.7' }, body: JSON.stringify({ phone: '+91 98765 43210', purpose: 'reset' }) }).then(r => r.json());
  const code = (pr.demo_sms.body.match(/\d{6}/) || [])[0];
  const pres = await post('/api/auth/password/reset', { phone: '+91 98765 43210', code, newPassword: 'qwertyui' });
  assert.ok(/predictable/.test(pres.error || ''), 'phone reset rejects keyboard runs');
  // and a GOOD password still completes the email reset
  const ok2 = await post('/api/auth/email/reset/confirm', { token: rq.token, newPassword: 'Good!reset9' });
  assert.equal(ok2.ok, true, 'a strong password completes the reset');
});

test('v1.5.9: a single inbox gets at most 3 reset emails per hour — sends stop, answers stay 200', async () => {
  await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.102.200' }, body: JSON.stringify({ name: 'Flooded', email: 'flooded@test.dev', password: 'Flooded-pass9' }) }).then(r => r.status);
  let i = 0;
  const ask = () => fetch(base + '/api/auth/email/reset/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.102.${++i}` }, // every request from a "different" network
    body: JSON.stringify({ email: 'flooded@test.dev' }),
  }).then(async r => ({ s: r.status, b: await r.json() }));
  assert.ok((await ask()).b.token, '1st request echoes a demo token (send #1)');
  assert.ok((await ask()).b.token, '2nd request echoes a demo token (send #2)');
  assert.ok((await ask()).b.token, '3rd request echoes a demo token (send #3)');
  const fourth = await ask();
  assert.equal(fourth.s, 200, '4th request is NOT refused — the victim must never see a 429');
  assert.equal(fourth.b.token, undefined, 'but no 4th email/link is produced — the flood stops');
});

test('v1.5.9: keyboard walks and common+digit suffixes are rejected at sign-up', async () => {
  let ipn = 0;
  const regFrom = (email, pw) => fetch(base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `203.0.116.${++ipn}` },
    body: JSON.stringify({ name: 'Pattern', email, password: pw }),
  }).then(r => r.status);
  assert.equal(await regFrom('kb-walk@x.test', 'qwertyuiop1'), 400, 'qwertyuiop is a keyboard run');
  assert.equal(await regFrom('kb-suffix@x.test', 'iloveyou1'), 400, 'common password + trailing digit caught');
  assert.equal(await regFrom('kb-fine@x.test', 'k9!Qwe-mix99'), 200, 'short (<5) keyboard fragments are fine in a mixed password');
});

// ---- v1.5.10/v1.5.11: a burned reset cap answers SILENT 200 — nobody, owner or stranger, is ever refused ----
test('v1.5.11: burned cap never 429s anyone — signed-in victim gets the same silent 200 as an attacker', async () => {
  const email = 'capped-owner@test.dev';
  const regX = (em, pw, ip) => fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify({ name: 'Capped', email: em, password: pw }) }).then(r => r.json());
  assert.ok((await regX(email, 'Capped-pass9', '198.51.105.8')).token, 'victim registered');
  const ask = hdrs => fetch(base + '/api/auth/email/reset/request', { method: 'POST', headers: { 'Content-Type': 'application/json', ...hdrs }, body: JSON.stringify({ email }) }).then(async r => ({ s: r.status, b: await r.json() }));
  for (const ip of ['198.51.105.1', '198.51.105.2', '198.51.105.3']) assert.equal((await ask({ 'X-Forwarded-For': ip })).s, 200, 'burn request answers 200');
  const fourth = await ask({ 'X-Forwarded-For': '198.51.105.4' });
  assert.equal(fourth.s, 200, 'attacker past the cap: 200');
  assert.equal(fourth.b.token, undefined, '…but silent — no new link');
  const owner = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.105.9' }, body: JSON.stringify({ email, password: 'Capped-pass9' }) }).then(r => r.json());
  assert.ok(owner.token, 'the owner can still sign in');
  const ownerReq = await ask({ 'X-Forwarded-For': '198.51.105.5', Authorization: 'Bearer ' + owner.token });
  assert.equal(ownerReq.s, 200, 'the signed-in victim is NEVER refused');
  assert.equal(ownerReq.b.token, undefined, 'within 10 min of the burns the answer is silence — the earlier valid links (real reset links for this account) are in the inbox');
});

test('v1.5.10: keyboard runs must be LONG (6+) — Wertyman-style words are fine, qwertyu is not', async () => {
  let ipn = 0;
  const regFrom = (email, pw) => fetch(base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `203.0.117.${++ipn}` },
    body: JSON.stringify({ name: 'Kb', email, password: pw }),
  }).then(r => r.status);
  assert.equal(await regFrom('werty-man@x.test', 'Wertyman!9Z'), 200, "'werty' inside a strong word is accepted");
  assert.equal(await regFrom('qwertyu-run@x.test', 'myQwertyu-pw'), 400, 'a 6-char keyboard run is still rejected');
  assert.equal(await regFrom('qwert-ok@x.test', 'v9!Qwert-mix'), 200, '5-char fragments remain fine');
});

// ---- v1.5.11: parallel guesses share one slot queue (no per-request nap to sleep around);
// giant "emails" never become map keys ----
test('v1.5.11: a parallel burst past the account threshold is serialised and capped, not waved through', async () => {
  const email = 'burst-victim@test.dev', goodPw = 'Burst-victim9';
  const regX = ip => fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify({ name: 'BurstV', email, password: goodPw }) }).then(r => r.status);
  assert.equal(await regX('198.51.104.250'), 200, 'victim registered');
  for (let i = 0; i < 21; i++) { // serial failures from distinct IPs enter protective mode
    await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.104.${i}` }, body: JSON.stringify({ email, password: 'nope-' + i }) }).then(r => r.status);
  }
  const t0 = Date.now();
  const burst = await Promise.all(Array.from({ length: 12 }, (_, k) =>
    fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.106.${k}` }, body: JSON.stringify({ email, password: 'parallel-' + k }) }).then(r => r.status)));
  const dt = Date.now() - t0;
  const served = burst.filter(s => s === 401).length;
  const refused = burst.filter(s => s === 429).length;
  assert.ok(refused >= 5, 'deep-queue guesses are refused, not waved through', `served=${served} refused=${refused}`);
  assert.ok(served >= 1 && served <= 6, 'only the slot-horizon few are verified', `served=${served}`);
  assert.ok(dt >= 1100, 'served guesses had to WAIT for their shared slot (serialised)', `${dt} ms`);
});

test('v1.5.11: oversized "emails" are refused before touching the throttle maps; valid long-but-legal addresses work', async () => {
  const giant = 'a'.repeat(250) + '@x.test'; // 257 chars — past the RFC cap
  const r = await post('/api/auth/login', { email: giant, password: 'whatever123' });
  assert.equal(r.status, 401, 'oversized login email reads as wrong-credentials');
  assert.equal(r.error, 'Wrong email or password', 'same message as unknown — no new tell');
  const reg = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.107.90' }, body: JSON.stringify({ name: 'Giant', email: giant, password: 'Str0ng-pass9' }) }).then(r => r.status);
  assert.equal(reg, 400, 'oversized register email rejected');
  let ok = 0;
  for (let i = 0; i < 60; i++) { // hammer it — memory stays flat because nothing is stored
    const st = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.107.${i % 40}` }, body: JSON.stringify({ email: 'a'.repeat(250) + i + '@x.test', password: 'x' }) }).then(r2 => r2.status);
    if (st === 401) ok++;
  }
  assert.equal(ok, 60, '60 oversized logins all answered uniformly');
});

// ---- v1.5.12: the owner's usual IP keeps access during a SUSTAINED attack; strangers stay throttled ----
test("v1.5.12: sustained flood cannot lock the owner out — their usual IP skips the slot queue", async () => {
  const email = 'trusted-owner@test.dev', pw = 'Trusted-pass9';
  const regX = (em, pw2, ip) => fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify({ name: 'T', email: em, password: pw2 }) }).then(r => r.status);
  assert.equal(await regX(email, pw, '198.51.110.7'), 200, 'victim registered');
  const login = (ip, pw2) => fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify({ email, password: pw2 }) }).then(r => r.status);
  assert.equal(await login('198.51.110.7', pw), 200, 'owner logs in once from home — that IP is now trusted');
  for (let i = 0; i < 21; i++) await login(`198.51.111.${i}`, 'wrong-' + i); // sustained distributed failure → protective mode
  // live a live flood: fire parallel claims WITHOUT waiting, so the horizon is deep right now
  const flood = Array.from({ length: 6 }, (_, k) => login(`198.51.112.${k}`, 'flood-' + k));
  await new Promise(r => setTimeout(r, 400)); // let them claim their slots (horizon ≈ 6 × 1.2 s)
  const stranger = await login('198.51.112.50', 'stranger-guess');
  assert.equal(stranger, 429, 'a stranger during the flood is refused — throttle intact');
  const t0 = Date.now();
  const owner = await login('198.51.110.7', pw);
  const dt = Date.now() - t0;
  assert.equal(owner, 200, 'THE OWNER SIGNS IN during the sustained attack');
  assert.ok(dt < 800, 'no slot wait for the trusted network', `${dt} ms`);
  await Promise.allSettled(flood); // let the queued flood finish before the server closes
});

// ---- v1.5.13: the trust-revocation line must not crash for phone-only accounts (email = null) ----
test('v1.5.13: a phone-only account resets its password even when trusted networks exist (was a 500)', async () => {
  // crash precondition: at least one successful EMAIL login somewhere → trustedIPs is non-empty
  // (own seed account — the demo account's password is legitimately changed by an earlier suite test)
  const seedX = (em, pw, ip) => fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify({ name: 'Seed', email: em, password: pw }) }).then(r => r.json());
  const logX = (em, pw, ip) => fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify({ email: em, password: pw }) }).then(r => r.json());
  assert.ok((await seedX('trust-seed@test.dev', 'Trust-seed9!', '198.51.113.5')).token, 'seed account created');
  assert.ok((await logX('trust-seed@test.dev', 'Trust-seed9!', '198.51.113.6')).token, 'email login seeds a trusted network');
  // create a phone-ONLY account — verify auto-creates it with email = null
  const pr = await fetch(base + '/api/auth/phone/request', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.113.1' }, body: JSON.stringify({ phone: '+91 919000022222' }) }).then(r => r.json());
  const code = (pr.demo_sms.body.match(/\d{6}/) || [])[0];
  const pv = await fetch(base + '/api/auth/phone/verify', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.113.1' }, body: JSON.stringify({ phone: '+91 919000022222', code }) }).then(r => r.json());
  assert.equal(pv.created, true, 'phone-only account created (no email on it)');
  // reset ITS password — the old line threw null.toLowerCase() here and answered 500
  const rr = await fetch(base + '/api/auth/phone/request', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.113.2' }, body: JSON.stringify({ phone: '+91 919000022222', purpose: 'reset' }) }).then(r => r.json());
  const code2 = (rr.demo_sms.body.match(/\d{6}/) || [])[0];
  const res = await post('/api/auth/password/reset', { phone: '+91 919000022222', code: code2, newPassword: 'Phone-only-9' });
  assert.equal(res.status, 200, 'phone reset succeeds for an email-less account');
  assert.equal(res.ok, true, 'and reports success — the user is not left thinking it failed');
  // sanity: the cleanup only touches the owner's own keys — the seed account still logs in
  assert.ok((await logX('trust-seed@test.dev', 'Trust-seed9!', '198.51.113.7')).token, 'unrelated trust unaffected');
});
