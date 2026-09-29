const fs = require('fs');
const path = require('path');
const { MEDIA_DIR, CONTENT_DIR, ROOT } = require('./paths');

function entrySize(p) {
  try {
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink()) return 0;
    if (st.isFile()) return st.size;
    if (!st.isDirectory()) return 0;
  } catch { return 0; }
  let total = 0;
  try { for (const e of fs.readdirSync(p)) total += entrySize(path.join(p, e)); } catch { /* ignore */ }
  return total;
}

function getStorage() {
  const media = entrySize(MEDIA_DIR);
  const content = entrySize(CONTENT_DIR);
  let quota = 0;
  try { const st = fs.statfsSync(ROOT); quota = Number(st.blocks) * Number(st.bsize); } catch { /* unsupported */ }
  return { media, content, used: media + content, quota, pagesLimit: 1024 * 1024 * 1024 };
}

module.exports = { getStorage, entrySize };
