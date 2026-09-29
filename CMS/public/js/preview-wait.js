// Opened by the Preview buttons. Starts a preview build, waits for it, then
// replaces itself with the locally served site at ?path=.
(() => {
  const $ = (id) => document.getElementById(id);
  const raw = new URLSearchParams(location.search).get('path') || '/';
  const target = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const call = async (path, method = 'GET') => { const r = await fetch(`/api/preview/${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'POST' ? '{}' : undefined }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); };

  function fail(message) {
    $('title').textContent = 'The preview build failed';
    $('text').textContent = 'Nothing was published. Fix the problem below, then build again.';
    $('log').textContent = message; $('log').style.display = 'block';
    $('retry').style.display = 'inline-block';
  }

  async function run() {
    $('title').innerHTML = '<span class="spin"></span>Building the site';
    $('log').style.display = 'none'; $('retry').style.display = 'none';
    try {
      let st = await call('start', 'POST');
      while (st.status === 'building') { await sleep(700); st = await call('status'); }
      if (st.status !== 'ready') return fail(st.error || 'The build did not finish.');
      location.replace(st.url.replace(/\/$/, '') + target);
    } catch (err) { fail(`Could not reach the CMS: ${err.message}`); }
  }

  $('retry').addEventListener('click', run);
  run();
})();
