// Local CMS for chrismooredesigns.com. Binds to 127.0.0.1 only, has no login,
// and refuses cross-site requests (same guard as the portfolio CMS).
const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { loadEnv } = require('./lib/env');
loadEnv();
const { ROOT, MEDIA_DIR } = require('./lib/paths');
const data = require('./lib/data');
const media = require('./lib/media');
const video = require('./lib/video');
const disk = require('./lib/disk');
const git = require('./lib/git');
const publish = require('./lib/publish');
const preview = require('./lib/preview');
let shopify = null;
try { shopify = require('./lib/shopify-admin'); } catch { /* Phase 4 */ }
let gemini = null;
try { gemini = require('./lib/gemini'); } catch { /* Phase 5 */ }

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const PKG = require('./package.json');

const UPLOAD_TEMP_DIR = path.join(os.tmpdir(), 'cmd-cms-uploads');
fs.mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });
fs.mkdirSync(MEDIA_DIR, { recursive: true });
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
(function cleanupOrphanTemps() {
  try {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const entry of fs.readdirSync(UPLOAD_TEMP_DIR)) {
      const full = path.join(UPLOAD_TEMP_DIR, entry);
      try { const st = fs.statSync(full); if (st.isFile() && st.mtimeMs < cutoff) fs.unlinkSync(full); } catch { /* ignore */ }
    }
  } catch { /* first run */ }
})();

app.use(express.json({ limit: '20mb' }));

function isLocalOrigin(value) {
  if (!value) return true;
  try { const { hostname, port } = new URL(value); return ['localhost', '127.0.0.1', '[::1]'].includes(hostname) && String(port || 80) === String(PORT); } catch { return false; }
}
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
app.use((req, res, next) => { if (!LOCAL_HOSTNAMES.has(req.hostname)) return res.status(403).send('Forbidden host'); next(); });
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (isLocalOrigin(req.get('origin') || req.get('referer'))) return next();
  res.status(403).json({ error: 'Cross-site request blocked' });
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/media', express.static(MEDIA_DIR));

const upload = multer({ dest: UPLOAD_TEMP_DIR, limits: { fileSize: 60 * 1024 * 1024 } });
const uploadBig = multer({ dest: UPLOAD_TEMP_DIR, limits: { fileSize: 600 * 1024 * 1024 } });

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message, details: err.details || undefined });
});

// --- status ---
app.get('/api/status', wrap(async (req, res) => {
  const g = await git.status();
  res.json({ version: PKG.version, root: ROOT, git: g, repo: git.repoWebUrl(g.remote), shopify: shopify ? await shopify.status() : { configured: false, ok: false, error: 'Shopify sync not installed yet' }, gemini: Boolean(gemini), preview: preview.state() });
}));
app.get('/api/storage', (req, res) => res.json(disk.getStorage()));

// --- settings / tasks ---
app.get('/api/settings', (req, res) => res.json(data.getSettings()));
app.post('/api/settings', wrap(async (req, res) => {
  const old = data.getSettings();
  const saved = data.saveSettings(req.body || {});
  const trash = await media.trashDroppedAssets(old, saved, data.everything());
  res.json({ settings: saved, trash });
}));
app.get('/api/tasks', (req, res) => res.json(data.getTasks()));
app.post('/api/tasks', (req, res) => res.json(data.saveTasks(req.body)));

