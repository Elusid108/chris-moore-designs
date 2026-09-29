// Shopify sync with an injected fetch: no network, asserts payload shape,
// id write-back, hash skip, throttle retry and error surfacing.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cmd-cms-shopify-'));
fs.mkdirSync(path.join(tmp, 'public', 'media', 'fam', 'prod'), { recursive: true });
fs.cpSync(path.join(__dirname, '..', '..', 'content'), path.join(tmp, 'content'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'public', 'media', 'fam', 'prod', 'x.webp'), Buffer.from('RIFF....WEBP'));
process.env.CMD_CMS_ROOT = tmp;
process.env.SHOPIFY_STORE_DOMAIN = 'test.myshopify.com';
process.env.SHOPIFY_ADMIN_TOKEN = 'shpat_test';
process.env.SHOPIFY_LOCATION_ID = 'gid://shopify/Location/1';
process.env.SHOPIFY_PUBLICATIONS = 'Online Store';
const data = require('../lib/data');
const shopify = require('../lib/shopify-admin');

const calls = [];
let throttleOnce = false;
function fakeFetch(url, opts = {}) {
  const json = (body, status = 200) => ({ ok: status < 400, status, headers: { get: () => '0' }, json: async () => body, text: async () => JSON.stringify(body) });
  if (String(url).includes('/staged-upload')) { calls.push({ upload: true }); return json({}); }
  if (String(url).includes('access_scopes')) return json({ access_scopes: ['write_products', 'write_publications', 'write_inventory', 'read_locations', 'write_files'].map((handle) => ({ handle })) });
  const { query, variables } = JSON.parse(opts.body);
  calls.push({ query, variables });
  if (query.includes('shop {')) return json({ data: { shop: { name: 'Test Shop', currencyCode: 'USD', primaryDomain: { host: 'test.myshopify.com' } }, locations: { nodes: [{ id: 'gid://shopify/Location/1', name: 'Bench' }] } } });
  if (query.includes('productByHandle')) return json({ data: { productByHandle: null } });
  if (query.includes('stagedUploadsCreate')) return json({ data: { stagedUploadsCreate: { stagedTargets: [{ url: 'https://shopify-staged/staged-upload', resourceUrl: 'https://shopify-staged/x.webp', parameters: [{ name: 'key', value: 'k' }] }], userErrors: [] } } });
  if (query.includes('productSet')) {
    if (throttleOnce) { throttleOnce = false; return json({ errors: [{ message: 'Throttled', extensions: { code: 'THROTTLED' } }] }); }
    const input = variables.input;
    if (input.title === 'BAD') return json({ data: { productSet: { product: null, userErrors: [{ field: ['input', 'handle'], message: 'Handle already in use' }] } } });
    return json({ data: { productSet: { product: { id: input.id || 'gid://shopify/Product/100', handle: input.handle, status: input.status, variants: { nodes: input.variants.map((v, i) => ({ id: v.id || `gid://shopify/ProductVariant/${i + 1}`, sku: v.sku, title: v.optionValues[0].name, selectedOptions: [{ name: v.optionValues[0].optionName, value: v.optionValues[0].name }], inventoryItem: { id: `gid://shopify/InventoryItem/${i + 1}` } })) }, media: { nodes: input.files.map((f, i) => ({ id: f.id || `gid://shopify/MediaImage/${i + 1}`, alt: f.alt, mediaContentType: 'IMAGE' })) } }, userErrors: [] } } });
  }
  if (query.includes('inventorySetQuantities')) return json({ data: { inventorySetQuantities: { userErrors: [] } } });
  if (query.includes('publications(')) return json({ data: { publications: { nodes: [{ id: 'gid://shopify/Publication/1', name: 'Online Store' }, { id: 'gid://shopify/Publication/2', name: 'Point of Sale' }] } } });
  if (query.includes('publishablePublish')) return json({ data: { publishablePublish: { userErrors: [] } } });
  throw new Error('unexpected query ' + query.slice(0, 60));
}
shopify.setFetch(fakeFetch);

test('status reports shop, locations and scopes', async () => {
  const s = await shopify.status();
  assert.equal(s.ok, true); assert.equal(s.shop.name, 'Test Shop'); assert.deepEqual(s.missingScopes, []); assert.equal(s.locations[0].name, 'Bench');
});

