// specsData editor: groups of rows (name / qty / value). Same data shape as the portfolio CMS.
import { esc, btn } from './form.js';
import { setDirty } from './state.js';
const uid = () => Math.random().toString(36).slice(2, 8);
export function render(root, groups) {
  root.innerHTML = (groups || []).map((g) => groupHtml(g)).join('') + `<div>${btn('<i class="ph ph-plus"></i> Add group', 'spec-add-group')}</div>`;
}
const groupHtml = (g) => `<div class="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-2" data-spec-group>
  <div class="flex gap-2 items-center"><input class="flex-1 bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm font-semibold" placeholder="Group title (e.g. Electrical)" value="${esc(g.title || '')}" data-spec-title>${btn('<i class="ph ph-plus"></i> Row', 'spec-add-row')}${btn('<i class="ph ph-trash"></i>', 'spec-remove-group', 'danger')}</div>
  <div class="space-y-1" data-spec-rows>${(g.items || []).map(rowHtml).join('')}</div></div>`;
const rowHtml = (i = {}) => `<div class="grid grid-cols-[1fr_5rem_2fr_auto] gap-1" data-spec-row><input class="bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm" placeholder="Name" value="${esc(i.name || '')}" data-spec-name><input class="bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm font-mono" placeholder="Qty" value="${esc(i.qty || '')}" data-spec-qty><input class="bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm" placeholder="Value" value="${esc(i.specs || '')}" data-spec-value><button type="button" data-action="spec-remove-row" class="text-zinc-500 hover:text-red-400 px-1"><i class="ph ph-x"></i></button></div>`;
export function read(root) {
  return [...root.querySelectorAll('[data-spec-group]')].map((g) => ({ id: uid(), title: g.querySelector('[data-spec-title]').value, items: [...g.querySelectorAll('[data-spec-row]')].map((r) => ({ id: uid(), name: r.querySelector('[data-spec-name]').value, qty: r.querySelector('[data-spec-qty]').value, specs: r.querySelector('[data-spec-value]').value })) }));
}
export function bind(root) {
  root.addEventListener('click', (e) => {
    const a = e.target.closest('[data-action]')?.dataset.action; if (!a) return;
    if (a === 'spec-add-group') { const groups = read(root); groups.push({ title: '', items: [{}] }); render(root, groups); setDirty(true); }
    if (a === 'spec-add-row') { e.target.closest('[data-spec-group]').querySelector('[data-spec-rows]').insertAdjacentHTML('beforeend', rowHtml()); setDirty(true); }
    if (a === 'spec-remove-row') { e.target.closest('[data-spec-row]').remove(); setDirty(true); }
    if (a === 'spec-remove-group') { e.target.closest('[data-spec-group]').remove(); setDirty(true); }
  });
}
