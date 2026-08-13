const express = require('express');
const path = require('path');
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType } = require('docx');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { expandContent } = require('../services/deepseek');
const { getUploadDir } = require('../config');

const router = express.Router();

const UPLOAD_DIR = getUploadDir();

function normalizePath(p) {
  if (!p) return '';
  let n = p.replace(/\\/g, '/');
  const idx = n.indexOf('uploads/');
  if (idx >= 0) n = n.substring(idx);
  else n = 'uploads/' + n;
  return '/' + n.replace(/^\/+/, '');
}

router.post('/expand', authMiddleware, async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '请选择需要扩写的工作内容' });
  }
  if (ids.length > 10) {
    return res.status(400).json({ error: '最多同时扩写10条工作内容' });
  }

  const db = getDb();
  const results = [];
  for (const id of ids) {
    const entry = db.prepare('SELECT * FROM work_entries WHERE id = ?').get(id);
    if (!entry) continue;
    const images = db.prepare('SELECT * FROM work_images WHERE work_entry_id = ? ORDER BY sort_order').all(id);
    const expanded = await expandContent(entry.description);
    results.push({
      id: entry.id,
      original: entry.description,
      expanded,
      category: entry.category,
      workDate: entry.work_date,
      images: images.map(img => ({
        id: img.id,
        originalName: img.original_name,
        storedPath: normalizePath(img.stored_path),
        thumbPath: normalizePath(img.thumb_path),
        fileSize: img.file_size,
      })),
    });
  }

  res.json({ results });
});

router.post('/word', authMiddleware, async (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: '缺少导出内容' });
  }

  try {
    const children = [];

    children.push(new Paragraph({
      text: '工作信息稿',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }));

    const today = new Date().toISOString().split('T')[0];
    children.push(new Paragraph({
      children: [new TextRun({ text: today, size: 28, font: '宋体' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }));

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      children.push(new Paragraph({
        children: [new TextRun({ text: `【${item.category}】`, bold: true, size: 28, font: '宋体' })],
        spacing: { before: 300, after: 100 },
      }));

      const text = item.expanded || item.description;
      children.push(new Paragraph({
        children: [new TextRun({ text, size: 24, font: '宋体' })],
        spacing: { after: 200, line: 360 },
      }));

      if (item.images && item.images.length > 0) {
        for (const img of item.images) {
          let imgPath = img.stored_path || img.storedPath;
          if (imgPath) {
            imgPath = imgPath.replace(/\\/g, '/');
            const idx = imgPath.indexOf('uploads/');
            if (idx >= 0) imgPath = imgPath.substring(idx + 8);
            imgPath = imgPath.replace(/^\/+/, '');
            const diskPath = path.resolve(UPLOAD_DIR, imgPath);
            if (fs.existsSync(diskPath)) {
              try {
                const imgBuffer = fs.readFileSync(diskPath);
                children.push(new Paragraph({
                  children: [new ImageRun({
                    data: imgBuffer,
                    transformation: { width: 600, height: 450 },
                  })],
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 100, after: 100 },
                }));
              } catch (e) { /* skip broken image */ }
            }
          }
        }
      }
    }

    const doc = new Document({
      styles: { default: { document: { run: { font: '宋体' } } } },
      sections: [{
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);

    const filename = `工作信息稿_${today}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).json({ error: '生成文档失败: ' + err.message });
  }
});

module.exports = router;
