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

module.exports = router;
