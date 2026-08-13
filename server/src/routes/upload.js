const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
let sharp = null;
try { sharp = require('sharp'); } catch (e) { /* sharp not available */ }
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { categorizeEntry } = require('../services/deepseek');

const router = express.Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const originalsDir = path.join(UPLOAD_DIR, 'originals', month);
    const thumbsDir = path.join(UPLOAD_DIR, 'thumbnails', month);
    fs.mkdirSync(originalsDir, { recursive: true });
    fs.mkdirSync(thumbsDir, { recursive: true });
    req._uploadMonth = month;
    cb(null, originalsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const id = uuidv4();
    req._currentFileId = id;
    cb(null, id + ext);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件格式，仅支持 JPG/PNG/WEBP'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post('/', authMiddleware, upload.array('images', 50), async (req, res) => {
  const { description, workDate, category: manualCategory } = req.body;
  const month = req._uploadMonth;

  if (!description || !description.trim()) {
    return res.status(400).json({ error: '工作内容描述不能为空' });
  }
  if (!workDate) {
    return res.status(400).json({ error: '工作日期不能为空' });
  }

  const db = getDb();

  try {
    const result = db.prepare(
      'INSERT INTO work_entries (batch_id, description, category, work_date, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), description.trim(), '未分类', workDate, req.user.id);

    const entryId = result.lastInsertRowid;
    const imageRecords = [];

    if (req.files && req.files.length > 0) {
      const insertImage = db.prepare(
        'INSERT INTO work_images (work_entry_id, original_name, stored_path, thumb_path, file_size, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
      );

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const originalsDir = path.join(UPLOAD_DIR, 'originals', month);
        const thumbsDir = path.join(UPLOAD_DIR, 'thumbnails', month);
        const normalizedPath = file.filename;
        const thumbFilename = 'thumb_' + path.parse(file.filename).name + '.jpg';
        const thumbPath = path.join(thumbsDir, thumbFilename);

        try {
          if (sharp) {
            await sharp(file.path)
              .resize(300, null, { withoutEnlargement: true })
              .jpeg({ quality: 80 })
              .toFile(thumbPath);
          } else {
            fs.copyFileSync(file.path, thumbPath);
          }
        } catch (sharpErr) {
          if (!fs.existsSync(thumbPath)) {
            fs.copyFileSync(file.path, thumbPath);
          }
        }

        insertImage.run(
          entryId,
          file.originalname,
          path.relative(UPLOAD_DIR, path.join(originalsDir, normalizedPath)),
          path.relative(UPLOAD_DIR, thumbPath),
          file.size,
          i
        );

        imageRecords.push({
          originalName: file.originalname,
          storedPath: path.relative(UPLOAD_DIR, path.join(originalsDir, normalizedPath)),
          thumbPath: path.relative(UPLOAD_DIR, thumbPath),
        });
      }
    }

    const category = manualCategory && manualCategory.trim()
      ? manualCategory.trim()
      : await categorizeEntry(description.trim());

    db.prepare('UPDATE work_entries SET category = ? WHERE id = ?').run(category, entryId);

    res.status(201).json({
      id: entryId,
      description: description.trim(),
      category,
      workDate,
      images: imageRecords,
    });
  } catch (err) {
    res.status(500).json({ error: '保存失败: ' + err.message });
  }
});

router.post('/batch', authMiddleware, async (req, res) => {
  const { workDate, entries } = req.body;

  if (!workDate) return res.status(400).json({ error: '工作日期不能为空' });
  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: '至少需要一条工作内容' });
  }
  if (entries.length > 50) {
    return res.status(400).json({ error: '单次最多提交50条工作条目' });
  }

  const db = getDb();
  const batchId = uuidv4();
  const results = [];

  const insertEntry = db.prepare(
    'INSERT INTO work_entries (batch_id, description, category, work_date, created_by) VALUES (?, ?, ?, ?, ?)'
  );

  for (const entry of entries) {
    if (!entry.description || !entry.description.trim() || entry.description.trim().length < 10) continue;
    if (entry.description.trim().length > 2000) continue;

    const description = entry.description.trim();
    const manualCategory = entry.category && entry.category.trim();

    const result = insertEntry.run(batchId, description, '未分类', workDate, req.user.id);
    const entryId = result.lastInsertRowid;

    const category = manualCategory
      ? manualCategory
      : await categorizeEntry(description);

    db.prepare('UPDATE work_entries SET category = ? WHERE id = ?').run(category, entryId);

    results.push({ id: entryId, description, category });
  }

  res.status(201).json({ batchId, entries: results });
});

router.post('/:id/images', authMiddleware, upload.array('images', 50), async (req, res) => {
  const month = req._uploadMonth;
  const db = getDb();
  const entry = db.prepare('SELECT * FROM work_entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: '记录不存在' });

  const existingMax = db.prepare('SELECT MAX(sort_order) as maxOrder FROM work_images WHERE work_entry_id = ?').get(req.params.id);
  let sortOrder = (existingMax.maxOrder || -1) + 1;

  const insertImage = db.prepare(
    'INSERT INTO work_images (work_entry_id, original_name, stored_path, thumb_path, file_size, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const imageRecords = [];
  if (req.files) {
    for (const file of req.files) {
      const originalsDir = path.join(UPLOAD_DIR, 'originals', month);
      const thumbsDir = path.join(UPLOAD_DIR, 'thumbnails', month);
      const thumbFilename = 'thumb_' + path.parse(file.filename).name + '.jpg';
      const thumbPath = path.join(thumbsDir, thumbFilename);

      try {
        if (sharp) {
          await sharp(file.path)
            .resize(300, null, { withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toFile(thumbPath);
        } else {
          fs.copyFileSync(file.path, thumbPath);
        }
      } catch (sharpErr) {
        if (!fs.existsSync(thumbPath)) {
          fs.copyFileSync(file.path, thumbPath);
        }
      }

      insertImage.run(
        req.params.id,
        file.originalname,
        path.relative(UPLOAD_DIR, path.join(originalsDir, file.filename)),
        path.relative(UPLOAD_DIR, thumbPath),
        file.size,
        sortOrder++
      );

      imageRecords.push({
        originalName: file.originalname,
        storedPath: path.relative(UPLOAD_DIR, path.join(originalsDir, file.filename)),
        thumbPath: path.relative(UPLOAD_DIR, thumbPath),
      });
    }
  }

  res.json({ images: imageRecords });
});

router.delete('/:entryId/images/:imageId', authMiddleware, (req, res) => {
  const db = getDb();
  const entry = db.prepare('SELECT * FROM work_entries WHERE id = ?').get(req.params.entryId);
  if (!entry) return res.status(404).json({ error: '记录不存在' });

  const image = db.prepare('SELECT * FROM work_images WHERE id = ? AND work_entry_id = ?').get(req.params.imageId, req.params.entryId);
  if (!image) return res.status(404).json({ error: '图片不存在' });

  const resolvePath = (p) => {
    if (!p) return '';
    let n = p.replace(/\\/g, '/');
    const idx = n.indexOf('uploads/');
    if (idx >= 0) n = n.substring(idx);
    return path.resolve(UPLOAD_DIR, n.replace(/^\/+/, ''));
  };

  try { fs.unlinkSync(resolvePath(image.stored_path)); } catch (e) { /* ignore */ }
  try { fs.unlinkSync(resolvePath(image.thumb_path)); } catch (e) { /* ignore */ }

  db.prepare('DELETE FROM work_images WHERE id = ?').run(req.params.imageId);
  res.json({ message: '图片已删除' });
});

module.exports = router;
