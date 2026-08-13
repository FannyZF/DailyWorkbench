const express = require('express');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { getUploadDir } = require('../config');

const router = express.Router();
const UPLOAD_DIR = getUploadDir();

function resolveDiskPath(storedPath) {
  if (!storedPath) return '';
  let p = storedPath.replace(/\\/g, '/');
  const idx = p.indexOf('uploads/');
  if (idx >= 0) p = p.substring(idx + 8);
  p = p.replace(/^\/+/, '');
  return path.resolve(UPLOAD_DIR, p);
}

function normalizePath(p) {
  if (!p) return '';
  let normalized = p.replace(/\\/g, '/');
  const idx = normalized.indexOf('uploads/');
  if (idx >= 0) {
    normalized = normalized.substring(idx);
  } else {
    normalized = 'uploads/' + normalized;
  }
  return '/' + normalized.replace(/^\/+/, '');
}

function canAccess(req, entryCreatedBy) {
  if (req.user.role === 'admin') return true;
  return req.user.id === entryCreatedBy;
}

router.get('/', authMiddleware, (req, res) => {
  const { date, category, startDate, endDate, keyword, page = 1, pageSize = 12 } = req.query;
  const db = getDb();
  const conditions = [];
  const params = [];

  if (date) {
    conditions.push('we.work_date = ?');
    params.push(date);
  }
  if (category) {
    const cats = category.split(',');
    conditions.push(`we.category IN (${cats.map(() => '?').join(',')})`);
    params.push(...cats);
  }
  if (startDate) {
    conditions.push('we.work_date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('we.work_date <= ?');
    params.push(endDate);
  }
  if (keyword) {
    conditions.push('we.description LIKE ?');
    params.push(`%${keyword}%`);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const offset = (parseInt(page) - 1) * parseInt(pageSize);

  const countSql = `SELECT COUNT(*) as total FROM work_entries we ${where}`;
  const total = db.prepare(countSql).get(...params).total;

  const dataSql = `
    SELECT we.*, u.display_name as creator_name
    FROM work_entries we
    LEFT JOIN users u ON we.created_by = u.id
    ${where}
    ORDER BY we.work_date DESC, we.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const rows = db.prepare(dataSql).all(...params, parseInt(pageSize), offset);

  const imageSql = db.prepare('SELECT * FROM work_images WHERE work_entry_id = ? ORDER BY sort_order');
  const entries = rows.map(row => {
    const images = imageSql.all(row.id);
    return {
      ...row,
      images: images.map(img => ({
        id: img.id,
        originalName: img.original_name,
        storedPath: normalizePath(img.stored_path),
        thumbPath: normalizePath(img.thumb_path),
        fileSize: img.file_size,
      })),
    };
  });

  res.json({ entries, total, page: parseInt(page), pageSize: parseInt(pageSize) });
});

router.get('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const entry = db.prepare(`
    SELECT we.*, u.display_name as creator_name
    FROM work_entries we
    LEFT JOIN users u ON we.created_by = u.id
    WHERE we.id = ?
  `).get(req.params.id);

  if (!entry) return res.status(404).json({ error: '记录不存在' });
  if (!canAccess(req, entry.created_by)) return res.status(403).json({ error: '权限不足' });

  const images = db.prepare('SELECT * FROM work_images WHERE work_entry_id = ? ORDER BY sort_order').all(entry.id);
  res.json({
    ...entry,
    images: images.map(img => ({
      ...img,
      stored_path: normalizePath(img.stored_path),
      thumb_path: normalizePath(img.thumb_path),
    })),
  });
});

router.put('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const entry = db.prepare('SELECT * FROM work_entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: '记录不存在' });
  if (!canAccess(req, entry.created_by)) return res.status(403).json({ error: '权限不足' });

  const { description, category, workDate } = req.body;
  db.prepare('UPDATE work_entries SET description = ?, category = ?, work_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(
      description || entry.description,
      category || entry.category,
      workDate || entry.work_date,
      req.params.id
    );

  res.json({ message: '更新成功' });
});

router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const entry = db.prepare('SELECT * FROM work_entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: '记录不存在' });
  if (!canAccess(req, entry.created_by)) return res.status(403).json({ error: '权限不足' });

  const images = db.prepare('SELECT * FROM work_images WHERE work_entry_id = ?').all(req.params.id);
  images.forEach(img => {
    try { fs.unlinkSync(resolveDiskPath(img.stored_path)); } catch (e) { /* ignore */ }
    try { fs.unlinkSync(resolveDiskPath(img.thumb_path)); } catch (e) { /* ignore */ }
  });

  db.prepare('DELETE FROM work_entries WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

router.post('/export-photos', authMiddleware, async (req, res) => {
  const { ids, prefix } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '请选择需要导出照片的工作内容' });
  }
  if (!prefix || !prefix.trim()) {
    return res.status(400).json({ error: '请输入导出文件名前缀' });
  }

  const db = getDb();

  const placeholders = ids.map(() => '?').join(',');
  const images = db.prepare(
    `SELECT wi.*, we.work_date FROM work_images wi
     JOIN work_entries we ON wi.work_entry_id = we.id
     WHERE wi.work_entry_id IN (${placeholders})
     ORDER BY we.work_date, wi.work_entry_id, wi.sort_order`
  ).all(...ids);

  if (images.length === 0) {
    return res.status(404).json({ error: '所选内容没有关联照片' });
  }

  if (req.user.role !== 'admin') {
    const entryIds = db.prepare(
      `SELECT id FROM work_entries WHERE id IN (${placeholders}) AND created_by = ?`
    ).all(...ids, req.user.id).map(e => e.id);
    if (entryIds.length === 0) {
      return res.status(403).json({ error: '权限不足' });
    }
  }

  try {
    const { ZipArchive } = require('archiver');
    const archive = new ZipArchive({ zlib: { level: 6 } });

    const safePrefix = prefix.trim().replace(/[<>:"/\\|?*]/g, '_');
    const zipFilename = `${safePrefix}_${new Date().toISOString().split('T')[0]}.zip`;
    const encodedFilename = encodeURIComponent(zipFilename);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);

    archive.on('error', (err) => {
      if (!res.headersSent) res.status(500).json({ error: '打包失败' });
    });

    archive.pipe(res);

    const pad = (n, len) => String(n).padStart(len, '0');
    const digits = String(images.length).length;

    const addedNames = new Map();
    images.forEach((img, index) => {
      const ext = path.extname(img.original_name) || '.jpg';
      const seqName = `${safePrefix}_${pad(index + 1, digits)}${ext}`;

      const filePath = resolveDiskPath(img.stored_path);
      if (fs.existsSync(filePath)) {
        archive.append(fs.createReadStream(filePath), { name: seqName });
      }
    });

    await archive.finalize();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: '导出失败: ' + err.message });
    }
  }
});

module.exports = router;
