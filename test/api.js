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
const del = (p, tok) => fetch(base + p, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } }).then(async r => ({ status: r.status, ...(await r.json()) }));

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
  const r = await post('/api/auth/register', { name: 'Test User', email: 'new@test.dev', password: 'secret1' });
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
  const good = await post('/api/auth/login', { email: 'new@test.dev', password: 'secret1' });
  assert.equal(good.status, 200);
  assert.ok(good.token);
  for (let i = 0; i < 12; i++) await post('/api/auth/login', { email: 'new@test.dev', password: 'wrong' + i });
  const limited = await post('/api/auth/login', { email: 'new@test.dev', password: 'secret1' });
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
  const v2 = await post('/api/auth/phone/verify', { phone: '9000011111', code: (await post('/api/auth/phone/request', { phone: '9000011111' })).demo_sms.body.match(/\d{6}/)[0] });
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
  const sub = { endpoint: 'https://push.example/abc123', keys: { p256dh: 'k', auth: 'a' } };
  const s1 = await post('/api/push/subscribe', { subscription: sub }, newTok);
  assert.equal(s1.status, 200);
  const s2 = await post('/api/push/subscribe', { subscription: { ...sub, keys: { p256dh: 'k2', auth: 'a2' } } }, newTok);
  assert.equal(s2.status, 200);
  const rows = db.prepare('SELECT * FROM push_subscriptions').all();
  const forUser = rows.filter(r => r.endpoint === sub.endpoint);
  assert.equal(forUser.length, 1); // upsert, not duplicate
});

test('stats: shape + tz-aware streak', async () => {
  if (!demoTok) demoTok = (await post('/api/auth/login', { email: 'demo@didilock.app', password: 'newpass99' })).token;
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

test('me: profile update incl. phone + delete', async () => {
  const p = await patch('/api/me', { name: 'Renamed', phone: '+91 98800 12345' }, newTok);
  assert.equal(p.user.name, 'Renamed');
  assert.equal(p.user.phone, '919880012345');
  const dup = await patch('/api/me', { phone: '919000011111' }, newTok);
  assert.equal(dup.status, 409); // taken by the OTP account
  const d = await del('/api/me', newTok);
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
  for (let i = 0; i < 10; i++) {
    const st = await fetch(base + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `${11 + i}.${i}.${i}.${i + 3}, 10.0.0.9, 198.51.100.7` },
      body: JSON.stringify({ name: 'Burst ' + i, email: 'burst' + i + '@x.test', password: 'password123' }),
    }).then(r => r.status);
    if (st === 429) limited += 1; else if (st === 200) ok += 1;
  }
  assert.ok(limited >= 1, 'burst eventually hits the limiter');
  assert.ok(ok <= 5, 'at most the register limit succeeds despite rotating client-supplied hops');
});

// ---- security v1.3.1: headers + client-IP selection ----
test('security v1.3.1: standard security headers are set', async () => {
  const r = await fetch(base + '/api/health');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.ok((r.headers.get('permissions-policy') || '').includes('geolocation=(self)'));
});

test('security v1.3.1: private trailing hops are skipped when picking the client IP', async () => {
  // simulates "realClient, internal-hop": a naive last-hop read would bucket everyone together
  const a = await fetch(base + '/api/whoip', { headers: { 'X-Forwarded-For': '203.0.113.7, 10.0.0.9' } }).then(r => r.json());
  assert.equal(a.ip, '203.0.113.7');
  // edge appended the visitor last (Render behaviour): last public hop wins
  const b = await fetch(base + '/api/whoip', { headers: { 'X-Forwarded-For': '9.9.9.9, 198.51.100.4' } }).then(r => r.json());
  assert.equal(b.ip, '198.51.100.4');
  // all-private chain (direct internal access): falls back to the last hop instead of crashing
  const c = await fetch(base + '/api/whoip', { headers: { 'X-Forwarded-For': '10.1.1.1, 10.0.0.2' } }).then(r => r.json());
  assert.equal(c.ip, '10.0.0.2');
});

