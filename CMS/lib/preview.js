// Local preview: a production build of the site as it would be if every
// draft were published, served on 127.0.0.1. Nothing here touches content/
// or git; the merged content and the build live under CMS/data/preview.
const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const data = require('./data');
const { ROOT, DATA_DIR } = require('./paths');

const PREVIEW_PORT = Number(process.env.PREVIEW_PORT) || 4321;
const PREVIEW_HOST = '127.0.0.1';
const PREVIEW_DIR = path.join(DATA_DIR, 'preview');
const CONTENT_OUT = path.join(PREVIEW_DIR, 'content');
const DIST_OUT = path.join(PREVIEW_DIR, 'dist');
const LOG_FILE = path.join(DATA_DIR, 'preview.log');
const ASTRO_BIN = path.join(ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs');

let server = null;
let building = null;
let buildId = 0;
let last = { status: 'idle', error: null, builtAt: null, ms: null };

// Astro resolves loader paths against the project root, so hand it a
// root-relative path with forward slashes (a Windows absolute path parses as a URL scheme).
const toRootRelative = (abs) => './' + path.relative(ROOT, abs).split(path.sep).join('/');

function writeContent() {
  fs.mkdirSync(CONTENT_OUT, { recursive: true });
  for (const c of data.COLLECTIONS) {
    const items = data.list(c).map(({ published, ...item }) => item);
    data.writeJSON(path.join(CONTENT_OUT, `${c}.json`), items);
  }
  return CONTENT_OUT;
}

function runBuild() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(ASTRO_BIN)) return reject(new Error('The site dependencies are not installed. Run "npm ci" in the repo root (launch.bat does this for you) and try again.'));
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const chunks = [];
    const child = spawn(process.execPath, [ASTRO_BIN, 'build', '--outDir', DIST_OUT], {
      cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
      env: { ...process.env, CMD_CONTENT_DIR: toRootRelative(CONTENT_OUT), FORCE_COLOR: '0', NO_COLOR: '1' },
    });
    child.stdout.on('data', (b) => chunks.push(b));
    child.stderr.on('data', (b) => chunks.push(b));
    child.on('error', reject);
    child.on('close', (code) => {
      const out = Buffer.concat(chunks).toString('utf8');
      try { fs.writeFileSync(LOG_FILE, out); } catch { /* log is best effort */ }
      if (code === 0) resolve(out);
      else reject(new Error(out.trim().slice(-4000) || `astro build exited with code ${code}`));
    });
  });
}

function serve() {
  if (server) return Promise.resolve();
  const app = express();
  app.use(express.static(DIST_OUT, { extensions: ['html'] }));
  app.use((req, res) => {
    const notFound = path.join(DIST_OUT, '404.html');
    if (fs.existsSync(notFound)) return res.status(404).sendFile(notFound);
    res.status(404).send('Not found');
  });
  return new Promise((resolve, reject) => {
    const s = app.listen(PREVIEW_PORT, PREVIEW_HOST, () => { server = s; resolve(); });
    s.on('error', (err) => reject(err.code === 'EADDRINUSE' ? new Error(`Port ${PREVIEW_PORT} is in use. Close whatever is using it (an old "astro dev"?) or set PREVIEW_PORT in CMS/.env.`) : err));
  });
}

/** Starts a build unless one is already running. Returns immediately; poll state(). */
function start() {
  if (building) return state();
  const id = ++buildId;
  const started = Date.now();
  last = { ...last, status: 'building', error: null };
  building = (async () => {
    try {
      writeContent();
      await runBuild();
      await serve();
      last = { status: 'ready', error: null, builtAt: new Date().toISOString(), ms: Date.now() - started };
    } catch (err) {
      last = { status: 'error', error: err.message, builtAt: last.builtAt, ms: Date.now() - started };
    } finally { if (id === buildId) building = null; }
  })();
  return state();
}

function stop() {
  if (server) { server.close(); server = null; }
  if (!building) last = { ...last, status: 'idle', error: null };
  return state();
}

function state() {
  return { ...last, buildId, running: Boolean(server), url: `http://${PREVIEW_HOST}:${PREVIEW_PORT}/`, port: PREVIEW_PORT };
}

const idle = () => building || Promise.resolve();

module.exports = { start, stop, state, idle, writeContent, PREVIEW_PORT, CONTENT_OUT, DIST_OUT };
