// Site search over the build-time /search-index.json. Loads on first focus.
interface Entry { type: string; title: string; sub: string; url: string; text: string }
let index: Entry[] | null = null;
const load = async () => { if (!index) index = (await (await fetch('/search-index.json')).json()) as Entry[]; return index; };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
export function search(entries: Entry[], query: string, limit = 8): Entry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return entries
    .map((e) => { const hay = `${e.title} ${e.sub} ${e.text}`.toLowerCase(); const t = e.title.toLowerCase(); let score = 0; for (const term of terms) { if (!hay.includes(term)) return null; score += t.includes(term) ? 3 : 1; if (t.startsWith(term)) score += 2; } return { e, score }; })
    .filter((x): x is { e: Entry; score: number } => Boolean(x))
    .sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.e);
}
document.querySelectorAll<HTMLElement>('[data-search]').forEach((root) => {
  const input = root.querySelector<HTMLInputElement>('[data-search-input]');
  const box = root.querySelector<HTMLElement>('[data-search-results]');
  if (!input || !box) return;
  const render = async () => {
    const q = input.value.trim();
    if (q.length < 2) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    const hits = search(await load(), q);
    box.innerHTML = hits.length
      ? hits.map((h) => `<a href="${esc(h.url)}" role="option" class="flex items-baseline justify-between gap-3 px-4 py-2.5 hover:bg-brand-surface-raised text-sm"><span><span class="font-semibold">${esc(h.title)}</span> <span class="text-brand-text-muted text-xs">${esc(h.sub)}</span></span><span class="font-mono text-[10px] uppercase text-brand-text-subtle">${esc(h.type)}</span></a>`).join('') + `<a href="/search/?q=${encodeURIComponent(q)}" class="block px-4 py-2 text-xs uppercase tracking-wide text-brand-accent border-t border-brand-border">All results</a>`
      : `<p class="px-4 py-3 text-sm text-brand-text-muted">No matches for “${esc(q)}”.</p>`;
    box.classList.remove('hidden');
  };
  input.addEventListener('focus', () => { void load(); });
  input.addEventListener('input', () => { void render(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); location.href = `/search/?q=${encodeURIComponent(input.value.trim())}`; } if (e.key === 'Escape') box.classList.add('hidden'); });
  document.addEventListener('click', (e) => { if (!root.contains(e.target as Node)) box.classList.add('hidden'); });
});
// Results page
const page = document.querySelector<HTMLElement>('[data-search-page]');
if (page) {
  const q = new URLSearchParams(location.search).get('q') || '';
  const input = page.querySelector<HTMLInputElement>('input');
  if (input) input.value = q;
  const list = page.querySelector<HTMLElement>('[data-search-page-results]');
  load().then((entries) => {
    const hits = search(entries, q, 50);
    if (list) list.innerHTML = hits.length ? hits.map((h) => `<li><a href="${esc(h.url)}" class="block rounded-xl bg-brand-surface border border-brand-border p-4 hover:border-cyan-500/50"><span class="font-mono text-[10px] uppercase text-brand-text-subtle">${esc(h.type)}</span><span class="block font-bold mt-1">${esc(h.title)}</span><span class="block text-sm text-brand-text-muted">${esc(h.sub)}</span></a></li>`).join('') : `<li class="text-brand-text-muted">No matches for “${esc(q)}”.</li>`;
  });
}
