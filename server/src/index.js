require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb, runMigrations } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/category');
const workRoutes = require('./routes/work');
const uploadRoutes = require('./routes/upload');
const aiRoutes = require('./routes/ai');
const statsRoutes = require('./routes/stats');
const draftRoutes = require('./routes/draft');
const usersRoutes = require('./routes/users');
const settingsRoutes = require('./routes/settings');

const apiRoutes = [
  { path: '/api/auth', routes: authRoutes },
  { path: '/api/categories', routes: categoryRoutes },
  { path: '/api/work', routes: workRoutes },
  { path: '/api/upload', routes: uploadRoutes },
  { path: '/api/ai', routes: aiRoutes },
  { path: '/api/stats', routes: statsRoutes },
  { path: '/api/draft', routes: draftRoutes },
  { path: '/api/users', routes: usersRoutes },
  { path: '/api/settings', routes: settingsRoutes },
];

apiRoutes.forEach(({ path: routePath, routes }) => {
  app.use(routePath, routes);
});

app.use(express.static(path.join(__dirname, '..', '..', 'client', 'dist')));
app.get('*', (req, res) => {
  if (!req.url.startsWith('/api') && !req.url.startsWith('/uploads')) {
    res.sendFile(path.join(__dirname, '..', '..', 'client', 'dist', 'index.html'));
  }
});

(async () => {
  await initDb();
  runMigrations();
  app.listen(PORT, () => {
    console.log(`[Server] 工作台后端服务已启动: http://localhost:${PORT}`);
  });
})();
