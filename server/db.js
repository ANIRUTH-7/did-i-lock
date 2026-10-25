'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DIL_DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_FILE = path.join(DATA_DIR, 'didilock.db');
const db = new Database(DB_FILE);
try { fs.chmodSync(DB_FILE, 0o600); } catch { /* restricted fs */ } // now that the file exists: private to the service user
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  list TEXT NOT NULL DEFAULT 'General',
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  due_at INTEGER,
  done INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  google_id TEXT UNIQUE,
  provider TEXT NOT NULL DEFAULT 'password',
  password_hash TEXT,
  home_lat REAL,
  home_lng REAL,
  home_label TEXT,
  geo_radius_m INTEGER NOT NULL DEFAULT 150,
  followup_minutes INTEGER NOT NULL DEFAULT 5,
  notify_inapp INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS deleted_ids (
  id INTEGER PRIMARY KEY,
  deleted_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'login',
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  subscription TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`);

// ---------- migration: old schema (email NOT NULL, no phone/google) -> new ----------
(function migrate() {
  const cols = db.prepare('PRAGMA table_info(users)').all();
  if (!cols.length) return;
  const names = cols.map(c => c.name);
  const needPhone = !names.includes('phone');
  const needGoogle = !names.includes('google_id');
  const needProvider = !names.includes('provider');
  const emailNotnull = (cols.find(c => c.name === 'email') || {}).notnull === 1;
  const pwNotnull = (cols.find(c => c.name === 'password_hash') || {}).notnull === 1;
  if (!needPhone && !needGoogle && !needProvider && !emailNotnull && !pwNotnull) return;
  db.pragma('foreign_keys = OFF');
  db.exec('BEGIN'); // the copy-and-replace must be all-or-nothing — a crash mid-way must not lose users
  try { db.exec(`
    CREATE TABLE users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      google_id TEXT UNIQUE,
      provider TEXT NOT NULL DEFAULT 'password',
      password_hash TEXT,
      home_lat REAL, home_lng REAL, home_label TEXT,
      geo_radius_m INTEGER NOT NULL DEFAULT 150,
      followup_minutes INTEGER NOT NULL DEFAULT 5,
      notify_inapp INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
    INSERT INTO users_new (id, name, email, phone, google_id, provider, password_hash, home_lat, home_lng, home_label, geo_radius_m, followup_minutes, notify_inapp, created_at)
      SELECT id, name, email, NULL, NULL, 'password', password_hash, home_lat, home_lng, home_label, geo_radius_m, followup_minutes, notify_inapp, created_at FROM users;
    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;
  `);
  db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  db.pragma('foreign_keys = ON');
  console.log('[migrate] users table upgraded to multi-method auth');
})();

// login_codes: add purpose column for older databases
(function migrateCodes() {
  const cols = db.prepare('PRAGMA table_info(login_codes)').all().map(c => c.name);
  if (!cols.length || cols.includes('purpose')) return;
  db.exec("ALTER TABLE login_codes ADD COLUMN purpose TEXT NOT NULL DEFAULT 'login'");
})();

db.exec(`
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'door',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id, sort_order);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'leaving',
  started_at INTEGER NOT NULL,
  followup_at INTEGER,
  resolved_at INTEGER,
  note TEXT,
  duration_seconds INTEGER,
  lat REAL,
  lng REAL,
  mode TEXT NOT NULL DEFAULT 'manual'
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_due ON sessions(status, followup_at);
CREATE TABLE IF NOT EXISTS session_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  item_id INTEGER,
  label TEXT NOT NULL,
  checked INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  session_id INTEGER,
  read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_items_session ON session_items(session_id);
