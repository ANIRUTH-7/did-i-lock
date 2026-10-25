/* password-reset page — token arrives in the URL fragment (never a query, never logged) */
const token = location.hash.slice(1);
const msg = document.getElementById('msg');
const form = document.getElementById('form');
const btn = document.getElementById('go');
if (!token) { msg.textContent = 'This link looks incomplete — request a fresh one from the app.'; form.remove(); }
btn.onclick = async () => {
  const pw = document.getElementById('pw').value;
  const pw2 = document.getElementById('pw2').value;
  msg.textContent = '';
  if (pw.length < 8) { msg.textContent = 'Password must be at least 8 characters.'; return; }
  if (pw !== pw2) { msg.textContent = 'Passwords do not match.'; return; }
  btn.disabled = true;
  try {
    const r = await fetch('/api/auth/email/reset/confirm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: pw }),
    });
    const d = await r.json();
    if (r.ok) {
      form.remove();
      msg.innerHTML = '✅ Password updated! <a href="/">Sign in with your new password</a>.';
      location.hash = '';
    } else { msg.textContent = d.error || 'That link did not work.'; btn.disabled = false; }
  } catch { msg.textContent = 'Network error — try again.'; btn.disabled = false; }
};
