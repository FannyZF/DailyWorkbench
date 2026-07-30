const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { categorizeEntry } = require('../services/deepseek');

const router = express.Router();

router.post('/categorize/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const entry = db.prepare('SELECT * FROM work_entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: '记录不存在' });

  categorizeEntry(entry.description).then(category => {
    db.prepare('UPDATE work_entries SET category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(category, req.params.id);
    res.json({ category });
  }).catch(err => {
    res.status(500).json({ error: '分类失败: ' + err.message });
  });
});

module.exports = router;
