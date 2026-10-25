'use strict';
/* ================= Did I Lock? — SPA ================= */

// ---------- icons ----------
const ICONS = {
  door: '<path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17"/><path d="M3 21h18"/><circle cx="15" cy="12" r="1"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3 1.072-1.222 2.5-2 2.5-5 2.5 1.5 5.5 5 5.5 8.5a6 6 0 1 1-12 0c0-1.03.25-2 .75-3 .5 1 1.5 2 2.75 2z"/>',
  iron: '<path d="M3.5 18h17"/><path d="M4.5 18v-1c0-4.5 3.5-8 8.8-8 4 0 6.2 2.3 6.2 5.5V18"/><circle cx="8.5" cy="14" r="1"/>',
  window: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M12 4v16M4 12h16"/>',
  plug: '<path d="M9 3v5M15 3v5"/><path d="M7 8h10v3a5 5 0 0 1-10 0z"/><path d="M12 16v5"/>',
  car: '<path d="M5 16l1.4-4.4A2 2 0 0 1 8.3 10h7.4a2 2 0 0 1 1.9 1.6L19 16"/><rect x="4" y="16" width="16" height="4" rx="1"/><path d="M7.5 18h.01M16.5 18h.01"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M15.5 6.5l3 3"/>',
  box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  pin: '<path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v5M14 11v5"/>',
  pencil: '<path d="M4 20l4.5-1L20 7.5 16.5 4 5 15.5 4 20z"/><path d="M14.5 6l3.5 3.5"/>',
  chevD: '<path d="M6 9l6 6 6-6"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1"/>',
  logout: '<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"/><path d="M14 8l4 4-4 4M18 12H9"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="5" cy="6" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="18" r="1"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>',
  route: '<circle cx="12" cy="12" r="9"/><path d="M15 9l-2 5-4 1 2-5z"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/>',
  gym: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/>',
  task: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a1 1 0 0 0-1 1c0 2.2 1.8 4 4 4M17 6h3a1 1 0 0 1 1 1c0 2.2-1.8 4-4 4"/>',
  gem: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M9.5 3L8 9l4 12M14.5 3L16 9l-4 12"/>',
  bolt: '<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>',
};
function icon(name, cls = '') {
  const body = ICONS[name] || ICONS.box;
  return `<span class="ic ${cls}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${body}</svg></span>`;
}

// ================= PAGE BACKGROUNDS — cinematic, per view =================
const PAGE_BG = {
  dashboard: '/img/bg-home.jpg',
  checks: '/img/bg-checks.jpg',
  tasks: '/img/bg-tasks.jpg',
  departures: '/img/bg-history.jpg',
  activity: '/img/bg-activity.jpg',
  settings: '/img/bg-settings.jpg',
};
function setPageBg(route) {
  const el = document.getElementById('page-bg');
  if (!el) return;
  const img = PAGE_BG[route] || '';
  if (el.dataset.cur === (img || 'none')) return;
  el.dataset.cur = img || 'none';
  el.classList.toggle('on', !!img);
  el.innerHTML = img ? `<img src="${img}" alt="" loading="lazy"/><div class="veil"></div>` : '<div class="veil"></div>';
}

// ================= SOUND — tiny WebAudio SFX, zero assets =================
const SFX = (() => {
  let ctx = null;
  const enabled = () => localStorage.getItem('dil_sfx') !== 'off';
  const ac = () => { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); return ctx; };
  function tone(freq, at, dur, type = 'sine', vol = .1, glideTo = null) {
    if (!enabled()) return;
    try {
      const c = ac(), t0 = c.currentTime + at;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + .012);
      g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
      o.connect(g).connect(c.destination);
      o.start(t0); o.stop(t0 + dur + .05);
    } catch { /* audio unavailable */ }
  }
  return {
    enabled,
    toggle() { const v = !enabled(); localStorage.setItem('dil_sfx', v ? 'on' : 'off'); return v; },
    tick() { tone(720, 0, .05, 'sine', .045); tone(1150, .045, .08, 'sine', .035); },
    unTick() { tone(420, 0, .07, 'sine', .035, 310); },
    go() { tone(440, 0, .1, 'sine', .05); tone(587, .09, .14, 'sine', .05); },
    success() { tone(523, 0, .12, 'sine', .055); tone(659, .1, .12, 'sine', .055); tone(784, .2, .3, 'sine', .065); },
    level() { tone(523, 0, .1, 'sine', .04); tone(659, .09, .1, 'sine', .04); tone(784, .18, .3, 'triangle', .06); },
    lock() { tone(140, 0, .09, 'square', .07, 100); tone(72, .05, .16, 'sine', .11); },
    alert() { tone(660, 0, .15, 'sine', .05); tone(880, .14, .18, 'sine', .045); },
  };
})();

// ================= XP + LEVELS (light game layer) =================
const LEVELS = [[0, 'Newcomer'], [50, 'Gatekeeper'], [150, 'Guardian'], [320, 'Lock Legend'], [600, 'Aurora Master']];
const xpKey = () => 'dil_xp_v1_' + ((state.user && state.user.id) || 'anon'); // XP belongs to the ACCOUNT, not the device
function xpGet() { return Number(localStorage.getItem(xpKey()) || 0); }
function levelOf(xp) { let cur = LEVELS[0]; for (const L of LEVELS) if (xp >= L[0]) cur = L; return cur; }
function xpPaint() {
  const el = document.getElementById('xp-num');
  if (el) el.textContent = xpGet();
}
function addXp(n, why = '') {
  const before = levelOf(xpGet())[1];
  const nv = xpGet() + n;
  localStorage.setItem(xpKey(), String(nv));
  xpPaint();
  if (state.user && !state.guest) api('/api/me', { method: 'PATCH', body: { xp: nv } }).then(d => { if (d.user) state.user = d.user; }).catch(() => { }); // XP travels with the login, fire-and-forget
  const pill = document.getElementById('xp-pill');
  if (pill) {
    pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump');
    const f = document.createElement('div');
    f.className = 'xp-float'; f.textContent = `+${n} XP${why ? ' · ' + why : ''}`;
    const r = pill.getBoundingClientRect();
    f.style.left = Math.max(12, r.left - 60) + 'px'; f.style.top = (r.bottom + 10) + 'px';
    document.body.appendChild(f); setTimeout(() => f.remove(), 1250);
  }
  const after = levelOf(nv)[1];
  if (after !== before) {
    SFX.level(); confetti(12, true);
    toast({ title: `Level up — ${after}!`, sub: 'New rank unlocked. Keep the streak alive.', type: 'ok', ms: 5200 });
  }
}

// ================= CONFETTI (one-shot celebration) =================
function confetti(n = 14, gold = false) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  const colors = gold
    ? ['#ffd166', '#f5b73f', '#ffb84d', '#fff3c4', '#ffe9a8']
    : ['#8b7bff', '#2ee6b8', '#5ff0cd', '#f5b73f', '#fb6d9d', '#7c6cff'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.className = 'cf' + (Math.random() < .3 ? ' round' : '');
    p.style.left = (Math.random() * 100) + 'vw';
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--dx', (Math.random() * 14 - 7) + 'vw');
    p.style.setProperty('--rot', (200 + Math.random() * 240) + 'deg');
    p.style.setProperty('--dur', (2.8 + Math.random() * 1.4) + 's');
    p.style.setProperty('--delay', (Math.random() * .5) + 's');
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 5200);
}

