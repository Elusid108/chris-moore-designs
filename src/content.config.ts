import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { file } from 'astro/loaders';

// Source of truth is content/*.json, written by the local CMS (CMS/). Every
// collection is a JSON array of objects with a unique `id` (UUID) and a `slug`
// used for URLs. Rich text fields hold Quill HTML and are rendered with set:html.

const html = z.string().default('');
const imageSet = z.object({
  url: z.string(),
  hero: z.string().nullable().optional(),
  thumb: z.string().nullable().optional(),
  alt: z.string().default(''),
  fit: z.object({ scale: z.number(), x: z.number(), y: z.number() }).nullable().optional(),
  sha1: z.string().nullable().optional(),
  shopifyMediaId: z.string().nullable().optional(),
});

const families = defineCollection({
  loader: file('./content/families.json'),
  schema: z.object({
    id: z.string(), slug: z.string(), name: z.string(), tagline: z.string().default(''),
    category: z.enum(['hardware', 'software', 'systems', 'tooling', 'lighting', 'art']).default('hardware'),
    description: html, heroImage: imageSet.nullable().optional(), portfolioSlug: z.string().nullable().optional(),
    order: z.number().default(100), timestamp: z.string().optional(),
  }),
});

const products = defineCollection({
  loader: file('./content/products.json'),
  schema: z.object({
    id: z.string(), slug: z.string(), slugHistory: z.array(z.string()).default([]),
    title: z.string(), sku: z.string(), family: z.string(),
    summary: html, description: html,
    specsData: z.array(z.object({ id: z.string(), title: z.string(), items: z.array(z.object({ id: z.string(), name: z.string(), qty: z.string().default(''), specs: z.string().default('') })) })).default([]),
    specs: html,
    optionName: z.string().default('Title'),
    variants: z.array(z.object({
      id: z.string(), title: z.string(), sku: z.string(), price: z.string(), compareAt: z.string().nullable().optional(),
      options: z.record(z.string(), z.string()).default({}), inventory: z.number().nullable().optional(), shopifyVariantId: z.string().nullable().optional(),
    })).default([]),
    images: z.array(imageSet).default([]),
    gallery: z.array(z.object({ type: z.enum(['image', 'video']).default('image'), url: z.string(), poster: z.string().nullable().optional(), thumb: z.string().nullable().optional(), caption: z.string().default('') })).default([]),
    files: z.array(z.object({ name: z.string(), url: z.string(), description: z.string().default(''), sha256: z.string().nullable().optional(), size: z.number().nullable().optional() })).default([]),
    firmware: z.array(z.string()).default([]), software: z.array(z.string()).default([]), related: z.array(z.string()).default([]),
    badges: z.object({ bestSeller: z.boolean().default(false), bundle: z.boolean().default(false) }).default({ bestSeller: false, bundle: false }),
    featured: z.boolean().default(false), order: z.number().default(100), status: z.enum(['active', 'archived']).default('active'),
    shopify: z.object({ productId: z.string().nullable(), handle: z.string(), hash: z.string().nullable(), lastSyncedAt: z.string().nullable(), lastError: z.string().nullable() }).partial().default({}),
    timestamp: z.string().optional(),
  }),
});

const firmware = defineCollection({
  loader: file('./content/firmware.json'),
  schema: z.object({
    id: z.string(), slug: z.string(), name: z.string(), version: z.string(), date: z.string(), targets: z.array(z.string()).default([]),
    downloadUrl: z.string().nullable().optional(), file: z.object({ url: z.string(), size: z.number().nullable().optional() }).nullable().optional(),
    sha256: z.string().nullable().optional(), webInstallerManifest: z.string().nullable().optional(), repo: z.string().nullable().optional(),
    ota: z.boolean().default(false), notes: html, timestamp: z.string().optional(),
  }),
});

const software = defineCollection({
  loader: file('./content/software.json'),
  schema: z.object({
    id: z.string(), slug: z.string(), name: z.string(), summary: z.string().default(''), description: html,
    platforms: z.array(z.enum(['windows', 'macos', 'linux', 'web', 'raspberry-pi'])).default([]), version: z.string().nullable().optional(),
    repo: z.string().nullable().optional(), releaseUrl: z.string().nullable().optional(), appUrl: z.string().nullable().optional(),
    screenshots: z.array(imageSet).default([]), wip: z.boolean().default(false), order: z.number().default(100), timestamp: z.string().optional(),
  }),
});

const services = defineCollection({
  loader: file('./content/services.json'),
  schema: z.object({
    id: z.string(), slug: z.string(), name: z.string(), summary: z.string().default(''), description: html,
    startingPrice: z.number().nullable().optional(), quoteUrl: z.string().nullable().optional(), image: imageSet.nullable().optional(),
    relatedApps: z.array(z.string()).default([]), order: z.number().default(100), timestamp: z.string().optional(),
  }),
});

export const collections = { families, products, firmware, software, services };
