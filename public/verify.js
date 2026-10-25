const token = location.hash.slice(1);
const msg = document.getElementById('msg');
if (!token) { msg.textContent = 'This link looks incomplete.'; }
else fetch('/api/verify-email/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
  .then(r => r.json().then(d => ({ ok: r.ok, d })))
  .then(({ ok, d }) => { msg.textContent = ok ? '✅ Verified! Your email is confirmed — Google sign-in can now link to this account.' : (d.error || 'Verification failed.'); })
  .catch(() => { msg.textContent = 'Network error — try the link again.'; });