// ---------- utils ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const token = () => localStorage.getItem('dil_token');
let clockSkew = 0; // server time minus device time — phone clocks are often minutes off
const serverNow = () => Date.now() + clockSkew;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function timeAgo(ts) {
  const d = Date.now() - ts;
  const hi = LANG === 'hi';
  if (d < 60e3) return hi ? 'अभी' : 'just now';
  if (d < 3600e3) return hi ? `${Math.floor(d / 60e3)} मि पहले` : `${Math.floor(d / 60e3)}m ago`;
  if (d < 86400e3) return hi ? `${Math.floor(d / 3600e3)} घं पहले` : `${Math.floor(d / 3600e3)}h ago`;
  if (d < 7 * 86400e3) return hi ? `${Math.floor(d / 86400e3)} दि पहले` : `${Math.floor(d / 86400e3)}d ago`;
  return new Date(ts).toLocaleDateString(hi ? 'hi-IN' : undefined, { month: 'short', day: 'numeric' });
}
const fmtTime = ts => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const fmtDay = ts => new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
function mmss(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function haversine(a, b) {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function toast({ title, sub = '', type = 'info', ms = 4600 }) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="t-ic">${icon(type === 'err' ? 'x' : type === 'ok' ? 'check' : 'info')}</span>
    <span class="t-body"><span class="t-title">${esc(title)}</span>${sub ? `<div class="t-sub">${esc(sub)}</div>` : ''}</span>
    <button class="t-close" aria-label="Dismiss">${icon('x')}</button>`;
  el.querySelector('.t-close').onclick = () => el.remove();
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 320); }, ms);
}

// ---------- i18n (EN / HI) ----------
let LANG = localStorage.getItem('dil_lang') || 'en';
const I18N = {
  en: {
    nav_dashboard: 'Dashboard', nav_checks: 'My checks', nav_tasks: 'Tasks', nav_departures: 'Departures', nav_activity: 'Activity', nav_settings: 'Settings',
    bn_home: 'Home', bn_checks: 'Checks', bn_history: 'History',
    hero_ready: 'Ready to leave', hero_ready_sub: 'Tap once per check — about 10 seconds. Then go. We’ll check in {min} minutes later so you can stop wondering on the way.',
    hero_cta: 'Start my check',
    hero_setup_t: 'Let’s set up your 10-second check.', hero_setup_s: 'Doors, stove, iron, windows — add what you want to remember, and we’ll check in with you 5 minutes after you leave so the spiral never starts.',
    hero_setup_cta: 'Add your first check',
    hero_away: 'Looks like you’re away from home.', away_sub: 'Did you do your 10-second check before going out?', away_cta: 'Do my check', away_ok: "No, I'm good",
    hero_going: 'on your way', hero_going_sub: 'We’ll nudge you at {time} — to confirm everything is really done.',
    hero_checkin: 'Quick gut check', hero_checkin_sub: 'You left home at {time}. Did you check the doors, stove, iron and windows?',
    checkin_in: 'CHECK-IN IN', confirm_early: 'Confirm early', checkin_now: 'Check in now', tap_close: 'TAP TO CLOSE THE LOOP',
    stat_week: 'This week', stat_ok: 'All-good rate', stat_back: 'Went back', stat_back_sub: 'each one was worth it', stat_streak: 'Day streak',
    recent: 'Recent departures', activity: 'Activity', view_all: 'View all →',
    how1_t: 'Tap your checks', how1_s: 'One tap per item — door, stove, iron, windows. Ten seconds, tops.',
    how2_t: 'Walk out the door', how2_s: 'We note the time and (if you allow it) watch your distance from home.',
    how3_t: 'Get the {min}-min nudge', how3_s: '“Did you check everything?” You confirm, the loop closes, the spiral dies.',
    checks_title: 'My checks', checks_sub: 'The 10-second ritual. Tap to add, drag to reorder, edit anything.',
    add_check: 'Add a check', add_placeholder: 'e.g. Garage door locked', add_btn: 'Add',
    no_checks_t: 'No checks yet', no_checks_s: 'Add the things you always wonder about — “Stove off”, “Iron unplugged”, “Windows closed” — and they’ll be waiting for you every time you leave.',
    leaving_now: 'Leaving now', leaving_sub: '{n} checks · about 10 seconds · we’ll check in in {min} min',
    confirmed_of: '{a} of {b} confirmed',
    unchecked_note: '{n} unchecked — tap the ones you did check, or mark all below.',
    mark_all: 'Mark all', im_leaving: 'I’m leaving — lock it in',
    success_go: 'Clean getaway', success_sub: '{a}/{b} confirmed at {time}. We’ll nudge you at <strong>{followup}</strong> to close the loop.',
    done: 'Done',
    fu_title: 'Did you check everything?', fu_body: '{name}, it’s {time} — {min} minutes since you left home. Trust your gut: doors, stove, iron, windows — really done?',
    fu_ok: 'Yes — everything’s good', fu_review: 'I need to double-check',
    fu_review_t: 'Double-check time', fu_review_s: 'Tap anything you’re unsure about. Better one U-turn than a whole day of doubt.',
    fu_note_ph: 'What did you find? (optional)', fu_back: 'I went back to re-check', fu_fine: 'Nope — actually all fine',
    loop_closed: 'Loop closed.', loop_closed_s: 'Everything confirmed. No spirals required — enjoy the ride, {name}.',
    went_back_h: 'Good thing you went back.', went_back_s: 'That’s the whole point: one nudge kills a whole day of doubt.',
    chip_ok: 'All good', chip_back: 'Went back', chip_pending: 'Awaiting you', chip_away: 'On the way', chip_missed: 'Missed',
    deps_title: 'Departures', deps_sub: 'Every time you checked out — and what the check-in found out.',
    filter_all: 'All', filter_ok: 'All good', filter_back: 'Went back', filter_pending: 'Pending',
    no_deps_t: 'No departures yet', no_deps_s: 'Hit “Start my check” on the dashboard — your first departure will appear here with its check-in result.',
    no_match_t: 'Nothing matches this filter', no_match_s: 'Try a different filter, or make a new one from the dashboard.',
    waiting_title: 'Waiting for your check-in', onway_title: 'On the way',
    allgood_btn: 'All good', back_btn: 'I went back', delete_btn: 'Delete',
    act_title: 'Activity', act_sub: 'Every reminder, check-in and result — the audit trail of your peace of mind.',
    mark_read: 'Mark all read', no_act_t: 'No activity yet', no_act_s: 'Once you do a check, reminders and check-in results will land here.',
    set_title: 'Settings', set_sub: 'Account, home zone, and how the check-in works.',
    prof_t: 'Profile', prof_s: 'Stored on your account — restored automatically after any reinstall.',
    name_l: 'Name', name_s: 'Used in your check-in messages', email_l: 'Email', email_s: 'Your sign-in — data lives here',
    phone_l: 'Phone', phone_s: 'Link a number to unlock the phone-OTP sign-in method', method_l: 'Sign-in method', method_s: 'How this account was created',
    lang_l: 'Language', lang_s: 'App language',
    loc_t: 'Home & location', loc_s: 'The app watches your distance from home. Beyond your radius, you count as “left”.',
    homelabel_l: 'Home label', homepoint_l: 'Home point', radius_l: 'Away radius', radius_s: 'You count as having left beyond this distance',
    save_loc: 'Save location', use_gps: 'Use GPS',
    checkin_t: 'Check-in', checkin_s: 'How long after you leave we ask “Did you check everything?”',
    wait_l: 'Wait before check-in', wait_s: '{min} minutes is the current setting — long enough to be on the road, short enough to matter',
    inapp_l: 'In-app notifications', inapp_s: 'Toasts and the check-in card in this app',
    push_l: 'Push notifications', push_s: 'Get the nudge even when the app is closed (installable PWA)',
    browser_l: 'Browser notifications', browser_s: 'System alerts while the tab is open',
    preview_l: 'Preview the check-in nudge', preview_s: 'See exactly what you’ll get after you leave', preview: 'Preview',
    save_checkin: 'Save check-in', enable: 'Enable',
    danger_t: 'Danger zone', danger_s: 'Deleting your account removes your checks, history and home zone permanently.',
    sign_out: 'Sign out', delete_acct: 'Delete account',
    forgot: 'Forgot password?',
    toast_sched_t: 'Check-in scheduled', toast_sched_s: 'We’ll ask you in {min} minutes',
    loop_toast: 'Loop closed ✓', back_toast: 'Good thing you went back', saved: 'Settings saved',
    last_time: 'Last time: you left {day} at {time}', last_first: 'your first check is waiting',
    last_detail_ok: 'Confirmed at the check-in. Zero spirals that day.', last_detail_back: 'You went back once — and it was worth it. Every nudge works like that.', last_none: 'Do it once and never wonder again.',
    theme_dark: 'Dark mode', theme_sub: 'Easier on the eyes at night',
    week_title: 'This week', week_none: 'Nothing yet this week — your first check is one tap away.', week_insight: '{a} checks · {b}% all good',
    tpl_title: 'New from a template', tpl_sub: 'Start from a ready-made routine — then make it yours.',
    tpl_home: 'Home', tpl_work: 'Work', tpl_travel: 'Travel', tpl_night: 'Night', tpl_gym: 'Gym',
    tpl_use: 'Replace my checklist', tpl_keep: 'Keep my checklist', tpl_use_s: 'Replaces your current checks with the {n} from the {name} routine.', tpl_done: 'Template applied — make it yours',
    share_l: 'Share Did I Lock?', share_s: 'Know someone who always wonders if they locked the door?', share_btn: 'Share', share_done: 'Link copied — share it anywhere',
    mile_t: 'Milestones', mile_s: 'Small marks of a calmer routine.',
    m_first: 'First check-in', m_ten: '10 check-ins', m_thirty: '30 check-ins', m_streak7: '7-day streak', m_back3: 'Double-checker',
    sched_lbl: 'Check-in scheduled', due_lbl: 'Check-in is due — tap to close the loop',
  },
  hi: {
    nav_dashboard: 'डैशबोर्ड', nav_checks: 'मेरी चेकलिस्ट', nav_tasks: 'काम', nav_departures: 'निकासी', nav_activity: 'गतिविधि', nav_settings: 'सेटिंग्स',
    bn_home: 'होम', bn_checks: 'चेक', bn_history: 'इतिहास',
    hero_ready: 'निकलने के लिए तैयार हैं', hero_ready_sub: 'हर चेक पर एक टैप — लगभग 10 सेकंड। फिर निकल जाएँ। {min} मिनट बाद हम पता लगाएँगे, ताकि रास्ते में ख्याल न रहे।',
    hero_cta: 'मेरी चेक शुरू करें',
    hero_setup_t: 'अपनी 10-सेकंड की चेक बनाएँ।', hero_setup_s: 'दरवाज़े, चूल्हा, आइरन, खिड़कियाँ — जो याद रखना है वह जोड़ें, और निकलने के 5 मिनट बाद हम पता लगाएँगे।',
    hero_setup_cta: 'पहली चेक जोड़ें',
    hero_away: 'लगता है आप घर से बाहर हैं।', away_sub: 'निकलने से पहले अपनी 10-सेकंड की चेक की थी ना?', away_cta: 'चेक करूँ', away_ok: 'नहीं, सब ठीक है',
    hero_going: 'राह पर हैं', hero_going_sub: 'हम {time} पर याद दिलाएँगे — सच में सब हो गया है या नहीं।',
    hero_checkin: 'एक पल की जाँच', hero_checkin_sub: 'आपने {time} पर घर छोड़ा। दरवाज़े, चूल्हा, आइरन, खिड़कियाँ — सब चेक किए?',
    checkin_in: 'चेक-इन शेष', confirm_early: 'अभी पुष्टि करें', checkin_now: 'अभी चेक-इन करें', tap_close: 'बंद करने के लिए टैप करें',
    stat_week: 'इस सप्ताह', stat_ok: 'सब-ठीक दर', stat_back: 'वापस गए', stat_back_sub: 'हर एक लाजवाब था', stat_streak: 'दिन की स्ट्रीक',
    recent: 'हाल की निकासी', activity: 'गतिविधि', view_all: 'सभी देखें →',
    how1_t: 'चेक टैप करें', how1_s: 'हर आइटम पर एक टैप — दरवाज़ा, चूल्हा, आइरन, खिड़कियाँ। ज़्यादा से ज़्यादा 10 सेकंड।',
    how2_t: 'दरवाज़ा पार करें', how2_s: 'हम समय नोट करते हैं और (अनुमति मिले तो) घर से दूरी देखते हैं।',
    how3_t: '{min}-मिनट का न्यूज़ पाएँ', how3_s: '“क्या आपने सब कुछ चेक किया?” आप पुष्टि करें, लूप बंद, चक्कर छूट।',
    checks_title: 'मेरी चेकलिस्ट', checks_sub: '10-सेकंड की आदत। जोड़ने, क्रम बदलने या संशोधन के लिए टैप करें।',
    add_check: 'चेक जोड़ें', add_placeholder: 'जैसे गैराज का दरवाज़ा बंद', add_btn: 'जोड़ें',
    no_checks_t: 'अभी कोई चेक नहीं', no_checks_s: 'वह जोड़ें जिसके बारे में आप हमेशा सोचते हैं — “चूल्हा बंद”, “आइरन अनप्लग”, “खिड़कियाँ बंद” — हर बार निकलने पर वे यहीं होंगी।',
    leaving_now: 'अभी निकल रहे हैं', leaving_sub: '{n} चेक · लगभग 10 सेकंड · {min} मिनट में चेक-इन',
    confirmed_of: '{b} में से {a} पुष्टि',
    unchecked_note: '{n} बिना चेक — जो कर चुके हैं उन्हें टैप करें, या नीचे सभी चिह्नित करें।',
    mark_all: 'सभी चिह्नित', im_leaving: 'मैं निकल रहा हूँ — लॉक करें',
    success_go: 'साफ़ निकास!', success_sub: '{b} में से {a} पुष्टि {time} पर। हम <strong>{followup}</strong> पर याद दिलाएँगे।',
    done: 'हो गया',
    fu_title: 'क्या आपने सब कुछ चेक किया?', fu_body: '{name}, अभी {time} है — घर छोड़कर {min} मिनट हो गए। दिल की सुनें: दरवाज़े, चूल्हा, आइरन, खिड़कियाँ — सच में हो गया?',
    fu_ok: 'हाँ — सब ठीक है', fu_review: 'मुझे दोबारा देखना होगा',
    fu_review_t: 'दोबारा जाँच का समय', fu_review_s: 'जिस पर शक है उसे टैप करें। एक पलटना बेहतर है, दिन भर की चिंता से।',
    fu_note_ph: 'आपने क्या पाया? (वैकल्पिक)', fu_back: 'मैं वापस जाकर देखने के लिए गया', fu_fine: 'अरे नहीं — सब ठीक था',
    loop_closed: 'लूप बंद।', loop_closed_s: 'सब पुष्टि। कोई चक्कर नहीं — {name}, सफर मज़े से करें।',
    went_back_h: 'खुद बचा कि वापस गए।', went_back_s: 'यही तो मक़सद है: एक न्यूज़ से दिन भर की चिंता खत्म।',
    chip_ok: 'सब ठीक', chip_back: 'वापस गए', chip_pending: 'पुष्टि का इंतज़ार', chip_away: 'राह पर', chip_missed: 'छूट गया',
    deps_title: 'निकासी', deps_sub: 'हर बार की चेक-आउट — और चेक-इन ने क्या पाया।',
    filter_all: 'सभी', filter_ok: 'सब ठीक', filter_back: 'वापस गए', filter_pending: 'लंबित',
    no_deps_t: 'अभी कोई निकासी नहीं', no_deps_s: 'डैशबोर्ड पर “मेरी चेक शुरू करें” दबाएँ — पहली निकासी यहाँ अपने नतीजे के साथ दिखेगी।',
    no_match_t: 'इस फ़िल्टर में कुछ नहीं', no_match_s: 'दूसरा फ़िल्टर आज़माएँ, या डैशबोर्ड से नई बनाएँ।',
    waiting_title: 'आपकी पुष्टि का इंतज़ार', onway_title: 'राह पर',
    allgood_btn: 'सब ठीक', back_btn: 'मैं वापस गया', delete_btn: 'हटाएँ',
    act_title: 'गतिविधि', act_sub: 'हर रिमाइंडर, चेक-इन और नतीजा — आपकी सुकून की रिकॉर्ड।',
    mark_read: 'सभी पढ़ा हुआ करें', no_act_t: 'अभी कोई गतिविधि नहीं', no_act_s: 'जब आप पहली चेक करेंगे, रिमाइंडर और नतीजे यहाँ आएंगे।',
    set_title: 'सेटिंग्स', set_sub: 'खाता, घर का क्षेत्र, और चेक-इन कैसे काम करता है।',
    prof_t: 'प्रोफ़ाइल', prof_s: 'आपके खाते पर सहेजा गया — रीइंस्टॉल के बाद अपने-आप लौटता है।',
    name_l: 'नाम', name_s: 'चेक-इन संदेशों में इस्तेमाल', email_l: 'ईमेल', email_s: 'आपका साइन-इन — डेटा यहीं रहता है',
    phone_l: 'फ़ोन', phone_s: 'फ़ोन-OTP साइन-इन खोलने के लिए नंबर जोड़ें', method_l: 'साइन-इन तरीका', method_s: 'यह खाता कैसे बना',
    lang_l: 'भाषा', lang_s: 'एप की भाषा',
    loc_t: 'घर और लोकेशन', loc_s: 'एप आपके घर से दूरी देखता है। त्रिज्या से बाहर मतलब “निकल गए”।',
    homelabel_l: 'घर का लेबल', homepoint_l: 'घर का बिंदु', radius_l: 'बाहर होने का त्रिज्या', radius_s: 'इतनी दूरी पर आप “निकल चुके” माने जाएँगे',
    save_loc: 'लोकेशन सहेजें', use_gps: 'GPS इस्तेमाल करें',
    checkin_t: 'चेक-इन', checkin_s: 'निकलने के कितने समय बाद हम पूछेंगे “क्या आपने सब कुछ चेक किया?”',
    wait_l: 'चेक-इन से पहले प्रतीक्षा', wait_s: '{min} मिनट — इतना कि आप राह पर हों, पर इतना कम कि फ़र्क पड़े',
    inapp_l: 'इन-एप सूचनाएँ', inapp_s: 'टोस्ट और ऐप में चेक-इन कार्ड',
    push_l: 'पुश नोटिफ़िकेशन', push_s: 'एप बंद होने पर भी न्यूज़ पाएँ (इंस्टॉल किया जा सकता है)',
    browser_l: 'ब्राउज़र नोटिफ़िकेशन', browser_s: 'टैब खुले होने पर सिस्टम अलर्ट',
    preview_l: 'चेक-इन न्यूज़ देखें', preview_s: 'ठीक-ठीक देखें कि आपको क्या मिलेगा', preview: 'पूर्वव्यू',
    save_checkin: 'चेक-इन सहेजें', enable: 'चालू करें',
    danger_t: 'ख़तरनाक क्षेत्र', danger_s: 'खाता हटाने पर आपकी चेक, हिस्ट्री और घर का क्षेत्र स्थायी रूप से हट जाते हैं।',
    sign_out: 'साइन आउट', delete_acct: 'खाता हटाएँ',
    forgot: 'पासवर्ड भूल गए?',
    toast_sched_t: 'चेक-इन शेड्यूल हुआ', toast_sched_s: 'हम {min} मिनट में पूछेंगे',
    loop_toast: 'लूप बंद ✓', back_toast: 'खुद बचा कि वापस गए', saved: 'सेटिंग्स सहेजी गईं',
    last_time: 'पिछली बार: आप {day} को {time} बजे निकले', last_first: 'आपकी पहली चेक इंतज़ार में है',
    last_detail_ok: 'चेक-इन पर पुष्टि हुई। उस दिन शून्य चक्कर।', last_detail_back: 'आप एक बार वापस गए — और वह लाजवाब था। हर न्यूज़ ऐसे ही काम करता है।', last_none: 'एक बार करें और फिर कभी न सोचें।',
    theme_dark: 'डार्क मोड', theme_sub: 'रात में आँखों के लिए आसान',
    week_title: 'इस सप्ताह', week_none: 'इस सप्ताह अभी कुछ नहीं — आपका पहला चेक बस एक टैप दूर है।', week_insight: '{a} चेक · {b}% सब ठीक',
    tpl_title: 'टेम्पलेट से नई', tpl_sub: 'तैयार रूटीन से शुरू करें — फिर इसे अपना बनाएं।',
    tpl_home: 'घर', tpl_work: 'कार्यालय', tpl_travel: 'यात्रा', tpl_night: 'रात', tpl_gym: 'जिम',
    tpl_use: 'मेरी चेकलिस्ट बदलें', tpl_keep: 'मेरी चेकलिस्ट रखें', tpl_use_s: 'आपकी वर्तमान चेक्स {name} रूटीन की {n} से बदल जाएँगी।', tpl_done: 'टेम्पलेट लागू — इसे अपना बनाएं',
    share_l: 'Did I Lock? साझा करें', share_s: 'कोई जानता है जो हमेशा दरवाज़ा बंद किया या नहीं सोचता है?', share_btn: 'साझा करें', share_done: 'लिंक कॉपी हो गया — कहीं भी साझा करें',
    mile_t: 'उपलब्धियाँ', mile_s: 'शांत रूटीन के छोटे निशान।',
    m_first: 'पहली चेक-इन', m_ten: '10 चेक-इन', m_thirty: '30 चेक-इन', m_streak7: '7 दिन की धावा', m_back3: 'दोबारा-चेकर',
    sched_lbl: 'चेक-इन शेड्यूल हुआ', due_lbl: 'चेक-इन का समय — टैप करके लूप बंद करें',
  },
};
function t(key, p) {
  let s = (I18N[LANG] && I18N[LANG][key]) || I18N.en[key] || key;
  if (p) for (const k of Object.keys(p)) s = s.replace('{' + k + '}', p[k]);
  return s;
}

// ---------- api ----------
let sessionExpiredDone = false;
function sessionExpired() { // 7-day token died mid-use — one clean handoff to the auth screen, no raw errors
  if (sessionExpiredDone || state.guest || !token()) return;
  sessionExpiredDone = true;
  localStorage.removeItem('dil_token');
  toast({ title: LANG === 'hi' ? 'सेशन समाप्त — दोबारा साइन इन करें' : 'Session expired — please sign in again', type: 'info' });
  setTimeout(() => location.reload(), 900);
}
async function realApi(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* noop */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status; // callers can tell "dead token" (401/403) from "network/5xx"
    if (res.status === 401 && token() && !path.startsWith('/api/auth/')) sessionExpired();
    throw err;
  }
  return data;
}


// ---------- guest mode ("try it first") — fully local preview, merges into the account on sign-up ----------
const GUEST_KEYS = ['dil_guest', 'dil_guest_items', 'dil_guest_tasks'];
const guestLoad = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
const guestSave = (k, v) => localStorage.setItem(k, JSON.stringify(v));
let guestSeq = -1;
function guestSeedItems() {
  return [
    { id: -1, label: 'Front door locked', icon: 'door', checked: 0, sort_order: 0 },
    { id: -2, label: 'Stove off', icon: 'flame', checked: 0, sort_order: 1 },
    { id: -3, label: 'Iron unplugged', icon: 'iron', checked: 0, sort_order: 2 },
    { id: -4, label: 'Windows closed', icon: 'window', checked: 0, sort_order: 3 },
  ];
}
async function guestApi(path, { method = 'GET', body } = {}) {
  const items = () => guestLoad('dil_guest_items', []);
  const tasks = () => guestLoad('dil_guest_tasks', []);
  const UPSELL = 'Create a free account to use this — it takes 10 seconds';
  let m;
  if (path === '/api/items' && method === 'GET') return { items: items() };
  if (path === '/api/items' && method === 'POST') {
    const its = items();
    const item = { id: guestSeq--, label: String(body.label || '').slice(0, 120), icon: body.icon || 'check', checked: 0, sort_order: its.length };
    its.push(item); guestSave('dil_guest_items', its);
    return { item };
  }
  if ((m = path.match(/^\/api\/items\/reorder$/)) && method === 'PATCH') {
    const its = items(); const pos = new Map((body.ids || []).map((id, i) => [id, i]));
    its.forEach(it => { if (pos.has(it.id)) it.sort_order = pos.get(it.id); });
    its.sort((a, b) => a.sort_order - b.sort_order); guestSave('dil_guest_items', its);
    return { ok: true };
  }
  if ((m = path.match(/^\/api\/items\/(\d+)$/))) {
    const id = Number(m[1]); const its = items(); const i = its.findIndex(x => x.id === id);
    if (i < 0) throw new Error('Not found');
    if (method === 'PATCH') { its[i] = { ...its[i], ...body }; guestSave('dil_guest_items', its); return { item: its[i] }; }
    if (method === 'DELETE') { its.splice(i, 1); guestSave('dil_guest_items', its); return { ok: true }; }
  }
  if (path === '/api/tasks' && method === 'GET') return { tasks: tasks() };
  if (path === '/api/tasks' && method === 'POST') {
    const ts = tasks();
    const task = { id: guestSeq--, title: String(body.title || '').slice(0, 120), notes: String(body.notes || ''), list: body.list || 'General', due_at: body.due_at || null, done: 0, created_at: Date.now(), subtasks: [] };
    ts.push(task); guestSave('dil_guest_tasks', ts);
    return { task };
  }
  if ((m = path.match(/^\/api\/tasks\/(\d+)$/))) {
    const id = Number(m[1]); const ts = tasks();
    let hit = ts.find(t => t.id === id);
    if (!hit) for (const t of ts) { hit = (t.subtasks || []).find(s => s.id === id); if (hit) break; }
    if (!hit) throw new Error('Not found');
    if (method === 'PATCH') { Object.assign(hit, body); guestSave('dil_guest_tasks', ts); return { task: hit }; }
    if (method === 'DELETE') {
      const pi = ts.findIndex(t => t.id === id);
      if (pi >= 0) ts.splice(pi, 1);
      else for (const t of ts) t.subtasks = (t.subtasks || []).filter(s => s.id !== id);
      guestSave('dil_guest_tasks', ts); return { ok: true };
    }
  }
  throw new Error(UPSELL);
}
function guestBoot() {
  state.guest = true;
  let its = guestLoad('dil_guest_items', null);
  if (!its) { its = guestSeedItems(); guestSave('dil_guest_items', its); }
  state.items = its;
  state.tasks = guestLoad('dil_guest_tasks', []);
  state.sessions = []; state.notifications = []; state.unread = 0; state.activeSession = null; state.loaded = true;
  state.stats = new Proxy({ ok: 0, wentBack: 0, total: 0, streak: 0 }, { get: (t, k) => (k in t ? t[k] : 0) });
  enterApp({ name: 'Guest', email: '', provider: 'guest', followup_minutes: 5 });
}
function mountGuestBar() {
  if (document.querySelector('.guest-bar')) return;
  const bar = document.createElement('div');
  bar.className = 'guest-bar';
  bar.innerHTML = '<span class="gb-txt">\uD83D\uDC41 Guest preview — data stays on this device only</span>'
    + '<button class="gb-save" id="guest-save">Keep my data — sign up</button>'
    + '<button class="gb-x" id="guest-exit" aria-label="Exit guest mode" title="Exit guest mode">\u2715</button>';
  document.getElementById('app-shell').prepend(bar);
  bar.querySelector('#guest-save').onclick = () => { try { sessionStorage.setItem('dil_to_auth', '1'); } catch { /* */ } location.reload(); }; // keys kept → merged after sign-up; the flag routes the reload to the auth screen
  bar.querySelector('#guest-exit').onclick = () => { GUEST_KEYS.forEach(k => localStorage.removeItem(k)); location.reload(); };
}
async function maybeMergeGuest() {
  const its = guestLoad('dil_guest_items', []);
  const ts = guestLoad('dil_guest_tasks', []);
  if (!its.length && !ts.length) { state.guest = false; return; }
  let moved = 0;
  try {
    // merge with de-duplication: identical defaults are skipped, custom guest items are moved in
    const haveItem = new Set(state.items.map(i => String(i.label || '').trim().toLowerCase()));
    for (const it of its) {
      const key = String(it.label || '').trim().toLowerCase();
      if (haveItem.has(key)) continue;
      const { item } = await realApi('/api/items', { method: 'POST', body: { label: it.label, icon: it.icon } });
      state.items.push(item); haveItem.add(key); moved++;
    }
    const haveTask = new Set(state.tasks.map(t => String(t.title || '').trim().toLowerCase()));
    for (const t of ts) {
      const key = String(t.title || '').trim().toLowerCase();
      if (haveTask.has(key)) continue;
      const { task } = await realApi('/api/tasks', { method: 'POST', body: { title: t.title, notes: t.notes, list: t.list, due_at: t.due_at } });
      task.subtasks = task.subtasks || []; state.tasks.push(task); haveTask.add(key); moved++;
    }
  } catch { return; } // keep the keys so the next login can merge again
  GUEST_KEYS.forEach(k => localStorage.removeItem(k));
  state.guest = false;
  const bar = document.querySelector('.guest-bar'); if (bar) bar.remove();
  toast({ title: 'Guest data saved to your account', sub: moved ? `${moved} item${moved === 1 ? '' : 's'} moved in` : 'Welcome in!', type: 'ok' });
  renderBellDot(); renderView();
}

async function api(path, opts = {}) {
  if (state.guest) return guestApi(path, opts);
  return realApi(path, opts);
}

// ---------- theme (light / dark) ----------
const THEME_KEY = 'dil_theme';
const MOON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>';
const SUN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
function currentTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme(th) {
  document.documentElement.dataset.theme = th;
  const btn = document.getElementById('theme-btn');
  if (btn) {
    btn.querySelector('.ic').innerHTML = th === 'dark' ? SUN_SVG : MOON_SVG;
    btn.setAttribute('aria-label', th === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
  const sel = document.getElementById('set-theme');
  if (sel) sel.checked = th === 'dark';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', th === 'dark' ? '#0c1120' : '#0e1424');
}
function setTheme(th) {
  localStorage.setItem(THEME_KEY, th);
  applyTheme(th);
}

// ---------- state ----------
const state = {
  user: null,
  guest: false,
  items: [],
  stats: null,
  activeSession: null,
  sessions: [],
  notifications: [],
  unread: 0,
  route: 'dashboard',
  loaded: false,
  deptFilter: 'all',
  followupOpenFor: null,
  geo: { last: null, error: null, away: null }, // null = no good fix yet
  newDeptId: null,   // departure just created → highlight it in history
  sheetJust: [],     // ids just checked in the sheet → tick-draw animation
  tplKey: null,      // template open in the preview modal
};
let awayPrompted = false;

// ---------- auth screen ----------
const GOOGLE_LOGO = `<svg viewBox="0 0 48 48" width="28" height="28"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

function showAuth() {
  $('#auth-screen').classList.remove('hidden');
  $('#app-shell').classList.add('hidden');
}
function setAuthTab(which) {
  const login = which === 'login';
  $('#tab-login').classList.toggle('active', login);
  $('#tab-register').classList.toggle('active', !login);
  $('#signin-wrap').classList.toggle('hidden', !login);
  $('#form-register').classList.toggle('hidden', login);
  $('#login-err').textContent = '';
  $('#register-err').textContent = '';
}
$('#tab-login').onclick = () => setAuthTab('login');
$('#tab-register').onclick = () => setAuthTab('register');

// --- sign-in method tabs (email / phone / google) ---
function setMethod(m) {
  $$('.method-tab').forEach(b => b.classList.toggle('active', b.dataset.m === m));
  $('#form-login').classList.toggle('hidden', m !== 'email');
  $('#method-phone').classList.toggle('hidden', m !== 'phone');
  $('#method-google').classList.toggle('hidden', m !== 'google');
}
$$('.method-tab').forEach(b => { b.onclick = () => setMethod(b.dataset.m); });

// --- email + password ---
$('#pw-eye').onclick = () => {
  const inp = $('#login-pw');
  inp.type = inp.type === 'password' ? 'text' : 'password';
};
async function doLogin(email, password, btn) {
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = 'Signing in…';
  try {
    const d = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    localStorage.setItem('dil_token', d.token);
    await enterApp(d.user);
    toast({ title: `Welcome back, ${firstName(d.user.name)}`, type: 'ok' });
  } catch (e) {
    $('#login-err').textContent = e.message;
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
}
$('#form-login').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  doLogin(f.email.value.trim(), f.password.value, $('#login-btn'));
});

// --- forgot password (reset via phone OTP) ---
const $rp = id => document.getElementById(id);
function resetShow(step) {
  $rp('reset-step1').classList.toggle('hidden', step !== 1);
  $rp('reset-step2').classList.toggle('hidden', step !== 2);
  $rp('reset-done').classList.toggle('hidden', step !== 3);
  if (step !== 2) $rp('reset-sms').classList.add('hidden');
  $rp('reset-err').textContent = '';
}
$('#forgot-link').onclick = () => {
  const panel = $('#reset-panel');
  const loginBtn = $('#login-btn'), forgotLink = $('#forgot-link');
  if (panel.classList.contains('hidden')) {
    panel.classList.remove('hidden');
    loginBtn.style.display = 'none'; forgotLink.style.display = 'none';
    resetShow(1);
  } else {
    panel.classList.add('hidden');
    loginBtn.style.display = ''; forgotLink.style.display = '';
  }
};
$('#reset-cancel').onclick = () => {
  $('#reset-panel').classList.add('hidden');
  $('#login-btn').style.display = ''; $('#forgot-link').style.display = '';
};
$('#reset-send').onclick = async () => {
  const btn = $rp('reset-send');
  $rp('reset-err').textContent = '';
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    const d = await api('/api/auth/phone/request', { method: 'POST', body: { phone: $rp('reset-phone').value, purpose: 'reset' } });
    $rp('reset-sms-to').textContent = d.demo_sms.to;
    $rp('reset-sms-body').textContent = d.demo_sms.body;
    $rp('reset-sms').classList.remove('hidden');
    resetShow(2);
    $rp('reset-code').focus();
  } catch (e) { $rp('reset-err').textContent = e.message; }
  finally { btn.disabled = false; btn.textContent = 'Send reset code'; }
};
$rp('reset-code').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });
$('#reset-email-btn').onclick = async () => { // H4: email accounts get a reset link instead of an SMS code
  const btn = $('#reset-email-btn'), msg = $('#reset-email-msg');
  btn.disabled = true; msg.textContent = '';
  try {
    const d = await api('/api/auth/email/reset/request', { method: 'POST', body: { email: $('#reset-email').value.trim() } });
    if (d.delivery === 'demo' && d.token) {
      msg.innerHTML = 'Demo server — open your reset link: <a href="/reset.html#' + d.token + '" style="color:var(--accent)">Reset password</a>';
    } else {
      msg.textContent = 'Reset link sent — check your inbox (it expires in 1 hour).';
    }
  } catch (e) { msg.textContent = e.message; }
  finally { btn.disabled = false; }
};
$('#reset-do').onclick = async () => {
  const btn = $rp('reset-do');
  const pw = $rp('reset-pw').value, pw2 = $rp('reset-pw2').value;
  $rp('reset-err').textContent = '';
  if (pw.length < 8) { $rp('reset-err').textContent = 'New password must be at least 8 characters'; return; }
  if (pw !== pw2) { $rp('reset-err').textContent = 'Passwords do not match'; return; }
  btn.disabled = true; btn.textContent = 'Resetting…';
  try {
    await api('/api/auth/password/reset', { method: 'POST', body: { phone: $rp('reset-phone').value, code: $rp('reset-code').value, newPassword: pw } });
    resetShow(3);
    $rp('reset-code').value = ''; $rp('reset-pw').value = ''; $rp('reset-pw2').value = '';
  } catch (e) { $rp('reset-err').textContent = e.message; }
  finally { btn.disabled = false; btn.textContent = 'Reset password'; }
};

