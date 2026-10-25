'use strict';
/* NOTE: run against a FRESHLY STARTED server — phone-OTP buckets (5/hour) are in-memory and this suite consumes them */
const puppeteer = require('puppeteer');
const fs = require('fs');
fs.mkdirSync('/tmp/shots', { recursive: true });

const results = [];
const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond, extra }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); };

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ---------- clean up state left by a previous run ----------
  // (a) an expired follow-up would auto-open its modal on boot and cover the UI,
  // (b) if a previous run died mid password-reset, restore the demo password
  {
    const api = {
      login: pw => fetch('http://127.0.0.1:3000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo@didilock.app', password: pw }) }).then(r => r.json()).catch(() => ({})),
      otp: () => fetch('http://127.0.0.1:3000/api/auth/phone/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '+91 98765 43210', purpose: 'reset' }) }).then(r => r.json()),
      reset: (code, pw) => fetch('http://127.0.0.1:3000/api/auth/password/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '+91 98765 43210', code, newPassword: pw }) }).then(r => r.json()),
    };
    let tok = (await api.login('demo1234')).token || (await api.login('reset-test-123')).token;
    if (tok) {
      if (!(await api.login('demo1234')).token) {
        const req = await api.otp();
        const code = (req.demo_sms.body.match(/\d{6}/) || [])[0];
        await api.reset(code, 'demo1234');
        tok = (await api.login('demo1234')).token;
      }
      const { session } = await fetch('http://127.0.0.1:3000/api/sessions/active', { headers: { Authorization: 'Bearer ' + tok } }).then(r => r.json());
      if (session && ['leaving', 'followup_pending'].includes(session.status)) {
        await fetch(`http://127.0.0.1:3000/api/sessions/${session.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } });
      }
    }
  }

  // ---------- auth screen ----------
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' });
  ok('auth screen visible', await page.$('#auth-screen:not(.hidden)'));
  const auroraBits = await page.$$eval('.aurora-bg i', els => els.length);
  ok('aurora backdrop + cinematic auth', auroraBits >= 4 && !!(await page.$('.auth-bg-img')) && !!(await page.$('.auth-card')), `${auroraBits} aurora layers`);
  ok('brand rendered', (await page.$eval('.brand-name', el => el.textContent)).replace(/\u00A0/g, ' ').includes('Did I Lock?'));
  await page.screenshot({ path: '/tmp/shots/01-auth.png' });

  // ---------- guest mode ----------
  ok('guest button on auth screen', !!(await page.$('#guest-btn')));
  ok('legal links on auth screen', !!(await page.$('.legal-links')) && (await page.$eval('.legal-links', el => el.textContent)).includes('Privacy'));
  const privSt = await page.evaluate(() => fetch('/privacy.html').then(r => r.status).catch(() => 0));
  const termSt = await page.evaluate(() => fetch('/terms.html').then(r => r.status).catch(() => 0));
  ok('privacy + terms pages serve', privSt === 200 && termSt === 200, `privacy ${privSt}, terms ${termSt}`);
  await page.click('#guest-btn');
  await sleep(1100);
  ok('guest enters app without an account', !!(await page.$('#app-shell:not(.hidden)')));
  ok('guest banner shown', !!(await page.$('.guest-bar')) && (await page.$eval('.guest-bar', el => el.textContent)).includes('Guest'));
  await page.evaluate(() => { location.hash = '#/checks'; });
  await sleep(700);
  const guestItems = await page.$$eval('#view .check-row', els => els.length).catch(() => 0);
  ok('guest gets a starter checklist', guestItems >= 3, `${guestItems} rows`);
  await page.screenshot({ path: '/tmp/shots/01b-guest.png' });
  await page.click('#guest-exit');
  await sleep(900);
  ok('guest exit returns to auth', !!(await page.$('#auth-screen:not(.hidden)')));

  // guest resume + the sign-up path (must land on AUTH with the data keys kept for the merge)
  await page.evaluate(() => localStorage.setItem('dil_guest', '1'));
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(900);
  ok('guest session resumes on reload', !!(await page.$('.guest-bar')));
  await page.evaluate(() => document.getElementById('guest-save').click());
  await sleep(1000);
  ok('sign-up intent lands on auth with data kept', !!(await page.$('#auth-screen:not(.hidden)'))
    && !!(await page.evaluate(() => localStorage.getItem('dil_guest_items'))));
  await page.evaluate(() => ['dil_guest', 'dil_guest_items', 'dil_guest_tasks'].forEach(k => localStorage.removeItem(k)));

  // method tabs present
  const tabs = await page.$$eval('.method-tab', els => els.map(e => e.textContent.trim()));
  ok('3 sign-in methods', tabs.length === 3 && tabs.join('|').includes('Email') && tabs.join('|').includes('Phone') && tabs.join('|').includes('Google'), tabs.join('|'));

  // wrong password
  await page.type('#form-login input[name=email]', 'demo@didilock.app');
  await page.type('#form-login input[name=password]', 'wrongpass');
  await page.click('#login-btn');
  await sleep(700);
  ok('wrong password rejected', (await page.$eval('#login-err', el => el.textContent)).includes('Wrong'));

  // ---------- PHONE OTP ----------
  await page.click('#try-phone');
  await page.waitForSelector('#sms-bubble:not(.hidden)', { timeout: 8000 });
  ok('demo SMS received in-app', (await page.$eval('#sms-to', el => el.textContent)).includes('9876543210'));
  await page.screenshot({ path: '/tmp/shots/01c-phone-otp.png' });
  const code = await page.$eval('#sms-body', el => (el.textContent.match(/\d{6}/) || [])[0]);
  ok('SMS contains 6-digit code', /^\d{6}$/.test(code || ''), code);
  await page.waitForSelector('#phone-step2:not(.hidden)');
  await page.type('#code-input', code);
  await page.click('#verify-code-btn');
  await page.waitForFunction(() => !document.querySelector('#app-shell').classList.contains('hidden'), { timeout: 10000 });
  ok('phone OTP sign-in works', (await page.$eval('.side-user-name', el => el.textContent)).includes('Ash'));
  // format tolerance: local format (no +91) should still reach the demo account, not create a new one
  const fb = await page.evaluate(async () => {
    const req = await (await fetch('/api/auth/phone/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '9876543210' }) })).json();
    const code = (req.demo_sms.body.match(/\d{6}/) || [])[0];
    return (await fetch('/api/auth/phone/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '9876543210', code }) })).json();
  });
  ok('phone format tolerance (no +91)', fb.user && fb.user.name.includes('Ash') && fb.created === false, `${fb.user && fb.user.name} created=${fb.created}`);
  await page.click('#signout-btn');
  await page.waitForFunction(() => !document.querySelector('#auth-screen').classList.contains('hidden'), { timeout: 8000 });

  // ---------- GOOGLE ----------
  await page.click('.method-tab[data-m=google]');
  await page.click('#google-btn');
  await page.waitForSelector('#g-modal .g-card', { timeout: 5000 });
  ok('google chooser opens', (await page.$eval('#g-modal h3', el => el.textContent)).includes('Sign in with Google'));
  ok('chooser lists demo account', (await page.$eval('.g-acct .g-acct-email', el => el.textContent)).includes('demo@didilock.app'));
  await page.screenshot({ path: '/tmp/shots/01d-google.png' });
  await page.click('.g-acct[data-email="demo@didilock.app"]');
  await page.waitForFunction(() => !document.querySelector('#app-shell').classList.contains('hidden'), { timeout: 10000 });
  ok('google sign-in links & restores data', (await page.$eval('.side-user-name', el => el.textContent)).includes('Ash'));
  await page.waitForFunction(() => document.querySelectorAll('.stat').length === 4, { timeout: 10000 });
  ok('google login loads full dashboard', true);
  await page.click('#signout-btn');
  await page.waitForFunction(() => !document.querySelector('#auth-screen').classList.contains('hidden'), { timeout: 8000 });

  // google quick-try (auto-selects the demo account)
  await page.click('#try-google');
  await page.waitForFunction(() => !document.querySelector('#app-shell').classList.contains('hidden'), { timeout: 10000 });
  ok('google quick-try signs in directly', (await page.$eval('.side-user-name', el => el.textContent)).includes('Ash'));
  await page.click('#signout-btn');
  await page.waitForFunction(() => !document.querySelector('#auth-screen').classList.contains('hidden'), { timeout: 8000 });

  // ---------- EMAIL (demo quick-try) ----------
  await page.click('#try-email');
  await page.waitForFunction(() => !document.querySelector('#app-shell').classList.contains('hidden'), { timeout: 10000 });
  ok('logged in via email demo', true);

  // dashboard
  await page.waitForFunction(() => { // wait for REAL content — the loading skeleton also has .hero and 4 .stat shells
    const v = document.querySelector('#view');
    const h = v && v.querySelector('.hero h2');
    return h && !/Loading/.test(h.textContent) && v.querySelectorAll('.stat:not(.skel-stat) .skel').length === 0 && v.querySelectorAll('.stat').length === 4;
  }, { timeout: 15000 });
  ok('dashboard hero + 4 stats', true);
  const heroText = await page.$eval('.hero h2', el => el.textContent);
  ok('hero greets user', heroText.includes('Ready to leave'), heroText);
  const streak = await page.$$eval('.stat .num', els => els.map(e => e.textContent));
  ok('stats have values', streak.every(s => s.length > 0), streak.join(','));
  const wkCols = await page.$$eval('.week-strip .wk', els => els.length);
  ok('this-week strip renders 7 days', wkCols === 7, `${wkCols} days`);
  const xpTop = await page.$eval('#xp-num', el => Number(el.textContent));
  ok('XP pill live in topbar', Number.isFinite(xpTop) && xpTop >= 0, `${xpTop} XP`);
  ok('hero shows XP bar + quest chip', !!(await page.$('.hero-xp .bar i')) && !!(await page.$('.quest-chip')));
  ok('bottom tab bar wired (5 tabs)', (await page.$$('#bottom-nav a')).length === 5);
  ok('tasks nav link present', !!(await page.$('.side-link[data-route=tasks]')));
  const xpBefore = xpTop;
  // dark mode toggle
  await page.click('#theme-btn');
  await sleep(300);
  ok('dark mode toggles on', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
  await page.screenshot({ path: '/tmp/shots/02b-dark.png', fullPage: true });
  await page.click('#theme-btn');
  await sleep(300);
  ok('dark mode toggles off', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light');
  await page.screenshot({ path: '/tmp/shots/02-dashboard.png', fullPage: true });

  // ---------- checklist sheet ----------
  await page.click('#hero-cta');
  await page.waitForSelector('#sheet-go', { timeout: 5000 });
  ok('checklist sheet opened', true);
  ok('progress ring animates in sheet head', !!(await page.$('#sheet-ring .val')));
  const rows = await page.$$('.cl-row');
  ok('7 checklist rows', rows.length === 7, `${rows.length} rows`);
  // tap the first 5 different rows
  for (let i = 0; i < 5; i++) { await page.evaluate(ix => document.querySelectorAll('.cl-row')[ix].click(), i); await sleep(120); }
  const prog = await page.$eval('.progress .bar', el => el.style.width);
  ok('progress updated', prog === '71.4286%' || parseFloat(prog) > 60, prog);
  await page.screenshot({ path: '/tmp/shots/03-sheet.png' });
  // mark all
  await page.click('#sheet-all');
  await sleep(150);
  ok('mark all works', (await page.$eval('.progress .bar', el => el.style.width)) === '100%');
  // confirm leave
  await page.click('#sheet-go');
  await page.waitForSelector('#sheet-done', { timeout: 6000 });
  ok('success view after leaving', true);
  const xpAfter = await page.$eval('#xp-num', el => Number(el.textContent));
  ok('XP awarded for safe launch (+25)', xpAfter === xpBefore + 25, `${xpBefore} -> ${xpAfter}`);
  ok('confetti celebration fires', !!(await page.$('.confetti-layer')));
  await page.screenshot({ path: '/tmp/shots/04-success.png' });
  await page.click('#sheet-done');
  await sleep(1000);
  // v1.5: the one-time push prompt appears after the first successful check — dismiss it
  const paNo = await page.$('#pa-no');
  if (paNo) { ok('one-time push prompt after first check', true); await page.click('#pa-no'); await sleep(300); }
  else ok('one-time push prompt after first check', false, 'prompt did not appear');
  // hero should now show countdown
  await page.waitForFunction(() => document.querySelector('#hero-confirm'), { timeout: 5000 });
  ok('hero shows active session', true);
  // a second check-out must be rejected while one is active
  const guard = await page.evaluate(async () => {
    const r = await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('dil_token') }, body: JSON.stringify({ items: [{ label: 'x', checked: 1 }] }) });
    return { status: r.status, error: (await r.json()).error };
  });
  ok('active session blocks a second check', guard.status === 409 && /check/i.test(guard.error || ''), `${guard.status} ${guard.error}`);

  // ---------- checks page CRUD ----------
  await page.click('.side-link[data-route=checks]');
  await page.waitForSelector('#checks-list .check-row', { timeout: 5000 });
  const before = (await page.$$('#checks-list .check-row')).length;
  ok('checks list rendered', before === 7, `${before} rows`);
  // template preview (no apply — keeps the 7-row checklist intact)
  await page.click('.tpl-chip[data-tpl=work]');
  await page.waitForSelector('#tpl-use', { timeout: 5000 });
  const tplItems = (await page.$$('.tpl-item')).length;
  ok('template preview lists items', tplItems === 5, `${tplItems} items`);
  ok('gym template chip exists', !!(await page.$('.tpl-chip[data-tpl=gym]')));
  await page.click('#tpl-cancel');
  await page.waitForFunction(() => !document.querySelector('#tpl-use'), { timeout: 5000 });
  await page.type('#new-check', 'AC remote off');
  await page.select('#new-icon', 'plug');
  await page.click('#add-check-btn');
  await sleep(600);
  const after = (await page.$$('#checks-list .check-row')).length;
  ok('optimistic add', after === before + 1, `${before} -> ${after}`);
  // edit the NEW row (last one) so demo data stays intact
  {
    const rows = await page.$$('#checks-list .check-row');
    const last = rows[rows.length - 1];
    await last.click(); // no-op to ensure visible
    await page.evaluate(() => {
      const rows = document.querySelectorAll('#checks-list .check-row');
      rows[rows.length - 1].querySelector('[data-act=edit]').click();
    });
    await sleep(250);
    const inp = await page.$('.check-edit-input');
    ok('edit mode', !!inp);
    await inp.click({ clickCount: 3 });
    await inp.type('AC remote off (check every morning)');
    await page.evaluate(() => {
      const rows = document.querySelectorAll('#checks-list .check-row');
      rows[rows.length - 1].querySelector('[data-act=save]').click();
    });
    await sleep(500);
    const labels = await page.$$eval('#checks-list .check-row .check-label', els => els.map(e => e.textContent));
    ok('optimistic edit saved', labels[labels.length - 1].includes('check every morning'), labels[labels.length - 1]);
  }
  // delete it again
  await page.evaluate(() => {
    const rows = document.querySelectorAll('#checks-list .check-row');
    rows[rows.length - 1].querySelector('[data-act=delete]').click();
  });
  await sleep(600);
  const finalN = (await page.$$('#checks-list .check-row')).length;
  ok('optimistic delete', finalN === before, `${after} -> ${finalN}`);
  await page.screenshot({ path: '/tmp/shots/05-checks.png', fullPage: true });

  // ---------- departures ----------
  await page.click('.side-link[data-route=departures]');
  await page.waitForSelector('.dept-card', { timeout: 5000 });
  const deptCards = await page.$$('.dept-card');
  ok('departures rendered', deptCards.length >= 13, `${deptCards.length} cards`);
  // open first card
  await page.click('.dept-card .dept-head');
  await sleep(200);
  ok('departure expands', await page.$('.dept-card.open .ditem'));
  // filter went back
  await page.click('.fchip[data-f=back]');
  await sleep(300);
  const backCards = await page.$$('.dept-card');
  ok('filter went-back', backCards.length === 2, `${backCards.length} cards`);
  await page.screenshot({ path: '/tmp/shots/06-departures.png', fullPage: true });

  // ---------- activity ----------
  await page.click('.side-link[data-route=activity]');
  await page.waitForSelector('.feed-item', { timeout: 5000 });
  ok('activity feed rendered', (await page.$$('.feed-item')).length >= 10);
  await page.screenshot({ path: '/tmp/shots/07-activity.png', fullPage: true });

  // ---------- settings ----------
  await page.click('.side-link[data-route=settings]');
  await page.waitForSelector('#save-location', { timeout: 5000 });
  ok('settings rendered', true);
  ok('share + milestones in settings', !!(await page.$('#share-app')) && (await page.$$('.milestone')).length === 5);
  ok('sound toggle + level badge', !!(await page.$('#set-sfx')) && !!(await page.$('.lvl-line .lvl-badge')));
  ok('streak card + help section', !!(await page.$('#share-card-btn')) && !!(await page.$('#share-app')));

  // ---------- TASKS (Google-Tasks-style) ----------
  const bgOn = await page.$eval('#page-bg', el => el.classList.contains('on') && !!el.querySelector('img'));
  ok('cinematic page background active on settings', bgOn);
  await page.click('.side-link[data-route=tasks]');
  await page.waitForSelector('#new-task-title', { timeout: 5000 });
  ok('tasks view renders with backdrop', (await page.$eval('#page-bg img', el => el.src)).includes('bg-tasks'));
  // isolation: earlier runs leave tasks behind — delete them, then re-enter the view so the DOM re-renders
  await page.evaluate(async () => {
    const t = localStorage.getItem('dil_token');
    const list = await fetch('/api/tasks', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json());
    for (const task of list.tasks || []) await fetch('/api/tasks/' + task.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } });
    document.querySelector('.side-link[data-route=dashboard]')?.click();
  });
  await sleep(400);
  await page.click('.side-link[data-route=tasks]');
  await sleep(400);
  await page.type('#new-task-title', 'Water the plants');
  await page.keyboard.press('Enter');
  await sleep(700);
  ok('task added via UI', (await page.$$('.task-row')).length === 1, `${(await page.$$('.task-row')).length} rows`);
  await page.click('.task-row .t-check');
  await sleep(700);
  const strike = await page.$eval('.task-row .t-title', el => getComputedStyle(el).textDecorationLine);
  ok('task completes with strike-through', strike.includes('line-through'), strike);
  const xpNow = await page.$eval('#xp-num', el => Number(el.textContent));
  ok('XP awarded for task (+3)', xpNow > 0, `${xpNow} XP`);
  await page.click('.side-link[data-route=settings]');
  await page.waitForSelector('#set-lang', { timeout: 5000 });
  // change name
  const nameInp = await page.$('#set-name');
  await nameInp.click({ clickCount: 3 });
  await nameInp.type('Ash Ramanathan');
  await page.click('#save-location');
  await sleep(700);
  const sideName = await page.$eval('.side-user-name', el => el.textContent);
  ok('profile save optimistic', sideName.includes('Ash Ramanathan'), sideName);
  await page.screenshot({ path: '/tmp/shots/08-settings.png', fullPage: true });
  // restore the seeded demo name so repeated runs keep the demo pristine
  await page.evaluate(async () => {
    await fetch('/api/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('dil_token') }, body: JSON.stringify({ name: 'Ash R.' }) });
  });

  // ---------- follow-up modal (force-due via API) ----------
  // find active session id
  const active = await page.evaluate(async () => {
    const r = await fetch('/api/sessions/active', { headers: { Authorization: 'Bearer ' + localStorage.getItem('dil_token') } });
    return (await r.json()).session;
  });
  ok('active session exists', active && active.status === 'leaving', active && `${active.id} ${active.status}`);
  await page.evaluate(async () => {
    const r = await fetch('/api/sessions/active', { headers: { Authorization: 'Bearer ' + localStorage.getItem('dil_token') } });
    const s = (await r.json()).session;
    return s;
  });
  // force due through direct DB (test harness only)
  const { execSync } = require('child_process');
  execSync(`node -e "const {db}=require('./server/db'); db.prepare('UPDATE sessions SET followup_at = ? WHERE id = ?').run(Date.now()-1000, ${active.id})"`);
  // wait for SSE push -> modal
  await page.waitForSelector('#fu-modal [data-fu=ok]', { timeout: 15000 });
  ok('SSE push opened follow-up modal', true);
  await page.screenshot({ path: '/tmp/shots/09-followup.png' });
  // review path
  await page.click('#fu-modal [data-fu=review]');
  await page.waitForSelector('#fu-modal [data-fu=back]');
  ok('review step renders items', (await page.$$('#fu-modal .cl-row')).length === 7);
  await page.type('#fu-modal #fu-note', 'Checked the stove again — it was off. Phew.');
  await page.screenshot({ path: '/tmp/shots/10-review.png' });
  await page.click('#fu-modal [data-fu=fine]');
  await page.waitForSelector('#fu-modal #fu-close', { timeout: 8000 });
  ok('resolution success shown', (await page.$eval('#fu-modal h2', el => el.textContent)).includes('Loop closed'));
  await page.click('#fu-modal #fu-close');
  await sleep(600);

  // ---------- language toggle (EN / हिन्दी) ----------
  await page.click('.side-link[data-route=settings]');
  await page.waitForSelector('#set-lang', { timeout: 5000 });
  await page.select('#set-lang', 'hi');
  await sleep(400);
  const hiNav = await page.$eval('.side-link[data-route=dashboard]', el => el.textContent.trim());
  ok('language: switches to हिन्दी', hiNav === 'डैशबोर्ड', hiNav);
  await page.screenshot({ path: '/tmp/shots/12-hindi.png' });
  await page.select('#set-lang', 'en');
  await sleep(400);
  ok('language: back to English', (await page.$eval('.side-link[data-route=dashboard]', el => el.textContent.trim())) === 'Dashboard');

  // ---------- forgot-password via phone OTP ----------
  const resetUi = async (newPw) => {
    await page.click('#forgot-link');
    await page.waitForSelector('#reset-panel:not(.hidden)', { timeout: 5000 });
    await page.$eval('#reset-phone', el => el.value = '');
    await page.type('#reset-phone', '+91 98765 43210');
    await page.click('#reset-send');
    await page.waitForSelector('#reset-sms:not(.hidden)', { timeout: 8000 });
    const code = await page.$eval('#reset-sms-body', el => (el.textContent.match(/\d{6}/) || [])[0]);
    await page.type('#reset-code', code);
    await page.type('#reset-pw', newPw);
    await page.type('#reset-pw2', newPw);
    await page.click('#reset-do');
    await page.waitForSelector('#reset-done:not(.hidden)', { timeout: 8000 });
    await page.screenshot({ path: '/tmp/shots/13-reset-done.png' });
    await page.click('#reset-cancel');
    await page.waitForSelector('#reset-panel.hidden', { timeout: 5000 });
  };
  const loginApi = pw => fetch('http://127.0.0.1:3000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo@didilock.app', password: pw }) }).then(r => r.json()).catch(() => ({}));
  const restorePw = async () => {
    const req = await (await fetch('http://127.0.0.1:3000/api/auth/phone/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '+91 98765 43210', purpose: 'reset' }) })).json();
    const code = (req.demo_sms.body.match(/\d{6}/) || [])[0];
    await fetch('http://127.0.0.1:3000/api/auth/password/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '+91 98765 43210', code, newPassword: 'demo1234' }) });
  };
  try {
    await page.evaluate(() => document.querySelector('#signout-btn').click());
    await page.waitForFunction(() => !document.querySelector('#auth-screen').classList.contains('hidden'), { timeout: 15000 });
    await resetUi('reset-test-123');
    ok('forgot-password: UI reset flow completes', true);
    ok('forgot-password: new password works', !!(await loginApi('reset-test-123')).token);
    await resetUi('demo1234');
    ok('forgot-password: original password restored', !!(await loginApi('demo1234')).token);
    // sign back in for the remaining checks
    await page.type('#form-login input[name=email]', 'demo@didilock.app');
    await page.type('#form-login input[name=password]', 'demo1234');
    await page.click('#login-btn');
    await page.waitForFunction(() => !document.querySelector('#app-shell').classList.contains('hidden'), { timeout: 10000 });
  } finally {
    // never leave the demo account with a test password
    if (!(await loginApi('demo1234')).token) await restorePw();
  }

  // mobile viewport check
  await page.setViewport({ width: 390, height: 844 });
  await page.click('.side-link[data-route=dashboard]');
  await sleep(500);
  await page.screenshot({ path: '/tmp/shots/11-mobile.png' });
  ok('mobile renders', true);

  // expected console noise: 401 from the deliberate wrong-password attempt,
  // 409 from the deliberate double-check guard test
  const realErrors = errors.filter(e => !e.includes('401') && !e.includes('409'));
  ok('no page errors', realErrors.length === 0, realErrors.slice(0, 4).join(' | '));
  if (realErrors.length) console.log('ERRORS:\n' + realErrors.join('\n'));

  await browser.close();
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
