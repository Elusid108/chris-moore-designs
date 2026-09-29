// Media pipeline, ported from the portfolio CMS. Files live under
// public/media/<family>/<product>/ and are referenced as "/media/..." paths.
// Images get three WebP sizes; unused files go to CMS/.trash (never public/).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const convertHeic = require('heic-convert');
const { ROOT, MEDIA_DIR, TRASH_DIR, MEDIA_WEB_PREFIX } = require('./paths');

const SIZES = { full: { width: 2000, quality: 85, suffix: '' }, hero: { width: 1200, quality: 82, suffix: '-hero' }, thumb: { width: 800, quality: 75, suffix: '-thumb' } };
const COMPANION_SUFFIXES = ['-hero', '-thumb', '-poster', '-poster-thumb'];

// Folder / file name component. Reserved characters and dot runs are replaced
// so a name can never climb out of its parent directory.
function sanitize(name) {
  const safe = String(name ?? '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\.{2,}/g, '_').replace(/^[.\s]+/, '').trim();
  return safe || '_';
}
function folderName(s) { return sanitize(String(s || 'misc').toLowerCase().replace(/\s+/g, '-')); }

function titleSlug(title) {
  const slug = String(title || 'Untitled').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'Untitled';
}
const randomMediaId = () => crypto.randomBytes(4).toString('hex').slice(0, 6);
const MEDIA_KINDS = ['img', 'vid', 'gfx'];
function mediaStem(title, kind) { return `${titleSlug(title)}-${MEDIA_KINDS.includes(kind) ? kind : 'img'}-${randomMediaId()}`; }
function allocateMediaStem(destDir, title, kind) {
  fs.mkdirSync(destDir, { recursive: true });
  for (let i = 0; i < 40; i++) {
    const stem = mediaStem(title, kind);
    if (!['webp', 'mp4', 'webm', 'mov', 'm4v'].some((ext) => fs.existsSync(path.join(destDir, `${stem}.${ext}`)))) return stem;
  }
  throw new Error('Could not allocate a unique media filename');
}

function looksLikeHeic(buf) {
  if (!buf || buf.length < 12) return false;
  const brand = buf.slice(8, 12).toString('ascii');
  return buf.slice(4, 8).toString('ascii') === 'ftyp' && ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis'].includes(brand);
}
async function toDecodableBuffer(srcPath, srcBuffer) {
  const buf = srcBuffer || fs.readFileSync(srcPath);
  if (!looksLikeHeic(buf)) return buf;
  return Buffer.from(await convertHeic({ buffer: buf, format: 'JPEG', quality: 0.92 }));
}

// OneDrive-style folders briefly lock fresh files (EPERM/EBUSY); retry with backoff.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DELAYS = [300, 800, 1500, 3000, 6000, 10000];
function scheduleUnlink(filePath, delays = DELAYS) {
  (async () => {
    for (let i = 0; i < delays.length; i++) {
      try { fs.unlinkSync(filePath); return; } catch (err) {
        if ((err.code === 'EPERM' || err.code === 'EBUSY') && i < delays.length - 1) { await sleep(delays[i]); continue; }
        if (err.code !== 'ENOENT') console.error(`Failed to delete temp file ${filePath}:`, err.message);
        return;
      }
    }
  })();
}
async function retryFsOp(fn, delays = DELAYS) {
  let last;
  for (let i = 0; i < delays.length; i++) {
    try { return fn(); } catch (err) { last = err; if ((err.code === 'EPERM' || err.code === 'EBUSY') && i < delays.length - 1) { await sleep(delays[i]); continue; } throw err; }
  }
  throw last;
}

// --- paths ---
function targetDir({ family, product }) {
  const parts = [folderName(family || 'misc')];
  if (product) parts.push(folderName(product));
  return { abs: path.join(MEDIA_DIR, ...parts), web: `${MEDIA_WEB_PREFIX}/${parts.join('/')}` };
}
function toWebPath(absPath) { return '/' + path.relative(path.join(ROOT, 'public'), absPath).split(path.sep).join('/'); }
// Resolves "/media/..." and refuses anything outside public/media.
function webPathToAbs(webPath) {
  const rel = String(webPath).replace(/^\/+/, '');
  const abs = path.resolve(path.join(ROOT, 'public'), ...rel.split('/'));
  const inside = path.relative(MEDIA_DIR, abs);
  if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) throw new Error(`Path is outside public/media: ${webPath}`);
  return abs;
}
function uniquePath(destAbs) {
  if (!fs.existsSync(destAbs)) return destAbs;
  const dir = path.dirname(destAbs), ext = path.extname(destAbs), base = path.basename(destAbs, ext);
  for (let i = 2; ; i++) { const c = path.join(dir, `${base}-${i}${ext}`); if (!fs.existsSync(c)) return c; }
}
const sha1File = (p) => crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex');
const sha256File = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