// --- phone OTP (demo SMS delivered in-app) ---
const phoneState = { timer: null };
async function requestCode() {
  const phone = $('#phone-input').value.trim();
  $('#phone-err').textContent = '';
  const btn = $('#send-code-btn');
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    const d = await api('/api/auth/phone/request', { method: 'POST', body: { phone } });
    $('#sms-to').textContent = d.demo_sms.to;
    $('#sms-body').textContent = d.demo_sms.body;
    $('#sms-bubble').classList.remove('hidden');
    $('#phone-step1').classList.add('hidden');
    $('#phone-step2').classList.remove('hidden');
    $('#code-input').value = '';
    $('#code-input').focus();
    startResend();
  } catch (e) {
    $('#phone-err').textContent = e.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Send code';
  }
}
function startResend() {
  let left = 30;
  const t = $('#resend-timer'), r = $('#resend-btn');
  r.disabled = true; t.textContent = `Resend in ${left}s`;
  clearInterval(phoneState.timer);
  phoneState.timer = setInterval(() => {
    left--;
    if (left <= 0) { clearInterval(phoneState.timer); r.disabled = false; t.textContent = 'Wrong code? You can resend anytime.'; }
    else t.textContent = `Resend in ${left}s`;
  }, 1000);
}
$('#send-code-btn').onclick = () => requestCode();
$('#resend-btn').onclick = () => requestCode();
$('#code-input').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });
$('#code-input').addEventListener('keydown', e => { if (e.key === 'Enter') verifyCode(); });
async function verifyCode() {
  const btn = $('#verify-code-btn');
  const phone = $('#phone-input').value.trim();
  const code = $('#code-input').value.trim();
  $('#phone-err').textContent = '';
  if (!code) { $('#phone-err').textContent = 'Enter the 6-digit code from the message'; return; }
  btn.disabled = true; btn.textContent = 'Verifying…';
  try {
    const d = await api('/api/auth/phone/verify', { method: 'POST', body: { phone, code } });
    localStorage.setItem('dil_token', d.token);
    await enterApp(d.user);
    toast({ title: d.created ? 'Account created with your phone' : `Welcome back, ${firstName(d.user.name)}`, sub: 'Signed in with phone OTP', type: 'ok' });
  } catch (e) {
    $('#phone-err').textContent = e.message;
    $('#sms-bubble').classList.add('hidden');
    if (/expired|No active/i.test(e.message)) {
      $('#phone-step2').classList.add('hidden');
      $('#phone-step1').classList.remove('hidden');
    }
  } finally {
    btn.disabled = false; btn.textContent = 'Verify & sign in';
  }
}
$('#verify-code-btn').onclick = () => verifyCode();

// --- Google sign-in (simulated handshake, real account linking) ---
function openGoogleChooser(preselectEmail = null) {
  if ($('#g-modal')) return;
  const el = document.createElement('div');
  el.className = 'modal';
  el.id = 'g-modal';
  el.innerHTML = `
    <div class="g-card">
      <div class="g-logo">${GOOGLE_LOGO}</div>
      <h3>Sign in with Google</h3>
      <p class="g-sub">to continue to <b>Did I Lock?</b></p>
      <button class="g-acct" type="button" data-email="demo@didilock.app" data-name="Ash R.">
        <span class="g-avatar" style="background:#7b1fa2">A</span>
        <span><span class="g-acct-name">Ash R.</span><span class="g-acct-email">demo@didilock.app</span></span>
      </button>
      <button class="g-acct" type="button" id="g-other">
        <span class="g-avatar ghost">+</span>
        <span><span class="g-acct-name">Use another account</span></span>
      </button>
      <div class="g-other-form hidden" id="g-other-form">
        <input type="email" id="g-other-email" placeholder="you@gmail.com" />
        <button class="btn" type="button" id="g-other-go">Continue</button>
      </div>
      <div class="g-foot">Demo mode — this simulates the Google Sign-In handshake (no real OAuth client). In production the button runs a standard Google OAuth flow and links your account exactly this way.</div>
    </div>`;
  $('#overlay-root').appendChild(el);
  el.addEventListener('click', e => {
    if (e.target === el) { el.remove(); return; }
    if (e.target.closest('#g-other')) { $('#g-other-form').classList.remove('hidden'); $('#g-other-email').focus(); return; }
    if (e.target.closest('#g-other-go')) {
      const email = $('#g-other-email').value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) { $('#g-other-email').focus(); return; }
      googleSignIn(email, email.split('@')[0].replace(/[._-]+/g, ' '));
      return;
    }
    const acct = e.target.closest('.g-acct[data-email]');
    if (acct) googleSignIn(acct.dataset.email, acct.dataset.name);
  });
  if (preselectEmail) googleSignIn(preselectEmail, 'Ash R.');
}
async function googleSignIn(email, name) {
  const modal = $('#g-modal');
  if (modal) $$('#g-modal .g-acct, #g-modal .btn').forEach(b => { b.disabled = true; b.style.opacity = .6; });
  const titleCase = s => String(s || '').split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  try {
    const d = await api('/api/auth/google', { method: 'POST', body: {
      id: 'g-' + String(email).toLowerCase().replace(/[^a-z0-9]/g, ''),
      email, name: titleCase(String(name || '').trim() || String(email).split('@')[0]),
    } });
    localStorage.setItem('dil_token', d.token);
    if (modal) modal.remove();
    await enterApp(d.user);
    toast({ title: d.created ? 'Account created with Google' : d.linked ? 'Google account linked to your data' : `Welcome back, ${firstName(d.user.name)}`, sub: 'Signed in with Google', type: 'ok' });
  } catch (e) {
    toast({ title: 'Google sign-in failed', sub: e.message, type: 'err' });
    if (modal) $$('#g-modal .g-acct, #g-modal .btn').forEach(b => { b.disabled = false; b.style.opacity = 1; });
  }
}
// real Google OAuth when configured on the server, simulated chooser in demo mode
let authConfig = null;
async function getAuthConfig() {
  if (!authConfig) { try { authConfig = await fetch('/api/config').then(r => r.json()); if (authConfig && authConfig.ts) clockSkew = authConfig.ts - Date.now(); } catch { authConfig = { googleOauth: false }; } }
  return authConfig;
}
$('#google-btn').onclick = async () => {
  const cfg = await getAuthConfig();
  if (cfg.googleOauth) location.href = '/auth/google';
  else if (cfg.demo) openGoogleChooser();
  else toast({ title: 'Google sign-in not configured', sub: 'This server has no Google keys yet — use email sign-in', type: 'info' });
};

// --- guest mode ---
$('#guest-btn')?.addEventListener('click', () => { localStorage.setItem('dil_guest', '1'); guestBoot(); });

// --- demo quick-try buttons ---
$('#try-email').onclick = () => {
  setAuthTab('login'); setMethod('email');
  $('#form-login input[name=email]').value = 'demo@didilock.app';
  $('#login-pw').value = 'demo1234';
  $('#form-login').requestSubmit();
};
$('#try-phone').onclick = () => {
  setAuthTab('login'); setMethod('phone');
  $('#phone-input').value = '+91 98765 43210';
  requestCode();
};
$('#try-google').onclick = async () => {
  const cfg = await getAuthConfig();
  if (cfg.googleOauth) location.href = '/auth/google';
  else if (cfg.demo) openGoogleChooser('demo@didilock.app');
  else toast({ title: 'Google sign-in not configured', sub: 'This server has no Google keys yet — use email sign-in', type: 'info' });
};
// OAuth errors redirected back to the app surface here
if (location.hash.startsWith('#google-error=')) {
  const raw = decodeURIComponent(location.hash.slice('#google-error='.length));
  const HUMAN = { // slugs come from the server redirect — show words, not codes
    google_server: 'Google had a problem on its side — please try again.',
    not_configured: 'Google sign-in is not set up on this server yet.',
    state_mismatch: 'Sign-in timed out or was tampered with — please try again.',
    state_expired: 'Sign-in took too long — please try again.',
    access_denied: 'Google sign-in was cancelled.',
    server_email: 'Your Google account has no verified email we can use.',
  };
  const msg = HUMAN[raw] || (raw.startsWith('http') ? raw : (HUMAN[raw.split(':')[0]] || raw));
  history.replaceState(null, '', '/');
  setTimeout(() => { showAuth(); toast({ title: 'Google sign-in failed', sub: msg, type: 'err' }); }, 400);
}

$('#form-register').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  const btn = $('#register-btn');
  btn.disabled = true; btn.textContent = 'Creating…';
  api('/api/auth/register', { method: 'POST', body: { name: f.name.value, email: f.email.value.trim(), password: f.password.value } })
    .then(d => { localStorage.setItem('dil_token', d.token); return enterApp(d.user); })
    .then(() => toast({ title: 'Account created', sub: 'Your starter checklist is ready', type: 'ok' }))
    .catch(e => { $('#register-err').textContent = e.message; })
    .finally(() => { btn.disabled = false; btn.textContent = 'Create account'; });
});
function firstName(name) { return String(name || '').split(' ')[0]; }

window.addEventListener('beforeunload', () => { if (es) { try { es.close(); } catch { /* */ } } });

