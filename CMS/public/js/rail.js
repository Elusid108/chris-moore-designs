import { state, familyName } from './state.js';
import { esc } from './form.js';
const dot = (i) => i.published ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Published"></span>' : '<span class="w-1.5 h-1.5 rounded-full bg-amber-400" title="Draft (local)"></span>';
const item = (type, i, label, sub) => `<a href="#/${type}/${i.id}" class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-zinc-900 ${state.current?.type === type && state.current?.id === i.id ? 'bg-zinc-900 text-white' : 'text-zinc-300'}" data-nav>${dot(i)}<span class="truncate flex-1">${esc(label)}</span>${sub ? `<span class="font-mono text-[10px] text-zinc-500 shrink-0">${esc(sub)}</span>` : ''}</a>`;
const group = (title, type, body) => `<div class="mb-4"><div class="flex items-center justify-between px-3 mb-1"><span class="font-mono text-[10px] uppercase tracking-widest text-zinc-500">${esc(title)}</span><a href="#/${type}/new" class="text-zinc-500 hover:text-cyan-400" title="New ${title}"><i class="ph ph-plus"></i></a></div>${body || '<p class="px-3 text-xs text-zinc-600">None yet</p>'}</div>`;
export function renderRail() {
  const c = state.collections;
  const byFam = new Map();
  for (const p of c.products) { const k = p.family; if (!byFam.has(k)) byFam.set(k, []); byFam.get(k).push(p); }
  const productsHtml = [...byFam.entries()].map(([fam, ps]) => `<div class="mb-2"><div class="px-3 text-[11px] text-zinc-500">${esc(familyName(fam))}</div>${ps.map((p) => item('products', p, p.title, p.sku)).join('')}</div>`).join('');
  document.getElementById('rail').innerHTML =
    `<a href="#/settings" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-zinc-900 mb-1 ${state.current?.type === 'settings' ? 'bg-zinc-900 text-white' : 'text-zinc-300'}" data-nav><i class="ph ph-storefront text-cyan-400"></i> Store settings</a>
     <a href="#/tasks" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-zinc-900 mb-4 ${state.current?.type === 'tasks' ? 'bg-zinc-900 text-white' : 'text-zinc-300'}" data-nav><i class="ph ph-check-square text-purple-400"></i> Tasks</a>` +
    group('Products', 'products', productsHtml) +
    group('Families', 'families', c.families.map((f) => item('families', f, f.name)).join('')) +
    group('Firmware', 'firmware', c.firmware.map((f) => item('firmware', f, f.name, `v${f.version}`)).join('')) +
    group('Software', 'software', c.software.map((s) => item('software', s, s.name, s.version ? `v${s.version}` : '')).join('')) +
    group('Services', 'services', c.services.map((s) => item('services', s, s.name)).join(''));
}