test('sync creates product, uploads image, writes ids back, then skips when unchanged', async () => {
  const pxd8 = data.list('products').find((p) => p.slug === 'pxd-8');
  data.save('products', { ...pxd8, images: [{ url: '/media/fam/prod/x.webp', hero: '/media/fam/prod/x.webp', thumb: '/media/fam/prod/x.webp', alt: 'Top view', sha1: 'abc' }], variants: [{ ...pxd8.variants[0], inventory: 7 }] }, { publish: true });
  calls.length = 0;
  const r = await shopify.syncProduct(pxd8.id);
  assert.equal(r.skipped, false);
  assert.equal(r.productId, 'gid://shopify/Product/100');
  const ps = calls.find((c) => c.query?.includes('productSet'));
  assert.equal(ps.variables.input.handle, 'pxd-8');
  assert.equal(ps.variables.input.productOptions[0].name, 'Outputs');
  assert.deepEqual(ps.variables.input.variants[0].optionValues, [{ optionName: 'Outputs', name: '8 ch' }]);
  assert.equal(ps.variables.input.variants[0].price, '89.00');
  assert.equal(ps.variables.input.files[0].originalSource, 'https://shopify-staged/x.webp');
  assert.ok(calls.some((c) => c.upload), 'image bytes were posted to the staged target');
  const inv = calls.find((c) => c.query?.includes('inventorySetQuantities'));
  assert.equal(inv.variables.input.quantities[0].quantity, 7);
  const pub = calls.find((c) => c.query?.includes('publishablePublish'));
  assert.deepEqual(pub.variables.input, [{ publicationId: 'gid://shopify/Publication/1' }]);
  const saved = data.get('products', pxd8.id);
  assert.equal(saved.shopify.productId, 'gid://shopify/Product/100');
  assert.equal(saved.variants[0].shopifyVariantId, 'gid://shopify/ProductVariant/1');
  assert.equal(saved.images[0].shopifyMediaId, 'gid://shopify/MediaImage/1');
  assert.equal(saved.shopify.lastError, null);
  assert.ok(saved.shopify.hash);
  // unchanged → skipped, no productSet call
  calls.length = 0;
  const r2 = await shopify.syncProduct(pxd8.id);
  assert.equal(r2.skipped, true);
  assert.ok(!calls.some((c) => c.query?.includes('productSet')));
  // price change → re-sync with the existing ids
  data.save('products', { ...saved, variants: [{ ...saved.variants[0], price: '95.00' }] });
  calls.length = 0;
  const r3 = await shopify.syncProduct(pxd8.id);
  assert.equal(r3.skipped, false);
  const ps3 = calls.find((c) => c.query?.includes('productSet'));
  assert.equal(ps3.variables.input.id, 'gid://shopify/Product/100');
  assert.equal(ps3.variables.input.variants[0].id, 'gid://shopify/ProductVariant/1');
  assert.equal(ps3.variables.input.files[0].id, 'gid://shopify/MediaImage/1', 'unchanged image reuses its media id');
  assert.ok(!calls.some((c) => c.upload), 'no re-upload of unchanged image');
});

test('throttled response is retried', async () => {
  const bundle = data.list('products').find((p) => p.slug === 'starter-bundle');
  throttleOnce = true;
  const r = await shopify.syncProduct(bundle.id, { force: true });
  assert.equal(r.skipped, false);
  const ps = calls.filter((c) => c.query?.includes('productSet'));
  assert.ok(ps.length >= 2, 'productSet was sent again after THROTTLED');
  assert.equal(ps.at(-1).variables.input.productOptions[0].values[0].name, 'Default Title', 'single-variant product uses Title/Default Title');
});

test('userErrors surface and are recorded on the product', async () => {
  const mini = data.list('products').find((p) => p.slug === 'pxd-mini');
  data.save('products', { ...mini, title: 'BAD' });
  await assert.rejects(() => shopify.syncProduct(mini.id, { force: true }), /Handle already in use/);
  assert.match(data.get('products', mini.id).shopify.lastError, /Handle already in use/);
});

test('syncAll reports counts and continues past failures', async () => {
  const r = await shopify.syncAll({ onlyDirty: true });
  assert.equal(r.errors.length, 1);
  assert.ok(r.synced + r.skipped >= 4);
});

test('drafts are refused and unconfigured store is reported', async () => {
  const d = data.save('products', { title: 'Draft only', sku: 'D', family: data.list('families')[0].id, variants: [{ title: 'x', sku: 'D', price: 1 }] });
  await assert.rejects(() => shopify.syncProduct(d.id), /Publish the item/);
  const env = { ...process.env }; delete process.env.SHOPIFY_STORE_DOMAIN; delete process.env.SHOPIFY_ADMIN_TOKEN;
  assert.equal((await shopify.status()).configured, false);
  Object.assign(process.env, env);
  fs.rmSync(tmp, { recursive: true, force: true });
  try { fs.unlinkSync(path.join(__dirname, '..', 'data', 'drafts.json')); } catch { /* none */ }
});
