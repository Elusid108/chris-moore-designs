import { state, setDirty } from '../state.js';
import { fields, readFields, section, btn, tabs, esc } from '../form.js';

const SITE = [
  { key: 'name', label: 'Site name' }, { key: 'url', label: 'Site URL' },
  { key: 'tagline', label: 'Tagline (default meta description)', type: 'textarea', span: 2, rows: 2 },
  { key: 'currency', label: 'Currency code', mono: true }, { key: 'quoteUrl', label: 'Quote request link' },
  { key: 'portfolioUrl', label: 'Portfolio URL' }, { key: 'github', label: 'GitHub URL' },
];
const SHOP = [
  { key: 'domain', label: 'Store domain (yourstore.myshopify.com)', mono: true, span: 2, help: 'Public. Used by the site to talk to the Storefront API.' },
  { key: 'storefrontToken', label: 'Storefront API access token (public)', mono: true, span: 2, help: 'Public by design: it can only read the catalogue and create carts. The Admin token lives in CMS/.env and is never stored here.' },
  { key: 'apiVersion', label: 'Storefront API version', mono: true },
];
const HOME = [
  { key: 'heroProduct', label: 'Hero product', type: 'select', options: [] },
  { key: 'shelfTitle', label: 'Shelf title' },
  { key: 'servicesTitle', label: 'Services title' },
];

