// Small declarative form helper shared by every editor.
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const cls = { input: 'w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:border-cyan-500 outline-none', label: 'block text-[11px] font-mono uppercase tracking-wide text-zinc-500 mb-1' };
export function field(f, value) {
  const id = `f-${f.key}`;
  const v = value ?? f.default ?? '';
  const help = f.help ? `<p class="text-[11px] text-zinc-500 mt-1">${esc(f.help)}</p>` : '';
  let control;
  switch (f.type) {
    case 'textarea': control = `<textarea id="${id}" name="${f.key}" rows="${f.rows || 3}" class="${cls.input}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`; break;
    case 'checkbox': return `<label class="flex items-center gap-2 text-sm py-1"><input type="checkbox" id="${id}" name="${f.key}" class="accent-cyan-400" ${v ? 'checked' : ''}> <span>${esc(f.label)}</span></label>${help}`;
    case 'select': control = `<select id="${id}" name="${f.key}" class="${cls.input}">${(f.options || []).map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`; break;
    case 'number': control = `<input type="number" id="${id}" name="${f.key}" class="${cls.input}" value="${esc(v)}" ${f.step ? `step="${f.step}"` : ''} ${f.min != null ? `min="${f.min}"` : ''} placeholder="${esc(f.placeholder || '')}">`; break;
    case 'date': control = `<input type="date" id="${id}" name="${f.key}" class="${cls.input}" value="${esc(v)}">`; break;
    default: control = `<input type="${f.type || 'text'}" id="${id}" name="${f.key}" class="${cls.input} ${f.mono ? 'font-mono' : ''}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}">`;
  }
  return `<div class="${f.span === 2 ? 'sm:col-span-2' : ''}"><label for="${id}" class="${cls.label}">${esc(f.label)}</label>${control}${help}</div>`;
}
export function fields(specs, item) { return `<div class="grid sm:grid-cols-2 gap-4">${specs.map((f) => field(f, item?.[f.key])).join('')}</div>`; }
export function readFields(root, specs) {
  const out = {};
  for (const f of specs) {
    const el = root.querySelector(`[name="${f.key}"]`); if (!el) continue;
    if (f.type === 'checkbox') out[f.key] = el.checked;
    else if (f.type === 'number') out[f.key] = el.value === '' ? null : Number(el.value);
    else if (f.type === 'list') out[f.key] = el.value.split(',').map((s) => s.trim()).filter(Boolean);
    else out[f.key] = el.value.trim() === '' && f.nullable ? null : el.value;
  }
  return out;
}
export const section = (title, body, extra = '') => `<section class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4"><div class="flex items-center justify-between"><h3 class="font-semibold">${esc(title)}</h3>${extra}</div>${body}</section>`;
export const btn = (label, action, kind = 'ghost', attrs = '') => `<button type="button" data-action="${action}" ${attrs} class="${kind === 'primary' ? 'px-3 py-1.5 rounded-lg bg-white text-black text-xs font-bold hover:bg-cyan-400' : kind === 'danger' ? 'px-3 py-1.5 rounded-lg border border-red-900 text-red-400 text-xs hover:bg-red-950' : 'px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-300 hover:border-cyan-500 hover:text-white'}">${label}</button>`;
export const chip = (text, color = 'zinc') => `<span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-${color}-950 text-${color}-400 border border-${color}-900">${esc(text)}</span>`;
export function tabs(list, active) {
  return `<div class="flex gap-1 border-b border-zinc-800 mb-5 overflow-x-auto" role="tablist">${list.map((t) => `<button type="button" role="tab" data-action="tab" data-tab="${t.id}" aria-selected="${t.id === active}" class="px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${t.id === active ? 'border-cyan-400 text-white' : 'border-transparent text-zinc-400 hover:text-white'}">${esc(t.label)}</button>`).join('')}</div>`;
}
export function switchTab(root, id) {
  root.querySelectorAll('[role="tab"]').forEach((b) => { const on = b.dataset.tab === id; b.setAttribute('aria-selected', on); b.classList.toggle('border-cyan-400', on); b.classList.toggle('text-white', on); b.classList.toggle('border-transparent', !on); b.classList.toggle('text-zinc-400', !on); });
  root.querySelectorAll('[data-tab-panel]').forEach((p) => p.classList.toggle('hidden', p.dataset.tabPanel !== id));
}
