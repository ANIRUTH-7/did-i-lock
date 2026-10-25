  (async function () {
    const id = decodeURIComponent(location.hash.slice(1));
    const fail = m => { document.getElementById('spin').style.display = 'none';
      const el = document.getElementById('msg'); el.className = 'err'; el.textContent = m; };
    try {
      if (!id) throw new Error('Missing handoff');
      const r = await fetch('/api/auth/google/handoff', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      });
      const d = await r.json();
      if (!r.ok || !d.token) throw new Error(d.error || 'Handoff failed');
      localStorage.setItem('dil_token', d.token);
      location.replace('/#/dashboard');
    } catch (e) { fail('Could not finish sign-in: ' + e.message + ' — please try again from the app.'); }
  })();
