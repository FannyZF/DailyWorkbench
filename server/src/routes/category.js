const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  const db = getDb();
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  res.json(categories);
});

router.post('/', authMiddleware, requireAdmin, (req, res) => {
  const { name, sortOrder } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '分类名称不能为空' });
  }
  const db = getDb();
  const existing = db.prepare('SELECT id FROM categories WHERE name = ?').get(name.trim());
  if (existing) {
    return res.status(400).json({ error: '分类名称已存在' });
  }
  const result = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)').run(name.trim(), sortOrder || 0);
  res.json({ id: result.lastInsertRowid, name: name.trim(), sort_order: sortOrder || 0 });
});

router.put('/:id', authMiddleware, requireAdmin, (req, res) => {
  const { name, sortOrder } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT id FROM categories WHERE name = ? AND id != ?').get(name.trim(), req.params.id);
  if (existing) {
    return res.status(400).json({ error: '分类名称已存在' });
  }
  db.prepare('UPDATE categories SET name = ?, sort_order = ? WHERE id = ?').run(name.trim(), sortOrder || 0, req.params.id);
  res.json({ message: '更新成功' });
});

router.delete('/:id', authMiddleware, requireAdmin, (req, res) => {
  const db = getDb();
  const category = db.prepare('SELECT name FROM categories WHERE id = ?').get(req.params.id);
  if (!category) {
    return res.status(404).json({ error: '分类不存在' });
  }
  const count = db.prepare('SELECT COUNT(*) as cnt FROM work_entries WHERE category = ?').get(category.name);
  if (count.cnt > 0) {
    return res.status(400).json({ error: `该分类下有 ${count.cnt} 条工作记录，请先将它们迁移到其他分类后再删除` });
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

module.exports = router;
