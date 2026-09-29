// Collections live in content/<name>.json (committed, published) and
// CMS/data/drafts.json (gitignored, unpublished). Items carry `published`
// only in API responses, never on disk.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { CONTENT_DIR, DATA_DIR } = require('./paths');
const { slugify, trackSlugChange } = require('./slug');
const { specsDataToHtml, normalizeSpecsData } = require('./specs');

const COLLECTIONS = ['families', 'products', 'firmware', 'software', 'services'];
const DRAFTS_FILE = path.join(DATA_DIR, 'drafts.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const SETTINGS_FILE = path.join(CONTENT_DIR, 'settings.json');

function assertCollection(name) {
  if (!COLLECTIONS.includes(name)) throw Object.assign(new Error(`Unknown collection "${name}"`), { status: 404 });
  return name;
}

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (err) { if (err.code === 'ENOENT') return fallback; throw err; }
}

// Atomic: write next to the target, then rename. Git (and Astro dev) may read
// these files at any moment, so they must never be half-written.
function writeJSON(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

const contentFile = (name) => path.join(CONTENT_DIR, `${name}.json`);
const readPublished = (name) => readJSON(contentFile(name), []);
const writePublished = (name, items) => writeJSON(contentFile(name), items);
const readDrafts = () => { const d = readJSON(DRAFTS_FILE, {}); for (const c of COLLECTIONS) if (!Array.isArray(d[c])) d[c] = []; return d; };
const writeDrafts = (d) => writeJSON(DRAFTS_FILE, d);

const titleOf = (item) => item.title || item.name || 'item';
const newId = () => crypto.randomUUID();

function list(name) {
  assertCollection(name);
  const published = readPublished(name).map((i) => ({ ...i, published: true }));
  const drafts = readDrafts()[name].map((i) => ({ ...i, published: false }));
  return [...published, ...drafts].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

function find(name, id) {
  assertCollection(name);
  const pub = readPublished(name).find((i) => i.id === id);
  if (pub) return { item: pub, published: true };
  const draft = readDrafts()[name].find((i) => i.id === id);
  if (draft) return { item: draft, published: false };
  return null;
}

function get(name, id) {
  const hit = find(name, id);
  return hit ? { ...hit.item, published: hit.published } : null;
}

function allSlugs(name, exceptId) {
  const taken = new Set();
  for (const i of [...readPublished(name), ...readDrafts()[name]]) {
    if (i.id === exceptId) continue;
    if (i.slug) taken.add(i.slug);
    for (const s of i.slugHistory || []) taken.add(s);
  }
  return taken;
}

function uniqueSlug(name, base, exceptId) {
  const taken = allSlugs(name, exceptId);
  let slug = base || 'item';
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

// Normalise fields that the site depends on. Keeps unknown fields as-is.
function normalize(name, item, existing) {
  const out = { ...(existing || {}), ...item };
  delete out.published;
  out.id = out.id || newId();
  out.timestamp = out.timestamp || new Date().toISOString();
  out.updatedAt = new Date().toISOString();
  if (existing) trackSlugChange(existing, out);
  out.slug = uniqueSlug(name, slugify(out.slug || titleOf(out)), out.id);
  out.slugHistory = Array.isArray(out.slugHistory) ? out.slugHistory.filter((s) => s && s !== out.slug) : [];
  if (typeof out.order !== 'number') out.order = 100;
  if (name === 'products') {
    out.specsData = normalizeSpecsData(out.specsData);
    out.specs = specsDataToHtml(out.specsData);
    out.optionName = out.optionName || 'Title';
    out.variants = (Array.isArray(out.variants) ? out.variants : []).map((v, i) => ({
      id: v.id || `v-${out.id.slice(0, 8)}-${i + 1}`, title: String(v.title || 'Default Title'), sku: String(v.sku || out.sku || ''),
      price: String(Number(v.price || 0).toFixed(2)), compareAt: v.compareAt ? String(Number(v.compareAt).toFixed(2)) : null,
      options: v.options && typeof v.options === 'object' ? v.options : { [out.optionName]: String(v.title || 'Default Title') },
      inventory: v.inventory == null || v.inventory === '' ? null : Number(v.inventory), shopifyVariantId: v.shopifyVariantId || null,
    }));
    if (out.variants.length === 0) out.variants = [{ id: `v-${out.id.slice(0, 8)}-1`, title: 'Default Title', sku: out.sku || '', price: '0.00', compareAt: null, options: { Title: 'Default Title' }, inventory: null, shopifyVariantId: null }];
    out.badges = { bestSeller: Boolean(out.badges?.bestSeller), bundle: Boolean(out.badges?.bundle) };
    out.status = out.status === 'archived' ? 'archived' : 'active';
    out.shopify = { productId: null, hash: null, lastSyncedAt: null, lastError: null, ...(out.shopify || {}), handle: out.slug };
    for (const k of ['images', 'gallery', 'files', 'firmware', 'software', 'related']) if (!Array.isArray(out[k])) out[k] = [];
    out.related = out.related.filter((id) => id !== out.id);
  }
  return out;
}

// Keeps product.related symmetric across published + draft products.
function syncRelated(saved) {
  const drafts = readDrafts();
  const pub = readPublished('products');
  let pubChanged = false, draftChanged = false;
  const touch = (arr, flag) => {
    for (const p of arr) {
      if (p.id === saved.id) continue;
      const rel = new Set(Array.isArray(p.related) ? p.related : []);
      const should = saved.related.includes(p.id);
      if (should && !rel.has(saved.id)) { rel.add(saved.id); p.related = [...rel]; flag(); }
      if (!should && rel.has(saved.id)) { rel.delete(saved.id); p.related = [...rel]; flag(); }
    }
  };
  touch(pub, () => (pubChanged = true));
  touch(drafts.products, () => (draftChanged = true));
  if (pubChanged) writePublished('products', pub);
  if (draftChanged) writeDrafts(drafts);
}

function save(name, item, { publish = false } = {}) {
  assertCollection(name);
  const hit = item.id ? find(name, item.id) : null;
  const saved = normalize(name, item, hit?.item);
  if (hit?.published || publish) {
    const pub = readPublished(name).filter((i) => i.id !== saved.id);
    pub.push(saved);
    writePublished(name, pub);
    if (hit && !hit.published) { const d = readDrafts(); d[name] = d[name].filter((i) => i.id !== saved.id); writeDrafts(d); }
  } else {
    const d = readDrafts();
    d[name] = d[name].filter((i) => i.id !== saved.id);
    d[name].push(saved);
    writeDrafts(d);
  }
  if (name === 'products') syncRelated(saved);
  return { ...saved, published: Boolean(hit?.published || publish) };
}

function publishItem(name, id) {
  const hit = find(name, id);
  if (!hit) throw Object.assign(new Error('Not found'), { status: 404 });
  if (hit.published) return { ...hit.item, published: true };
  return save(name, hit.item, { publish: true });
}

function unpublishItem(name, id) {
  const hit = find(name, id);
  if (!hit) throw Object.assign(new Error('Not found'), { status: 404 });
  if (!hit.published) return { ...hit.item, published: false };
  writePublished(name, readPublished(name).filter((i) => i.id !== id));
  const d = readDrafts(); d[name].push(hit.item); writeDrafts(d);
  return { ...hit.item, published: false };
}

function remove(name, id) {
  const hit = find(name, id);
  if (!hit) return null;
  if (hit.published) writePublished(name, readPublished(name).filter((i) => i.id !== id));
  else { const d = readDrafts(); d[name] = d[name].filter((i) => i.id !== id); writeDrafts(d); }
  if (name === 'products') {
    const strip = (arr) => { let c = false; for (const p of arr) if (Array.isArray(p.related) && p.related.includes(id)) { p.related = p.related.filter((r) => r !== id); c = true; } return c; };
    const pub = readPublished('products'); if (strip(pub)) writePublished('products', pub);
    const d = readDrafts(); if (strip(d.products)) writeDrafts(d);
  }
  return hit.item;
}

function reorder(name, ids) {
  assertCollection(name);
  const pos = new Map(ids.map((id, i) => [id, i]));
  const pub = readPublished(name); let pc = false;
  for (const i of pub) if (pos.has(i.id) && i.order !== pos.get(i.id)) { i.order = pos.get(i.id); pc = true; }
  if (pc) writePublished(name, pub);
  const d = readDrafts(); let dc = false;
  for (const i of d[name]) if (pos.has(i.id) && i.order !== pos.get(i.id)) { i.order = pos.get(i.id); dc = true; }
  if (dc) writeDrafts(d);
  return list(name);
}

function getSettings() { return readJSON(SETTINGS_FILE, {}); }
function saveSettings(settings) { const merged = { ...getSettings(), ...settings }; writeJSON(SETTINGS_FILE, merged); return merged; }

function getTasks() { return readJSON(TASKS_FILE, { tasks: [] }); }
function saveTasks(body) {
  const statuses = new Set(['todo', 'in-progress', 'blocked', 'done']);
  const norm = (t, i) => ({ id: t.id || `t-${Date.now().toString(36)}-${i}`, title: String(t.title || ''), status: statuses.has(t.status) ? t.status : 'todo', description: String(t.description || ''), notes: String(t.notes || ''), order: typeof t.order === 'number' ? t.order : i, subtasks: Array.isArray(t.subtasks) ? t.subtasks.map((s, j) => ({ id: s.id || `s-${Date.now().toString(36)}-${j}`, title: String(s.title || ''), status: statuses.has(s.status) ? s.status : 'todo' })) : [] });
  const tasks = (Array.isArray(body?.tasks) ? body.tasks : []).map(norm);
  writeJSON(TASKS_FILE, { tasks });
  return { tasks };
}

/** Apply a patch to a published item in place (used by Shopify sync write-back). */
function patchPublished(name, id, fn) {
  assertCollection(name);
  const items = readPublished(name);
  const item = items.find((i) => i.id === id);
  if (!item) return null;
  fn(item);
  writePublished(name, items);
  return item;
}

/** Every item across all collections, published and draft (for media reference scans). */
function everything() {
  const d = readDrafts();
  const out = { settings: getSettings() };
  for (const c of COLLECTIONS) out[c] = [...readPublished(c), ...d[c]];
  return out;
}

module.exports = { COLLECTIONS, assertCollection, list, get, find, save, publishItem, unpublishItem, remove, reorder, getSettings, saveSettings, getTasks, saveTasks, everything, patchPublished, readJSON, writeJSON, readPublished, writePublished, readDrafts, writeDrafts };
