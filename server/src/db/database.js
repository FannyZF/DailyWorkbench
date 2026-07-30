const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'app.db');

let db;

function getDb() {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
  }
  return db;
}

function runMigrations() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    NOT NULL UNIQUE,
      display_name  TEXT    NOT NULL,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'staff' CHECK(role IN ('admin', 'staff')),
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS work_entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id    TEXT    NOT NULL,
      description TEXT    NOT NULL,
      category    TEXT    NOT NULL DEFAULT '未分类',
      work_date   DATE    NOT NULL,
      created_by  INTEGER NOT NULL,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS work_images (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      work_entry_id  INTEGER NOT NULL,
      original_name  TEXT    NOT NULL,
      stored_path    TEXT    NOT NULL,
      thumb_path     TEXT    NOT NULL,
      file_size      INTEGER NOT NULL,
      sort_order     INTEGER DEFAULT 0,
      uploaded_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (work_entry_id) REFERENCES work_entries(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_work_entries_batch    ON work_entries(batch_id);
    CREATE INDEX IF NOT EXISTS idx_work_entries_date     ON work_entries(work_date);
    CREATE INDEX IF NOT EXISTS idx_work_entries_category ON work_entries(category);
    CREATE INDEX IF NOT EXISTS idx_work_entries_author   ON work_entries(created_by);
    CREATE INDEX IF NOT EXISTS idx_work_images_entry     ON work_images(work_entry_id);

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );
  `);

  // Insert default settings
  const insertSetting = database.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('unitName', '');

  const bcrypt = require('bcryptjs');

  const catCount = database.prepare('SELECT COUNT(*) as cnt FROM categories').get();
  if (catCount.cnt === 0) {
    const insert = database.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
    insert.run('民生实事', 1);
    insert.run('环境整治', 2);
    insert.run('安全生产', 3);
  }

  const userCount = database.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (userCount.cnt === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    database.prepare('INSERT INTO users (username, display_name, password_hash, role) VALUES (?, ?, ?, ?)')
      .run('admin', '系统管理员', hash, 'admin');
    console.log('[DB] 默认管理员已创建: admin / admin123');
  }
}

module.exports = { getDb, runMigrations };