// ---------- app shell ----------
function enterApp(user) {
  state.user = user;
  try { // migrate the old device-global XP to this account; server copy wins when it is ahead; local wins after offline gains
    const k = 'dil_xp_v1_' + user.id;
    const legacy = localStorage.getItem('dil_xp_v1');
    if (legacy != null) { if (localStorage.getItem(k) == null) localStorage.setItem(k, legacy); localStorage.removeItem('dil_xp_v1'); }
    const local = Number(localStorage.getItem(k) || 0), server = Number(user.xp || 0);
    if (server > local) localStorage.setItem(k, String(server));
    else if (local > server && !state.guest) api('/api/me', { method: 'PATCH', body: { xp: local } }).then(d => { if (d.user) state.user = d.user; }).catch(() => { });
  } catch { /* never block sign-in on XP housekeeping */ }
  try { // device language wins locally; the account's language is only the DEFAULT for a brand-new device
    const saved = localStorage.getItem('dil_lang');
    if (!saved && !state.guest && user.lang && I18N[user.lang]) setLang(user.lang);
    else translateChrome();
  } catch { /* */ }
  $('#auth-screen').classList.add('hidden');
  $('#app-shell').classList.remove('hidden');
  renderSideUser();
  if (state.guest) mountGuestBar();
  xpPaint();
  $$('#bottom-nav a').forEach(a => {
    const key = a.dataset.bn;
    a.querySelector('.bic').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[NAV_ICONS[key]] || ''}</svg>`;
  });
  if (!state.guest) { connectSSE(); startGeo(); }
  if (!location.hash) location.hash = '#/dashboard';
  route();
  boot();
  // PWA app-shortcut deep link: ?action=check opens the checklist right away
  if (new URLSearchParams(location.search).get('action') === 'check') {
    history.replaceState(null, '', location.pathname);
    let tries = 0;
    const openWhenReady = () => { // wait for real readiness — a fixed 700 ms silently died on slow networks
      if (state.activeSession) return;
      if (state.loaded && state.items.length) return openSheet();
      if (++tries < 60) setTimeout(openWhenReady, 250);
    };
    setTimeout(openWhenReady, 250);
  }
}

function renderSideUser() {
  const u = state.user;
  const initials = u.name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  const sub = u.email || (u.phone ? '+' + u.phone : 'Did I Lock? account');
  $('#side-user').innerHTML = `<span class="side-avatar">${esc(initials)}</span>
    <span style="min-width:0"><div class="side-user-name">${esc(u.name)}</div><div class="side-user-mail">${esc(sub)}</div></span>`;
  $('#signout-btn').innerHTML = `${icon('logout')}Sign out`;
}

async function signOut() {
  if (esRetry) { clearTimeout(esRetry); esRetry = null; }
  esFails = 0;
  const t = token(); // capture BEFORE clearing localStorage — the cleanup request below needs it
  localStorage.removeItem('dil_token');
  GUEST_KEYS.forEach(k => localStorage.removeItem(k));
  if (es) { try { es.close(); } catch { /* */ } es = null; }
  location.hash = '';
  try {
    // detach THIS device from the account — otherwise the next user here is blocked
    // ("already registered to another account") and alerts keep arriving on this phone
    const cleanup = navigator.serviceWorker?.ready
      ?.then(reg => reg.pushManager.getSubscription())
      .then(async sub => {
        if (!sub) return;
        await fetch('/api/push/unsubscribe', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ subscription: { endpoint: sub.endpoint } }) }); // keepalive: survive the reload that follows
        try { sub.unsubscribe(); } catch { /* */ }
      });
    await Promise.race([cleanup, new Promise(r => setTimeout(r, 2000))]); // never trap the user on a dead network — 2 s cap, then go
  } catch { /* */ }
  location.reload();
}
$('#signout-btn').onclick = signOut;

// mobile sidebar
$('#menu-btn').onclick = () => { $('#sidebar').classList.add('open'); $('#scrim').classList.remove('hidden'); };
$('#scrim').onclick = () => { $('#sidebar').classList.remove('open'); $('#scrim').classList.add('hidden'); };

// inject sidebar icons
const NAV_ICONS = { dashboard: 'home', checks: 'list', tasks: 'task', departures: 'clock', activity: 'activity', settings: 'sliders' };
$('#side-nav').querySelectorAll('.side-link').forEach(a => { a.querySelector('.ic').outerHTML = icon(NAV_ICONS[a.dataset.route]); });
$('#menu-btn').innerHTML = icon('menu');
$('#bell-btn').querySelector('.ic').outerHTML = icon('bell');
function renderBellDot() { $('#bell-dot').classList.toggle('hidden', !state.unread); }

// ---------- language ----------
function translateChrome() { // side nav + bottom nav + header bits — must also run on cold start, not only on language change
  const NAV = { dashboard: 'nav_dashboard', checks: 'nav_checks', tasks: 'nav_tasks', departures: 'nav_departures', activity: 'nav_activity', settings: 'nav_settings' };
  $$('#side-nav .side-link').forEach(a => {
    for (const n of a.childNodes) if (n.nodeType === 3) n.nodeValue = ' ' + t(NAV[a.dataset.route]);
  });
  const BN = { dashboard: 'bn_home', checks: 'bn_checks', tasks: 'nav_tasks', departures: 'bn_history', settings: 'nav_settings' };
  $$('#bottom-nav [data-bn]').forEach(a => { const bl = a.querySelector('.bl'); if (bl) bl.textContent = t(BN[a.dataset.bn]); });
}
function setLang(l) {
  LANG = I18N[l] ? l : 'en';
  localStorage.setItem('dil_lang', LANG);
  translateChrome();
  if (state.loaded) renderView();
}

// ---------- router ----------
const TITLES = () => ({ dashboard: t('nav_dashboard'), checks: t('nav_checks'), tasks: t('nav_tasks'), departures: t('nav_departures'), activity: t('nav_activity'), settings: t('nav_settings') });
function route() {
  const T = TITLES();
  const h = location.hash.replace(/^#\//, '') || 'dashboard';
  state.route = T[h] ? h : 'dashboard';
  $('#topbar-title').textContent = T[state.route];
  $$('#side-nav .side-link').forEach(a => a.classList.toggle('active', a.dataset.route === state.route));
  $$('#bottom-nav a').forEach(a => a.classList.toggle('active', a.dataset.bn === state.route));
  setPageBg(state.route);
  $('#sidebar').classList.remove('open'); $('#scrim').classList.add('hidden');
  renderView();
  if (state.route === 'tasks' && !state.guest) // re-entry always syncs with the server — no ghost rows after deletes or edits from another device
    api('/api/tasks').then(d => { state.tasks = d.tasks || []; if (state.route === 'tasks') renderView(); }).catch(() => {});
}
window.addEventListener('hashchange', route);

async function boot() {
  if (state.guest) { renderBellDot(); renderView(); return; }
  try {
    const tzMin = -new Date().getTimezoneOffset(); // user's offset, minutes east of UTC
    const [items, active, stats, sess, notif, tasks] = await Promise.all([
      api('/api/items'), api('/api/sessions/active'), api(`/api/stats?tz=${tzMin}`), api('/api/sessions?limit=50'), api('/api/notifications'), api('/api/tasks'),
    ]);
    state.items = items.items;
    state.activeSession = active.session;
    state.stats = stats.stats;
    state.sessions = sess.sessions;
    state.notifications = notif.notifications;
    state.tasks = tasks.tasks || [];
    state.unread = notif.unread;
    state.loaded = true;
    renderBellDot();
    if (state.activeSession && state.activeSession.status === 'followup_pending' && serverNow() >= (state.activeSession.followup_at || 0)) {
      openFollowup(state.activeSession);
    }
    renderView();
    maybeMergeGuest();
  } catch (e) {
    const v = $('#view');
    if (v && !state.loaded) {
      v.innerHTML = `<div class="card card-pad" style="text-align:center;padding:44px 20px">
        <h2 style="margin-bottom:6px">${LANG === 'hi' ? 'डेटा लोड नहीं हो सका' : 'Couldn\u2019t load your data'}</h2>
        <p class="muted" style="margin-bottom:16px">${esc((e && e.message) || '')}</p>
        <button class="btn btn-primary btn-lg" id="boot-retry">${LANG === 'hi' ? 'फिर कोशिश करें' : 'Try again'}</button></div>`;
      const rb = $('#boot-retry');
      if (rb) rb.onclick = () => boot();
    }
    if (!navigator.onLine) { // flaky metro Wi-Fi / elevator — also retry on our own once we're back
      setTimeout(() => { if (token() && !state.loaded) boot(); }, 12000);
    }
  }
}

window.addEventListener('online', () => { if (token() && !state.loaded) boot(); }); // back online → finish loading

function skeletonView() {
  $('#view').innerHTML = `
    <div class="hero" style="opacity:.35;pointer-events:none"><h2>Loading…</h2></div>
    <div class="grid-stats">${[0, 1, 2, 3].map(() => `<div class="stat"><div class="skel" style="width:34px;height:34px"></div><div class="skel" style="height:26px;width:60px;margin:10px 0 8px"></div><div class="skel" style="height:12px;width:90px"></div></div>`).join('')}</div>
    <div class="grid-2"><div class="card card-pad"><div class="skel" style="height:180px"></div></div><div class="card card-pad"><div class="skel" style="height:180px"></div></div></div>`;
}

function renderView() {
  if (!state.loaded) { skeletonView(); return; }
  ({ dashboard: viewDashboard, checks: viewChecks, tasks: viewTasks, departures: viewDepartures, activity: viewActivity, settings: viewSettings })[state.route]();
  const v = $('#view');
  v.classList.remove('view-in');
  void v.offsetWidth; // restart the transition on every view change
  v.classList.add('view-in');
}

// ================= DASHBOARD =================
// 3D door visual for the hero — mode: 'open' (ajar, light on) | 'locked' | 'due'
function doorScene(mode) {
  return `<div class="door-scene ${mode === 'open' ? '' : 'locked'}${mode === 'due' ? ' due' : ''}" aria-hidden="true">
    <div class="door-frame">
      <div class="door-light"></div>
      <div class="door-panel"><span class="knob"></span></div>
      <span class="bolt"></span>
    </div>
    <div class="door-tag"><i></i>${mode === 'due' ? 'check-in due' : mode === 'locked' ? 'locked up' : 'unlocked'}</div>
  </div>`;
}
// pointer tilt — the door follows the cursor a few degrees (desktop only, motion-safe)
function wireDoorTilt() {
  const hero = document.querySelector('.hero'), door = document.querySelector('.door-scene');
  if (!hero || !door) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(hover: hover)').matches) return;
  hero.addEventListener('pointermove', e => {
    const r = hero.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - .5, dy = (e.clientY - r.top) / r.height - .5;
    door.style.transform = `rotateY(${dx * 8}deg) rotateX(${-dy * 5}deg)`;
  });
  hero.addEventListener('pointerleave', () => { door.style.transform = ''; });
}
function viewDashboard() {
  const s = state.stats;
  const active = state.activeSession;
  const resolved = s.ok + s.wentBack;
  const allGoodPct = resolved ? Math.round((s.ok / resolved) * 100) : 100;
  const recent = state.sessions.filter(x => x.status !== 'leaving').slice(0, 3);
  const min = state.user.followup_minutes;

  // proactive away-from-home prompt (live location crossed the radius, no check in progress)
  let awayBanner = '';
  const awayDismissedUntil = Number(localStorage.getItem('dil_away_dismissed') || 0);
  if (state.geo.away && !active && Date.now() > awayDismissedUntil) {
    awayBanner = `<div class="away-banner">
      ${icon('pin')}
      <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14.5px">${esc(t('hero_away'))}</div>
        <div class="muted small">${esc(t('away_sub'))}</div></div>
      <button class="btn btn-ghost" id="away-ok" style="border-color:#fcd34d;color:var(--warn)">${esc(t('away_ok'))}</button>
      <button class="btn btn-primary" id="away-cta">${esc(t('away_cta'))}</button>
    </div>`;
  }

  let hero;
  if (!state.items.length) {
    hero = `<div class="hero">${doorScene('open')}<div class="hero-top"><div>
      <h2>${esc(t('hero_setup_t'))}</h2>
      <p>${esc(t('hero_setup_s'))}</p>
    </div><button class="btn btn-white" id="hero-cta">${icon('plus')}${esc(t('hero_setup_cta'))}</button></div></div>`;
  } else if (active && active.status === 'leaving') {
    hero = `<div class="hero">${doorScene('locked')}<div class="hero-top"><div>
      <h2>${esc(firstName(state.user.name))} ${esc(t('hero_going'))} 🚗</h2>
      <p>${esc(t('hero_going_sub', { time: fmtTime(active.followup_at) }))}</p>
    </div></div>
    <div class="hero-dots" style="margin-top:14px"><i class="on"></i><i></i><i></i></div>
    <div class="hero-status">
      <div style="display:flex;align-items:center;gap:11px">
        <span class="sched-dot" title="${esc(t('sched_lbl'))}"></span>
        <div><div class="lbl">${esc(t('checkin_in'))}</div><div class="hero-timer" data-countdown="${active.followup_at}">--:--</div></div>
      </div>
      <div style="flex:1"></div>
      <button class="btn btn-white" id="hero-confirm">${icon('check')}${esc(t('confirm_early'))}</button>
    </div></div>`;
  } else if (active && active.status === 'followup_pending') {
    hero = `<div class="hero">${doorScene('due')}<div class="hero-top"><div>
      <h2>${esc(t('hero_checkin'))}, ${esc(firstName(state.user.name))}.</h2>
      <p>${esc(t('hero_checkin_sub', { time: fmtTime(active.started_at) }))}</p>
    </div></div>
    <div class="hero-dots" style="margin-top:14px"><i class="on"></i><i class="on"></i><i></i></div>
    <div class="hero-status">
      <div style="flex:1">
        <div class="lbl" style="font-size:15px;color:#fff">${esc(t('tap_close'))}</div>
        <div style="margin-top:9px"><span class="due-pill">${icon('bell')} ${esc(t('due_lbl'))}</span></div>
      </div>
      <button class="btn btn-white" id="hero-confirm">${icon('bell')}${esc(t('checkin_now'))}</button>
    </div></div>`;
  } else {
    const xp = xpGet(), lvl = levelOf(xp);
    const nextLvl = LEVELS.find(([m]) => xp < m);
    const pct = nextLvl ? Math.min(100, Math.round(((xp - lvl[0]) / (nextLvl[0] - lvl[0])) * 100)) : 100;
    const flame = s.streak >= 3
      ? `<span class="streak-chip"><span class="flame-on">${icon('flame')}</span>${s.streak}-day streak</span>` : '';
    hero = `<div class="hero">
      ${doorScene('open')}
      <div class="hero-top"><div>
      <h2>${esc(t('hero_ready'))}, ${esc(firstName(state.user.name))}?</h2>
      <p>${esc(t('hero_ready_sub', { min }))}</p>
    </div>
    <button class="btn btn-white" id="hero-cta">${icon('check')}${esc(t('hero_cta'))}</button></div>
    <div class="hero-status" style="background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.14)">
      ${icon('shield').replace('class="ic"', 'class="ic" style="color:#a5f3c7"')}
      <div><div class="lbl" style="color:#fff;font-weight:700">${esc(lastTime())}</div>
      <div style="font-size:13px;color:#c7d0f5">${esc(lastDetail())}</div></div>
      <div style="flex:1"></div>${flame}
    </div>
    <div class="hero-xp"><span class="xpx">${esc(lvl[1])} · ${xp} XP</span>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <span class="quest-chip">${icon('spark')} Run a check → +25 XP</span></div></div>`;
  }

  $('#view').innerHTML = `
    ${awayBanner}
    ${hero}
    <div class="grid-stats">
      ${statCard('route', t('stat_week'), s.weekCount, 'departures', 'var(--accent-soft)', 'var(--accent)')}
      ${statCard('check', t('stat_ok'), allGoodPct + '%', 'departures', 'var(--ok-soft)', 'var(--ok)')}
      ${statCard('route', t('stat_back'), s.wentBack, 'departures', 'var(--warn-soft)', 'var(--warn)', t('stat_back_sub'))}
      ${statCard(s.streak >= 3 ? 'flame' : 'spark', t('stat_streak'), s.streak, 'departures', s.streak >= 3 ? 'var(--warn-soft)' : 'var(--accent-soft)', s.streak >= 3 ? 'var(--warn)' : 'var(--accent)', '', s.streak >= 3 ? 'stat-flame' : '')}
    </div>
    <div class="card card-pad" style="margin-bottom:14px">
      <div class="sec-title" style="margin-bottom:4px">${esc(t('week_title'))}</div>
      <div class="week-strip">${(s.week || []).map(wkCol).join('')}</div>
      <div class="wk-insight">${s.week && s.week.some(w => w.n) ? esc(t('week_insight', { a: s.week.reduce((x, w) => x + w.n, 0), b: allGoodPct })) : esc(t('week_none'))}</div>
    </div>
    <div class="grid-2">
      <div class="card card-pad">
        <div class="sec-title">${esc(t('recent'))}</div>
        ${recent.length ? recent.map(recentRow).join('') : `<div class="empty" style="padding:26px 10px"><h3>${esc(t('no_deps_t'))}</h3><p>${esc(t('no_deps_s'))}</p></div>`}
      </div>
      <div class="card card-pad">
        <div class="sec-title" style="display:flex;justify-content:space-between;align-items:center">${esc(t('activity'))} <a href="#/activity" class="small">${esc(t('view_all'))}</a></div>
        ${state.notifications.slice(0, 4).map((n, i) => feedRow(n, i)).join('') || `<div class="empty" style="padding:26px 10px"><h3>${esc(t('no_act_t'))}</h3><p>${esc(t('no_act_s'))}</p></div>`}
      </div>
    </div>
    ${dashTasksCard()}
    <div class="how">
      <div class="how-card"><div class="n">1</div><h4>${esc(t('how1_t'))}</h4><p>${esc(t('how1_s'))}</p></div>
      <div class="how-card"><div class="n">2</div><h4>${esc(t('how2_t'))}</h4><p>${esc(t('how2_s'))}</p></div>
      <div class="how-card"><div class="n">3</div><h4>${esc(t('how3_t', { min }))}</h4><p>${esc(t('how3_s'))}</p></div>
    </div>`;

  const cta = $('#hero-cta');
  if (cta) cta.onclick = () => {
    if (!state.items.length) location.hash = '#/checks';
    else openSheet();
  };
  const confirm = $('#hero-confirm');
  if (confirm) confirm.onclick = () => openFollowup(active);
  const awayCta = $('#away-cta');
  if (awayCta) awayCta.onclick = () => { localStorage.removeItem('dil_away_dismissed'); state.items.length ? openSheet() : (location.hash = '#/checks'); };
  const awayOk = $('#away-ok');
  if (awayOk) awayOk.onclick = () => { localStorage.setItem('dil_away_dismissed', String(Date.now() + 2 * 3600e3)); renderView(); };
  tickCountdowns();
  wireDoorTilt();
}
function statCard(ic, lbl, num, href, bg, color, sub, cls = '') {
  return `<a class="stat${cls ? ' ' + cls : ''}" href="#/${href}" style="text-decoration:none;color:inherit">
    <div class="stat-ic" style="background:${bg};color:${color}">${icon(ic)}</div>
    <div class="num">${num}</div><div class="lbl">${esc(lbl)}${sub ? ` · ${esc(sub)}` : ''}</div></a>`;
}
function statusChip(status) {
  const map = {
    confirmed_ok: ['chip-ok', t('chip_ok')], went_back: ['chip-warn', t('chip_back')],
    followup_pending: ['chip-bad', t('chip_pending')], leaving: ['chip-info', t('chip_away')],
    missed: ['chip-muted', t('chip_missed')],
  };
  const [cls, lbl] = map[status] || ['chip-muted', status];
  return `<span class="chip ${cls}">${esc(lbl)}</span>`;
}
function checkedCount(sess) { return sess.items.filter(i => i.checked).length; }
function recentRow(s) {
  const ck = checkedCount(s);
  return `<div class="row">
    <div class="row-ic" style="background:${s.status === 'went_back' ? 'var(--warn-soft)' : s.status === 'missed' ? 'rgba(127,127,127,.12)' : 'var(--ok-soft)'};color:${s.status === 'went_back' ? 'var(--warn)' : s.status === 'missed' ? 'var(--muted,#8a8f9d)' : 'var(--ok)'}">${icon(s.status === 'went_back' ? 'route' : s.status === 'missed' ? 'clock' : 'check')}</div>
    <div class="row-main"><div class="row-title">${ck}/${s.items.length} checked</div>
      <div class="row-sub">${fmtDay(s.started_at)} · ${fmtTime(s.started_at)}${s.note ? ' · noted' : ''}</div></div>
    <div class="row-side">${statusChip(s.status)}<a href="#/departures" class="small">→</a></div>
  </div>`;
}
function lastTime() {
  const s = state.sessions.find(x => ['confirmed_ok', 'went_back'].includes(x.status));
  return s ? t('last_time', { day: fmtDay(s.started_at), time: fmtTime(s.started_at) }) : t('last_first');
}
function lastDetail() {
  const s = state.sessions.find(x => ['confirmed_ok', 'went_back'].includes(x.status));
  if (!s) return t('last_none');
  return s.status === 'went_back' ? t('last_detail_back') : t('last_detail_ok');
}
function milestoneDefs(s) {
  const defs = [
    { id: 'first', key: 'm_first', icon: 'door', got: s.total >= 1 },
    { id: 'ten', key: 'm_ten', icon: 'check', got: s.total >= 10 },
    { id: 'thirty', key: 'm_thirty', icon: 'shield', got: s.total >= 30 },
    { id: 'streak7', key: 'm_streak7', icon: 'flame', got: s.streak >= 7 },
    { id: 'back3', key: 'm_back3', icon: 'route', got: s.wentBack >= 3 },
  ];
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem('dil_milestones') || '[]'); } catch { /* */ }
  const newly = defs.filter(m => m.got && !seen.includes(m.id)).map(m => m.id);
  if (newly.length) localStorage.setItem('dil_milestones', JSON.stringify([...new Set([...seen, ...newly])]));
  return defs.map(m => ({ ...m, pop: newly.includes(m.id) }));
}
async function shareApp() {
  const text = `Did I Lock? — a 10-second pre-departure checklist with a 5-minute check-in. ${t('share_s')}`;
  try {
    if (navigator.share) { await navigator.share({ title: 'Did I Lock?', text, url: location.origin }); return; }
    await navigator.clipboard.writeText(`${text} ${location.origin}`);
    toast({ title: t('share_done'), type: 'ok' });
  } catch { /* user dismissed */ }
}
// ---------- shareable streak card: drawn on canvas, no personal data ----------
async function shareStreakCard() {
  try {
    const s = state.stats;
    const resolved = s.ok + s.wentBack;
    const goodPct = resolved ? Math.round((s.ok / resolved) * 100) : 100;
    const xp = xpGet(), lvl = levelOf(xp);
    const W = 1080, H = 1350;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const F = (w, sz) => `${w} ${sz}px -apple-system, "Segoe UI", Roboto, "Inter", sans-serif`;
    // aurora night background
    const bg = x.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0e1233'); bg.addColorStop(.5, '#221a6e'); bg.addColorStop(1, '#0d4f57');
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    const glow = (cx, cy, r, col) => {
      const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = rg; x.fillRect(0, 0, W, H);
    };
    glow(130, 170, 520, 'rgba(124,108,255,.5)');
    glow(960, 280, 470, 'rgba(45,212,176,.35)');
    glow(540, 1280, 580, 'rgba(139,92,246,.35)');
    x.fillStyle = '#fff';
    for (let i = 0; i < 70; i++) {
      x.globalAlpha = Math.random() * .65 + .15;
      x.beginPath(); x.arc(Math.random() * W, Math.random() * H * .8, Math.random() * 2.2 + .6, 0, 7); x.fill();
    }
    x.globalAlpha = 1;
    const rr = (px, py, w2, h2, r2) => { x.beginPath(); x.moveTo(px + r2, py); x.arcTo(px + w2, py, px + w2, py + h2, r2); x.arcTo(px + w2, py + h2, px, py + h2, r2); x.arcTo(px, py + h2, px, py, r2); x.arcTo(px, py, px + w2, py, r2); x.closePath(); };
    rr(26, 26, W - 52, H - 52, 46); x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 3; x.stroke();
    // wordmark
    x.textAlign = 'center';
    x.fillStyle = '#c7d2fe'; x.font = F(800, 44); x.fillText('DID I LOCK?', W / 2, 158);
    x.fillStyle = 'rgba(255,255,255,.55)'; x.font = F(500, 30); x.fillText('the 10-second leave-home ritual', W / 2, 208);
    // glowing lock
    x.save(); x.strokeStyle = '#5ff0cd'; x.lineWidth = 12; x.lineCap = 'round';
    x.shadowColor = 'rgba(94,240,205,.8)'; x.shadowBlur = 26;
    x.beginPath(); x.arc(W / 2, 392, 46, Math.PI, 0); x.stroke();
    rr(W / 2 - 86, 392, 172, 130, 26); x.stroke();
    x.fillStyle = '#5ff0cd'; x.beginPath(); x.arc(W / 2, 448, 13, 0, 7); x.fill();
    x.fillRect(W / 2 - 8, 448, 16, 42); x.restore();
    // big streak
    x.fillStyle = '#ffd98a'; x.font = F(800, 210); x.fillText(String(s.streak), W / 2, 810);
    x.fillStyle = 'rgba(255,255,255,.9)'; x.font = F(750, 48); x.fillText('DAY STREAK', W / 2, 878);
    // stat chips
    const chip = (cx, w2, l1, l2) => {
      rr(cx - w2 / 2, 950, w2, 130, 34);
      x.fillStyle = 'rgba(255,255,255,.10)'; x.fill();
      x.strokeStyle = 'rgba(255,255,255,.22)'; x.lineWidth = 2; x.stroke();
      x.fillStyle = '#fff'; x.font = F(800, 52); x.fillText(l1, cx, 1016);
      x.fillStyle = 'rgba(255,255,255,.6)'; x.font = F(600, 27); x.fillText(l2, cx, 1056);
    };
    chip(W / 2 - 250, 420, goodPct + '%', 'all-good rate');
    chip(W / 2 + 250, 420, lvl[1].split(' ')[0], lvl[1] + ' · ' + xp + ' XP');
    x.fillStyle = 'rgba(255,255,255,.5)'; x.font = F(600, 30);
    x.fillText(location.host || 'did-i-lock', W / 2, H - 80);
    const blob2 = await new Promise(r => c.toBlob(r, 'image/png'));
    const file = new File([blob2], 'did-i-lock-streak.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Did I Lock?', text: `${s.streak}-day leaving-home streak 🔒` });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob2); a.download = 'did-i-lock-streak.png'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast({ title: 'Streak card saved', sub: 'Check your downloads — share it anywhere', type: 'ok' });
    }
  } catch { /* dismissed or blocked */ }
}
function wkCol(w) {
  const dt = new Date(w.k + 'T12:00:00');
  const day = dt.toLocaleDateString(undefined, { weekday: 'narrow' });
  const bars = [0, 1, 2].map(b =>
    `<div class="wk-bar"${b < Math.min(w.n, 3) ? ' style="background:var(--accent-grad)"' : ''}></div>`).join('');
  return `<div class="wk${w.today ? ' today' : ''}" title="${day} · ${w.n}">
    <div class="wk-bars">${bars}</div>
    <div class="wk-d">${day}</div>
    <div class="wk-n">${w.n || ''}</div>
  </div>`;
}

// ================= CHECKS (CRUD) =================
let editingId = null;
function viewChecks() {
  const items = state.items;
  $('#view').innerHTML = `
    <div class="page-head">
      <div><h2>${esc(t('checks_title'))}</h2><p>${esc(t('checks_sub'))}</p></div>
      <button class="btn btn-soft" id="add-focus">${icon('plus')}${esc(t('add_check'))}</button>
    </div>
    <div class="card card-pad tpl-card">
      <div style="font-weight:700;font-size:14.5px">${esc(t('tpl_title'))}</div>
      <div style="font-size:13px;color:var(--muted);margin-top:2px">${esc(t('tpl_sub'))}</div>
      <div class="tpl-row">${Object.keys(TEMPLATES).map(k =>
        `<button class="tpl-chip" data-tpl="${k}"><span class="ic">${icon(TPL_ICONS[k])}</span>${esc(t('tpl_' + k))}</button>`).join('')}</div>
    </div>
    <div class="card checks-list" id="checks-list">
      <div class="add-check">
        <input id="new-check" placeholder="${esc(t('add_placeholder'))}" maxlength="60" />
        <select id="new-icon" style="width:46px;height:42px;border:1.5px solid var(--line);border-radius:10px;background:var(--card-soft);color:var(--muted);font-size:13px"></select>
        <button class="btn btn-primary" id="add-check-btn">${esc(t('add_btn'))}</button>
      </div>
      ${items.length ? items.map(checkRow).join('') : `
        <div class="empty">
          <div class="empty-ic">${icon('list')}</div>
          <h3>${esc(t('no_checks_t'))}</h3>
          <p>${esc(t('no_checks_s'))}</p>
        </div>`}
    </div>`;

  const sel = $('#new-icon');
  sel.innerHTML = ['door','flame','iron','window','plug','car','key','box']
    .map(k => `<option value="${k}">${k[0].toUpperCase() + k.slice(1)}</option>`).join('');
  sel.value = 'door';

  const doAdd = () => {
    const inp = $('#new-check');
    const label = inp.value.trim();
    if (!label) { inp.focus(); return; }
    addItem(label, sel.value);
    inp.value = ''; inp.focus();
  };
  $('#add-check-btn').onclick = doAdd;
  $('#new-check').addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
  $('#add-focus').onclick = () => $('#new-check').focus();
  $$('#view .tpl-chip').forEach(b => b.onclick = () => openTemplate(b.dataset.tpl));
  wireCheckRowEvents();
}

const TPL_ICONS = { home: 'home', work: 'box', travel: 'car', night: 'lock', gym: 'bolt' };
const TEMPLATES = {
  home: [['Front door locked', 'door'], ['Stove off', 'flame'], ['Iron unplugged', 'iron'], ['Windows closed', 'window'], ['Keys & phone in hand', 'key']],
  work: [['Laptop packed', 'box'], ['Documents in order', 'list'], ['Bag ready', 'box'], ['Keys & wallet', 'key'], ['Charger packed', 'plug']],
  travel: [['Passport / ID', 'shield'], ['Charger packed', 'plug'], ['Medicines', 'shield'], ['Keys', 'key'], ['Travel documents', 'list']],
  night: [['Lights off', 'plug'], ['Front door locked', 'door'], ['Stove off', 'flame'], ['Phone on charger', 'plug'], ['Windows closed', 'window']],
  gym: [['Gym bag packed', 'box'], ['Water bottle', 'plug'], ['Shoes & towel', 'check'], ['Locker key', 'key'], ['Phone + earphones', 'user']],
};
function openTemplate(key) {
  const items = TEMPLATES[key];
  if (!items) return;
  state.tplKey = key;
  $('#overlay-root').innerHTML = `
    <div class="overlay" id="tpl-overlay" style="align-items:center">
      <div class="sheet" style="max-width:420px;border-radius:18px;max-height:86vh">
        <div class="sheet-head"><div class="t">${esc(t('tpl_' + key))}</div><div class="s">${esc(t('tpl_use_s', { n: items.length, name: t('tpl_' + key) }))}</div></div>
        <div class="sheet-body">
          ${items.map(([label, ic]) => `<div class="tpl-item"><span class="ic">${icon(ic)}</span><span>${esc(label)}</span></div>`).join('')}
          <div class="tpl-actions">
            <button class="btn btn-primary btn-block" id="tpl-use">${esc(t('tpl_use'))}</button>
            <button class="btn btn-ghost btn-block" id="tpl-cancel">${esc(t('tpl_keep'))}</button>
          </div>
        </div>
      </div>
    </div>`;
  const close = () => { $('#overlay-root').innerHTML = ''; };
  $('#tpl-cancel').onclick = close;
  $('#tpl-overlay').addEventListener('mousedown', e => { if (e.target.id === 'tpl-overlay') close(); });
  $('#tpl-use').onclick = applyTemplate;
}
async function applyTemplate() {
  const key = state.tplKey;
  if (!key || !confirm(t('tpl_use_s', { n: TEMPLATES[key].length, name: t('tpl_' + key) }))) return;
  const btn = $('#tpl-use'); if (btn) btn.disabled = true;
  try {
    for (const it of [...state.items]) await api(`/api/items/${it.id}`, { method: 'DELETE' });
    state.items = [];
    renderView();
    for (const [label, ic] of TEMPLATES[key]) await addItem(label, ic, true);
    toast({ title: t('tpl_done'), type: 'ok' });
  } catch (e) {
    toast({ title: e.message, type: 'err' });
  }
  $('#overlay-root').innerHTML = '';
  viewIf('checks');
}

function checkRow(item, idx) {
  if (editingId === item.id) {
    return `<div class="check-row" data-id="${item.id}">
      <span class="item-ic">${icon(item.icon)}</span>
      <input class="check-edit-input" value="${esc(item.label)}" maxlength="60" />
      <div class="check-actions">
        <button class="icon-btn" data-act="save" title="Save">${icon('check')}</button>
        <button class="icon-btn" data-act="cancel" title="Cancel">${icon('x')}</button>
      </div>
      <div style="padding:0 16px 12px;flex-basis:100%"><div class="icon-picker" data-pick-for="${item.id}">
        ${['door','flame','iron','window','plug','car','key','box'].map(k =>
          `<button type="button" class="icon-pick ${item.icon === k ? 'sel' : ''}" data-ic="${k}" title="${k}">${icon(k)}</button>`).join('')}
      </div></div>
    </div>`;
  }
  return `<div class="check-row" draggable="true" data-id="${item.id}">
    <span class="grip" title="Drag to reorder">${icon('grip')}</span>
    <span class="item-ic">${icon(item.icon)}</span>
    <span class="check-label">${esc(item.label)}</span>
    <div class="check-actions">
      <button class="icon-btn" data-act="up" title="Move up" ${idx === 0 ? 'disabled style="opacity:.3"' : ''}>${icon('up')}</button>
      <button class="icon-btn" data-act="down" title="Move down" ${idx === state.items.length - 1 ? 'disabled style="opacity:.3"' : ''}>${icon('down')}</button>
      <button class="icon-btn" data-act="edit" title="Edit">${icon('pencil')}</button>
      <button class="icon-btn danger" data-act="delete" title="Delete">${icon('trash')}</button>
    </div>
  </div>`;
}

function wireCheckRowEvents() {
  const list = $('#checks-list');
  if (!list) return;
  list.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) {
      const pick = e.target.closest('.icon-pick');
      if (pick) { $$('.icon-pick', pick.parentElement).forEach(b => b.classList.remove('sel')); pick.classList.add('sel'); return; }
      return;
    }
    const row = e.target.closest('.check-row');
    const id = Number(row.dataset.id);
    const act = btn.dataset.act;
    if (act === 'edit') { editingId = id; viewChecks(); const inp = $('.check-edit-input'); if (inp) inp.focus(); }
    if (act === 'cancel') { editingId = null; viewChecks(); }
    if (act === 'save') {
      const inp = $('.check-edit-input');
      const pick = $('.icon-pick.sel');
      const label = inp.value.trim();
      if (!label) { toast({ title: 'Name cannot be empty', type: 'err' }); return; }
      editingId = null;
      editItem(id, { label, icon: pick ? pick.dataset.ic : undefined });
    }
    if (act === 'up' || act === 'down') {
      const i = state.items.findIndex(x => x.id === id);
      const j = act === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= state.items.length) return;
      const prev = [...state.items];
      [state.items[i], state.items[j]] = [state.items[j], state.items[i]];
      viewChecks();
      api('/api/items/reorder', { method: 'PATCH', body: { ids: state.items.map(x => x.id) } })
        .catch(() => { state.items = prev; viewChecks(); toast({ title: 'Could not reorder', type: 'err' }); });
    }
    if (act === 'delete') deleteItem(id);
  });
  // drag & drop
  let dragId = null;
  list.querySelectorAll('.check-row[draggable]').forEach(r => {
    r.addEventListener('dragstart', () => { dragId = Number(r.dataset.id); r.classList.add('dragging'); });
    r.addEventListener('dragend', () => { r.classList.remove('dragging'); dragId = null; });
    r.addEventListener('dragover', e => e.preventDefault());
    r.addEventListener('drop', e => {
      e.preventDefault();
      const overId = Number(r.dataset.id);
      if (dragId == null || dragId === overId) return;
      const prev = [...state.items];
      const from = state.items.findIndex(x => x.id === dragId);
      const to = state.items.findIndex(x => x.id === overId);
      const [moved] = state.items.splice(from, 1);
      state.items.splice(to, 0, moved);
      viewChecks();
      api('/api/items/reorder', { method: 'PATCH', body: { ids: state.items.map(x => x.id) } })
        .catch(() => { state.items = prev; viewChecks(); toast({ title: 'Could not reorder', type: 'err' }); });
    });
  });
}

// optimistic CRUD
function addItem(label, iconName, silent = false) {
  const tmp = { id: -Date.now(), label, icon: iconName, sort_order: state.items.length, _pending: true }; // optimistic row — not on the server yet
  state.items.push(tmp);
  viewIf('checks');
  api('/api/items', { method: 'POST', body: { label, icon: iconName } })
    .then(d => {
      const i = state.items.findIndex(x => x.id === tmp.id);
      if (i >= 0) state.items[i] = d.item;
      if (!silent) toast({ title: 'Check added', sub: label, type: 'ok' });
      viewIf('checks');
    })
    .catch(() => {
      state.items = state.items.filter(x => x.id !== tmp.id);
      viewIf('checks');
      toast({ title: 'Could not add check', type: 'err' });
    });
}
function editItem(id, patch) {
  const cur = state.items.find(x => x.id === id);
  if (cur && cur._pending) return toast({ title: 'Still saving that check — try again in a second', type: 'info' });
  const i = state.items.findIndex(x => x.id === id);
  if (i < 0) return;
  const prev = state.items[i];
  state.items[i] = { ...prev, ...patch };
  viewIf('checks');
  api(`/api/items/${id}`, { method: 'PATCH', body: patch })
    .then(d => { const j = state.items.findIndex(x => x.id === id); if (j >= 0) state.items[j] = d.item; viewIf('checks'); })
    .catch(() => { const j = state.items.findIndex(x => x.id === id); if (j >= 0) { state.items[j] = prev; viewIf('checks'); } toast({ title: 'Could not save', type: 'err' }); });
}
function deleteItem(id) {
  const pending = state.items.find(x => x.id === id);
  if (pending && pending._pending) return toast({ title: 'Still saving that check — try again in a second', type: 'info' });
  const i = state.items.findIndex(x => x.id === id);
  if (i < 0) return;
  const [gone] = state.items.splice(i, 1);
  viewIf('checks');
  toast({ title: 'Check removed', sub: gone.label, type: 'info' });
  api(`/api/items/${id}`, { method: 'DELETE' })
    .catch(() => { state.items.splice(i, 0, gone); viewIf('checks'); toast({ title: 'Could not delete', type: 'err' }); });
}
function viewIf(route) { if (state.route === route) renderView(); }

// ================= DEPARTURES =================
// ================= TASKS — Google-Tasks-style personal tasks =================
let taskFilter = 'all';
let expandedTaskId = null;
const dueInfo = t => {
  if (!t.dueAt) return null;
  const d = new Date(t.dueAt), today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const diff = Math.round((day - today) / 86400000);
  if (diff < 0) return { label: diff === -1 ? 'Yesterday' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), cls: 'over' };
  if (diff === 0) return { label: 'Today', cls: 'today' };
  if (diff === 1) return { label: 'Tomorrow', cls: 'soon' };
  return { label: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }), cls: 'soon' };
};
function taskLists() { return [...new Set(state.tasks.map(t => t.list || 'General'))]; }
function findTask(id) {
  for (const t of state.tasks) {
    if (t.id === id) return { t, parent: null };
    const s = (t.subtasks || []).find(x => x.id === id);
    if (s) return { t: s, parent: t };
  }
  return {};
}
function fmtDue(ts) {
  if (!ts) return '';
  const d = new Date(ts), today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(ts).setHours(0, 0, 0, 0) - today) / 86400000);
  if (diff === 0) return 'Today'; if (diff === 1) return 'Tomorrow'; if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
async function addTask(fields) {
  try {
    const { task } = await api('/api/tasks', { method: 'POST', body: fields });
    task.subtasks = [];
    state.tasks.push(task);
    SFX.tick(); renderView();
  } catch (e) { toast({ title: 'Could not add task', sub: e.message, type: 'err' }); }
}
async function patchTask(id, patch) {
  try {
    const { task } = await api(`/api/tasks/${id}`, { method: 'PATCH', body: patch });
    const hit = findTask(id);
    if (!hit.t) return;
    Object.assign(hit.t, task);
    if (task.done) {
      SFX.tick(); addXp(3, 'task done');
      const pending = state.tasks.filter(t => !t.done).length + state.tasks.reduce((a, t) => a + (t.subtasks || []).filter(s => !s.done).length, 0);
      if (pending === 0) { confetti(12); toast({ title: 'All tasks done', sub: 'Enjoy the clear head ✨', type: 'ok' }); }
    }
    renderView();
  } catch (e) { toast({ title: 'Could not update task', sub: e.message, type: 'err' }); }
}
async function delTask(id) {
  try {
    await api(`/api/tasks/${id}`, { method: 'DELETE' });
    const hit = findTask(id);
    if (hit.parent) hit.parent.subtasks = hit.parent.subtasks.filter(s => s.id !== id);
    else state.tasks = state.tasks.filter(t => t.id !== id);
    SFX.unTick(); renderView();
  } catch (e) { toast({ title: 'Could not delete task', sub: e.message, type: 'err' }); }
}
function taskRow(t, depth = 0) {
  const due = dueInfo(t);
  const subs = (t.subtasks || []);
  const doneSubs = subs.filter(s => s.done).length;
  const open = expandedTaskId === t.id;
  return `<div class="task-wrap${open ? ' open' : ''}">
    <div class="task-row${t.done ? ' done' : ''}" data-task="${t.id}">
      <button class="t-check${t.done ? ' checked' : ''}" data-tt="${t.id}" aria-label="Complete task"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path class="tick" d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>
      <div class="t-main" data-tx="${t.id}">
        <div class="t-title">${esc(t.title)}</div>
        <div class="t-meta">${t.list !== 'General' ? `<span class="t-list-chip">${esc(t.list)}</span>` : ''}${due ? `<span class="t-due ${due.cls}">${due.label}</span>` : ''}${subs.length ? `<span class="t-subn">${doneSubs}/${subs.length} subtasks</span>` : ''}</div>
      </div>
      <button class="t-expand icon-btn" data-tx="${t.id}" aria-label="Details">${icon(open ? 'up' : 'chevD')}</button>
    </div>
    ${open ? `<div class="task-detail">
      <div class="td-grid">
        <label class="td-f"><span>Notes</span><textarea data-tn="${t.id}" rows="2" placeholder="Add details…">${esc(t.notes || '')}</textarea></label>
        <label class="td-f"><span>Due date</span><input type="date" data-td="${t.id}" value="${t.dueAt ? new Date(t.dueAt).toISOString().slice(0, 10) : ''}" /></label>
        <label class="td-f"><span>List</span><input data-tl="${t.id}" value="${esc(t.list)}" maxlength="24" placeholder="General" /></label>
      </div>
      ${subs.map(s => `
        <div class="task-row sub${s.done ? ' done' : ''}" data-task="${s.id}">
          <button class="t-check${s.done ? ' checked' : ''}" data-tt="${s.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path class="tick" d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>
          <div class="t-main"><div class="t-title">${esc(s.title)}</div></div>
          <button class="t-expand icon-btn" data-tdel="${s.id}" aria-label="Delete subtask">${icon('x')}</button>
        </div>`).join('')}
      <div class="add-sub"><input data-tnew="${t.id}" placeholder="Add a subtask…" maxlength="120" /><button class="btn btn-soft" data-tadd="${t.id}">${icon('plus')}Add</button></div>
      <div class="td-actions"><button class="btn btn-danger" data-tdel="${t.id}">${icon('trash')}Delete task</button></div>
    </div>` : ''}
  </div>`;
}
function viewTasks() {
  const lists = taskLists();
  const pend = state.tasks.filter(t => !t.done);
  const comp = state.tasks.filter(t => t.done);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const match = t => {
    if (taskFilter === 'all') return true;
    if (taskFilter === 'today') return t.dueAt && t.dueAt <= todayEnd.getTime();
    return (t.list || 'General') === taskFilter;
  };
  const showPend = pend.filter(match), showComp = comp.filter(match);
  $('#view').innerHTML = `
    <div class="page-head"><div><h2>Tasks</h2><p>The small stuff that shouldn't slip — with due dates, notes and subtasks.</p></div>
      <button class="btn btn-primary" id="task-fab">${icon('plus')}New task</button></div>
    <div class="card card-pad">
      <div class="task-add">
        <button class="t-check static" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>
        <input id="new-task-title" placeholder="Add a task…  (Enter to save)" maxlength="120" />
        <select id="new-task-list"><option value="">List: General</option>${lists.map(l => `<option>${esc(l)}</option>`).join('')}</select>
        <input type="date" id="new-task-due" title="Due date" />
        <button class="btn btn-primary" id="new-task-btn">Add</button>
      </div>
      <div class="task-chips">
        <button class="fchip${taskFilter === 'all' ? ' active' : ''}" data-tf="all">All</button>
        <button class="fchip${taskFilter === 'today' ? ' active' : ''}" data-tf="today">Today</button>
        ${lists.map(l => `<button class="fchip${taskFilter === l ? ' active' : ''}" data-tf="${esc(l)}">${esc(l)}</button>`).join('')}
      </div>
      <div class="tasks-list">
        ${showPend.length ? showPend.map(t => taskRow(t)).join('') : `<div class="empty" style="padding:30px 10px"><div class="empty-ic">${icon('task')}</div><h3>${taskFilter === 'all' ? 'Nothing pending — beautiful.' : 'Nothing here.'}</h3><p>${taskFilter === 'all' ? 'Add a task above, or just enjoy the quiet.' : 'Try another filter.'}</p></div>`}
      </div>
      ${comp.length ? `<button class="t-done-toggle" id="done-toggle">${icon('chevD')} Completed (${showComp.length})</button>
      <div class="tasks-list done-list${taskFilter === 'all' || showComp.length !== comp.length ? '' : ''}" ${taskFilter === 'all' ? 'hidden' : ''}>${showComp.map(t => taskRow(t)).join('')}</div>` : ''}
    </div>`;
  const addRow = () => {
    const title = $('#new-task-title').value.trim();
    if (!title) return $('#new-task-title').focus();
    const dueVal = $('#new-task-due').value;
    addTask({ title, list: $('#new-task-list').value || 'General', due_at: dueVal ? new Date(dueVal + 'T12:00:00').getTime() : null });
  };
  $('#new-task-btn').onclick = addRow;
  $('#new-task-title').onkeydown = e => { if (e.key === 'Enter') addRow(); };
  $('#task-fab').onclick = () => { $('#new-task-title').scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => $('#new-task-title').focus(), 350); };
  $$('.fchip[data-tf]').forEach(c => c.onclick = () => { taskFilter = c.dataset.tf; renderView(); });
  const doneT = $('#done-toggle');
  if (doneT) doneT.onclick = () => { const l = $('.done-list'); l.hidden = !l.hidden; doneT.classList.toggle('open', !l.hidden); };
  $$('.task-wrap [data-tt]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const id = Number(b.dataset.tt);
    const hit = findTask(id);
    patchTask(id, { done: !hit.t.done });
  });
  $$('.task-wrap [data-tx]').forEach(el => el.onclick = () => {
    const id = Number(el.dataset.tx);
    expandedTaskId = expandedTaskId === id ? null : id;
    renderView();
  });
  $$('.task-wrap [data-tdel]').forEach(b => b.onclick = () => delTask(Number(b.dataset.tdel)));
  $$('.task-wrap [data-tadd]').forEach(b => b.onclick = () => {
    const pid = Number(b.dataset.tadd);
    const inp = $(`[data-tnew="${pid}"]`);
    const title = inp.value.trim();
    if (!title) return inp.focus();
    const parent = state.tasks.find(t => t.id === pid);
    api('/api/tasks', { method: 'POST', body: { title, list: parent.list, parent_id: pid } })
      .then(({ task }) => { parent.subtasks = parent.subtasks || []; parent.subtasks.push(task); SFX.tick(); renderView(); });
  });
  $$('.task-wrap [data-tnew]').forEach(inp => inp.onkeydown = e => {
    if (e.key === 'Enter') $(`[data-tadd="${inp.dataset.tnew}"]`).click();
  });
  $$('.task-wrap [data-td]').forEach(inp => inp.onchange = () => patchTask(Number(inp.dataset.td), { due_at: inp.value ? new Date(inp.value + 'T12:00:00').getTime() : null }));
  $$('.task-wrap [data-tn]').forEach(ta => ta.onblur = () => {
    const id = Number(ta.dataset.tn); const hit = findTask(id);
    if (hit.t && hit.t.notes !== ta.value) patchTask(id, { notes: ta.value });
  });
  $$('.task-wrap [data-tl]').forEach(inp => inp.onblur = () => {
    const id = Number(inp.dataset.tl); const hit = findTask(id);
    const v = inp.value.trim() || 'General';
    if (hit.t && hit.t.list !== v) patchTask(id, { list: v });
  });
}
function dashTasksCard() {
  const pend = state.tasks.filter(t => !t.done).slice(0, 3);
  if (!pend.length) return '';
  const total = state.tasks.filter(t => !t.done).length;
  return `<div class="card card-pad" style="margin-bottom:14px">
    <div class="sec-title" style="display:flex;justify-content:space-between;align-items:center">Tasks · ${total} pending <a href="#/tasks" class="small">Open</a></div>
    ${pend.map(t => `<div class="row"><div class="row-ic" style="background:var(--accent-soft);color:var(--accent)">${icon('task')}</div>
      <div class="row-main"><div class="row-title">${esc(t.title)}</div>
      <div class="row-sub">${t.dueAt ? 'Due ' + fmtDue(t.dueAt) : esc(t.list)}</div></div></div>`).join('')}
  </div>`;
}
function viewDepartures() {
  const counts = {
    all: state.sessions.length,
    ok: state.sessions.filter(s => s.status === 'confirmed_ok').length,
    back: state.sessions.filter(s => s.status === 'went_back').length,
    pending: state.sessions.filter(s => ['leaving', 'followup_pending'].includes(s.status)).length,
  };
  let list = state.sessions;
  if (state.deptFilter === 'ok') list = list.filter(s => s.status === 'confirmed_ok');
  if (state.deptFilter === 'back') list = list.filter(s => s.status === 'went_back');
  if (state.deptFilter === 'pending') list = list.filter(s => ['leaving', 'followup_pending'].includes(s.status));

  $('#view').innerHTML = `
    <div class="page-head">
      <div><h2>${esc(t('deps_title'))}</h2><p>${esc(t('deps_sub'))}</p></div>
      <div class="filter-chips">
        ${chipF('all', t('filter_all'), counts.all)}${chipF('ok', t('filter_ok'), counts.ok)}
        ${chipF('back', t('filter_back'), counts.back)}${chipF('pending', t('filter_pending'), counts.pending)}
      </div>
    </div>
    <div id="dept-list">${list.length ? list.map((s, i) => deptCard(s, i, s.id === state.newDeptId)).join('') : `
      <div class="card card-pad"><div class="empty">
        <img class="empty-art" src="/img/empty-history.webp" alt="" aria-hidden="true">
        <h3>${esc(emptyDeptMsg())}</h3>
        <p>${esc(emptyDeptSub())}</p>
      </div></div>`}</div>`;
  if (state.newDeptId) state.newDeptId = null; // highlight only on first render after creation

  $$('#view .fchip').forEach(c => c.onclick = () => { state.deptFilter = c.dataset.f; viewDepartures(); });
  $('#dept-list').addEventListener('click', e => {
    const head = e.target.closest('.dept-head');
    if (head && !e.target.closest('button')) { head.closest('.dept-card').classList.toggle('open'); return; }
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const card = btn.closest('.dept-card');
    const id = Number(card.dataset.id);
    if (btn.dataset.act === 'del') deleteSession(id, card);
    if (btn.dataset.act === 'ok') resolveSession(id, 'ok');
    if (btn.dataset.act === 'back') resolveSession(id, 'went_back');
  });
}
function emptyDeptMsg() {
  if (state.sessions.length) return t('no_match_t');
  return t('no_deps_t');
}
function emptyDeptSub() {
  if (state.sessions.length) return t('no_match_s');
  return t('no_deps_s');
}
function chipF(key, lbl, n) {
  return `<button class="fchip ${state.deptFilter === key ? 'active' : ''}" data-f="${key}">${esc(lbl)} · ${n}</button>`;
}
function deptCard(s, i = 0, isNew = false) {
  const d = new Date(s.started_at);
  const ck = checkedCount(s);
  const miss = s.items.length - ck;
  const title = s.status === 'followup_pending' ? t('waiting_title')
    : s.status === 'leaving' ? t('onway_title') : `${ck}/${s.items.length} checked${miss ? ` · ${miss} unchecked` : ''}`;
  return `<div class="card dept-card stagger${isNew ? ' dept-new' : ''}" style="--i:${Math.min(i, 7)}" data-id="${s.id}">
    <div class="dept-head">
      <div class="dept-date"><div class="d">${d.getDate()}</div><div class="m">${d.toLocaleDateString(undefined, { month: 'short' })}</div></div>
      <div class="dept-info">
        <div class="row-title">${esc(title)}</div>
        <div class="row-sub">${fmtDay(s.started_at)} · ${fmtTime(s.started_at)}${s.duration_seconds ? ` · ${s.duration_seconds}s check` : ''} ${s.mode === 'geo' ? '· location tracked' : '· manual'}</div>
      </div>
      ${statusChip(s.status)}
      ${icon('chevD')}
    </div>
    ${s.note ? `<div class="dept-note">“${esc(s.note)}”</div>` : ''}
    <div class="dept-items">
      ${s.items.map(it => `<div class="ditem ${it.checked ? 'ok' : 'miss'}">
        <span class="dcheck">${icon(it.checked ? 'check' : 'x')}</span><span>${esc(it.label)}</span></div>`).join('')}
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        ${['leaving', 'followup_pending'].includes(s.status)
          ? `<button class="btn btn-ok" data-act="ok" style="font-size:13.5px;padding:8px 14px">${icon('check')}${esc(t('allgood_btn'))}</button>
             <button class="btn btn-warn" data-act="back" style="font-size:13.5px;padding:8px 14px">${icon('route')}${esc(t('back_btn'))}</button>`
          : ''}
        <button class="btn btn-ghost" data-act="del" style="font-size:13.5px;padding:8px 14px;color:var(--bad)">${icon('trash')}${esc(t('delete_btn'))}</button>
      </div>
    </div>
  </div>`;
}
function deleteSession(id, cardEl) {
  if (!confirm('Delete this departure from your history?')) return;
  const i = state.sessions.findIndex(s => s.id === id);
  const [gone] = state.sessions.splice(i, 1);
  if (state.activeSession && state.activeSession.id === id) state.activeSession = null;
  viewIf('departures');
  if (state.route === 'dashboard') renderView();
  api(`/api/sessions/${id}`, { method: 'DELETE' })
    .catch(() => { state.sessions.splice(i, 0, gone); viewIf('departures'); toast({ title: 'Could not delete', type: 'err' }); });
}
function resolveSession(id, result) {
  const s = state.sessions.find(x => x.id === id);
  if (!s) return;
  const prev = s.status;
  s.status = result === 'ok' ? 'confirmed_ok' : 'went_back';
  s.resolved_at = Date.now();
  if (state.activeSession && state.activeSession.id === id) state.activeSession = null;
  viewIf('departures');
  api(`/api/sessions/${id}/followup`, { method: 'POST', body: { result } })
    .then(d => {
      const j = state.sessions.findIndex(x => x.id === id);
      if (j >= 0) state.sessions[j] = d.session;
      state.unread++; renderBellDot();
      toast({ title: result === 'ok' ? t('loop_toast') : t('back_toast'), type: 'ok' });
      if (result === 'ok') { SFX.success(); addXp(15, 'check-in complete'); }
      else addXp(10, 'honest check-in');
    })
    .catch(e => {
      s.status = prev;
      viewIf('departures');
      if (/already handled/i.test(e.message)) boot(); // session auto-closed as missed while we were answering — resync
      else toast({ title: 'Could not record check-in', sub: e.message, type: 'err' });
    });
}

// ================= ACTIVITY =================
function viewActivity() {
  const TYPE = {
    followup: ['bell', 'var(--accent-soft)', 'var(--accent)'],
    ok: ['check', 'var(--ok-soft)', 'var(--ok)'],
    went_back: ['route', 'var(--warn-soft)', 'var(--warn)'],
    reminder: ['clock', 'var(--accent-soft)', 'var(--accent)'],
    tip: ['spark', 'var(--warn-soft)', 'var(--warn)'],
    test: ['bell', 'var(--accent-soft)', 'var(--accent)'],
  };
  $('#view').innerHTML = `
    <div class="page-head">
      <div><h2>${esc(t('act_title'))}</h2><p>${esc(t('act_sub'))}</p></div>
      <button class="btn btn-ghost" id="mark-read" ${state.unread ? '' : 'disabled'}>${esc(t('mark_read'))}</button>
    </div>
    <div class="card card-pad">
      ${state.notifications.length ? state.notifications.map((n, i) => {
        const [ic, bg, color] = TYPE[n.type] || ['info', 'var(--bg-soft)', 'var(--muted)'];
        return `<div class="feed-item stagger" style="--i:${Math.min(i, 8)};${n.read ? 'opacity:.72' : ''}">
          <div class="feed-ic" style="background:${bg};color:${color}">${icon(ic)}</div>
          <div class="feed-body"><div class="feed-title">${esc(n.title)}${n.read ? '' : ' <span class="chip chip-info" style="font-size:10px;padding:2px 8px;vertical-align:1px">new</span>'}</div>
            ${n.body ? `<p>${esc(n.body)}</p>` : ''}</div>
          <div class="feed-time">${timeAgo(n.created_at)}</div>
        </div>`;
      }).join('') : `<div class="empty">
        <div class="empty-ic">${icon('activity')}</div><h3>${esc(t('no_act_t'))}</h3>
        <p>${esc(t('no_act_s'))}</p></div>`}
    </div>`;
  $('#mark-read').onclick = () => {
    state.unread = 0;
    state.notifications.forEach(n => n.read = 1);
    renderBellDot(); renderView();
    api('/api/notifications/read', { method: 'POST' }).catch(() => { });
  };
}
function feedRow(n, i = 0) {
  const TYPE = { followup: ['bell', 'var(--accent)', 'var(--accent-soft)'], ok: ['check', 'var(--ok)', 'var(--ok-soft)'],
    went_back: ['route', 'var(--warn)', 'var(--warn-soft)'], reminder: ['clock', 'var(--accent)', 'var(--accent-soft)'],
    tip: ['spark', 'var(--warn)', 'var(--warn-soft)'], test: ['bell', 'var(--accent)', 'var(--accent-soft)'] };
  const [ic, color, bg] = TYPE[n.type] || ['info', 'var(--muted)', 'var(--bg-soft)'];
  return `<div class="feed-item stagger" style="--i:${Math.min(i, 8)}">
    <div class="feed-ic" style="background:${bg};color:${color}">${icon(ic)}</div>
    <div class="feed-body"><div class="feed-title">${esc(n.title)}</div>${n.body ? `<p>${esc(n.body)}</p>` : ''}</div>
    <div class="feed-time">${timeAgo(n.created_at)}</div>
  </div>`;
}

// ================= SETTINGS =================
function viewSettings() {
  const u = state.user;
  $('#view').innerHTML = `
    <div class="page-head"><div><h2>${esc(t('set_title'))}</h2><p>${esc(t('set_sub'))}</p></div></div>

    <div class="card card-pad set-card">
      <h3>${esc(t('prof_t'))}</h3><p class="set-sub">${esc(t('prof_s'))}</p>
      <div class="set-row"><div><div class="lbl">${esc(t('name_l'))}</div><div class="sub">${esc(t('name_s'))}</div></div>
        <div class="field"><input id="set-name" value="${esc(u.name)}" maxlength="40" /></div></div>
      <div class="set-row"><div><div class="lbl">${esc(t('email_l'))}</div><div class="sub">${esc(t('email_s'))}</div></div>
        <div class="muted small">${u.email ? esc(u.email) : '—'}</div></div>
      <div class="set-row" id="phone-row"><div><div class="lbl">${esc(t('phone_l'))}</div><div class="sub">${esc(t('phone_s'))}</div></div>
        <div style="display:flex;gap:8px;align-items:center"><div class="muted small">${u.phone ? '+' + esc(u.phone) : '—'}</div>
          <button class="btn btn-ghost" id="change-phone">${u.phone ? (LANG === 'hi' ? 'बदलें' : 'Change') : (LANG === 'hi' ? 'जोड़ें' : 'Add')}</button></div></div>
      ${u.provider !== 'google' && u.email && !u.email_verified ? `<div class="set-row"><div><div class="lbl">${LANG === 'hi' ? 'ईमेल सत्यापित नहीं है' : 'Email not verified'}</div><div class="sub">${LANG === 'hi' ? 'Google साइन-इन को सुरक्षित लिंक करने के लिए ईमेल सत्यापित करें' : 'Verify your email so Google sign-in can safely link later'}</div></div>
        <button class="btn btn-ghost" id="verify-email-btn">${icon('shield')}${LANG === 'hi' ? 'सत्यापित करें' : 'Verify'}</button></div>` : ''}
      <div class="set-row"><div><div class="lbl">${esc(t('method_l'))}</div><div class="sub">${esc(t('method_s'))}${u.google_linked ? ' · Google also linked' : ''}</div></div>
        <span class="chip ${u.provider === 'google' ? 'chip-info' : u.provider === 'phone' ? 'chip-ok' : 'chip-muted'}">${u.provider === 'google' ? 'Google' : u.provider === 'phone' ? 'Phone OTP' : 'Email + password'}</span></div>
      <div class="set-row"><div><div class="lbl">${esc(t('lang_l'))}</div><div class="sub">${esc(t('lang_s'))}</div></div>
        <select id="set-lang" style="border:1.5px solid var(--line);border-radius:9px;padding:8px 10px;font-size:14px;background:var(--card);color:var(--ink)">
          <option value="en" ${LANG === 'en' ? 'selected' : ''}>English</option>
          <option value="hi" ${LANG === 'hi' ? 'selected' : ''}>हिन्दी</option>
        </select></div>
    </div>

    <div class="card card-pad set-card">
      <div class="set-row" style="border-top:none;padding-top:2px"><div><div class="lbl">${esc(t('theme_dark'))}</div><div class="sub">${esc(t('theme_sub'))}</div></div>
        <label class="toggle"><input type="checkbox" id="set-theme" ${document.documentElement.dataset.theme === 'dark' ? 'checked' : ''}/><span class="track"></span><span class="thumb"></span></label></div>
      <div class="set-row"><div><div class="lbl">Sound effects</div><div class="sub">Tiny clicks &amp; chimes — pure WebAudio, no downloads</div></div>
        <label class="toggle"><input type="checkbox" id="set-sfx" ${SFX.enabled() ? 'checked' : ''}/><span class="track"></span><span class="thumb"></span></label></div>
      <div class="set-row"><div><div class="lbl">${esc(t('share_l'))}</div><div class="sub">${esc(t('share_s'))}</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
          <button class="btn btn-soft" id="share-card-btn">${icon('spark')}Streak card</button>
          <button class="btn btn-soft" id="share-app">${icon('share')}${esc(t('share_btn'))}</button>
        </div></div>
    </div>

    <div class="card card-pad set-card">
      <h3>${esc(t('loc_t'))}</h3><p class="set-sub">${esc(t('loc_s'))}</p>
      <div class="set-row"><div><div class="lbl">${esc(t('homelabel_l'))}</div></div>
        <div class="field"><input id="set-home-label" value="${esc(u.home_label || '')}" placeholder="Home · Your area" maxlength="50" /></div></div>
      <div class="set-row"><div><div class="lbl">${esc(t('homepoint_l'))}</div><div class="sub" id="geo-status">${esc(geoStatusText())}</div></div>
        <div style="display:flex;gap:8px;align-items:center">
          <div class="field" style="margin:0"><input id="set-lat" type="number" step="any" value="${u.home_lat ?? ''}" placeholder="lat" /></div>
          <div class="field" style="margin:0"><input id="set-lng" type="number" step="any" value="${u.home_lng ?? ''}" placeholder="lng" /></div>
          <button class="btn btn-ghost" id="use-gps" title="Use my current location">${icon('pin')}${esc(t('use_gps'))}</button>
        </div></div>
      <div class="set-row"><div><div class="lbl">${esc(t('radius_l'))}</div><div class="sub">${esc(t('radius_s'))}</div></div>
        <div style="display:flex;align-items:center;gap:10px">
          <input type="range" id="set-radius" min="100" max="1000" step="50" value="${u.geo_radius_m || 250}" />
          <span class="small muted" id="radius-val" style="width:52px;text-align:right">${u.geo_radius_m || 250} m</span>
        </div></div>
      <div style="margin-top:14px"><button class="btn btn-primary" id="save-location">${icon('check')}${esc(t('save_loc'))}</button></div>
    </div>

    <div class="card card-pad set-card">
      <h3>${esc(t('checkin_t'))}</h3><p class="set-sub">${esc(t('checkin_s'))}</p>
      <div class="set-row"><div><div class="lbl">${esc(t('wait_l'))}</div><div class="sub">${esc(t('wait_s', { min: u.followup_minutes }))}</div></div>
        <div style="display:flex;align-items:center;gap:8px"><input type="number" id="set-wait" min="1" max="60" value="${u.followup_minutes}" style="width:70px;border:1.5px solid var(--line);border-radius:9px;padding:8px 10px;font-size:14px" /> <span class="small muted">min</span></div></div>
      <div class="set-row"><div><div class="lbl">${esc(t('inapp_l'))}</div><div class="sub">${esc(t('inapp_s'))}</div></div>
        <label class="toggle"><input type="checkbox" id="set-notif" ${u.notify_inapp ? 'checked' : ''}/><span class="track"></span><span class="thumb"></span></label></div>
      <div class="set-row"><div><div class="lbl">${esc(t('push_l'))}</div><div class="sub" id="push-status">${esc(pushStatusText())}</div></div>
        <button class="btn btn-ghost" id="enable-push">${icon('bell')}${esc(t('enable'))}</button></div>
      <div class="set-row"><div><div class="lbl">${esc(t('browser_l'))}</div><div class="sub" id="notif-status">${esc(notifStatusText())}</div></div>
        <button class="btn btn-ghost" id="enable-notif">${icon('bell')}${esc(t('enable'))}</button></div>
      <div class="set-row"><div><div class="lbl">${esc(t('preview_l'))}</div><div class="sub">${esc(t('preview_s'))}</div></div>
        <button class="btn btn-soft" id="preview-rem">${icon('eye')}${esc(t('preview'))}</button></div>
      <div style="margin-top:14px"><button class="btn btn-primary" id="save-checkin">${icon('check')}${esc(t('save_checkin'))}</button></div>
    </div>

    <div class="card card-pad set-card">
      <h3>${esc(t('mile_t'))}</h3><p class="set-sub">${esc(t('mile_s'))}</p>
      <div class="lvl-line"><span class="lvl-badge">${icon('trophy')}${esc(levelOf(xpGet())[1])}</span>
        <span><b>${xpGet()} XP</b> — ${xpGet() < 50 ? 'run checks &amp; check-ins to level up' : 'keep the streak alive to rank up'}</span></div>
      <div class="milestones">${milestoneDefs(state.stats).map(m =>
        `<span class="milestone${m.got ? ' got' : ''}${m.pop ? ' pop' : ''}">${icon(m.icon)}${esc(t(m.key))}</span>`).join('')}</div>
    </div>

    <div class="card card-pad set-card">
      <h3>Help &amp; about</h3><p class="set-sub">How things work, in three lines.</p>
      <div class="set-row"><div><div class="lbl">How the check-in works</div><div class="sub">After you lock in, the server waits your chosen minutes, then pings you — in-app, or as a push even when the app is closed. One tap closes the loop.</div></div></div>
      <div class="set-row"><div><div class="lbl">Your privacy</div><div class="sub">Your checklist, history and home zone live only in your own account. Nothing is shared or sold — the streak card you generate contains no personal data.</div></div></div>
      <div class="set-row"><div><div class="lbl">Motion &amp; sound</div><div class="sub">Animations switch off automatically if your device requests reduced motion; sounds are always toggleable here.</div></div></div>
      <div class="set-row"><div><div class="lbl">Version</div><div class="sub">1.1 · Aurora Glass — built as an installable web app, works on Android &amp; iPhone.</div></div></div>
    </div>

    <div class="card card-pad set-card danger-zone">
      <h3>${esc(t('danger_t'))}</h3><p class="set-sub" style="color:var(--bad);opacity:.8">${esc(t('danger_s'))}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <div class="set-legal"><a href="/privacy.html" target="_blank" rel="noopener">Privacy policy</a> · <a href="/terms.html" target="_blank" rel="noopener">Terms</a></div>
      <button class="btn btn-ghost" id="btn-signout">${esc(t('sign_out'))}</button>
        <button class="btn btn-danger" id="btn-delete-account">${icon('trash')}${esc(t('delete_acct'))}</button>
      </div>
    </div>`;
  $('#set-lang').onchange = e => { setLang(e.target.value); saveProfile({}); toast({ title: LANG === 'hi' ? 'भाषा बदली गई' : 'Language changed', type: 'ok' }); };
  $('#change-phone').onclick = () => phoneChangeFlow();
  $('#verify-email-btn')?.addEventListener('click', async () => {
    const btn = $('#verify-email-btn'); btn.disabled = true;
    try {
      const d = await api('/api/verify-email/start', { method: 'POST', body: {} });
      if (d.delivery === 'demo' && d.token) { // demo server: no mail sender, walk the flow directly
        await api('/api/verify-email/confirm', { method: 'POST', body: { token: d.token } });
        toast({ title: LANG === 'hi' ? 'ईमेल सत्यापित! (डेमो)' : 'Email verified! (demo)', type: 'ok' });
        boot();
      } else toast({ title: LANG === 'hi' ? 'इनबॉक्स देखें' : 'Check your inbox', sub: LANG === 'hi' ? 'सत्यापन लिंक 24 घंटे में समाप्त होगा' : 'The verification link expires in 24 hours', type: 'ok' });
    } catch (e) { toast({ title: LANG === 'hi' ? 'सत्यापन नहीं भेजा जा सका' : 'Could not send verification', sub: e.message, type: 'err' }); btn.disabled = false; }
  });
  $('#set-theme').onchange = e => setTheme(e.target.checked ? 'dark' : 'light');
  $('#set-sfx').onchange = e => { const v = SFX.toggle(); e.target.checked = v; if (v) SFX.tick(); };
  $('#share-app').onclick = () => shareApp();
  $('#share-card-btn').onclick = () => shareStreakCard();

  $('#set-name').addEventListener('keydown', e => { if (e.key === 'Enter') saveProfile(); });
  $('#save-location').onclick = () => saveProfile({
    name: $('#set-name').value,
    home_label: $('#set-home-label').value,
    home_lat: $('#set-lat').value === '' ? null : Number($('#set-lat').value),
    home_lng: $('#set-lng').value === '' ? null : Number($('#set-lng').value),
    geo_radius_m: Number($('#set-radius').value),
  });
  $('#set-radius').oninput = e => { $('#radius-val').textContent = e.target.value + ' m'; };
  $('#save-checkin').onclick = () => saveProfile({
    followup_minutes: Math.min(60, Math.max(1, Number($('#set-wait').value) || 5)),
    notify_inapp: $('#set-notif').checked,
  });
  $('#use-gps').onclick = () => {
    if (!('geolocation' in navigator)) return toast({ title: 'Geolocation not available', sub: 'Enter coordinates manually', type: 'err' });
    $('#use-gps').disabled = true; $('#use-gps').textContent = 'Locating…';
    navigator.geolocation.getCurrentPosition(p => {
      $('#set-lat').value = p.coords.latitude.toFixed(6);
      $('#set-lng').value = p.coords.longitude.toFixed(6);
      toast({ title: 'Location captured', sub: 'Tap Save location to store it as home', type: 'ok' });
    }, () => toast({ title: 'Could not get location', sub: 'Check browser permissions, or enter manually', type: 'err' }), { enableHighAccuracy: false, timeout: 12000 });
    setTimeout(() => { $('#use-gps').disabled = false; $('#use-gps').innerHTML = `${icon('pin')}Use GPS`; }, 13000);
  };
  $('#enable-notif').onclick = async () => {
    try {
      if (!('Notification' in window)) return toast({ title: 'Not supported here', type: 'err' });
      const perm = await Notification.requestPermission();
      $('#notif-status').textContent = perm === 'granted' ? notifStatusText() : 'Blocked by the browser';
      if (perm === 'granted') toast({ title: 'Browser notifications on', type: 'ok' });
    } catch { /* noop */ }
  };
  $('#enable-push').onclick = () => enablePush();
  $('#preview-rem').onclick = () => openFollowup({
    id: -1, status: 'followup_pending', started_at: Date.now() - (u.followup_minutes || 5) * 60e3,
    followup_at: Date.now(), items: state.items.map(i => ({ label: i.label, checked: 1 })), _preview: true,
  });
  $('#btn-signout').onclick = signOut;
  $('#btn-delete-account').onclick = () => { // masked modal — a bare prompt() shows the password as typed
    if ($('#overlay-root').querySelector('.modal')) return;
    const isPw = state.user.provider === 'password';
    const el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = `<div class="modal-card">
      <div class="modal-bell" style="background:var(--warn-soft);color:var(--warn)">${icon('trash')}</div>
      <h2>${esc(t('delete_acct'))}</h2>
      <p class="muted">${isPw
        ? (LANG === 'hi' ? 'पुष्टि के लिए पासवर्ड भरें — यह छिपा रहेगा। सारा डेटा हमेशा के लिए मिट जाएगा।' : 'Type your password to confirm — it stays hidden. ALL your data will be erased forever.')
        : (LANG === 'hi' ? 'हमेशा के लिए मिटाने के लिए DELETE लिखें।' : 'Type DELETE to erase your account and all its data forever.')}</p>
      <div style="margin:12px 0 4px"><input id="del-input" type="${isPw ? 'password' : 'text'}" autocomplete="off"
        style="width:100%;border:1.5px solid var(--line);border-radius:9px;padding:10px 12px;font-size:15px;background:var(--card);color:var(--ink)" /></div>
      <div class="modal-actions" style="margin-top:12px">
        <button class="btn btn-danger btn-lg" id="del-go">${icon('trash')}${esc(t('delete_acct'))}</button>
        <button class="btn btn-ghost" id="del-cancel">${LANG === 'hi' ? 'रद्द करें' : 'Cancel'}</button>
      </div></div>`;
    $('#overlay-root').appendChild(el);
    $('#del-cancel').onclick = () => el.remove();
    $('#del-input').focus();
    $('#del-go').onclick = async () => {
      const v = $('#del-input').value;
      if (!v) return;
      $('#del-go').disabled = true;
      try {
        await api('/api/me', { method: 'DELETE', body: isPw ? { password: v } : { confirm: v.trim() } });
        localStorage.removeItem('dil_token');
        location.reload();
      } catch (e) { $('#del-go').disabled = false; toast({ title: 'Could not delete account', sub: e.message, type: 'err' }); }
    };
  };
}
function saveProfile(extra = {}) {
  const body = { ...extra, lang: LANG }; // server remembers the language for push texts
  if (body.name === undefined) body.name = $('#set-name') ? $('#set-name').value : state.user.name;
  if (!body.name) body.name = state.user.name; // phone changes happen through the verified flow only — save never touches the phone field
  api('/api/me', { method: 'PATCH', body })
    .then(d => {
      state.user = d.user;
      renderSideUser();
      if (extra.home_lat !== undefined || extra.home_lng !== undefined || extra.geo_radius_m !== undefined || extra.home_label !== undefined) {
        const pill = $('#loc-pill');
        if (pill) { pill.style.animation = 'none'; void pill.offsetWidth; pill.style.animation = 'dotPop .45s var(--ease-spring)'; }
      }
      toast({ title: t('saved'), type: 'ok' });
      viewIf('settings');
    })
    .catch(e => toast({ title: 'Could not save', sub: e.message, type: 'err' }));
}
function geoStatusText() {
  if (!state.geo.last) return state.geo.error ? 'No location yet — tap “Use GPS” or allow location' : 'Waiting for your first fix…';
  const u = state.user;
  if (u.home_lat != null && u.home_lng != null) {
    const d = haversine({ lat: u.home_lat, lng: u.home_lng }, state.geo.last);
    return `Last fix ${timeAgo(state.geo.last.ts)} · ${d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1) + ' km'} from home`;
  }
  return `Last fix ${timeAgo(state.geo.last.ts)} · set a home point to compute distance`;
}
function notifStatusText() {
  if (!('Notification' in window)) return 'Not supported in this browser';
  return Notification.permission === 'granted' ? 'Enabled — you’ll get system notifications'
    : Notification.permission === 'denied' ? 'Blocked by the browser' : 'Off — enable to get system-level nudges';
}

// ---------- web push (PWA) ----------
function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
async function swReady() {
  if (!pushSupported()) throw new Error('Push is not supported in this browser');
  const reg = await swRegPromise(); // single shared registration
  if (!reg.active && !reg.waiting) await new Promise((r, j) => {
    reg.updateFound?.(j);
    reg.installing?.addEventListener('statechange', e => { if (e.target.state === 'activated') r(); }, { once: true });
    setTimeout(r, 4000); // proceed even if already cached
  });
  return reg;
}
async function pushSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}
function pushStatusText() {
  if (!pushSupported()) return 'Not supported in this browser';
  return Notification.permission === 'granted'
    ? 'Enabled — nudges arrive even when the app is closed'
    : Notification.permission === 'denied' ? 'Blocked by the browser' : 'Off — enable to get nudges with the app closed';
}
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}
let _swReg = null;
function swRegPromise() { // register once per page — duplicate register() calls reset the worker unnecessarily
  if (!_swReg) _swReg = navigator.serviceWorker.register('/sw.js');
  return _swReg;
}
async function enablePush() {
  try {
    if (state.guest) return toast({ title: 'Create a free account for reminders', sub: 'Guest mode stays on this device — an account unlocks the 5-minute check-in push', type: 'info' });
    if (!pushSupported()) return toast({ title: 'Push not supported here', sub: 'Try Chrome/Edge on a phone or desktop', type: 'err' });
    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    if (perm !== 'granted') return toast({ title: 'Notifications are blocked', sub: 'Allow them in browser settings, then retry', type: 'err' });
    const reg = await swReady();
    const { publicKey } = await api('/api/push/vapid');
    const existing = await reg.pushManager.getSubscription();
    const b64 = b => { try { return btoa(String.fromCharCode(...new Uint8Array(b))); } catch { return null; } };
    const keyMatches = existing && existing.options && existing.options.applicationServerKey
      && b64(existing.options.applicationServerKey) === b64(urlBase64ToUint8Array(publicKey).buffer);
    if (existing && keyMatches) { await api('/api/push/subscribe', { method: 'POST', body: { subscription: existing.toJSON() } }); }
    else {
      if (existing) { try { await existing.unsubscribe(); } catch { /* */ } } // server keys changed — the old subscription would silently never fire
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      await api('/api/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
    }
    $('#push-status') && ($('#push-status').textContent = pushStatusText());
    toast({ title: 'Push notifications on', sub: 'You’ll get the check-in even when the app is closed', type: 'ok' });
  } catch (e) {
    toast({ title: 'Could not enable push', sub: e.message, type: 'err' });
  }
}

// phone number changes — SMS-verified flow (request → 6-digit code → verify)
function phoneChangeFlow() {
  if ($('#overlay-root').querySelector('.modal')) return;
  const hi = LANG === 'hi';
  const el = document.createElement('div');
  el.className = 'modal';
  el.innerHTML = `<div class="modal-card" id="pc-card">
    <div class="modal-bell" style="background:var(--accent-soft);color:var(--accent)">${icon('key')}</div>
    <h2>${hi ? 'फ़ोन नंबर' : 'Phone number'}</h2>
    <p class="muted">${hi ? 'हम SMS से 6-अंकीय कोड भेजेंगे — 5 मिनट में समाप्त।' : 'We\u2019ll text you a 6-digit code — it expires in 5 minutes.'}</p>
    <div style="margin:12px 0 4px"><input id="pc-phone" type="tel" placeholder="+91 98765 43210" maxlength="16" autocomplete="tel"
      style="width:100%;border:1.5px solid var(--line);border-radius:9px;padding:10px 12px;font-size:15px;background:var(--card);color:var(--ink)" /></div>
    <div class="modal-actions" style="margin-top:12px">
      <button class="btn btn-primary btn-lg" id="pc-send">${icon('key')}${hi ? 'कोड भेजें' : 'Send code'}</button>
      <button class="btn btn-ghost" id="pc-cancel">${hi ? 'रद्द करें' : 'Cancel'}</button>
    </div></div>`;
  $('#overlay-root').appendChild(el);
  $('#pc-cancel').onclick = () => el.remove();
  $('#pc-phone').focus();
  $('#pc-send').onclick = async () => {
    const phone = $('#pc-phone').value.trim();
    const card = $('#pc-card');
    card.querySelectorAll('button,input').forEach(x => { x.disabled = true; });
    try {
      const d = await api('/api/me/phone/request', { method: 'POST', body: { phone } });
      const demoCode = d.demo_sms ? (String(d.demo_sms.body).match(/\d{6}/) || [])[0] : null;
      card.innerHTML = `<div class="modal-bell" style="background:var(--accent-soft);color:var(--accent)">${icon('key')}</div>
        <h2>${hi ? 'कोड दर्ज करें' : 'Enter the code'}</h2>
        <p class="muted">${hi ? 'SMS में आया 6-अंकीय कोड भरें।' : 'Type the 6-digit code we just texted you.'}</p>
        ${demoCode ? `<p class="set-legal" style="margin:6px 0">Demo server — code: <b>${demoCode}</b></p>` : ''}
        <div style="margin:12px 0 4px"><input id="pc-code" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="••••••"
          style="width:100%;border:1.5px solid var(--line);border-radius:9px;padding:10px 12px;font-size:20px;letter-spacing:8px;text-align:center;background:var(--card);color:var(--ink)" /></div>
        <div class="modal-actions" style="margin-top:12px">
          <button class="btn btn-primary btn-lg" id="pc-verify">${icon('check')}${hi ? 'सत्यापित करें' : 'Verify'}</button>
          <button class="btn btn-ghost" id="pc-cancel2">${hi ? 'रद्द करें' : 'Cancel'}</button>
        </div>`;
      $('#pc-cancel2').onclick = () => el.remove();
      $('#pc-code').focus();
      $('#pc-verify').onclick = async () => {
        const code = $('#pc-code').value.trim();
        $('#pc-verify').disabled = true;
        try {
          const v = await api('/api/me/phone/verify', { method: 'POST', body: { code } });
          state.user = v.user;
          el.remove();
          toast({ title: hi ? 'फ़ोन नंबर अपडेट हुआ' : 'Phone number updated', type: 'ok' });
          boot();
        } catch (e) { $('#pc-verify').disabled = false; toast({ title: hi ? 'कोड गलत है' : 'Wrong code', sub: e.message, type: 'err' }); }
      };
    } catch (e) {
      card.querySelectorAll('button,input').forEach(x => { x.disabled = false; });
      toast({ title: hi ? 'कोड नहीं भेजा जा सका' : 'Could not send code', sub: e.message, type: 'err' });
    }
  };
}

// one-time, gentle push ask — fires after the first successful check, never nags
function maybeAskPush() {
  try {
    if (state.guest || !state.loaded) return;
    if (localStorage.getItem('dil_push_asked')) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    if (Notification.permission !== 'default') { localStorage.setItem('dil_push_asked', '1'); return; }
    if ($('#overlay-root').querySelector('.modal')) { setTimeout(maybeAskPush, 5000); return; } // let the success sheet finish its moment
    localStorage.setItem('dil_push_asked', '1'); // one ask, ever
    const hi = LANG === 'hi';
    const el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = `<div class="modal-card">
      <div class="modal-bell" style="background:var(--warn-soft);color:var(--warn)"><span class="pulse"></span>${icon('bell')}</div>
      <h2>${hi ? 'रिमाइंडर चालू करें?' : 'Turn on lock reminders?'}</h2>
      <p class="muted">${hi ? 'ऐप बंद होने पर भी चेक-इन पिंग पाएँ — हम सिर्फ़ एक बार पूछते हैं।' : 'Get the check-in ping even when the app is closed. We ask only this once.'}</p>
      <div class="modal-actions" style="margin-top:12px">
        <button class="btn btn-primary btn-lg" id="pa-yes">${icon('bell')}${hi ? 'चालू करें' : 'Enable'}</button>
        <button class="btn btn-ghost" id="pa-no">${hi ? 'बाद में' : 'Not now'}</button>
      </div></div>`;
    $('#overlay-root').appendChild(el);
    $('#pa-yes').onclick = () => { el.remove(); enablePush(); };
    $('#pa-no').onclick = () => el.remove();
  } catch { /* never block the check-in flow */ }
}

// ================= CHECKLIST SHEET =================
let sheet = null; // { startedAt, states: Map }
function openSheet() {
  if (sheet) return;
  sheet = { startedAt: Date.now(), states: new Map(state.items.map(i => [i.id, false])) };
  renderSheet();
  document.addEventListener('keydown', sheetEsc);
}
function sheetEsc(e) { if (e.key === 'Escape') closeSheet(true); }
function closeSheet(cancelled) {
  if (!sheet) return;
  sheet = null;
  $('#overlay-root').innerHTML = '';
  document.removeEventListener('keydown', sheetEsc);
  if (!cancelled && state.activeSession) { /* success handled by success view */ }
}
function renderSheet() {
  const items = state.items;
  const total = items.length;
  const checkedN = [...sheet.states.values()].filter(Boolean).length;
  const unchecked = total - checkedN;
  const pct = total ? Math.round((checkedN / total) * 100) : 0;
  const prevPct = sheet.lastPct ?? 0; // animate the ring from its last value
  sheet.lastPct = pct;
  const RC = 119.4; // ring circumference (r=19)
  $('#overlay-root').innerHTML = `
    <div class="overlay" id="sheet-overlay">
      <div class="sheet">
        <div class="sheet-head">
          <div style="display:flex;align-items:center;gap:14px">
            <div class="sheet-ring${pct === 100 ? ' full' : ''}" id="sheet-ring" role="img" aria-label="${pct}% complete">
              <svg viewBox="0 0 46 46">
                <defs><linearGradient id="ringg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b7bff"/><stop offset="1" stop-color="#2ee6b8"/></linearGradient></defs>
                <circle class="track" cx="23" cy="23" r="19"/>
                <circle class="val" cx="23" cy="23" r="19" style="stroke-dasharray:${RC};stroke-dashoffset:${(RC * (1 - prevPct / 100)).toFixed(1)}"/>
              </svg>
              <span class="pct">${pct}%</span>
            </div>
            <div style="flex:1;min-width:0"><div class="t">${esc(t('leaving_now'))}</div><div class="s">${esc(t('leaving_sub', { n: total, min: state.user.followup_minutes }))}</div></div>
            <button class="icon-btn" id="sheet-x" aria-label="Close">${icon('x')}</button>
          </div>
          <div class="progress-outer${pct === 100 ? ' full' : ''}">
            <div class="progress"><div class="bar" style="width:${pct}%"></div></div>
            <span class="spark">${icon('spark')}</span>
          </div>
          <div class="s" style="margin-top:6px;font-weight:600;color:${pct === 100 ? 'var(--ok)' : 'var(--muted)'}">${esc(t('confirmed_of', { a: checkedN, b: total }))}</div>
        </div>
        <div class="sheet-body" id="sheet-body">
          ${items.map((i, ix) => {
            const on = sheet.states.get(i.id);
            const just = state.sheetJust.includes(i.id);
            return `<div class="cl-row ${on ? 'checked' : ''}${just ? ' just' : ''}" data-cl="${i.id}">
              <span class="cl-check"${just ? ` style="animation-delay:${ix * 45}ms"` : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path class="tick" d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
              <span class="cl-lbl">${esc(i.label)}</span>
              <span class="cl-ic">${icon(i.icon)}</span>
            </div>`;
          }).join('')}
          ${unchecked ? `<div style="text-align:center;font-size:13px;color:var(--warn);font-weight:600;padding:10px 0 4px">
            ${esc(t('unchecked_note', { n: unchecked }))}</div>` : ''}
        </div>
        <div class="sheet-foot">
          <button class="btn btn-ghost" id="sheet-all" style="flex:0 0 auto">${icon('check')}${esc(t('mark_all'))}</button>
          <button class="btn btn-primary btn-lg" id="sheet-go" style="flex:1">${icon('lock')}${esc(t('im_leaving'))}</button>
        </div>
      </div>
    </div>`;
  $('#sheet-x').onclick = () => closeSheet(true);
  requestAnimationFrame(() => {
    const v = document.querySelector('#sheet-ring .val');
    if (v) v.style.strokeDashoffset = (RC * (1 - pct / 100)).toFixed(1);
  });
  $('#sheet-overlay').addEventListener('mousedown', e => { if (e.target.id === 'sheet-overlay') closeSheet(true); });
  $('#sheet-body').addEventListener('click', e => {
    const row = e.target.closest('.cl-row');
    if (!row) return;
    const id = Number(row.dataset.cl);
    const turning = !sheet.states.get(id);
    sheet.states.set(id, turning);
    if (turning) {
      SFX.tick();
      state.sheetJust = [id];
      setTimeout(() => { state.sheetJust = []; }, 450);
    } else SFX.unTick();
    renderSheet();
  });
  $('#sheet-all').onclick = () => {
    state.items.forEach(i => sheet.states.set(i.id, true));
    state.sheetJust = state.items.map(i => i.id);
    setTimeout(() => { state.sheetJust = []; }, 450 + state.items.length * 45);
    renderSheet();
  };
  $('#sheet-go').onclick = () => confirmLeave();
}
async function confirmLeave() {
  const items = state.items.map(i => ({ item_id: i.id, label: i.label, checked: sheet.states.get(i.id) ? 1 : 0 }));
  const duration = Math.round((Date.now() - sheet.startedAt) / 1000);
  let lat = null, lng = null, mode = 'manual';
  if (state.geo.last) { lat = state.geo.last.lat; lng = state.geo.last.lng; mode = 'geo'; }
  $('#sheet-go').disabled = true;
  try {
    const { session } = await api('/api/sessions', { method: 'POST', body: { items, durationSeconds: duration, lat, lng, mode } });
    state.activeSession = session;
    state.newDeptId = session.id; // highlight the new departure in history
    const i = state.sessions.findIndex(x => x.id === session.id);
    if (i >= 0) state.sessions[i] = session; else state.sessions.unshift(session);
    state.unread++; renderBellDot();
    toast({ title: t('toast_sched_t'), sub: t('toast_sched_s', { min: state.user.followup_minutes }), type: 'ok' });
    SFX.go();
    SFX.lock(); // the deadbolt slams home
    addXp(25, 'safe launch');
    renderSheetSuccess(session);
  } catch (e) {
    toast({ title: 'Could not start your check-out', sub: e.message, type: 'err' });
    $('#sheet-go').disabled = false;
  }
}
function renderSheetSuccess(session) {
  $('#overlay-root').innerHTML = `
    <div class="overlay" id="sheet-overlay">
      <div class="sheet">
        <div class="sheet-body success-wrap" style="padding:30px 28px 30px">
          <img class="success-art" src="/img/success.webp" alt="" aria-hidden="true">
          <div class="success-big">
            <svg viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
              <circle class="ring" cx="28" cy="28" r="25"/>
              <path class="tick" d="M18 29l7 7 14-16"/>
            </svg>
            <span class="success-burst go"></span>
            <span class="success-sparkle s1">${icon('spark')}</span>
            <span class="success-sparkle s2">${icon('spark')}</span>
            <span class="success-sparkle s3">${icon('spark')}</span>
          </div>
          <h2 style="margin:0 0 8px;font-size:22px">${esc(t('success_go'))}, ${esc(firstName(state.user.name))}.</h2>
          <p class="muted" style="max-width:38ch;margin:0 auto 18px">
            ${t('success_sub', { a: checkedCount(session), b: session.items.length, time: fmtTime(session.started_at), followup: esc(fmtTime(session.followup_at)) })}
          </p>
          <div class="hero-status" style="background:var(--accent-soft);border-color:#dfe3ff;justify-content:center;gap:10px;max-width:300px;margin:0 auto 22px">
            <span class="lbl" style="color:var(--accent-ink)">${esc(t('checkin_in'))}</span>
            <span class="hero-timer" style="font-size:24px;color:var(--accent-ink)" data-countdown="${session.followup_at}">--:--</span>
          </div>
          <button class="btn btn-primary btn-lg btn-block" id="sheet-done">${esc(t('done'))}</button>
        </div>
      </div>
    </div>`;
  $('#sheet-done').onclick = () => { closeSheet(false); boot(); setTimeout(maybeAskPush, 900); };
  SFX.success();
  confetti(16);
  tickCountdowns();
}

// ================= FOLLOW-UP MODAL =================
function openFollowup(session) {
  if (!session || (state.followupOpenFor && state.followupOpenFor === session.id)) return;
  if ($('#overlay-root').querySelector('.modal')) return; // sheet open
  state.followupOpenFor = session.id;
  const mins = Math.max(1, Math.round((Date.now() - session.started_at) / 60000));
  const steps = {
    ask: `
      <div class="modal-bell" style="background:var(--accent-soft);color:var(--accent)">
        <span class="pulse"></span>${icon('bell')}
      </div>
      <h2>${esc(t('fu_title'))}</h2>
      <p>${esc(t('fu_body', { name: firstName(state.user.name), time: fmtTime(Date.now()), min: mins }))}</p>
      <div class="modal-actions">
        <button class="btn btn-ok btn-lg" data-fu="ok">${icon('check')}${esc(t('fu_ok'))}</button>
        <button class="btn btn-warn btn-lg" data-fu="review">${esc(t('fu_review'))}</button>
      </div>`,
    review: `
      <div class="modal-bell" style="background:var(--warn-soft);color:var(--warn)">
        <span class="pulse"></span>${icon('route')}
      </div>
      <h2>${esc(t('fu_review_t'))}</h2>
      <p>${esc(t('fu_review_s'))}</p>
      <div style="text-align:left;margin:0 0 14px" id="fu-items">
        ${session.items.map((it, i) => `<div class="cl-row ${it.checked ? 'checked' : ''}" data-fu-it="${i}" style="cursor:pointer">
          <span class="cl-check">${icon('check')}</span><span class="cl-lbl">${esc(it.label)}</span></div>`).join('')}
      </div>
      <div class="modal-note"><input id="fu-note" placeholder="${esc(t('fu_note_ph'))}" maxlength="200" /></div>
      <div class="modal-actions" style="margin-top:12px">
        <button class="btn btn-warn btn-lg" data-fu="back">${icon('route')}${esc(t('fu_back'))}</button>
        <button class="btn btn-ghost" data-fu="fine">${esc(t('fu_fine'))}</button>
      </div>`,
  };
  const el = document.createElement('div');
  el.className = 'modal';
  el.id = 'fu-modal';
  el.innerHTML = `<div class="modal-card" id="fu-card">${steps.ask}</div>`;
  $('#overlay-root').appendChild(el);
  SFX.alert();

  const reviewStates = session.items.map(it => !!it.checked);
  el.addEventListener('click', async e => {
    const btn = e.target.closest('[data-fu]');
    const itRow = e.target.closest('[data-fu-it]');
    if (itRow) {
      const i = Number(itRow.dataset.fuIt);
      reviewStates[i] = !reviewStates[i];
      itRow.classList.toggle('checked', reviewStates[i]);
      return;
    }
    if (!btn) return;
    const act = btn.dataset.fu;
    if (act === 'ok') return finish('ok', '');
    if (act === 'review') $('#fu-card').innerHTML = steps.review;
    if (act === 'fine') return finish('ok', '');
    if (act === 'back') return finish('went_back', $('#fu-note') ? $('#fu-note').value.trim() : '', reviewStates);
  });
  el.addEventListener('mousedown', e => { if (e.target === el && session._preview) { el.remove(); state.followupOpenFor = null; } });

  async function finish(result, note, reviewStates) {
    const card = $('#fu-card');
    if (session._preview) {
      card.innerHTML = `
        <div class="success-big" style="background:var(--accent-soft);color:var(--accent)">${icon('info')}</div>
        <h2>That’s exactly how it lands</h2>
        <p>In real life this arrives ${state.user.followup_minutes} minutes after you tap “I’m leaving” — as a toast here, plus a browser notification if you enabled one.</p>
        <div class="modal-actions"><button class="btn btn-primary btn-lg" id="fu-close">Got it</button></div>`;
      $('#fu-close').onclick = () => { el.remove(); state.followupOpenFor = null; };
      return;
    }
    card.innerHTML = `<div class="skel" style="height:220px"></div>`;
    try {
      const reviewed = result === 'went_back' && Array.isArray(reviewStates) ? { items: session.items.map((it, i) => ({ label: it.label, checked: !!reviewStates[i] })) } : {}; // send what the user actually unticked
      const d = await api(`/api/sessions/${session.id}/followup`, { method: 'POST', body: { result, note: note || null, ...reviewed } });
      const j = state.sessions.findIndex(x => x.id === session.id);
      if (j >= 0) state.sessions[j] = d.session;
      if (state.activeSession && state.activeSession.id === session.id) state.activeSession = null;
      state.unread++; renderBellDot();
      const ok = result === 'ok';
      card.innerHTML = `
        <div class="success-big" ${ok ? '' : 'style="background:var(--warn-soft);color:var(--warn)"'}>${icon(ok ? 'check' : 'route')}</div>
        <h2>${esc(ok ? t('loop_closed') : t('went_back_h'))}</h2>
        <p>${esc(ok ? t('loop_closed_s', { name: firstName(state.user.name) }) : t('went_back_s'))}</p>
        <div class="modal-actions"><button class="btn btn-primary btn-lg" id="fu-close">${esc(t('done'))}</button></div>`;
      $('#fu-close').onclick = () => { el.remove(); state.followupOpenFor = null; boot(); }; // full resync — stats, streak and history update immediately
    } catch (err) {
      card.innerHTML = `<h2>Couldn’t record that</h2><p class="muted">${esc(err.message)}</p>
        <div class="modal-actions"><button class="btn btn-primary" id="fu-close">Try again</button></div>`;
      state.followupOpenFor = null;
      $('#fu-close').onclick = () => { el.remove(); setTimeout(() => openFollowup(session), 60); };
    }
  }
}

// browser notification on follow-up
function systemNotify(title, body) {
  // Android Chrome has no Notification constructor — the SW's showNotification is the only path that works there
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const fallback = () => { try { new Notification(title, { body }); } catch { /* very old browsers */ } };
  try {
    swReady()
      .then(reg => (reg && reg.showNotification)
        ? reg.showNotification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png', tag: 'didilock-page' })
        : fallback())
      .catch(fallback);
  } catch { fallback(); }
}

// ================= SSE =================
let es = null;
let esRetry = null, esFails = 0;
async function connectSSE() {
  if (es) { try { es.close(); } catch { /* */ } es = null; }
  if (esRetry) { clearTimeout(esRetry); esRetry = null; }
  try {
    let ticket = '';
    try { ticket = (await realApi('/api/events/ticket')).ticket; } catch { return; } // dead token → no stream
    es = new EventSource(`/api/events?ticket=${encodeURIComponent(ticket)}`);
    es.onopen = () => { esFails = 0; };
    es.onerror = () => { // a 502 during a deploy must not kill the live link forever — but a dead token shouldn't spin either
      try { es && es.close(); } catch { /* */ } es = null;
      esFails = Math.min(esFails + 1, 6);
      const wait = esFails >= 5 ? 120000 : 12000 + Math.floor(Math.random() * 6000); // back off hard after 5 straight failures
      if (token() && !esRetry) esRetry = setTimeout(connectSSE, wait);
      if (esFails >= 5) esFails = 0; // after a long backoff, start the ladder again
    };
    es.onmessage = ev => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === 'followup_due') {
        const bell = $('#bell-btn');
        if (bell) { bell.classList.remove('nudge'); void bell.offsetWidth; bell.classList.add('nudge'); }
        toast({ title: 'Did you check everything?', sub: 'Your check-in just arrived', type: 'info', ms: 7000 });
        systemNotify('Did you check everything? 🚪', 'A few minutes have passed since you left home. Door, stove, iron, windows?');
        api('/api/sessions/active').then(d => {
          if (d.session) { state.activeSession = d.session; openFollowup(d.session); }
        }).catch(() => { });
      } else if (msg.type === 'notification') {
        api('/api/notifications').then(d => {
          state.notifications = d.notifications; state.unread = d.unread;
          renderBellDot();
          if (state.route === 'activity') renderView();
        }).catch(() => { });
      } else if (msg.type === 'session_created') {
        api('/api/sessions/active').then(d => { state.activeSession = d.session; if (state.route === 'dashboard') renderView(); }).catch(() => { });
      }
    };
  } catch { /* EventSource unsupported */ }
}

// ================= countdown ticker =================
function tickCountdowns() {
  $$('#view [data-countdown], #overlay-root [data-countdown]').forEach(el => {
    const diff = Number(el.dataset.countdown) - serverNow(); // server time, not the phone's possibly-wrong clock
    el.textContent = mmss(diff);
    if (diff < 0 && el.closest('.hero')) {
      el.textContent = 'NOW';
    }
  });
}
setInterval(() => {
  if (!state.user) return;
  tickCountdowns();
  const a = state.activeSession;
  if (a && a.status === 'leaving' && serverNow() >= (a.followup_at || 0)) {
    a.status = 'followup_pending';
    if (state.route === 'dashboard') renderView();
  }
  if (a && a.status === 'followup_pending' && !state.followupOpenFor && !sheet && state.user.notify_inapp) {
    openFollowup(a);
  }
}, 1000);

// ================= geolocation =================
function startGeo() {
  if (!('geolocation' in navigator)) { setLocPill('error', 'Location off'); return; }
  setLocPill('off', 'Finding you…');
  try {
    navigator.geolocation.watchPosition(pos => {
      state.geo.last = { lat: pos.coords.latitude, lng: pos.coords.longitude, ts: Date.now(), acc: pos.coords.accuracy || 0 };
      state.geo.error = null;
      const u = state.user;
      const good = (state.geo.last.acc || 0) <= 150; // coarse Wi-Fi/IP fixes can be km off — never drive Away prompts with them
      if (u.home_lat != null && u.home_lng != null) {
        const d = haversine({ lat: u.home_lat, lng: u.home_lng }, state.geo.last);
        const isAway = d > u.geo_radius_m;
        if (!good) { // bad fix: keep the last known state, show no distance (false precision), never flip anything
          const known = state.geo.away;
          if (known !== null) setLocPill(known ? 'away' : 'home', (known ? 'Away' : 'At home') + ' · weak GPS');
          else setLocPill('home', 'Getting a GPS fix…');
        } else setLocPill(isAway ? 'away' : 'home',
          d <= 1000 ? `At home · ${Math.round(d)} m` : `Away · ${(d / 1000).toFixed(1)} km`);
        if (isAway) {
          // home → away transition (or first fix while away): surface the proactive prompt
          if (!awayPrompted) {
            awayPrompted = true;
            if (state.loaded && state.route === 'dashboard') renderView();
          }
          state.geo.away = true;
        } else {
          awayPrompted = false;
          state.geo.away = false;
        }
      } else setLocPill('away', 'Tracking');
      // attach live position to an in-flight session
      const a = state.activeSession;
      if (a && a.status === 'leaving' && Date.now() - a.started_at < 30 * 60e3 && Date.now() - (state.geo.lastPost || 0) > 30000
        && state.geo.last && Date.now() - state.geo.last.ts < 5 * 60e3 && (state.geo.last.acc || 0) <= 150) { // fresh + accurate fixes only
        state.geo.lastPost = Date.now(); // one upload per 30 s — GPS fixes arrive far more often than the server wants
        api(`/api/sessions/${a.id}/location`, { method: 'POST', body: { lat: state.geo.last.lat, lng: state.geo.last.lng } })
          .then(() => { a.mode = 'geo'; }).catch(() => { });
      }
      if (state.route === 'settings') { const g = $('#geo-status'); if (g) g.textContent = geoStatusText(); }
    }, err => {
      state.geo.error = err.code;
      setLocPill('error', err.code === 1 ? 'Location denied · manual mode' : 'No signal · manual mode');
    }, { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 });
  } catch {
    setLocPill('error', 'Location off · manual mode');
  }
}
function setLocPill(kind, text) {
  $('#loc-dot').className = 'loc-dot ' + (kind === 'off' ? '' : kind);
  $('#loc-text').textContent = text;
}

// ================= boot =================
// production servers (no demo mode): hide the demo quick-try chips
fetch('/api/config').then(r => r.json()).then(c => { if (c && c.ts) clockSkew = c.ts - Date.now(); if (c && c.demo === false) $$('.try-chip').forEach(b => b.style.display = 'none'); }).catch(() => {});
if ('serviceWorker' in navigator) swRegPromise().catch(() => { /* offline shell unavailable */ });
(async function bootApp() {
  applyTheme(currentTheme());
  document.getElementById('theme-btn').addEventListener('click', () =>
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  if (token()) {
    try {
      const { user } = await api('/api/me');
      enterApp(user);
      return;
    } catch (e) {
      if (e && (e.status === 401 || e.status === 403)) {
        localStorage.removeItem('dil_token'); // genuinely dead session
      } else {
        // offline / Render cold start / 5xx: the session is FINE — never log the user out for that.
        // keep the token, self-heal when connectivity returns (login screen sits on top meanwhile)
        try {
          toast({ title: LANG === 'hi' ? 'सर्वर नहीं मिला — सेशन सुरक्षित है' : 'Can\u2019t reach the server — your session is safe', sub: LANG === 'hi' ? 'नेटवर्क आते ही अपने आप खुलेगा' : 'We\u2019ll reopen automatically once you\u2019re back online', type: 'info' });
        } catch { /* */ }
        const heal = () => { if (token() && !state.user) location.reload(); }; // if they signed in meanwhile, leave them alone
        window.addEventListener('online', heal, { once: true });
        setTimeout(heal, 15000);
      }
    }
  }
  let toAuth = false;
  try { toAuth = sessionStorage.getItem('dil_to_auth') === '1'; } catch { /* */ }
  if (localStorage.getItem('dil_guest') === '1' && !toAuth) { guestBoot(); return; }
  try { sessionStorage.removeItem('dil_to_auth'); } catch { /* */ }
  // cold-start hint: free hosting sleeps; if the server hasn't answered in 2.5s, say so instead of looking broken
  let woke = false;
  const wakeCtl = typeof AbortController === 'function' ? new AbortController() : null;
  if (wakeCtl) setTimeout(() => wakeCtl.abort(), 8000); // never let a stalled probe hang around
  fetch('/api/health', wakeCtl ? { signal: wakeCtl.signal } : {}).then(() => { woke = true; document.getElementById('cold-start')?.classList.add('hidden'); }).catch(() => {});
  setTimeout(() => { if (!woke) document.getElementById('cold-start')?.classList.remove('hidden'); }, 2500);
  showAuth();
})();
 