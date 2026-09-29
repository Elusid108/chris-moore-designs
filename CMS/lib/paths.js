const path = require('path');
const ROOT = process.env.CMD_CMS_ROOT || path.join(__dirname, '..', '..'); // repo root (override for tests)
const CMS_DIR = path.join(__dirname, '..');
module.exports = {
  ROOT,
  CMS_DIR,
  CONTENT_DIR: path.join(ROOT, 'content'),
  MEDIA_DIR: path.join(ROOT, 'public', 'media'),
  DATA_DIR: path.join(CMS_DIR, 'data'),
  TRASH_DIR: path.join(CMS_DIR, '.trash'),
  MEDIA_WEB_PREFIX: '/media',
};
