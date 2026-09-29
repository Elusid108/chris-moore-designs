// Shopify Admin API sync. One product in the CMS ⇄ one product on Shopify.
//
// Credentials come from CMS/.env (SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_TOKEN) and
// never leave this process. The public Storefront token lives in
// content/settings.json and is unrelated to this module.
//
// Sync is idempotent: `productSet` upserts product + options + variants + media
// by id, ids are written back into content/products.json, and a hash of the
// Shopify-relevant subset skips products that have not changed.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const data = require('./data');
const { webPathToAbs } = require('./media');

const API_VERSION = process.env.SHOPIFY_ADMIN_API_VERSION || '2026-07';
const REQUIRED_SCOPES = ['write_products', 'write_publications', 'write_inventory', 'read_locations', 'write_files'];

function config() {
  const domain = (process.env.SHOPIFY_STORE_DOMAIN || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const token = (process.env.SHOPIFY_ADMIN_TOKEN || '').trim();
  return { domain, token, configured: Boolean(domain && token), locationId: (process.env.SHOPIFY_LOCATION_ID || '').trim() || null, publications: (process.env.SHOPIFY_PUBLICATIONS || 'Online Store,Headless').split(',').map((s) => s.trim()).filter(Boolean) };
}

// Injectable fetch for tests.
let fetchImpl = (...a) => fetch(...a);
function setFetch(fn) { fetchImpl = fn || ((...a) => fetch(...a)); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function admin(query, variables = {}, { retries = 5 } = {}) {
  const c = config();
  if (!c.configured) throw Object.assign(new Error('Shopify is not configured (set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN in CMS/.env)'), { status: 400 });
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(`https://${c.domain}/admin/api/${API_VERSION}/graphql.json`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': c.token }, body: JSON.stringify({ query, variables }) });
    if (res.status === 429 || res.status === 503) { if (attempt >= retries) throw new Error(`Shopify rate limited (HTTP ${res.status})`); await sleep(Number(res.headers?.get?.('Retry-After') || 1) * 1000); continue; }
    if (res.status === 401 || res.status === 403) throw new Error(`Shopify rejected the Admin token (HTTP ${res.status}). Check SHOPIFY_ADMIN_TOKEN and the app's scopes.`);
    if (!res.ok) throw new Error(`Shopify Admin API HTTP ${res.status}`);
    const json = await res.json();
    const throttled = json.errors?.some((e) => e.extensions?.code === 'THROTTLED');
    if (throttled) { if (attempt >= retries) throw new Error('Shopify throttled the request repeatedly'); await sleep(1000); continue; }
    if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
    return json.data;
  }
}

async function status() {
  const c = config();
  if (!c.configured) return { configured: false, ok: false, error: 'Not configured: add SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN to CMS/.env and restart the CMS.' };
  try {
    const d = await admin('{ shop { name currencyCode primaryDomain { host } } locations(first: 5) { nodes { id name } } }');
    let missingScopes = [];
    try {
      const res = await fetchImpl(`https://${c.domain}/admin/oauth/access_scopes.json`, { headers: { 'X-Shopify-Access-Token': c.token } });
      if (res.ok) { const have = new Set(((await res.json()).access_scopes || []).map((s) => s.handle)); missingScopes = REQUIRED_SCOPES.filter((s) => !have.has(s) && !(s.startsWith('write_') && have.has(s))); }
    } catch { /* scope check is best effort */ }
    return { configured: true, ok: true, shop: { name: d.shop.name, currency: d.shop.currencyCode, domain: d.shop.primaryDomain?.host }, locations: d.locations.nodes, locationId: c.locationId, publications: c.publications, missingScopes, apiVersion: API_VERSION };
  } catch (err) { return { configured: true, ok: false, error: err.message, apiVersion: API_VERSION }; }
}

// --- hashing: what, if changed, requires a sync ---
function syncSubset(p) {
  return {
    title: p.title, handle: p.slug, descriptionHtml: (p.summary || '') + (p.description || ''), status: p.status, optionName: p.optionName,
    variants: (p.variants || []).map((v) => ({ title: v.title, sku: v.sku, price: v.price, compareAt: v.compareAt, options: v.options, inventory: v.inventory })),
    images: (p.images || []).map((i) => ({ sha1: i.sha1, alt: i.alt })),
  };
}
const computeHash = (p) => crypto.createHash('sha1').update(JSON.stringify(syncSubset(p))).digest('hex');

// --- media: staged upload of a local WebP, returns the resourceUrl for productSet ---
async function stageImage(img, productTitle) {
  const abs = webPathToAbs(img.url);
  const bytes = fs.readFileSync(abs);
  const filename = path.basename(abs);
  const d = await admin(`mutation ($input: [StagedUploadInput!]!) { stagedUploadsCreate(input: $input) { stagedTargets { url resourceUrl parameters { name value } } userErrors { field message } } }`, { input: [{ resource: 'IMAGE', filename, mimeType: 'image/webp', httpMethod: 'POST', fileSize: String(bytes.length) }] });
  const errs = d.stagedUploadsCreate.userErrors; if (errs.length) throw new Error(`stagedUploadsCreate: ${errs.map((e) => e.message).join('; ')}`);
  const target = d.stagedUploadsCreate.stagedTargets[0];
  const form = new FormData();
  for (const p of target.parameters) form.append(p.name, p.value);
  form.append('file', new Blob([bytes], { type: 'image/webp' }), filename);
  const up = await fetchImpl(target.url, { method: 'POST', body: form });
  if (!up.ok) throw new Error(`Image upload failed for ${filename} (HTTP ${up.status})`);
  return { originalSource: target.resourceUrl, alt: img.alt || productTitle, contentType: 'IMAGE' };
}

const PRODUCT_SET = `mutation ($input: ProductSetInput!) { productSet(input: $input, synchronous: true) {
  product { id handle status variants(first: 100) { nodes { id sku title selectedOptions { name value } inventoryItem { id } } } media(first: 100) { nodes { id alt mediaContentType } } }
  userErrors { field message } } }`;

async function resolvePublications(names) {
  if (!names.length) return [];
  const d = await admin('{ publications(first: 20) { nodes { id name } } }');
  return d.publications.nodes.filter((p) => names.includes(p.name)).map((p) => p.id);
}

async function syncProduct(idOrProduct, { force = false, emit = () => {} } = {}) {
  const c = config();
  const p = typeof idOrProduct === 'string' ? data.get('products', idOrProduct) : idOrProduct;
  if (!p) throw Object.assign(new Error('Product not found'), { status: 404 });
  if (!p.published) throw Object.assign(new Error('Publish the item in the CMS first (drafts are not synced)'), { status: 400 });
  const hash = computeHash(p);
  if (!force && p.shopify?.productId && p.shopify?.hash === hash) return { id: p.id, skipped: true, productId: p.shopify.productId };
  emit('shopify', 'running', `Syncing ${p.title}`);
  try {
    // Adopt an existing product with the same handle instead of creating a duplicate.
    let productId = p.shopify?.productId || null;
    if (!productId) { const d = await admin('query ($h: String!) { productByHandle(handle: $h) { id } }', { h: p.slug }); productId = d.productByHandle?.id || null; }

    const files = [];
    for (const img of p.images || []) {
      if (img.shopifyMediaId && img.sha1 === img.syncedSha1) files.push({ id: img.shopifyMediaId, alt: img.alt || p.title });
      else files.push(await stageImage(img, p.title));
    }
    const optionName = p.optionName || 'Title';
    const single = p.variants.length === 1 && (p.variants[0].title === 'Default Title' || optionName === 'Title');
    const input = {
      ...(productId ? { id: productId } : {}), handle: p.slug, title: p.title, descriptionHtml: (p.summary || '') + (p.description || ''), status: p.status === 'archived' ? 'ARCHIVED' : 'ACTIVE',
      productOptions: [{ name: single ? 'Title' : optionName, position: 1, values: p.variants.map((v) => ({ name: single ? 'Default Title' : v.title })) }],
      variants: p.variants.map((v) => ({ ...(v.shopifyVariantId ? { id: v.shopifyVariantId } : {}), sku: v.sku || undefined, price: v.price, compareAtPrice: v.compareAt || null, optionValues: [{ optionName: single ? 'Title' : optionName, name: single ? 'Default Title' : v.title }], inventoryItem: { tracked: true } })),
      files,
    };
    const d = await admin(PRODUCT_SET, { input });
    const errs = d.productSet.userErrors; if (errs.length) throw new Error(errs.map((e) => `${(e.field || []).join('.')}: ${e.message}`).join('; '));
    const prod = d.productSet.product;

    // write back ids
    const bySku = new Map(prod.variants.nodes.filter((v) => v.sku).map((v) => [v.sku, v]));
    const byTitle = new Map(prod.variants.nodes.map((v) => [v.selectedOptions?.[0]?.value || v.title, v]));
    const variantIds = p.variants.map((v) => (v.sku && bySku.get(v.sku)) || byTitle.get(single ? 'Default Title' : v.title) || null);
    const knownMedia = new Set((p.images || []).map((i) => i.shopifyMediaId).filter(Boolean));
    const newMedia = prod.media.nodes.filter((m) => m.mediaContentType === 'IMAGE' && !knownMedia.has(m.id));
    let n = 0;
    const mediaIds = (p.images || []).map((i) => (i.shopifyMediaId && i.sha1 === i.syncedSha1 ? i.shopifyMediaId : newMedia[n++]?.id || null));

    // inventory
    if (c.locationId) {
      const quantities = p.variants.map((v, i) => ({ v, node: variantIds[i] })).filter((x) => x.node?.inventoryItem?.id && x.v.inventory != null).map((x) => ({ inventoryItemId: x.node.inventoryItem.id, locationId: c.locationId, quantity: Number(x.v.inventory) }));
      if (quantities.length) { const r = await admin('mutation ($input: InventorySetQuantitiesInput!) { inventorySetQuantities(input: $input) { userErrors { field message } } }', { input: { name: 'available', reason: 'correction', ignoreCompareQuantity: true, quantities } }); const ie = r.inventorySetQuantities.userErrors; if (ie.length) emit('shopify', 'warn', `${p.title}: inventory ${ie.map((e) => e.message).join('; ')}`); }
    }
    // sales channels
    const pubIds = await resolvePublications(c.publications);
    if (pubIds.length) { const r = await admin('mutation ($id: ID!, $input: [PublicationInput!]!) { publishablePublish(id: $id, input: $input) { userErrors { field message } } }', { id: prod.id, input: pubIds.map((publicationId) => ({ publicationId })) }); const pe = r.publishablePublish.userErrors; if (pe.length) emit('shopify', 'warn', `${p.title}: publish ${pe.map((e) => e.message).join('; ')}`); }

    const now = new Date().toISOString();
    data.patchPublished('products', p.id, (item) => {
      item.shopify = { ...(item.shopify || {}), productId: prod.id, handle: prod.handle, hash, lastSyncedAt: now, lastError: null };
      item.variants.forEach((v, i) => { if (variantIds[i]?.id) v.shopifyVariantId = variantIds[i].id; });
      (item.images || []).forEach((img, i) => { if (mediaIds[i]) { img.shopifyMediaId = mediaIds[i]; img.syncedSha1 = img.sha1; } });
    });
    emit('shopify', 'running', `${p.title}: synced`);
    return { id: p.id, skipped: false, productId: prod.id, variantIds: variantIds.map((v) => v?.id || null), mediaIds };
  } catch (err) {
    data.patchPublished('products', p.id, (item) => { item.shopify = { ...(item.shopify || {}), lastError: err.message }; });
    err.status = err.status || 502;
    throw err;
  }
}

async function syncAll({ onlyDirty = true, emit = () => {} } = {}) {
  const products = data.list('products').filter((p) => p.published);
  const out = { synced: 0, skipped: 0, errors: [] };
  for (const p of products) {
    try { const r = await syncProduct(p, { force: !onlyDirty, emit }); if (r.skipped) out.skipped++; else out.synced++; }
    catch (err) { out.errors.push({ id: p.id, title: p.title, error: err.message }); emit('shopify', 'warn', `${p.title}: ${err.message}`); }
  }
  return out;
}

module.exports = { config, status, admin, computeHash, syncSubset, syncProduct, syncAll, setFetch, REQUIRED_SCOPES, API_VERSION };
