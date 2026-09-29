// Open Graph images: public/og/<slug>.jpg (1200×630) per product and family,
// plus og/site.jpg. Composited with Sharp from the hero image (or the brand
// gradient) and the title. Regenerated at publish; unchanged output is skipped.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const data = require('./data');
const { ROOT } = require('./paths');
const { webPathToAbs, esc } = (() => { const m = require('./media'); const { esc } = require('./specs'); return { webPathToAbs: m.webPathToAbs, esc }; })();

const OG_DIR = path.join(ROOT, 'public', 'og');
const W = 1200, H = 630;

function wrap(text, max = 24) {
  const words = String(text).split(/\s+/); const lines = []; let line = '';
  for (const w of words) { if ((line + ' ' + w).trim().length > max && line) { lines.push(line); line = w; } else line = (line + ' ' + w).trim(); }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function overlaySvg({ title, eyebrow, price, siteName }) {
  const lines = wrap(title);
  const size = lines.length > 2 ? 60 : 72;
  const text = lines.map((l, i) => `<text x="72" y="${300 + i * (size + 10)}" font-family="Inter, Arial, sans-serif" font-weight="800" font-size="${size}" fill="#ffffff">${esc(l)}</text>`).join('');
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#a855f7"/></linearGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#09090b" stop-opacity="0.55"/><stop offset="1" stop-color="#09090b" stop-opacity="0.92"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#shade)"/>
    <text x="72" y="215" font-family="JetBrains Mono, Consolas, monospace" font-size="24" letter-spacing="4" fill="#22d3ee">${esc(String(eyebrow || '').toUpperCase())}</text>
    ${text}
    ${price ? `<text x="72" y="${300 + lines.length * (size + 10) + 20}" font-family="JetBrains Mono, Consolas, monospace" font-size="34" fill="#e4e4e7">${esc(price)}</text>` : ''}
    <rect x="72" y="${H - 96}" width="180" height="6" fill="url(#g)"/>
    <text x="72" y="${H - 52}" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="26" fill="#e4e4e7">${esc(siteName)}</text>
  </svg>`);
}

async function background(imgWebPath) {
  if (imgWebPath) { try { return await sharp(webPathToAbs(imgWebPath)).resize(W, H, { fit: 'cover' }).toBuffer(); } catch { /* fall through */ } }
  const dots = Array.from({ length: Math.ceil(W / 18) * Math.ceil(H / 18) }, (_, i) => { const x = (i % Math.ceil(W / 18)) * 18 + 9, y = Math.floor(i / Math.ceil(W / 18)) * 18 + 9; const hue = 232 + 40 * Math.sin(x / 90 + y / 70); return `<rect x="${x - 1.5}" y="${y - 1.5}" width="3" height="3" fill="hsl(${hue.toFixed(0)},90%,60%)" opacity="0.5"/>`; }).join('');
  return sharp(Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" fill="#09090b"/>${dots}</svg>`)).png().toBuffer();
}

async function render(file, opts, bgPath) {
  const bg = await background(bgPath);
  const out = await sharp(bg).composite([{ input: overlaySvg(opts), top: 0, left: 0 }]).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  fs.mkdirSync(OG_DIR, { recursive: true });
  const dest = path.join(OG_DIR, file);
  const prev = fs.existsSync(dest) ? fs.readFileSync(dest) : null;
  if (prev && crypto.createHash('sha1').update(prev).digest('hex') === crypto.createHash('sha1').update(out).digest('hex')) return false;
  fs.writeFileSync(dest, out);
  return true;
}

async function generateAll(emit = () => {}) {
  const settings = data.getSettings();
  const siteName = settings.site?.name || 'Chris Moore Designs';
  const currency = settings.site?.currency || 'USD';
  const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: Number(n) % 1 ? 2 : 0 }).format(Number(n));
  const products = data.readPublished('products').filter((p) => p.status !== 'archived');
  const families = data.readPublished('families');
  const famName = (id) => families.find((f) => f.id === id)?.name || '';
  const keep = new Set(['site.jpg']);
  let written = 0;
  if (await render('site.jpg', { title: settings.site?.tagline || siteName, eyebrow: 'chrismooredesigns.com', siteName }, null)) written++;
  for (const p of products) {
    const prices = p.variants.map((v) => Number(v.price)).filter((n) => n > 0);
    const price = prices.length ? (Math.min(...prices) === Math.max(...prices) ? money(prices[0]) : `from ${money(Math.min(...prices))}`) : '';
    const file = `${p.slug}.jpg`; keep.add(file);
    if (await render(file, { title: p.title, eyebrow: `${famName(p.family)} · ${p.sku}`, price, siteName }, p.images?.[0]?.hero || p.images?.[0]?.url || null)) written++;
  }
  for (const f of families) { const file = `family-${f.slug}.jpg`; keep.add(file); if (await render(file, { title: f.name, eyebrow: 'Product family', siteName }, f.heroImage?.hero || f.heroImage?.url || null)) written++; }
  for (const e of fs.existsSync(OG_DIR) ? fs.readdirSync(OG_DIR) : []) if (!keep.has(e) && e.endsWith('.jpg')) fs.unlinkSync(path.join(OG_DIR, e));
  emit('og', 'done', `${written} image(s) regenerated`);
  return { written, total: keep.size };
}

module.exports = { generateAll, render };
