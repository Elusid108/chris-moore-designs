// End-to-end API smoke test against a throwaway copy of the repo content.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cmd-cms-api-'));
fs.mkdirSync(path.join(tmp, 'public'), { recursive: true });
fs.cpSync(path.join(__dirname, '..', '..', 'content'), path.join(tmp, 'content'), { recursive: true });
process.env.CMD_CMS_ROOT = tmp;
process.env.PORT = '3997';
const app = require('../server');

test('product lifecycle: draft → image → publish → delete → cleanup', async () => {
  const server = app.listen(3997, '127.0.0.1');
  const base = 'http://127.0.0.1:3997';
  const json = async (url, opts) => { const r = await fetch(base + url, opts); const b = await r.json(); if (!r.ok) throw new Error(`${url}: ${b.error}`); return b; };
  const post = (url, body) => json(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(body) });
  try {
    const families = await json('/api/families');
    const created = await post('/api/products', { title: 'Test Board', sku: 'TB-1', family: families[0].id, optionName: 'Outputs', variants: [{ title: '4 ch', sku: 'TB-1-4', price: 12.5 }], specsData: [{ title: 'Specs', items: [{ name: 'MCU', specs: 'ESP32' }] }] });
    assert.equal(created.item.published, false, 'new items are drafts');
    assert.equal(created.item.slug, 'test-board');
    assert.match(created.item.specs, /<dt>MCU<\/dt><dd>ESP32<\/dd>/);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'data', 'drafts.json')));
    assert.ok(!JSON.parse(fs.readFileSync(path.join(tmp, 'content', 'products.json'))).some((p) => p.id === created.item.id), 'draft not in content/');

    // image upload (multipart) → three WebP sizes
    const sharp = require('sharp');
    const png = await sharp({ create: { width: 1400, height: 900, channels: 3, background: '#22d3ee' } }).png().toBuffer();
    const form = new FormData();
    form.append('file', new Blob([png], { type: 'image/png' }), 'board.png');
    form.append('family', 'pixeldecode'); form.append('product', 'test-board'); form.append('title', 'Test Board');
    const img = await json('/api/media/upload', { method: 'POST', headers: { Origin: base }, body: form });
    assert.match(img.url, /^\/media\/pixeldecode\/test-board\/Test-Board-img-[a-f0-9]{6}\.webp$/);
    for (const k of ['url', 'hero', 'thumb']) assert.ok(fs.existsSync(path.join(tmp, 'public', img[k])), `${k} exists`);
    const heroMeta = await sharp(path.join(tmp, 'public', img.hero)).metadata();
    assert.equal(heroMeta.width, 1200);

    const withImage = await post('/api/products', { ...created.item, images: [img] });
    assert.equal(withImage.item.images.length, 1);

    const published = await post(`/api/products/${created.item.id}/publish`);
    assert.equal(published.published, true);
    assert.ok(JSON.parse(fs.readFileSync(path.join(tmp, 'content', 'products.json'))).some((p) => p.id === created.item.id), 'now in content/');

    // validation sees it; dry-run publish stages it (build skipped)
    const v = await json('/api/publish/validate');
    assert.deepEqual(v.errors, []);

    // remove image reference → files trashed
    const noImage = await post('/api/products', { ...withImage.item, images: [] });
    assert.equal(noImage.trash.moved, 3, 'full + hero + thumb trashed');
    assert.ok(!fs.existsSync(path.join(tmp, 'public', img.url)));
    assert.ok(fs.existsSync(path.join(__dirname, '..', '.trash', 'pixeldecode', 'test-board', path.basename(img.url))));

    // related links are symmetric
    const pxd8 = (await json('/api/products')).find((p) => p.slug === 'pxd-8');
    await post('/api/products', { ...noImage.item, related: [pxd8.id] });
    const pxd8After = await json(`/api/products/${pxd8.id}`);
    assert.ok(pxd8After.related.includes(created.item.id));

    const del = await json(`/api/products/${created.item.id}`, { method: 'DELETE', headers: { Origin: base } });
    assert.equal(del.ok, true);
    assert.ok(!(await json(`/api/products/${pxd8.id}`)).related.includes(created.item.id), 'reverse link removed');

    // cross-site guard
    const blocked = await fetch(base + '/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{}' });
    assert.equal(blocked.status, 403);
  } finally {
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
    try { fs.unlinkSync(path.join(__dirname, '..', 'data', 'drafts.json')); } catch { /* none */ }
    fs.rmSync(path.join(__dirname, '..', '.trash'), { recursive: true, force: true });
  }
});
