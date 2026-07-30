const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { generateSummary } = require('../services/deepseek');

const router = express.Router();

router.get('/count', authMiddleware, (req, res) => {
  const { startDate, endDate, category } = req.query;
  const db = getDb();
  const conditions = [];
  const params = [];

  if (req.user.role !== 'admin') {
    conditions.push('created_by = ?');
    params.push(req.user.id);
  }

  if (startDate) { conditions.push('work_date >= ?'); params.push(startDate); }
  if (endDate) { conditions.push('work_date <= ?'); params.push(endDate); }
  if (category) {
    const cats = category.split(',');
    conditions.push(`category IN (${cats.map(() => '?').join(',')})`);
    params.push(...cats);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const categoryStats = db.prepare(`
    SELECT category, COUNT(*) as count FROM work_entries ${where} GROUP BY category ORDER BY count DESC
  `).all(...params);

  const dailyStats = db.prepare(`
    SELECT work_date, COUNT(*) as count FROM work_entries ${where} GROUP BY work_date ORDER BY work_date
  `).all(...params);

  res.json({ categoryStats, dailyStats });
});

router.post('/summary', authMiddleware, async (req, res) => {
  const { startDate, endDate, category } = req.body;
  if (!startDate || !endDate) {
    return res.status(400).json({ error: '请选择时间段' });
  }

  const db = getDb();
  const conditions = [];
  const params = [];

  if (req.user.role !== 'admin') {
    conditions.push('created_by = ?');
    params.push(req.user.id);
  }

  conditions.push('work_date >= ?'); params.push(startDate);
  conditions.push('work_date <= ?'); params.push(endDate);
  if (category) {
    const cats = category.split(',');
    conditions.push(`category IN (${cats.map(() => '?').join(',')})`);
    params.push(...cats);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const stats = db.prepare(`SELECT category, COUNT(*) as count FROM work_entries ${where} GROUP BY category`).all(...params);
  const statsMap = {};
  stats.forEach(s => { statsMap[s.category] = s.count; });

  const entries = db.prepare(`SELECT * FROM work_entries ${where} ORDER BY work_date DESC LIMIT 50`).all(...params);
  const summaries = entries.map(e => ({
    category: e.category,
    description: e.description.length > 200 ? e.description.substring(0, 200) + '...' : e.description,
  }));

  if (entries.length === 0) {
    return res.status(400).json({ error: '所选时间段内暂无工作记录' });
  }

  const summary = await generateSummary(statsMap, summaries, startDate, endDate);
  res.json({ summary, stats: statsMap, entryCount: entries.length });
});

router.get('/export', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, category } = req.query;
    const ExcelJS = require('exceljs');
    const db = getDb();
    const conditions = [];
    const params = [];

    if (req.user.role !== 'admin') {
      conditions.push('created_by = ?');
      params.push(req.user.id);
    }

    if (startDate) { conditions.push('work_date >= ?'); params.push(startDate); }
    if (endDate) { conditions.push('work_date <= ?'); params.push(endDate); }
    if (category) {
      const cats = category.split(',');
      conditions.push(`category IN (${cats.map(() => '?').join(',')})`);
      params.push(...cats);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const stats = db.prepare(`SELECT category, COUNT(*) as count FROM work_entries ${where} GROUP BY category ORDER BY count DESC`).all(...params);
    const entries = db.prepare(`SELECT * FROM work_entries ${where} ORDER BY work_date DESC`).all(...params);

    const workbook = new ExcelJS.Workbook();
    const sheet1 = workbook.addWorksheet('分类统计');
    sheet1.columns = [
      { header: '分类名称', key: 'category', width: 20 },
      { header: '次数', key: 'count', width: 10 },
      { header: '占比', key: 'percent', width: 15 },
    ];
    const total = stats.reduce((s, r) => s + r.count, 0);
    stats.forEach(s => {
      sheet1.addRow({ category: s.category, count: s.count, percent: total > 0 ? ((s.count / total) * 100).toFixed(1) + '%' : '0%' });
    });

    const sheet2 = workbook.addWorksheet('明细清单');
    sheet2.columns = [
      { header: '日期', key: 'work_date', width: 15 },
      { header: '分类', key: 'category', width: 15 },
      { header: '描述摘要', key: 'description', width: 60 },
    ];
    entries.forEach(e => {
      sheet2.addRow({ work_date: e.work_date, category: e.category, description: e.description.substring(0, 200) });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = encodeURIComponent(`统计报表_${startDate || ''}_${endDate || ''}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
    res.setHeader('Content-Length', buffer.length);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('[Export Error]', err.message);
    res.status(500).json({ error: '报表生成失败，请重试' });
  }
});

module.exports = router;
