// Git operations for Publish. Uses the git on PATH and the machine's own
// credentials; the CMS never stores or prompts for any.
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./paths');

const PUBLISH_PATHS = ['content', 'public/media', 'public/og'];

function git(args, { cwd = ROOT, timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, timeout, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }, (err, stdout, stderr) => {
      if (err) return reject(Object.assign(new Error((stderr || err.message || '').trim() || `git ${args[0]} failed`), { code: err.code, stdout, stderr, args }));
      resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

// index.lock can linger on synced folders; retry once after a pause.
async function gitRetry(args, opts) {
  try { return await git(args, opts); } catch (err) {
    if (/index\.lock/.test(err.message)) { await new Promise((r) => setTimeout(r, 1500)); return git(args, opts); }
    throw err;
  }
}

async function status() {
  const out = { isRepo: false, branch: null, remote: null, ahead: 0, behind: 0, changes: [], other: [] };
  try { await git(['rev-parse', '--is-inside-work-tree']); out.isRepo = true; } catch { return out; }
  out.branch = (await git(['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();
  try { out.remote = (await git(['remote', 'get-url', 'origin'])).stdout.trim(); } catch { out.remote = null; }
  const porcelain = (await git(['status', '--porcelain=v1', '-z'])).stdout.split('\0').filter(Boolean);
  for (const line of porcelain) {
    const code = line.slice(0, 2), file = line.slice(3);
    (PUBLISH_PATHS.some((p) => file === p || file.startsWith(p + '/')) ? out.changes : out.other).push({ code, file });
  }
  try {
    const lr = (await git(['rev-list', '--left-right', '--count', `HEAD...origin/${out.branch}`])).stdout.trim().split(/\s+/);
    out.ahead = Number(lr[0] || 0); out.behind = Number(lr[1] || 0);
  } catch { /* no upstream yet */ }
  return out;
}

function repoWebUrl(remote) {
  if (!remote) return null;
  const m = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)(\.git)?$/);
  return m ? { owner: m[1], repo: m[2], url: `https://github.com/${m[1]}/${m[2]}` } : null;
}

/**
 * fetch → rebase if behind → add publish paths → commit → push.
 * emit(step, state, detail) reports progress. dryRun runs everything except the
 * commit/push side effects (uses `git push --dry-run` after a real commit? no:
 * dry-run skips commit entirely and reports what would be staged).
 */
async function publish({ message, dryRun = false, emit = () => {} } = {}) {
  const st = await status();
  if (!st.isRepo) throw new Error('This folder is not a git repository.');
  if (!st.remote) throw new Error('No "origin" remote is configured.');
  const web = repoWebUrl(st.remote);
  emit('git', 'running', `On ${st.branch}, ${st.changes.length} publishable change(s)`);

  try { await git(['fetch', 'origin', st.branch], { timeout: 60000 }); } catch (err) { emit('git', 'warn', `fetch failed: ${err.message}`); }
  const after = await status();
  if (after.behind > 0) {
    emit('git', 'running', `Behind origin by ${after.behind}; rebasing`);
    try { await gitRetry(['pull', '--rebase', '--autostash', 'origin', st.branch]); }
    catch (err) { try { await git(['rebase', '--abort']); } catch { /* nothing to abort */ } throw new Error(`Could not rebase onto origin/${st.branch}: ${err.message}. Resolve it in git, then publish again.`); }
  }

  const result = { branch: st.branch, remote: st.remote, repoUrl: web?.url || null, owner: web?.owner || null, repo: web?.repo || null, staged: [], other: after.other.map((o) => o.file), committed: false, pushed: false, sha: null, commitUrl: null, actionsUrl: web ? `${web.url}/actions?query=branch%3A${encodeURIComponent(st.branch)}` : null, dryRun };

  const present = PUBLISH_PATHS.filter((p) => fs.existsSync(path.join(ROOT, p)));
  if (present.length === 0) { emit('git', 'done', 'Nothing to publish yet'); return result; }
  await gitRetry(['add', '-A', '--', ...present]);
  const staged = (await git(['diff', '--cached', '--name-status', '-z'])).stdout.split('\0').filter(Boolean);
  for (let i = 0; i + 1 < staged.length; i += 2) result.staged.push({ code: staged[i], file: staged[i + 1] });
  if (result.staged.length === 0) { emit('git', 'done', 'Nothing to publish: content and media are already up to date'); if (after.ahead > 0 && !dryRun) { await gitRetry(['push', 'origin', `HEAD:${st.branch}`]); result.pushed = true; emit('git', 'done', `Pushed ${after.ahead} earlier commit(s)`); } return result; }

  if (dryRun) {
    await gitRetry(['reset', '-q', '--', ...present]);
    let pushDry = '';
    try { pushDry = (await git(['push', '--dry-run', 'origin', `HEAD:${st.branch}`])).stderr; } catch (err) { pushDry = err.message; }
    result.pushDryRun = pushDry.trim();
    emit('git', 'done', `Dry run: ${result.staged.length} file(s) would be committed`);
    return result;
  }

  const msg = message || `Publish: ${result.staged.length} file(s) from the CMS`;
  await gitRetry(['commit', '-q', '-m', msg]);
  result.committed = true;
  result.sha = (await git(['rev-parse', 'HEAD'])).stdout.trim();
  result.commitUrl = web ? `${web.url}/commit/${result.sha}` : null;
  emit('git', 'running', `Committed ${result.sha.slice(0, 7)}; pushing`);
  await gitRetry(['push', 'origin', `HEAD:${st.branch}`], { timeout: 180000 });
  result.pushed = true;
  emit('git', 'done', `Pushed to origin/${st.branch}`);
  return result;
}

module.exports = { git, status, publish, repoWebUrl, PUBLISH_PATHS };
