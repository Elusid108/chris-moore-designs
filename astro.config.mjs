// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';

// Renamed product/family slugs (slugHistory) become static redirects.
/** @type {Record<string, string>} */
const redirects = {};
for (const [file, prefix] of [['products', '/products/'], ['families', '/families/']]) {
  try {
    for (const item of JSON.parse(readFileSync(new URL(`./content/${file}.json`, import.meta.url), 'utf8'))) {
      for (const old of item.slugHistory || []) if (old && old !== item.slug) redirects[`${prefix}${old}/`] = `${prefix}${item.slug}/`;
    }
  } catch { /* content not seeded yet */ }
}

// `site` is the final production origin. Until the domain is split from
// chrismoore.me the deployed copy lives at https://elusid108.github.io/chris-moore-designs/
// — leave `base` at '/' anyway; every internal link is root-relative and
// the GitHub Pages project URL is only a temporary preview.
export default defineConfig({
  site: 'https://chrismooredesigns.com',
  output: 'static',
  trailingSlash: 'always',
  redirects,
  integrations: [sitemap()],
  vite: {
    build: {
      // The CSP meta in Base.astro is `script-src 'self'`, so every script must be
      // an external file. 0 stops Vite/Astro from inlining small scripts.
      assetsInlineLimit: 0,
    },
  },
});
