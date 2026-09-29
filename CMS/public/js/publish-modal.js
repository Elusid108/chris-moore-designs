import { api } from './api.js';
import { esc } from './form.js';
import { toast } from './ui/toast.js';
const STEPS = [['validate', 'Validate content'], ['shopify', 'Sync to Shopify'], ['build', 'Verify build'], ['git', 'Commit & push'], ['deploy', 'GitHub Pages deploy']];
const icon = { pending: 'ph-circle text-zinc-600', running: 'ph-spinner animate-spin text-cyan-400', done: 'ph-check-circle text-emerald-400', error: 'ph-x-circle text-red-400', warn: 'ph-warning text-amber-400', skipped: 'ph-minus-circle text-zinc-500' };
let es = null;
function row(step) { return document.querySelector(`[data-step="${step}"]`); }
function setStep(step, stateName, detail) { const r = row(step); if (!r) return; r.querySelector('i').className = `ph ${icon[stateName] || icon.pending}`; const d = r.querySelector('[data-detail]'); d.textContent = detail || ''; d.classList.toggle('whitespace-pre-wrap', /\n/.test(detail || '')); }
export function openPublishModal() {
  const m = document.getElementById('publish-modal');
  m.querySelector('[data-steps]').innerHTML = STEPS.map(([id, label]) => `<div class="flex gap-3 items-start" data-step="${id}"><i class="ph ph-circle text-zinc-600 mt-0.5"></i><div class="min-w-0"><div class="text-sm">${label}</div><div class="text-xs text-zinc-500 font-mono break-words" data-detail></div></div></div>`).join('');
  m.querySelector('[data-publish-result]').innerHTML = '';
  m.querySelector('[data-publish-go]').disabled = false;
  m.classList.remove('hidden');
  api.get('/publish/status').then((g) => { m.querySelector('[data-publish-summary]').textContent = g.isRepo ? `${g.changes.length} changed file(s) in content/ and media on branch ${g.branch}${g.other.length ? ` · ${g.other.length} other change(s) will be left alone` : ''}` : 'Not a git repository'; }).catch((e) => toast(e.message, 'err'));
}
export function bindPublishModal() {
  const m = document.getElementById('publish-modal');
  m.querySelectorAll('[data-publish-close]').forEach((b) => b.addEventListener('click', () => { m.classList.add('hidden'); es?.close(); es = null; }));
  m.querySelector('[data-publish-go]').addEventListener('click', async (e) => {
    const dryRun = m.querySelector('[name=dryRun]').checked, verifyBuild = m.querySelector('[name=verifyBuild]').checked, syncShopify = m.querySelector('[name=syncShopify]').checked, message = m.querySelector('[name=message]').value.trim();
    e.target.disabled = true;
    STEPS.forEach(([id]) => setStep(id, 'pending', ''));
    es = new EventSource('/api/publish/events');
    es.onmessage = (ev) => { try { const d = JSON.parse(ev.data); if (d.step && d.step !== 'done') setStep(d.step, d.state, d.detail); } catch { /* ignore */ } };
    try {
      const r = await api.post('/publish', { dryRun, verifyBuild, syncShopify, message });
      const out = m.querySelector('[data-publish-result]');
      if (r.dryRun) out.innerHTML = `<p class="text-sm text-amber-400">Dry run. Would commit ${r.staged.length} file(s):</p><ul class="font-mono text-xs text-zinc-400 max-h-40 overflow-auto">${r.staged.map((s) => `<li>${esc(s.code)} ${esc(s.file)}</li>`).join('')}</ul>${r.pushDryRun ? `<pre class="text-[11px] text-zinc-500 mt-2 whitespace-pre-wrap">${esc(r.pushDryRun)}</pre>` : ''}`;
      else if (r.pushed) { out.innerHTML = `<p class="text-sm text-emerald-400">Pushed ${esc(r.sha.slice(0, 7))}. <a class="underline" target="_blank" rel="noopener" href="${esc(r.commitUrl)}">Commit</a> · <a class="underline" target="_blank" rel="noopener" href="${esc(r.actionsUrl)}">Actions</a></p>`; setStep('deploy', 'running', 'Waiting for GitHub Actions'); poll(r); }
      else out.innerHTML = '<p class="text-sm text-zinc-400">Nothing to publish.</p>';
      if (r.warnings?.length) out.insertAdjacentHTML('beforeend', `<p class="text-xs text-amber-400 mt-2">Warnings:<br>${r.warnings.map(esc).join('<br>')}</p>`);
    } catch (err) { m.querySelector('[data-publish-result]').innerHTML = `<pre class="text-xs text-red-400 whitespace-pre-wrap">${esc(err.message)}</pre>`; }
    finally { es?.close(); es = null; e.target.disabled = false; }
  });
}
async function poll(r) {
  for (let i = 0; i < 60; i++) {
    await new Promise((res) => setTimeout(res, 10000));
    try {
      const run = await api.get(`/publish/run?owner=${encodeURIComponent(r.owner)}&repo=${encodeURIComponent(r.repo)}&sha=${r.sha}`);
      if (run?.status === 'completed') { setStep('deploy', run.conclusion === 'success' ? 'done' : 'error', `${run.conclusion} · ${run.url}`); if (run.conclusion === 'success') toast('Site deployed'); return; }
      setStep('deploy', 'running', `${run?.status || 'pending'}${run?.url ? ` · ${run.url}` : ''}`);
    } catch { /* keep polling */ }
  }
}