// --- media ---
app.post('/api/media/upload', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json(await media.processUpload(req.file, { family: req.body.family, product: req.body.product, title: req.body.title }));
}));
app.post('/api/media/upload-file', uploadBig.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json(await media.processFileUpload(req.file, { family: req.body.family, product: req.body.product }));
}));
const sseClients = new Map();
app.get('/api/media/video-progress/:jobId', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ ready: true })}\n\n`);
  sseClients.set(req.params.jobId, res);
  req.on('close', () => sseClients.delete(req.params.jobId));
});
app.post('/api/media/upload-video', uploadBig.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const jobId = req.body.jobId;
  const onProgress = (pct, mark) => { const c = jobId && sseClients.get(jobId); if (c) c.write(`data: ${JSON.stringify({ pct, mark })}\n\n`); };
  const result = await video.processVideoUpload(req.file, { family: req.body.family, product: req.body.product, title: req.body.title }, onProgress, req.body.keepAudio === 'true');
  const c = jobId && sseClients.get(jobId); if (c) { c.write(`data: ${JSON.stringify({ done: true })}\n\n`); c.end(); sseClients.delete(jobId); }
  res.json(result);
}));
app.post('/api/media/cleanup', wrap(async (req, res) => res.json(await media.trashUnusedMedia(data.everything()))));
app.get('/api/media/list', (req, res) => res.json(media.listMediaFiles()));

// --- publish ---
const publishListeners = new Set();
const emit = (step, state, detail) => { const msg = `data: ${JSON.stringify({ step, state, detail, at: Date.now() })}\n\n`; for (const r of publishListeners) r.write(msg); };
app.get('/api/publish/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders(); res.write(`data: ${JSON.stringify({ ready: true })}\n\n`);
  publishListeners.add(res); req.on('close', () => publishListeners.delete(res));
});
app.get('/api/publish/validate', (req, res) => res.json(publish.validate()));
app.get('/api/publish/status', wrap(async (req, res) => res.json(await git.status())));
let publishing = false;
app.post('/api/publish', wrap(async (req, res) => {
  if (publishing) return res.status(409).json({ error: 'A publish is already running' });
  publishing = true;
  try {
    const { message, dryRun = false, verifyBuild = true, syncShopify = true } = req.body || {};
    const beforeGit = shopify && syncShopify ? async (e) => { const st = await shopify.status(); if (!st.configured) { e('shopify', 'skipped', 'Shopify not configured'); return; } if (!st.ok) { e('shopify', 'warn', st.error || 'Shopify not reachable; skipped'); return; } e('shopify', 'running', 'Syncing changed products'); const r = await shopify.syncAll({ onlyDirty: true, emit: e }); e('shopify', r.errors.length ? 'warn' : 'done', `${r.synced} synced, ${r.skipped} unchanged${r.errors.length ? `, ${r.errors.length} failed` : ''}`); } : null;
    const result = await publish.publish({ message, dryRun, verifyBuild, beforeGit, emit });
    emit('done', 'done', result.pushed ? 'Published' : result.dryRun ? 'Dry run complete' : 'Nothing to publish');
    res.json(result);
  } catch (err) { emit('done', 'error', err.message); throw err; } finally { publishing = false; }
}));
app.get('/api/publish/run', wrap(async (req, res) => res.json(await publish.fetchActionsRun({ owner: req.query.owner, repo: req.query.repo, sha: req.query.sha }))));

// --- preview (production build with drafts merged in, served locally) ---
app.get('/api/preview/status', (req, res) => res.json(preview.state()));
app.post('/api/preview/start', (req, res) => res.json(preview.start()));
app.post('/api/preview/stop', (req, res) => res.json(preview.stop()));

// --- shopify (Phase 4) ---
app.get('/api/shopify/status', wrap(async (req, res) => res.json(shopify ? await shopify.status() : { configured: false, ok: false, error: 'Shopify sync not installed yet' })));
app.post('/api/shopify/sync/:id', wrap(async (req, res) => { if (!shopify) return res.status(501).json({ error: 'Shopify sync not installed yet' }); res.json(await shopify.syncProduct(req.params.id, { force: Boolean(req.body?.force) })); }));
app.post('/api/shopify/sync-all', wrap(async (req, res) => { if (!shopify) return res.status(501).json({ error: 'Shopify sync not installed yet' }); res.json(await shopify.syncAll({ onlyDirty: !req.body?.force })); }));

// --- gemini (Phase 5) ---
app.post('/api/gemini', wrap(async (req, res) => { if (!gemini) return res.status(501).json({ error: 'AI copywriting not installed yet' }); res.json(await gemini.runTask(req.body || {})); }));

// --- collections ---
app.get('/api/collections', (req, res) => {
  const out = {};
  for (const c of data.COLLECTIONS) out[c] = data.list(c);
  res.json(out);
});
app.get('/api/:collection', wrap(async (req, res) => res.json(data.list(req.params.collection))));
app.post('/api/:collection/reorder', wrap(async (req, res) => res.json(data.reorder(req.params.collection, Array.isArray(req.body?.ids) ? req.body.ids : []))));
app.get('/api/:collection/:id', wrap(async (req, res) => { const item = data.get(req.params.collection, req.params.id); if (!item) return res.status(404).json({ error: 'Not found' }); res.json(item); }));
app.post('/api/:collection', wrap(async (req, res) => {
  const name = data.assertCollection(req.params.collection);
  const old = req.body?.id ? data.get(name, req.body.id) : null;
  const saved = data.save(name, req.body || {}, { publish: Boolean(req.query.publish) });
  const trash = old ? await media.trashDroppedAssets(old, saved, data.everything()) : { moved: 0, files: [], warnings: [] };
  res.json({ item: saved, trash });
}));
app.post('/api/:collection/:id/publish', wrap(async (req, res) => res.json(data.publishItem(req.params.collection, req.params.id))));
app.post('/api/:collection/:id/unpublish', wrap(async (req, res) => res.json(data.unpublishItem(req.params.collection, req.params.id))));
app.delete('/api/:collection/:id', wrap(async (req, res) => {
  const name = data.assertCollection(req.params.collection);
  const removed = data.remove(name, req.params.id);
  if (!removed) return res.status(404).json({ error: 'Not found' });
  const trash = await media.trashDroppedAssets(removed, null, data.everything());
  res.json({ ok: true, trash });
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown API route' }));

if (require.main === module) {
  const server = app.listen(PORT, HOST, () => {
    console.log(`CMS v${PKG.version} → http://localhost:${PORT}  (repo: ${ROOT})`);
  });
  server.on('error', (err) => { if (err.code === 'EADDRINUSE') { console.error(`Port ${PORT} is in use. Close the other CMS window or set PORT=...`); process.exit(1); } throw err; });
}
module.exports = app;
