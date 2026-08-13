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
  // 只接受绝对路径配置，相对路径一律忽略，统一使用 server/uploads
  if (configured && path.isAbsolute(configured)) return configured;
  return path.join(SERVER_ROOT, 'uploads');
}

function getDbPath() {
  const configured = process.env.DB_PATH;
  // 只接受绝对路径配置，相对路径一律忽略，统一使用 server/data/app.db
  if (configured && path.isAbsolute(configured)) return configured;
  return path.join(SERVER_ROOT, 'data', 'app.db');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = { getUploadDir, getDbPath, ensureDir, resolveAbsolute, SERVER_ROOT };