CREATE INDEX IF NOT EXISTS idx_login_codes_phone ON login_codes(phone, purpose);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
`);

// ---------- password helpers (scrypt) ----------
function hashPasswordSync(pw) { // boot-time seeding only — request paths use the async version so scrypt never blocks the event loop
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
const scryptAsync = (pw, salt, len) => new Promise((ok, no) =>
  crypto.scrypt(pw, salt, len, (e, k) => (e ? no(e) : ok(k))));
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scryptAsync(pw, salt, 64)).toString('hex');
  return `${salt}:${hash}`;
}
async function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const calc = (await scryptAsync(pw, salt, 64)).toString('hex');
  try { return crypto.timingSafeEqual(Buffer.from(calc, 'hex'), Buffer.from(hash, 'hex')); }
  catch { return false; } // a corrupt hash must read as a wrong password, never a 500
}

// ---------- seeding ----------
const now = () => Date.now();
const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;

function seedSession(db, uid, dayOffset, hour, minute, { items, allChecked = true, missOne = null,
  durationSeconds, status = 'confirmed_ok', note = null, mode = 'manual' }) {
  const today0 = new Date();
  today0.setUTCHours(0, 0, 0, 0);
  let started = today0.getTime() - dayOffset * DAY + hour * HOUR + minute * MIN; // same time-of-day, N days ago
  if (started > Date.now() - 25 * MIN) started = Date.now() - (2 + dayOffset) * HOUR; // never in the future
  const st = started;
  const followupAt = st + 5 * MIN;
  const resolvedAt = followupAt + 40_000 + Math.floor(Math.random() * 90_000);
  const info = db.prepare(`
    INSERT INTO sessions (user_id, status, started_at, followup_at, resolved_at, note, duration_seconds, lat, lng, mode)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(
    uid, status, st, status === 'leaving' ? followupAt : followupAt,
    status === 'leaving' || status === 'followup_pending' ? null : resolvedAt,
    note, durationSeconds,
    12.9719 + (Math.random() - 0.5) * 0.004,
    79.9942 + (Math.random() - 0.5) * 0.004,
    mode
  );
  const sid = info.lastInsertRowid;
  const insItem = db.prepare('INSERT INTO session_items (session_id, item_id, label, checked) VALUES (?,?,?,?)');
  for (const it of items) {
    const checked = allChecked && it.label === missOne ? 0 : (allChecked ? 1 : (it.label !== missOne));
    insItem.run(sid, it.id, it.label, checked ? 1 : 0);
  }
  return sid;
}

