// Publish = validate → normalise → (optional build gate) → git commit + push.
// Shopify sync is inserted as a step by server.js when configured (Phase 4).
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const data = require('./data');
const git = require('./git');
const { ROOT, MEDIA_DIR } = require('./paths');
const { webPathToAbs, collectPaths } = require('./media');

function validate() {
  const errors = [], warnings = [];
  const all = data.everything();
  const settings = all.settings || {};
  const familyIds = new Set(data.readPublished('families').map((f) => f.id));
  for (const c of data.COLLECTIONS) {
    const seen = new Map();
    for (const item of data.readPublished(c)) {
      const label = `${c}/${item.slug || item.id}`;
      if (!item.slug) errors.push(`${label}: missing slug`);
      if (seen.has(item.slug)) errors.push(`${label}: duplicate slug (also ${seen.get(item.slug)})`); else seen.set(item.slug, item.id);
      if (c === 'products') {
        if (!familyIds.has(item.family)) errors.push(`${label}: family is not published`);
        if (!item.variants?.length) errors.push(`${label}: no variants`);
        else for (const v of item.variants) if (!(Number(v.price) > 0)) warnings.push(`${label}: variant "${v.title}" has no price`);
        if (!item.images?.length) warnings.push(`${label}: no product image`);
      }
      for (const p of collectPaths(item)) {
        try { if (!fs.existsSync(webPathToAbs(p))) errors.push(`${label}: missing media file ${p}`); } catch (err) { errors.push(`${label}: ${err.message}`); }
      }
    }
  }
  if (!settings.home?.heroProduct) errors.push('settings: home.heroProduct is not set');
  else if (!data.readPublished('products').some((p) => p.id === settings.home.heroProduct)) errors.push('settings: home.heroProduct is not a published product');
  return { errors, warnings };
}

function runBuild(emit) {
  return new Promise((resolve, reject) => {
    emit('build', 'running', 'astro build');
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    execFile(npm, ['run', 'build'], { cwd: ROOT, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024, shell: process.platform === 'win32' }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`Build failed:\n${(stderr || stdout || err.message).slice(-4000)}`));
      resolve({ stdout: String(stdout).slice(-2000) });
    });
  });
}

async function publish({ message, dryRun = false, verifyBuild = true, beforeGit = null, emit = () => {} } = {}) {
  const started = Date.now();
  emit('validate', 'running', 'Checking content');
  const v = validate();
  if (v.errors.length) { emit('validate', 'error', v.errors.join('\n')); const e = new Error('Validation failed'); e.details = v; throw e; }
  emit('validate', 'done', v.warnings.length ? `${v.warnings.length} warning(s)` : 'OK');
  if (beforeGit) await beforeGit(emit);
  if (verifyBuild) { try { await runBuild(emit); emit('build', 'done', 'Build OK'); } catch (err) { emit('build', 'error', err.message); throw err; } }
  else emit('build', 'skipped', 'Build check skipped');
  const result = await git.publish({ message, dryRun, emit });
  return { ...result, warnings: v.warnings, ms: Date.now() - started };
}

async function fetchActionsRun({ owner, repo, sha }) {
  if (!owner || !repo || !sha) return null;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs?head_sha=${encodeURIComponent(sha)}&per_page=1`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'cmd-cms' } });
  if (!res.ok) return { error: `GitHub API ${res.status}` };
  const json = await res.json();
  const run = json.workflow_runs?.[0];
  return run ? { id: run.id, status: run.status, conclusion: run.conclusion, url: run.html_url, name: run.name } : { status: 'pending' };
}

module.exports = { validate, publish, runBuild, fetchActionsRun };
