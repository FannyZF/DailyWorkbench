const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

router.put('/', authMiddleware, requireAdmin, (req, res) => {
  const { unitName, deepseekApiKey } = req.body;
  const db = getDb();
  if (unitName !== undefined) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('unitName', unitName);
  }
  if (deepseekApiKey !== undefined) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('deepseekApiKey', deepseekApiKey);
  }
  res.json({ message: '设置已保存' });
});

router.get('/status', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });

  const dbKey = settings.deepseekApiKey || '';
  const envKey = process.env.DEEPSEEK_API_KEY || '';
  const apiKeyConfigured = !!(dbKey || envKey);

  const imageCount = db.prepare('SELECT COUNT(*) as cnt FROM work_images').get()?.cnt || 0;
  const fileSystem = require('fs');
  const uploadPath = require('path').join(__dirname, '..', '..', 'uploads');
  const uploadsExist = fileSystem.existsSync(uploadPath);

  res.json({
    apiKeyConfigured,
    apiKeySource: dbKey ? 'DB' : envKey ? 'ENV' : 'none',
    dbEntries: db.prepare('SELECT COUNT(*) as cnt FROM work_entries').get()?.cnt || 0,
    dbImages: imageCount,
    uploadsDirExists: uploadsExist,
    nodeVersion: process.version,
    platform: process.platform,
  });
});

module.exports = router;