// --- uploads ---
async function processUpload(file, { family, product, title } = {}) {
  const { abs: destDir, web: webDir } = targetDir({ family, product });
  const stem = allocateMediaStem(destDir, title || product || family || 'image', 'img');
  let buf;
  try { buf = await toDecodableBuffer(file.path, file.buffer); } catch (err) { if (file.path) scheduleUnlink(file.path); throw new Error(`Image processing failed for "${file.originalname}": HEIC/HEIF conversion failed (${err.message})`); }
  const out = {};
  let meta = null;
  for (const [key, s] of Object.entries(SIZES)) {
    const name = `${stem}${s.suffix}.webp`;
    const dest = path.join(destDir, name);
    try {
      const info = await sharp(buf, { failOn: 'none' }).rotate().resize(s.width, null, { withoutEnlargement: true }).webp({ quality: s.quality }).toFile(dest);
      if (key === 'full') meta = { width: info.width, height: info.height };
      out[key] = `${webDir}/${name}`;
    } catch (err) { console.error(`Sharp ${key} error:`, err.message); }
  }
  const okFull = out.full && fs.statSync(path.join(destDir, `${stem}.webp`)).size > 0;
  if (!okFull) {
    for (const s of Object.values(SIZES)) { try { fs.unlinkSync(path.join(destDir, `${stem}${s.suffix}.webp`)); } catch { /* none */ } }
    if (file.path) scheduleUnlink(file.path);
    throw new Error(`Image processing failed for "${file.originalname}": format may not be supported`);
  }
  if (file.path) scheduleUnlink(file.path);
  return { url: out.full, hero: out.hero || out.full, thumb: out.thumb || out.hero || out.full, alt: '', fit: null, sha1: sha1File(path.join(destDir, `${stem}.webp`)), width: meta?.width || null, height: meta?.height || null };
}

async function processFileUpload(file, { family, product } = {}) {
  const { abs, web } = targetDir({ family, product });
  const destDir = path.join(abs, 'files');
  fs.mkdirSync(destDir, { recursive: true });
  const name = sanitize(file.originalname);
  const dest = uniquePath(path.join(destDir, name));
  await retryFsOp(() => fs.copyFileSync(file.path, dest));
  scheduleUnlink(file.path);
  return { name: path.basename(dest), url: `${web}/files/${path.basename(dest)}`, size: fs.statSync(dest).size, sha256: sha256File(dest) };
}

