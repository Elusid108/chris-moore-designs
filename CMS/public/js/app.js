// Boot, hash routing (#/products/<id>, #/products/new, #/settings, #/tasks),
// delegated data-action handling, dirty guard, save/publish/delete/preview.
import { api } from './api.js';
import { state, byId, setDirty } from './state.js';
import { renderRail } from './rail.js';
import { switchTab } from './form.js';
import { toast } from './ui/toast.js';
import { confirmAction, bindConfirm } from './ui/confirm.js';
import { bindCropModal } from './crop-modal.js';
import { openPublishModal, bindPublishModal } from './publish-modal.js';
import { openTasks } from './tasks.js';
import * as productEditor from './editors/product.js';
import * as simpleEditor from './editors/simple.js';
import * as settingsEditor from './editors/settings.js';
import { uploadQueue } from './upload-queue.js';

window.cmsToast = toast;
const main = () => document.getElementById('editor');

async function refresh() {
  const [collections, settings, status] = await Promise.all([api.get('/collections'), api.get('/settings'), api.get('/status').catch(() => null)]);
  state.collections = collections; state.settings = settings; state.status = status;
  renderRail();
  const s = document.getElementById('status-line');
  if (s && status) s.innerHTML = `v${status.version} · <span class="${status.git.changes.length ? 'text-amber-400' : 'text-zinc-500'}">${status.git.changes.length} unpublished change(s)</span>${status.git.behind ? ` · <span class="text-amber-400">${status.git.behind} behind origin</span>` : ''} · Shopify: ${status.shopify.configured ? (status.shopify.ok ? '<span class="text-emerald-400">connected</span>' : '<span class="text-red-400">error</span>') : '<span class="text-zinc-500">not set up</span>'}`;
  const pv = document.getElementById('preview-btn'); if (pv && status) pv.classList.toggle('text-emerald-400', status.preview?.running);
}

function route() {
  const [type, id] = location.hash.replace(/^#\/?/, '').split('/');
  const el = main();
  if (!type) { el.innerHTML = welcome(); state.current = null; state.editor = null; renderRail(); return; }
  state.current = { type, id };
  setDirty(false);
  if (type === 'settings') state.editor = settingsEditor.open(el, state.settings);
  else if (type === 'tasks') { state.editor = null; openTasks(el); }
  else if (type === 'products') state.editor = productEditor.open(el, id === 'new' ? null : byId('products', id));
  else if (['families', 'firmware', 'software', 'services'].includes(type)) state.editor = simpleEditor.open(el, type, id === 'new' ? null : byId(type, id));
  else { el.innerHTML = welcome(); state.editor = null; }
  renderRail();
  window.scrollTo(0, 0);
}
const welcome = () => `<div class="max-w-xl"><p class="font-mono text-[11px] uppercase tracking-widest text-cyan-400">chrismooredesigns.com</p><h2 class="text-2xl font-bold mt-1">Store CMS</h2><p class="text-zinc-400 mt-3 text-sm leading-relaxed">Pick something in the left rail, or add a product. New items start as local drafts (amber dot) and are not in git until you click <em>Publish item</em>. <em>Publish</em> in the header commits everything published and pushes it; GitHub Actions rebuilds the site.</p><ol class="mt-4 text-sm text-zinc-400 list-decimal pl-5 space-y-1"><li>Add or edit a product: title, family, variants with prices, photos, specs.</li><li>Save, then Preview (runs the site locally on port 4321).</li><li>Publish item → Publish. Products sync to Shopify on the way if the store is connected.</li></ol></div>`;

async function save({ silent = false } = {}) {
  const ed = state.editor; if (!ed) return null;
  try {
    if (ed.type === 'settings') { const r = await api.post('/settings', ed.collect()); state.settings = r.settings; if (!silent) toast('Settings saved'); setDirty(false); return r.settings; }
    const r = await api.post(`/${ed.type}`, ed.collect());
    setDirty(false); if (!silent) toast(r.item.published ? 'Saved' : 'Saved as local draft');
    if (r.trash?.moved) toast(`${r.trash.moved} unused file(s) moved to CMS/.trash`, 'warn');
    await refresh();
    if (!ed.id) location.hash = `#/${ed.type}/${r.item.id}`; else route();
    return r.item;
  } catch (e) { toast(e.message, 'err'); return null; }
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]'); if (!btn) return;
  const a = btn.dataset.action; const ed = state.editor;
  if (a === 'tab') return switchTab(main(), btn.dataset.tab);
  if (a === 'save') return save();
  if (a === 'publish-item' && ed?.id) { const saved = await save({ silent: true }); if (!saved) return; try { await api.post(`/${ed.type}/${ed.id}/publish`); toast('Item published (will be committed on Publish)'); await refresh(); route(); } catch (err) { toast(err.message, 'err'); } return; }
  if (a === 'unpublish-item' && ed?.id) { if (!(await confirmAction({ title: 'Unpublish item?', text: 'It moves back to a local draft and disappears from the site on the next Publish.', ok: 'Unpublish' }))) return; try { await api.post(`/${ed.type}/${ed.id}/unpublish`); await refresh(); route(); } catch (err) { toast(err.message, 'err'); } return; }
  if (a === 'delete-item' && ed?.id) { if (!(await confirmAction({ title: 'Delete this item?', text: 'Its unused media moves to CMS/.trash. If it was on Shopify, it is archived there on the next sync.', ok: 'Delete', danger: true }))) return; try { await api.del(`/${ed.type}/${ed.id}`); toast('Deleted'); await refresh(); location.hash = '#/'; } catch (err) { toast(err.message, 'err'); } return; }
  if (a === 'preview-item' || a === 'preview') { try { const st = await api.post('/preview/start'); const path = a === 'preview-item' && ed ? ed.previewPath : '/'; window.open(st.url.replace(/\/$/, '') + path, 'cmd-preview'); if (!st.running) toast('Starting the site preview; give it a few seconds'); } catch (err) { toast(err.message, 'err'); } return; }
  if (a === 'publish') return openPublishModal();
  if (a === 'refresh') { await refresh(); route(); return; }
  if (a === 'cleanup') { if (!(await confirmAction({ title: 'Move unused media to trash?', text: 'Files under public/media that nothing references are moved to CMS/.trash.', ok: 'Clean up' }))) return; try { const r = await api.post('/media/cleanup'); toast(`${r.moved} file(s) moved`); } catch (err) { toast(err.message, 'err'); } return; }
  if (ed?.action) ed.action(a, btn);
});

// dirty tracking + navigation guard
document.body.addEventListener('input', (e) => { if (e.target.closest('#editor') && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) && !e.target.closest('[data-task]')) setDirty(true); });
document.body.addEventListener('change', (e) => { if (e.target.closest('#editor') && !e.target.closest('[data-task]')) setDirty(true); });
window.addEventListener('beforeunload', (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });
let lastHash = location.hash;
window.addEventListener('hashchange', async () => {
  if (state.dirty && location.hash !== lastHash) {
    const target = location.hash; history.replaceState(null, '', lastHash);
    const ok = await confirmAction({ title: 'Unsaved changes', text: 'Discard your changes and leave this item?', ok: 'Discard' });
    if (!ok) return;
    setDirty(false); location.hash = target; return;
  }
  lastHash = location.hash; route();
});
document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); } });

(async () => {
  bindConfirm(); bindCropModal(); bindPublishModal();
  try { await refresh(); } catch (e) { toast(`Could not reach the CMS server: ${e.message}`, 'err'); }
  route();
})();
