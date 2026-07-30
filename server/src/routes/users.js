const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

const router = express.Router();

router.get('/', authMiddleware, requireAdmin, (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, username, display_name, role, created_at, last_login_at FROM users ORDER BY created_at').all();
  res.json(users);
});

router.post('/', authMiddleware, requireAdmin, (req, res) => {
  const { username, displayName, password, role } = req.body;
  if (!username || !displayName || !password) {
    return res.status(400).json({ error: '用户名、显示姓名和密码不能为空' });
  }
  if (password.length < 6 || password.length > 20) {
    return res.status(400).json({ error: '密码长度 6-20 位' });
  }
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(400).json({ error: '用户名已存在' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, display_name, password_hash, role) VALUES (?, ?, ?, ?)').run(username, displayName, hash, role || 'staff');
  res.status(201).json({ message: '用户创建成功', id: result.lastInsertRowid });
});

router.delete('/:id', authMiddleware, requireAdmin, (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: '不能删除自己的账号' });
  }
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: '用户已删除' });
});

module.exports = router;
