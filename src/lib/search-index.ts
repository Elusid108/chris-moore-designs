import { getCatalog, priceRange, stripHtml } from './content';

export interface SearchEntry { type: 'product' | 'family' | 'firmware' | 'software' | 'service'; title: string; sub: string; url: string; text: string; }

export async function buildSearchIndex(): Promise<SearchEntry[]> {
  const c = await getCatalog();
  const out: SearchEntry[] = [];
  for (const p of c.products) out.push({ type: 'product', title: p.title, sub: `${p.sku} · ${priceRange(p).label}`, url: `/products/${p.slug}/`, text: [p.sku, stripHtml(p.summary), stripHtml(p.specs), p.variants.map((v) => v.sku).join(' ')].join(' ') });
  for (const f of c.families) out.push({ type: 'family', title: f.name, sub: 'Product family', url: `/families/${f.slug}/`, text: f.tagline });
  for (const f of c.firmware) out.push({ type: 'firmware', title: `${f.name} v${f.version}`, sub: 'Firmware', url: `/firmware/#${f.slug}`, text: stripHtml(f.notes) });
  for (const s of c.software) out.push({ type: 'software', title: s.name, sub: s.platforms.join(' / '), url: `/software/#${s.slug}`, text: s.summary });
  for (const s of c.services) out.push({ type: 'service', title: s.name, sub: 'Service', url: `/services/#${s.slug}`, text: s.summary });
  return out;
}