// --- reference scanning ---
const WEB_RE = /\/media\/[^\s"'<>\\)]+/g;
function normalizeMediaPath(value) {
  if (typeof value !== 'string') return null;
  let s = value.trim().replace(/\\/g, '/').split('?')[0].split('#')[0];
  if (!s.startsWith('/')) s = '/' + s;
  if (!s.startsWith(`${MEDIA_WEB_PREFIX}/`)) return null;
  s = s.replace(/[.,;:)]+$/, '');
  return s || null;
}
function collectPaths(value, set = new Set()) {
  if (typeof value === 'string') {
    const n = normalizeMediaPath(value);
    if (n) set.add(n);
    else if (value.includes('/media/')) for (const m of value.match(WEB_RE) || []) { const nn = normalizeMediaPath(m); if (nn) set.add(nn); }
  } else if (Array.isArray(value)) value.forEach((v) => collectPaths(v, set));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectPaths(v, set));
  return set;
}
function companionPaths(webPath) {
  const slash = webPath.lastIndexOf('/');
  if (slash === -1) return [];
  const dir = webPath.slice(0, slash), base = webPath.slice(slash + 1);
  const dot = base.lastIndexOf('.');
  const stem = dot === -1 ? base : base.slice(0, dot), ext = (dot === -1 ? '' : base.slice(dot)).toLowerCase();
  const out = [];
  if (ext === '.webp' && !COMPANION_SUFFIXES.some((s) => stem.endsWith(s))) out.push(`${dir}/${stem}-hero.webp`, `${dir}/${stem}-thumb.webp`);
  if (/\.(mp4|webm|mov|m4v)$/.test(ext)) out.push(`${dir}/${stem}-poster.webp`, `${dir}/${stem}-poster-thumb.webp`);
  return out;
}
function collectReferencedPaths(everything) {
  const set = collectPaths(everything);
  for (const p of [...set]) companionPaths(p).forEach((c) => set.add(c));
  return set;
}
function listMediaFiles(dir = MEDIA_DIR, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) listMediaFiles(full, acc);
    else if (e.isFile() && !e.name.startsWith('.')) acc.push(toWebPath(full));
  }
  return acc;
}

// --- trash ---
function removeEmptyDirs(dir, isRoot = false) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) removeEmptyDirs(path.join(dir, e.name));
  if (!isRoot && fs.readdirSync(dir).length === 0) { try { fs.rmdirSync(dir); } catch { /* ignore */ } }
}
async function moveToTrash(webPath) {
  let src;
  try { src = webPathToAbs(webPath); } catch (err) { return { ok: false, reason: err.message }; }
  try { if (!fs.existsSync(src) || !fs.statSync(src).isFile()) return { ok: false, reason: 'missing' }; } catch (err) { return { ok: false, reason: err.message }; }
  const rel = path.relative(MEDIA_DIR, src);
  const dest = uniquePath(path.join(TRASH_DIR, rel));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try { await retryFsOp(() => fs.renameSync(src, dest)); return { ok: true }; }
  catch { try { await retryFsOp(() => fs.copyFileSync(src, dest)); await retryFsOp(() => fs.unlinkSync(src)); return { ok: true }; } catch (err) { return { ok: false, reason: err.message }; } }
}
async function trashPaths(candidates) {
  const moved = [], warnings = [], seen = new Set();
  for (const p of candidates) {
    if (!p || seen.has(p)) continue; seen.add(p);
    const r = await moveToTrash(p);
    if (r.ok) moved.push(p); else if (r.reason !== 'missing') warnings.push(`${p}: ${r.reason}`);
  }
  if (moved.length) removeEmptyDirs(MEDIA_DIR, true);
  return { moved: moved.length, files: moved, warnings };
}
async function trashUnusedMedia(everything) {
  const used = collectReferencedPaths(everything);
  return trashPaths(listMediaFiles().filter((p) => !used.has(p)));
}
// After a save/delete: anything the old item referenced that the new one (and nothing else) does.
async function trashDroppedAssets(oldItem, newItem, everything) {
  const oldPaths = collectPaths(oldItem), newPaths = collectPaths(newItem || {});
  const dropped = [...oldPaths].filter((p) => !newPaths.has(p));
  if (!dropped.length) return { moved: 0, files: [], warnings: [] };
  const used = collectReferencedPaths(everything);
  const toTrash = new Set(dropped.filter((p) => !used.has(p)));
  for (const p of [...toTrash]) for (const c of companionPaths(p)) if (!used.has(c)) toTrash.add(c);
  return trashPaths([...toTrash]);
}

module.exports = { SIZES, sanitize, folderName, titleSlug, allocateMediaStem, scheduleUnlink, retryFsOp, targetDir, toWebPath, webPathToAbs, sha256File, processUpload, processFileUpload, normalizeMediaPath, collectPaths, companionPaths, collectReferencedPaths, listMediaFiles, trashPaths, trashUnusedMedia, trashDroppedAssets };
