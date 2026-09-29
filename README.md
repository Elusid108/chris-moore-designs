# chrismooredesigns.com

The main Chris Moore Designs site: pixel hardware (PixelDecode ESP32 boards, PixelPilot Raspberry Pi controller), the firmware and software that go with them, and services such as custom color lithophanes. Aimed at pro-sumer DIYers.

It is a sibling of the portfolio at [chrismoore.me](https://chrismoore.me) ([Elusid108/Portfolio](https://github.com/Elusid108/Portfolio)) and shares its design tokens so the two read as one brand.

## Stack

- [Astro](https://astro.build) (static output) + Tailwind CSS v4
- Content collections loaded from `content/*.json` (families, products, firmware, software, services), written by the CMS
- Shopify Storefront API for cart + hosted checkout (see `docs/INTEGRATION.md`)
- GitHub Pages via `.github/workflows/deploy.yml`

## Develop

```sh
npm ci
cp .env.example .env   # optional: fill in Shopify values to enable the cart
npm run dev            # http://localhost:4321
npm run build          # -> dist/
npm run check          # astro check (types)
```

## Layout

```
design/            tokens.json + tokens.css (shared with the portfolio), mockups/
docs/INTEGRATION.md  architecture + Shopify/GitHub Pages security notes
content/           JSON per collection + settings.json (source of truth, CMS-managed)
CMS/               local admin app (server.js, lib/, public/)
src/components/    Nav, Footer, Wordmark, PixelField, Cart, AddToCart, SpecTable, ReleaseList
src/lib/shopify.ts Storefront API client (public token only)
src/pages/         index, families/[slug], products/[slug], firmware, software, services
public/            favicon, robots.txt, .nojekyll, media/ and og/ (CMS-managed)  (add CNAME when the domain is split)
```

## CMS

The store is edited with a local CMS in `CMS/`, in the same spirit as the portfolio's: an Express app bound to `127.0.0.1:3000` with no login. It writes `content/*.json` and `public/media/`, keeps unpublished items in a gitignored drafts file, previews the site (drafts included) as a local production build, and publishes by committing and pushing to `main` (GitHub Actions then deploys). Products can also be synced to Shopify (see `docs/SHOPIFY-SETUP.md`).

```sh
cd CMS
npm ci
cp .env.example .env    # optional: Shopify Admin credentials, local only
npm start               # http://localhost:3000  (Windows: launch.bat)
npm test                # API + git publish tests
```

Flow: add or edit an item → **Save** (local draft, amber dot) → **Publish item** (moves into `content/`, green dot) → **Publish** in the header (validate → optional Shopify sync → optional build check → commit + push). Drafts and pre-launch prices never reach GitHub.

## Status

The Storefront direction is built out; the five original mockups remain in `design/mockups/` for reference (open them from the repo; they are no longer deployed). The cart shows “Coming soon” until products carry Shopify variant ids.

## Deploy

1. Repo Settings → Pages → Source: **GitHub Actions**.
2. Push to `main`. The workflow builds and deploys `dist/`.
3. When ready to move the domain off the portfolio redirect: add `public/CNAME` containing `chrismooredesigns.com`, point DNS at GitHub Pages, enable "Enforce HTTPS".
4. Shopify: add `PUBLIC_SHOPIFY_DOMAIN` (variable) and `PUBLIC_SHOPIFY_STOREFRONT_TOKEN` (secret) under Settings → Secrets and variables → Actions.