export function open(root, settings) {
  const s = JSON.parse(JSON.stringify(settings || {}));
  s.site ||= {}; s.shopify ||= {}; s.home ||= {}; s.footer ||= {};
  const products = state.collections.products.filter((p) => p.published);
  HOME.find((f) => f.key === 'heroProduct').options = products.map((p) => ({ value: p.id, label: `${p.title} (${p.sku})` }));
  const shelfOrder = (s.home.shelf || []).filter((id) => products.some((p) => p.id === id)).concat(products.filter((p) => !(s.home.shelf || []).includes(p.id)).map((p) => p.id));
  const listRows = (items, render) => items.map((x, i) => `<div class="flex gap-2 items-center rounded-lg border border-zinc-800 bg-zinc-950 p-2" draggable="true" data-row="x">${render(x, i)}<button type="button" data-action="row-remove" class="text-zinc-500 hover:text-red-400 px-1"><i class="ph ph-x"></i></button></div>`).join('');
  const stripRow = (it = {}) => `<div class="grid sm:grid-cols-[6rem_1fr_1fr] gap-2 flex-1"><select data-f="icon" class="bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm">${['bolt', 'app', 'docs', 'wrench', 'box', 'lock', 'check'].map((i) => `<option ${it.icon === i ? 'selected' : ''}>${i}</option>`).join('')}</select><input data-f="title" class="bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm" placeholder="Title" value="${esc(it.title || '')}"><input data-f="linkLabel" class="bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm" placeholder="Link label" value="${esc(it.linkLabel || '')}"><input data-f="text" class="sm:col-span-2 bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm" placeholder="Text" value="${esc(it.text || '')}"><input data-f="href" class="bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm font-mono" placeholder="/firmware/" value="${esc(it.href || '')}"><select data-f="ref" class="sm:col-span-3 bg-transparent border border-zinc-800 rounded px-2 py-1 text-xs"><option value="">No version badge</option>${state.collections.firmware.map((f) => `<option value="firmware:${f.id}" ${it.ref?.firmware === f.id ? 'selected' : ''}>Show ${esc(f.name)} version</option>`).join('')}${state.collections.software.map((f) => `<option value="software:${f.id}" ${it.ref?.software === f.id ? 'selected' : ''}>Show ${esc(f.name)} version</option>`).join('')}</select></div>`;
  const trustRow = (r = {}) => `<div class="grid sm:grid-cols-[6rem_1fr_2fr] gap-2 flex-1"><select data-f="icon" class="bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm">${['lock', 'box', 'wrench', 'bolt', 'check'].map((i) => `<option ${r.icon === i ? 'selected' : ''}>${i}</option>`).join('')}</select><input data-f="title" class="bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm" placeholder="Title" value="${esc(r.title || '')}"><input data-f="text" class="bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm" placeholder="Text" value="${esc(r.text || '')}"></div>`;
  const linkRow = (l = {}) => `<div class="grid sm:grid-cols-2 gap-2 flex-1"><input data-f="label" class="bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm" placeholder="Label" value="${esc(l.label || '')}"><input data-f="href" class="bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm font-mono" placeholder="/services/ or https://…" value="${esc(l.href || '')}"></div>`;
  const textRow = (t = '') => `<input data-f="value" class="flex-1 bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm" value="${esc(t)}">`;
  const shelfRow = (id) => { const p = products.find((x) => x.id === id); return `<span class="cursor-grab text-zinc-600"><i class="ph ph-dots-six-vertical"></i></span><span class="flex-1 text-sm" data-id="${id}">${esc(p?.title || id)} <span class="font-mono text-xs text-zinc-500">${esc(p?.sku || '')}</span></span>`; };

  root.innerHTML = `
    <div class="flex items-start justify-between gap-4 mb-4"><div><p class="font-mono text-[11px] uppercase tracking-widest text-cyan-400">Settings</p><h2 class="text-2xl font-bold">Store settings</h2></div><div>${btn('<i class="ph ph-floppy-disk"></i> Save', 'save', 'primary')}</div></div>
    ${tabs([{ id: 'store', label: 'Store' }, { id: 'home', label: 'Home page' }, { id: 'footer', label: 'Footer' }, { id: 'shopify', label: 'Shopify' }], 'store')}
    <div data-tab-panel="store" class="space-y-5">${section('Site', fields(SITE, s.site))}</div>
    <div data-tab-panel="home" class="hidden space-y-5">
      ${section('Hero', fields(HOME, s.home) + `<div><label class="block text-[11px] font-mono uppercase tracking-wide text-zinc-500 mb-1">Hero variant pills</label><p class="text-[11px] text-zinc-500 mb-2">Products whose variants appear as pills on the home hero (lets the hero switch between sibling boards).</p><div class="grid sm:grid-cols-2 gap-1">${products.map((p) => `<label class="flex items-center gap-2 text-sm py-1"><input type="checkbox" class="accent-cyan-400" data-hero-pill value="${p.id}" ${(s.home.heroVariantsFrom || []).includes(p.id) ? 'checked' : ''}> ${esc(p.title)}</label>`).join('')}</div></div>`)}
      ${section('Trust bullets (under Add to cart)', `<div class="space-y-2" data-list="trust">${listRows(s.home.trustBullets || [], textRow)}</div>`, btn('<i class="ph ph-plus"></i>', 'add-trust'))}
      ${section('Shelf order', `<p class="text-[11px] text-zinc-500 mb-2">Drag to order the product shelf. Filters come from families plus "Bundles".</p><div class="space-y-2" data-list="shelf">${listRows(shelfOrder, shelfRow)}</div>`)}
      ${section('Support strip ("Included with every board")', `<div class="space-y-2" data-list="strip">${listRows(s.home.supportStrip || [], stripRow)}</div>`, btn('<i class="ph ph-plus"></i>', 'add-strip'))}
    </div>
    <div data-tab-panel="footer" class="hidden space-y-5">
      ${section('Trust rows', `<div class="space-y-2" data-list="trustrows">${listRows(s.footer.trustRows || [], trustRow)}</div>`, btn('<i class="ph ph-plus"></i>', 'add-trustrow'))}
      ${section('Footer links', `<div class="space-y-2" data-list="links">${listRows(s.footer.links || [], linkRow)}</div>`, btn('<i class="ph ph-plus"></i>', 'add-link'))}
    </div>
    <div data-tab-panel="shopify" class="hidden space-y-5">${section('Storefront (public values, committed)', fields(SHOP, s.shopify))}${section('Admin connection (local only)', `<div data-shopify-status class="text-sm text-zinc-400">Checking…</div><p class="text-[11px] text-zinc-500 mt-2">Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN in CMS/.env, then restart the CMS. See docs/SHOPIFY-SETUP.md.</p>`)}</div>`;

  root.querySelectorAll('[data-list]').forEach((list) => {
    let dragging = null;
    list.addEventListener('dragstart', (e) => { dragging = e.target.closest('[data-row]'); });
    list.addEventListener('dragover', (e) => { if (!dragging) return; e.preventDefault(); const after = [...list.querySelectorAll('[data-row]')].filter((r) => r !== dragging).find((r) => e.clientY <= r.getBoundingClientRect().top + r.offsetHeight / 2); list.insertBefore(dragging, after || null); });
    list.addEventListener('dragend', () => { dragging = null; setDirty(true); });
    list.addEventListener('click', (e) => { if (e.target.closest('[data-action="row-remove"]')) { e.target.closest('[data-row]').remove(); setDirty(true); } });
  });
  const add = (listName, html) => { root.querySelector(`[data-list="${listName}"]`).insertAdjacentHTML('beforeend', `<div class="flex gap-2 items-center rounded-lg border border-zinc-800 bg-zinc-950 p-2" draggable="true" data-row="x">${html}<button type="button" data-action="row-remove" class="text-zinc-500 hover:text-red-400 px-1"><i class="ph ph-x"></i></button></div>`); setDirty(true); };
  const rows = (listName, keys) => [...root.querySelectorAll(`[data-list="${listName}"] [data-row]`)].map((r) => { const o = {}; for (const k of keys) { const el = r.querySelector(`[data-f="${k}"]`); if (el) o[k] = el.value; } return o; });
  fetch('/api/shopify/status').then((r) => r.json()).then((st) => { root.querySelector('[data-shopify-status]').innerHTML = st.configured ? (st.ok ? `<span class="text-emerald-400">Connected</span> to <strong>${esc(st.shop?.name || '')}</strong>${st.missingScopes?.length ? `<br><span class="text-amber-400">Missing scopes: ${esc(st.missingScopes.join(', '))}</span>` : ''}` : `<span class="text-red-400">Configured but not reachable:</span> ${esc(st.error || '')}`) : '<span class="text-zinc-500">Not configured.</span> ' + esc(st.error || ''); }).catch(() => {});

  return {
    type: 'settings', id: 'settings',
    collect() {
      const home = readFields(root, HOME);
      return { ...s,
        site: { ...s.site, ...readFields(root, SITE) }, shopify: { ...s.shopify, ...readFields(root, SHOP) },
        home: { ...s.home, ...home, heroVariantsFrom: [...root.querySelectorAll('[data-hero-pill]:checked')].map((c) => c.value), trustBullets: rows('trust', ['value']).map((r) => r.value).filter(Boolean), shelf: [...root.querySelectorAll('[data-list="shelf"] [data-id]')].map((e) => e.dataset.id),
          shelfFilters: [{ label: 'All', key: 'all' }, ...state.collections.families.filter((f) => f.published).map((f) => ({ label: f.name, key: f.id })), { label: 'Bundles', key: 'bundles' }],
          supportStrip: rows('strip', ['icon', 'title', 'linkLabel', 'text', 'href', 'ref']).map((r) => { const [kind, id] = (r.ref || '').split(':'); return { icon: r.icon, color: r.icon === 'app' ? 'secondary' : r.icon === 'docs' ? 'hardware' : 'accent', title: r.title, linkLabel: r.linkLabel, text: r.text, href: r.href, ref: kind && id ? { [kind]: id } : null }; }) },
        footer: { trustRows: rows('trustrows', ['icon', 'title', 'text']), links: rows('links', ['label', 'href']) },
      };
    },
    action(a) { if (a === 'add-trust') add('trust', textRow()); if (a === 'add-strip') add('strip', stripRow()); if (a === 'add-trustrow') add('trustrows', trustRow()); if (a === 'add-link') add('links', linkRow()); },
    previewPath: '/',
  };
}
