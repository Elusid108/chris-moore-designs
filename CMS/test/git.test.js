// Publish flow against a temporary bare remote: only content/ and public/media are committed.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cmd-cms-git-'));
const remote = path.join(base, 'remote.git');
const work = path.join(base, 'work');
const sh = (args, cwd) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString();
sh(['init', '--bare', '-b', 'main', remote], base);
sh(['clone', remote, work], base);
sh(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--allow-empty', '-m', 'init'], work);
sh(['push', '-u', 'origin', 'main'], work);
fs.mkdirSync(path.join(work, 'content'), { recursive: true });
fs.mkdirSync(path.join(work, 'public', 'media', 'x'), { recursive: true });
fs.writeFileSync(path.join(work, 'content', 'products.json'), '[]\n');
fs.writeFileSync(path.join(work, 'public', 'media', 'x', 'a.webp'), 'x');
fs.writeFileSync(path.join(work, 'unrelated.txt'), 'leave me alone');
sh(['config', 'user.name', 't'], work); sh(['config', 'user.email', 't@t'], work);
process.env.CMD_CMS_ROOT = work;
const git = require('../lib/git');

test('dry run stages nothing permanently and reports files', async () => {
  const r = await git.publish({ dryRun: true });
  assert.equal(r.dryRun, true);
  assert.deepEqual(r.staged.map((s) => s.file).sort(), ['content/products.json', 'public/media/x/a.webp']);
  assert.ok(r.other.includes('unrelated.txt'));
  assert.equal(sh(['diff', '--cached', '--name-only'], work).trim(), '', 'index reset after dry run');
});

test('publish commits only publish paths and pushes', async () => {
  const steps = [];
  const r = await git.publish({ message: 'test publish', emit: (s, st, d) => steps.push(`${s}:${st}`) });
  assert.equal(r.pushed, true);
  assert.match(r.sha, /^[0-9a-f]{40}$/);
  const files = sh(['show', '--name-only', '--format=', 'HEAD'], work).trim().split('\n').sort();
  assert.deepEqual(files, ['content/products.json', 'public/media/x/a.webp']);
  assert.equal(sh(['status', '--porcelain'], work).trim(), '?? unrelated.txt');
  assert.equal(sh(['rev-parse', 'main'], remote).trim(), r.sha, 'remote has the commit');
  assert.ok(steps.some((s) => s === 'git:done'));
});

test('behind origin → rebases first', async () => {
  const other = path.join(base, 'other');
  sh(['clone', remote, other], base);
  fs.writeFileSync(path.join(other, 'README.md'), 'hi');
  sh(['add', '.'], other); sh(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'upstream'], other); sh(['push'], other);
  fs.writeFileSync(path.join(work, 'content', 'products.json'), '[{"id":"1"}]\n');
  const r = await git.publish({ message: 'after upstream' });
  assert.equal(r.pushed, true);
  assert.ok(fs.existsSync(path.join(work, 'README.md')), 'upstream change pulled in');
  fs.rmSync(base, { recursive: true, force: true });
});
