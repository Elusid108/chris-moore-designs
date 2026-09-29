// Typed access to the JSON collections with the joins the pages need.
import { getCollection, type CollectionEntry } from 'astro:content';
import { SETTINGS } from './store-config';

export type Product = CollectionEntry<'products'>['data'];
export type Family = CollectionEntry<'families'>['data'];
export type Firmware = CollectionEntry<'firmware'>['data'];
export type Software = CollectionEntry<'software'>['data'];
export type Service = CollectionEntry<'services'>['data'];

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

export async function getFamilies(): Promise<Family[]> {
  return (await getCollection('families')).map((e) => e.data).sort(byOrder);
}
export async function getProducts(): Promise<Product[]> {
  return (await getCollection('products')).map((e) => e.data).filter((p) => p.status === 'active').sort(byOrder);
}
export async function getFirmware(): Promise<Firmware[]> {
  return (await getCollection('firmware')).map((e) => e.data).sort((a, b) => b.date.localeCompare(a.date));
}
export async function getSoftware(): Promise<Software[]> {
  return (await getCollection('software')).map((e) => e.data).sort(byOrder);
}
export async function getServices(): Promise<Service[]> {
  return (await getCollection('services')).map((e) => e.data).sort(byOrder);
}

export interface Catalog {
  settings: typeof SETTINGS;
  families: Family[]; products: Product[]; firmware: Firmware[]; software: Software[]; services: Service[];
  familyById: Map<string, Family>; productById: Map<string, Product>; firmwareById: Map<string, Firmware>; softwareById: Map<string, Software>;
}
let cached: Catalog | null = null;
export async function getCatalog(): Promise<Catalog> {
  if (cached) return cached;
  const [families, products, firmware, software, services] = await Promise.all([getFamilies(), getProducts(), getFirmware(), getSoftware(), getServices()]);
  cached = {
    settings: SETTINGS, families, products, firmware, software, services,
    familyById: new Map(families.map((f) => [f.id, f])),
    productById: new Map(products.map((p) => [p.id, p])),
    firmwareById: new Map(firmware.map((f) => [f.id, f])),
    softwareById: new Map(software.map((s) => [s.id, s])),
  };
  return cached;
}

export function pick<T>(map: Map<string, T>, ids: string[]): T[] {
  return ids.map((id) => map.get(id)).filter((x): x is T => Boolean(x));
}

export function money(amount: string | number, currency = SETTINGS.site.currency): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: n % 1 === 0 ? 0 : 2 }).format(n);
}

export function priceRange(p: Product): { min: number; max: number; label: string } {
  const prices = p.variants.map((v) => Number(v.price)).filter((n) => !Number.isNaN(n));
  if (prices.length === 0) return { min: 0, max: 0, label: 'Price on request' };
  const min = Math.min(...prices), max = Math.max(...prices);
  return { min, max, label: min === max ? money(min) : `from ${money(min)}` };
}

export function heroImage(p: Product): { src: string; alt: string } | null {
  const img = p.images[0];
  if (!img) return null;
  return { src: img.hero || img.url, alt: img.alt || p.title };
}
export function cardImage(p: Product): { src: string; alt: string } | null {
  const img = p.images[0];
  if (!img) return null;
  return { src: img.thumb || img.hero || img.url, alt: img.alt || p.title };
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Redirects for renamed slugs, consumed by astro.config.mjs at build. */
export function slugRedirects(products: { slug: string; slugHistory?: string[] }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of products) for (const old of p.slugHistory || []) if (old && old !== p.slug) out[`/products/${old}/`] = `/products/${p.slug}/`;
  return out;
}