function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count > 0) return;

  const insUser = db.prepare(`
    INSERT INTO users (name, email, phone, provider, password_hash, home_lat, home_lng, home_label, geo_radius_m, followup_minutes, notify_inapp, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  // ---- Demo user (Ash, Katpadi) — reachable via email, phone OTP, or Google ----
  const ashId = insUser.run(
    'Ash R.', 'demo@didilock.app', '919876543210', 'password', hashPasswordSync('demo1234'),
    12.9726, 79.9939, 'Home · Katpadi, TN', 250, 5, 1, now() - 21 * DAY
  ).lastInsertRowid;

  const insItem = db.prepare('INSERT INTO items (user_id, label, icon, sort_order, created_at) VALUES (?,?,?,?,?)');
  const itemDefs = [
    ['Front door locked', 'door'],
    ['Back door locked', 'door'],
    ['Stove off', 'flame'],
    ['Iron unplugged', 'iron'],
    ['Windows closed', 'window'],
    ['Balcony door shut', 'door'],
    ['Keys & phone in bag', 'key'],
  ];
  const ashItems = itemDefs.map(([label, icon], i) =>
    insItem.run(ashId, label, icon, i, now() - (21 - i) * DAY).lastInsertRowid);
  const ashItemRows = db.prepare('SELECT * FROM items WHERE user_id = ? ORDER BY sort_order').all(ashId);

  const mk = (dayOffset, hour, minute, o = {}) =>
    seedSession(db, ashId, dayOffset, hour, minute, { items: ashItemRows, ...o });

  // Two weeks of realistic history — mostly all good, a couple of "went back" moments.
  mk(13, 9, 12, { durationSeconds: 11, mode: 'geo' });
  mk(12, 8, 47, { durationSeconds: 9, missOne: 'Iron unplugged', allChecked: false, status: 'confirmed_ok' });
  mk(11, 19, 5, { durationSeconds: 14 });
  mk(10, 8, 58, { durationSeconds: 10, mode: 'geo', status: 'went_back', note: 'Stopped at the traffic light near the bakery — stove was ON. Good thing I checked in time.' });
  mk(9, 9, 21, { durationSeconds: 8 });
  mk(8, 18, 44, { durationSeconds: 12 });
  mk(7, 8, 36, { durationSeconds: 10, mode: 'geo' });
  mk(6, 9, 2, { durationSeconds: 9, allChecked: false, missOne: 'Windows closed', status: 'confirmed_ok' });
  mk(5, 8, 51, { durationSeconds: 13 });
  mk(4, 19, 30, { durationSeconds: 11 });
  mk(3, 8, 40, { durationSeconds: 9, status: 'went_back', note: 'Second-guessed the back door on the way to the bus. It was locked — but my brain needed to see it.' });
  mk(2, 9, 15, { durationSeconds: 8, mode: 'geo' });
  mk(1, 8, 55, { durationSeconds: 10 });

  const insNotif = db.prepare('INSERT INTO notifications (user_id, type, title, body, session_id, read, created_at) VALUES (?,?,?,?,?,?,?)');
  // one matching notification per session, oldest first
  const s = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY started_at ASC').all(ashId);
  for (const sess of s) {
    if (sess.status === 'went_back') {
      insNotif.run(ashId, 'went_back', 'Went back — and it helped',
        sess.note || 'You double-checked. That is the whole point of this app.', sess.id, 1, sess.started_at + 6 * MIN);
    } else {
      insNotif.run(ashId, 'ok', 'All good, Ash',
        'You confirmed everything at the 5-minute check-in. No spirals.', sess.id, 1, sess.started_at + 6 * MIN);
    }
  }
  const newest = s[s.length - 1];
  insNotif.run(ashId, 'reminder', 'Reminder scheduled', 'We will check in with you 5 minutes after you left home.', newest.id, 0, newest.started_at);
  insNotif.run(ashId, 'tip', 'Tip: windows count', 'Monsoons coming — “Windows closed” is doing real work right now.', null, 0, now() - 6 * HOUR);

  // ---- Second user, so multi-tenancy is real ----
  const raviId = insUser.run(
    'Meera K.', 'ravi@didilock.app', '919123456789', 'password', hashPasswordSync('ravi1234'),
    12.9406, 80.2249, 'Flat 4B · Chennai', 400, 5, 1, now() - 9 * DAY
  ).lastInsertRowid;
  const raviItems = [
    ['Main door locked', 'door'],
    ['Induction stove off', 'flame'],
    ['Microwave off', 'box'],
    ['Bathroom window', 'window'],
  ].map(([label, icon], i) =>
    insItem.run(raviId, label, icon, i, now() - (9 - i) * DAY).lastInsertRowid);
  const raviItemRows = db.prepare('SELECT * FROM items WHERE user_id = ? ORDER BY sort_order').all(raviId);
  mkFor(raviId, 6, 9, 0, raviItemRows, {});
  mkFor(raviId, 5, 8, 50, raviItemRows, {});
  mkFor(raviId, 4, 19, 20, raviItemRows, { allChecked: false, missOne: 'Bathroom window' });
  mkFor(raviId, 2, 8, 45, raviItemRows, {});
  mkFor(raviId, 1, 9, 5, raviItemRows, {});

  function mkFor(uid, dayOffset, hour, minute, items, o) {
    return seedSession(db, uid, dayOffset, hour, minute, { items, ...o });
  }

  console.log('[seed] demo data created — demo@didilock.app / demo1234');
}

if (process.env.DIL_SEED_DEMO === '1') seedIfEmpty();
else console.log('[seed] demo data skipped (set DIL_SEED_DEMO=1 to enable the demo account)');

try { db.exec('ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0'); } catch (e) { if (!/duplicate column|already exists/i.test(e.message)) throw e; } // rethrow real failures — silent swallows here cost days of debugging
try { db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0'); } catch (e) { if (!/duplicate column|already exists/i.test(e.message)) throw e; } // rethrow real failures — silent swallows here cost days of debugging
try { db.exec("ALTER TABLE users ADD COLUMN lang TEXT NOT NULL DEFAULT 'en'"); } catch (e) { if (!/duplicate column|already exists/i.test(e.message)) throw e; } // rethrow real failures — silent swallows here cost days of debugging
try { db.exec('ALTER TABLE users ADD COLUMN xp INTEGER NOT NULL DEFAULT 0'); } catch (e) { if (!/duplicate column|already exists/i.test(e.message)) throw e; } // rethrow real failures — silent swallows here cost days of debugging
db.exec(`CREATE TABLE IF NOT EXISTS email_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'verify'
)`);
try { db.exec("ALTER TABLE email_tokens ADD COLUMN purpose TEXT NOT NULL DEFAULT 'verify'"); } catch (e) { if (!/duplicate column|already exists/i.test(e.message)) throw e; } // pre-existing databases: every token already there was a verify link

module.exports = { db, hashPassword, verifyPassword, hashPasswordSync };
