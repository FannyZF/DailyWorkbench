require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const { runMigrations } = require('./db/database');
const { authMiddleware } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/category');
const workRoutes = require('./routes/work');
const uploadRoutes = require('./routes/upload');
const aiRoutes = require('./routes/ai');
const statsRoutes = require('./routes/stats');
const draftRoutes = require('./routes/draft');
const usersRoutes = require('./routes/users');
const settingsRoutes = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 3001;

runMigrations();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

const apiRoutes = [
  { path: '/api/auth', routes: authRoutes, auth: false },
  { path: '/api/categories', routes: categoryRoutes, auth: false },
  { path: '/api/work', routes: workRoutes, auth: false },
  { path: '/api/upload', routes: uploadRoutes, auth: false },
  { path: '/api/ai', routes: aiRoutes, auth: false },
  { path: '/api/stats', routes: statsRoutes, auth: false },
  { path: '/api/draft', routes: draftRoutes, auth: false },
  { path: '/api/users', routes: usersRoutes, auth: false },
  { path: '/api/settings', routes: settingsRoutes, auth: false },
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

app.listen(PORT, () => {
  console.log(`[Server] 工作台后端服务已启动: http://localhost:${PORT}`);
});
