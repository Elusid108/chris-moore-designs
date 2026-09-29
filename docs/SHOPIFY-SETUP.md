# Shopify setup

The site sells through Shopify without any server of its own. Two tokens are involved and they must never be confused:

| Token | Where it lives | What it can do | Who uses it |
|---|---|---|---|
| **Admin API token** | `CMS/.env` on your machine only (gitignored) | Create and update products, variants, prices, images, inventory, sales channels | The CMS "Sync to Shopify" step |
| **Storefront API token** | `content/settings.json` (committed, public by design) | Read the public catalogue, create carts, hand off to checkout | The live site, in the visitor's browser |

Everything below is done once.

## 1. Create the store

1. Sign up at shopify.com and create the store (Basic plan is enough). Note the `*.myshopify.com` domain.
2. Settings → Payments: connect Shopify Payments (or PayPal).
3. Settings → Shipping and delivery: set your shipping profile (US, rates).
4. Settings → Locations: note your one location's name; the CMS status panel shows its id.

## 2. Admin API token (for the CMS)

1. Settings → Apps and sales channels → **Develop apps** → Allow custom app development.
2. **Create an app** named `CMS sync`.
3. Configuration → Admin API integration → select these scopes:
   - `write_products` (and `read_products`)
   - `write_publications` (and `read_publications`)
   - `write_inventory` (and `read_inventory`)
   - `read_locations`
   - `write_files` (and `read_files`)
4. Save, then **Install app**. Reveal the **Admin API access token** once and paste it into `CMS/.env`:

```
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_TOKEN=shpat_…
SHOPIFY_LOCATION_ID=gid://shopify/Location/…    # optional, enables stock levels
SHOPIFY_PUBLICATIONS=Online Store,Headless       # sales channels to publish to
```

5. Restart the CMS. Settings → Shopify shows "Connected to <store>" and lists locations. Copy the location id into `.env` if you want inventory quantities pushed.

The token is only ever read by `CMS/lib/shopify-admin.js` and is not included in any API response or file the CMS writes.

## 3. Storefront API token (for the site)

1. Settings → Apps and sales channels → **Headless** (install it from the Shopify App Store if it is not listed) → Add storefront, or use the same custom app's **Storefront API integration** tab.
2. Grant only the unauthenticated scopes:
   - `unauthenticated_read_product_listings`
   - `unauthenticated_read_product_inventory`
   - `unauthenticated_read_checkouts`, `unauthenticated_write_checkouts`
3. Copy the **Storefront API access token** (public) into the CMS: Settings → Shopify → Storefront fields (domain, token, API version `2026-07`). Save and Publish.

Optional: set the same values as GitHub Actions variables `PUBLIC_SHOPIFY_DOMAIN` / `PUBLIC_SHOPIFY_STOREFRONT_TOKEN`; they override the committed values, which lets you rotate the token without a commit.

## 4. First sync

1. In the CMS, make sure each product has a title, a family, at least one variant with a price, and at least one image, then **Publish item**.
2. **Publish** in the header with "Sync to Shopify" ticked. Each changed product is upserted (`productSet`), its images are uploaded, stock is set if a location id is configured, and the product is published to the channels in `SHOPIFY_PUBLICATIONS`.
3. Shopify product and variant ids are written back into `content/products.json` and committed with the publish. From then on the site's Add to cart buttons are live.

A product is re-synced only when something Shopify cares about changed (title, handle, copy, status, option name, variants, images). "Force re-sync" on the product's Shopify tab overrides that.

## 5. Checkout domain (recommended)

By default checkout happens on `your-store.myshopify.com`. To keep the brand continuous:

1. Shopify Settings → Domains → Connect existing domain → `shop.chrismooredesigns.com`.
2. At the registrar add `CNAME shop → shops.myshopify.com`.
3. Make `shop.chrismooredesigns.com` the primary domain. Checkout then runs there, and you also get a full Shopify-hosted storefront at that address as a fallback.

Fully custom checkout beyond that needs Shopify Plus and is not needed.

## Things to check when Shopify changes

- API version: both `CMS/lib/shopify-admin.js` (`SHOPIFY_ADMIN_API_VERSION`) and the Storefront version in settings are pinned to `2026-07`. Bump them together; each version is supported for a year.
- `productSet` matches variants by id, then by SKU, then by option value. Don't edit ids by hand in `content/products.json`.
- Deleting a product in the CMS archives it on Shopify on the next sync rather than deleting it, so order history stays intact.
