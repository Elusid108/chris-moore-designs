import { api } from '../api.js';
import { state, byId, setDirty } from '../state.js';
import { fields, readFields, section, btn, tabs, esc } from '../form.js';
import { makeEditor } from '../quill-setup.js';
import * as specs from '../specs-builder.js';
import { imageRow, galleryRow, fileRow, readRows, bindRowList, bindDropZone, dropZoneHtml } from '../media-rows.js';
import { toast } from '../ui/toast.js';

const OVERVIEW = [
  { key: 'title', label: 'Title', placeholder: 'PXD-8 pixel decoder' },
  { key: 'sku', label: 'SKU (base)', mono: true, placeholder: 'PXD-8' },
  { key: 'family', label: 'Family', type: 'select', options: [] },
  { key: 'slug', label: 'URL slug', mono: true, help: 'Leave blank to derive from the title. Renaming keeps a redirect.' },
  { key: 'order', label: 'Order', type: 'number', default: 100 },
  { key: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived (hidden, kept on Shopify as archived)' }] },
];
const money = (n) => (n == null || n === '' ? '' : Number(n).toFixed(2));

export function open(root, product) {
  const p = product || { title: '', sku: '', family: state.collections.families[0]?.id || '', optionName: 'Outputs', variants: [{ title: '', sku: '', price: '' }], images: [], gallery: [], files: [], firmware: [], software: [], related: [], badges: {}, specsData: [], published: false };
  OVERVIEW.find((f) => f.key === 'family').options = state.collections.families.map((f) => ({ value: f.id, label: f.name }));
  const mediaFields = () => ({ family: byId('families', root.querySelector('[name=family]').value)?.slug || 'misc', product: root.querySelector('[name=slug]').value || root.querySelector('[name=title]').value || 'product', title: root.querySelector('[name=title]').value });
  const checkList = (name, items, selected, labelFn) => `<div class="grid sm:grid-cols-2 gap-1">${items.map((i) => `<label class="flex items-center gap-2 text-sm py-1"><input type="checkbox" class="accent-cyan-400" data-multi="${name}" value="${i.id}" ${selected.includes(i.id) ? 'checked' : ''}> ${esc(labelFn(i))}</label>`).join('') || '<p class="text-sm text-zinc-500">Nothing yet.</p>'}</div>`;

  root.innerHTML = `
    <div class="flex items-start justify-between gap-4 mb-4">
      <div><p class="font-mono text-[11px] uppercase tracking-widest text-cyan-400">Product ${p.published ? '<span class="text-emerald-400">· published</span>' : '<span class="text-amber-400">· draft (local only)</span>'}</p><h2 class="text-2xl font-bold" data-editor-title>${esc(p.title || 'New product')}</h2></div>
      <div class="flex gap-2 shrink-0">${p.id ? btn('<i class="ph ph-eye"></i> Preview', 'preview-item') : ''}${p.id ? (p.published ? btn('Unpublish', 'unpublish-item') : btn('Publish item', 'publish-item', 'primary')) : ''}${p.id ? btn('<i class="ph ph-trash"></i>', 'delete-item', 'danger') : ''}${btn('<i class="ph ph-floppy-disk"></i> Save', 'save', 'primary')}</div>
    </div>
    ${tabs([{ id: 'overview', label: 'Overview' }, { id: 'variants', label: 'Variants & pricing' }, { id: 'copy', label: 'Copy' }, { id: 'media', label: 'Media' }, { id: 'specs', label: 'Specs' }, { id: 'files', label: 'Downloads' }, { id: 'links', label: 'Links' }, { id: 'shopify', label: 'Shopify' }], 'overview')}
    <div data-tab-panel="overview" class="space-y-5">${section('Basics', fields(OVERVIEW, p))}${section('Badges', `<div class="flex gap-6"><label class="flex items-center gap-2 text-sm"><input type="checkbox" name="bestSeller" class="accent-cyan-400" ${p.badges?.bestSeller ? 'checked' : ''}> Best seller</label><label class="flex items-center gap-2 text-sm"><input type="checkbox" name="bundle" class="accent-cyan-400" ${p.badges?.bundle ? 'checked' : ''}> Bundle &amp; save</label><label class="flex items-center gap-2 text-sm"><input type="checkbox" name="featured" class="accent-cyan-400" ${p.featured ? 'checked' : ''}> Featured</label></div>`)}</div>
    <div data-tab-panel="variants" class="hidden space-y-5">${section('Option', `<div class="grid sm:grid-cols-2 gap-4"><div><label class="block text-[11px] font-mono uppercase tracking-wide text-zinc-500 mb-1">Option name</label><input name="optionName" class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm" value="${esc(p.optionName || 'Outputs')}" placeholder="Outputs"><p class="text-[11px] text-zinc-500 mt-1">Shown above the variant pills. Use "Title" for a single-variant product.</p></div></div>`)}
      ${section('Variants', `<div class="space-y-2" data-variants>${(p.variants || []).map(variantRow).join('')}</div>`, btn('<i class="ph ph-plus"></i> Variant', 'variant-add'))}</div>
    <div data-tab-panel="copy" class="hidden space-y-5">${section('Summary', '<p class="text-[11px] text-zinc-500">One or two sentences under the title, and on cards.</p><div class="quill-dark" data-quill="summary"></div>', btn('<i class="ph ph-sparkle"></i> Draft with AI', 'ai-summary'))}${section('Description', '<p class="text-[11px] text-zinc-500">The "About" section on the product page.</p><div class="quill-dark" data-quill="description"></div><label class="block mt-3 text-[11px] font-mono uppercase tracking-wide text-zinc-500">Notes for the AI (optional)</label><textarea data-ai-notes rows="2" class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm" placeholder="Anything the specs don\'t say: what it is for, what is in the box, quirks…"></textarea>', btn('<i class="ph ph-sparkle"></i> Draft with AI', 'ai-description'))}</div>
    <div data-tab-panel="media" class="hidden space-y-5">${section('Product images', `<p class="text-[11px] text-zinc-500">First image is the hero and the card image. Uploads are converted to WebP at 2000 / 1200 / 800 px. These are what sync to Shopify.</p><div class="space-y-2" data-list="images">${(p.images || []).map(() => '').join('')}</div>${dropZoneHtml('Drop photos here or click to choose (JPG, PNG, HEIC)', 'image/*,.heic,.heif')}`)}
      ${section('Gallery', `<p class="text-[11px] text-zinc-500">Extra photos and videos shown below the fold. Videos are re-encoded to H.264, 720p, no audio.</p><div class="space-y-2" data-list="gallery"></div>${dropZoneHtml('Drop gallery photos or videos', 'image/*,video/*,.heic')}`)}</div>
    <div data-tab-panel="specs" class="hidden">${section('Specifications', '<div class="space-y-3" data-specs></div>')}</div>
    <div data-tab-panel="files" class="hidden">${section('Downloads', `<p class="text-[11px] text-zinc-500">Schematics, STEP files, manuals. Stored under /media/…/files/. SHA-256 is recorded.</p><div class="space-y-2" data-list="files"></div>${dropZoneHtml('Drop files to offer for download', '*/*')}`)}</div>
    <div data-tab-panel="links" class="hidden space-y-5">${section('Firmware for this product', checkList('firmware', state.collections.firmware, p.firmware || [], (f) => `${f.name} v${f.version}`))}${section('Software', checkList('software', state.collections.software, p.software || [], (s) => s.name))}${section('Related products', checkList('related', state.collections.products.filter((x) => x.id !== p.id), p.related || [], (x) => x.title))}</div>
    <div data-tab-panel="shopify" class="hidden space-y-5">${section('Shopify', `<dl class="grid grid-cols-[8rem_1fr] gap-y-2 text-sm"><dt class="text-zinc-500">Product id</dt><dd class="font-mono text-xs break-all">${esc(p.shopify?.productId || 'not synced yet')}</dd><dt class="text-zinc-500">Handle</dt><dd class="font-mono text-xs">${esc(p.slug || '')}</dd><dt class="text-zinc-500">Last synced</dt><dd class="font-mono text-xs">${esc(p.shopify?.lastSyncedAt || 'never')}</dd><dt class="text-zinc-500">Last error</dt><dd class="text-xs text-red-400">${esc(p.shopify?.lastError || '')}</dd></dl><div class="mt-4 flex gap-2">${btn('<i class="ph ph-arrows-clockwise"></i> Sync to Shopify', 'shopify-sync', 'primary', p.id && p.published ? '' : 'disabled title="Save and publish the item first"')}${btn('Force re-sync', 'shopify-sync-force', 'ghost', p.id && p.published ? '' : 'disabled')}</div><p class="text-[11px] text-zinc-500 mt-2" data-shopify-note>Sync happens automatically on Publish when the store is connected.</p>`)}</div>`;

  const editors = { summary: makeEditor(root.querySelector('[data-quill="summary"]'), 'short', { placeholder: 'Eight fused, level-shifted outputs…', onChange: () => setDirty(true) }), description: makeEditor(root.querySelector('[data-quill="description"]'), 'long', { placeholder: 'What it is, what it does, what is in the box…', onChange: () => setDirty(true) }) };
  editors.summary.html = p.summary || ''; editors.description.html = p.description || '';
  const lists = { images: root.querySelector('[data-list="images"]'), gallery: root.querySelector('[data-list="gallery"]'), files: root.querySelector('[data-list="files"]') };
  (p.images || []).forEach((i) => lists.images.appendChild(imageRow(i)));
  (p.gallery || []).forEach((g) => lists.gallery.appendChild(galleryRow(g)));
  (p.files || []).forEach((f) => lists.files.appendChild(fileRow(f)));
  Object.values(lists).forEach(bindRowList);
  const zones = root.querySelectorAll('[data-dropzone]');
  bindDropZone(zones[0], { list: lists.images, kind: 'image', fields: mediaFields });
  bindDropZone(zones[1], { list: lists.gallery, kind: 'gallery', fields: mediaFields });
  bindDropZone(zones[2], { list: lists.files, kind: 'file', fields: mediaFields });
  const specsRoot = root.querySelector('[data-specs]'); specs.render(specsRoot, p.specsData || []); specs.bind(specsRoot);
  root.querySelector('[data-variants]').addEventListener('click', (e) => { if (e.target.closest('[data-action="variant-remove"]')) { e.target.closest('[data-variant]').remove(); setDirty(true); } });
  root.querySelector('[name=title]').addEventListener('input', (e) => { root.querySelector('[data-editor-title]').textContent = e.target.value || 'New product'; });

  return {
    type: 'products', id: p.id || null,
    collect() {
      const o = readFields(root, OVERVIEW);
      const optionName = root.querySelector('[name=optionName]').value.trim() || 'Title';
      const variants = [...root.querySelectorAll('[data-variant]')].map((r) => ({ id: r.dataset.variant || undefined, title: r.querySelector('[name=v-title]').value.trim() || 'Default Title', sku: r.querySelector('[name=v-sku]').value.trim(), price: r.querySelector('[name=v-price]').value, compareAt: r.querySelector('[name=v-compare]').value || null, inventory: r.querySelector('[name=v-inventory]').value === '' ? null : Number(r.querySelector('[name=v-inventory]').value), options: { [optionName]: r.querySelector('[name=v-title]').value.trim() || 'Default Title' }, shopifyVariantId: r.dataset.shopifyVariantId || null }));
      const multi = (name) => [...root.querySelectorAll(`[data-multi="${name}"]:checked`)].map((c) => c.value);
      return { ...p, ...o, optionName, variants, summary: editors.summary.html, description: editors.description.html, images: readRows(lists.images), gallery: readRows(lists.gallery), files: readRows(lists.files), specsData: specs.read(specsRoot), firmware: multi('firmware'), software: multi('software'), related: multi('related'), badges: { bestSeller: root.querySelector('[name=bestSeller]').checked, bundle: root.querySelector('[name=bundle]').checked }, featured: root.querySelector('[name=featured]').checked };
    },
    action(a) {
      if (a === 'variant-add') { root.querySelector('[data-variants]').insertAdjacentHTML('beforeend', variantRow({})); setDirty(true); }
      if (a === 'ai-summary' || a === 'ai-description') {
        const apiKey = localStorage.getItem('cms.geminiKey'), modelId = localStorage.getItem('cms.geminiModel') || 'gemini-2.5-flash';
        if (!apiKey) return toast('Add a Gemini API key under Store settings → AI first', 'warn');
        const task = a === 'ai-summary' ? 'summary' : 'description';
        const product = { ...this.collect(), notes: root.querySelector('[data-ai-notes]')?.value || '' };
        toast('Asking Gemini…');
        return api.post('/gemini', { task, apiKey, modelId, product }).then((r) => { if (task === 'summary') editors.summary.html = `<p>${esc(r.text)}</p>`; else editors.description.html = r.html; setDirty(true); toast('Draft inserted; edit as needed'); }).catch((e) => toast(e.message, 'err'));
      }
      if (a === 'shopify-sync' || a === 'shopify-sync-force') return api.post(`/shopify/sync/${p.id}`, { force: a.endsWith('force') }).then((r) => { toast(r.skipped ? 'Already in sync' : 'Synced to Shopify'); root.querySelector('[data-shopify-note]').textContent = JSON.stringify(r); }).catch((e) => toast(e.message, 'err'));
    },
    previewPath: p.slug ? `/products/${p.slug}/` : '/',
  };
}
const variantRow = (v) => `<div class="grid grid-cols-2 sm:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center rounded-lg border border-zinc-800 bg-zinc-950 p-2" data-variant="${esc(v.id || '')}" data-shopify-variant-id="${esc(v.shopifyVariantId || '')}">
  <input name="v-title" class="bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm" placeholder="8 ch" value="${esc(v.title || '')}">
  <input name="v-sku" class="bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm font-mono" placeholder="SKU" value="${esc(v.sku || '')}">
  <input name="v-price" type="number" step="0.01" min="0" class="bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm font-mono" placeholder="Price" value="${esc(money(v.price))}">
  <input name="v-compare" type="number" step="0.01" min="0" class="bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm font-mono" placeholder="Compare at" value="${esc(money(v.compareAt))}">
  <input name="v-inventory" type="number" step="1" min="0" class="bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm font-mono" placeholder="Stock" value="${esc(v.inventory ?? '')}">
  <button type="button" data-action="variant-remove" class="text-zinc-500 hover:text-red-400 px-2" title="Remove"><i class="ph ph-x"></i></button>
  ${v.shopifyVariantId ? `<div class="col-span-full font-mono text-[10px] text-zinc-500">${esc(v.shopifyVariantId)}</div>` : ''}</div>`;
