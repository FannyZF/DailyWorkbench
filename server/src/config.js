const path = require('path');
const fs = require('fs');

const SERVER_ROOT = path.join(__dirname, '..');

function resolveAbsolute(p) {
  if (!p) return '';
  if (path.isAbsolute(p)) return p;
  return path.join(SERVER_ROOT, p.replace(/^[.\/\\]+/, ''));
}

function getUploadDir() {
  const configured = process.env.UPLOAD_DIR;
  if (configured) return resolveAbsolute(configured);
  return path.join(SERVER_ROOT, 'uploads');
}

function getDbPath() {
  const configured = process.env.DB_PATH;
  if (configured) return resolveAbsolute(configured);
  return path.join(SERVER_ROOT, 'data', 'app.db');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = { getUploadDir, getDbPath, ensureDir, resolveAbsolute, SERVER_ROOT };
