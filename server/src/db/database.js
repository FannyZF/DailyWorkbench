const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { getDbPath, ensureDir } = require('../config');

const DB_PATH = getDbPath();

let db = null;
let SQL = null;

class StatementWrapper {
  constructor(database, sql) {
    this._db = database;
    this._sql = sql;
    this._isSelect = /^\s*SELECT|^\s*PRAGMA/i.test(sql);
  }

  get(...params) {
    try {
      const stmt = this._db.prepare(this._sql);
      if (params && params.length > 0) stmt.bind(params);
      let row = undefined;
      if (stmt.step()) {
        row = stmt.getAsObject();
      }
      stmt.free();
      return row;
    } catch (e) {
      console.error('[SQL Error] GET', this._sql, e.message);
      return undefined;
    }
  }

  all(...params) {
    try {
      const stmt = this._db.prepare(this._sql);
      if (params && params.length > 0) stmt.bind(params);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    } catch (e) {
      console.error('[SQL Error] ALL', this._sql, e.message);
      return [];
    }
  }

  run(...params) {
    try {
      this._db.run(this._sql, params || []);
      const rowsModified = this._db.getRowsModified();
      const idResult = this._db.exec('SELECT last_insert_rowid()');
      const lastId = (idResult && idResult.length > 0 && idResult[0].values.length > 0)
        ? idResult[0].values[0][0] : 0;

      // If last_insert_rowid returns 0 but it's an INSERT, try getting the max id
      let actualId = lastId;
      if (lastId === 0 && /^\s*INSERT/i.test(this._sql)) {
        const maxResult = this._db.exec("SELECT MAX(id) as maxId FROM work_entries");
        if (maxResult && maxResult.length > 0 && maxResult[0].values.length > 0) {
          actualId = maxResult[0].values[0][0] || 0;
        }
      }

      saveDb();
      return {
        lastInsertRowid: actualId,
        changes: rowsModified,
      };
    } catch (e) {
      console.error('[SQL Error] RUN', this._sql, e.message);
      throw e;
    }
  }
}

function saveDb() {
  if (!db) return;
  try {
    const data = db.export();
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error('[DB] Write error:', e.message);
  }
}

function dbWrapper() {
  return {
    prepare: (sql) => new StatementWrapper(db, sql),
    exec: (s) => { const r = db.exec(s); saveDb(); return r; },
    _raw: db,
  };
}

async function initDb() {
  if (db) return;

  SQL = await initSqlJs();

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');
}

function getDb() {
  return dbWrapper();
}

function runMigrations() {
  const d = dbWrapper();
  const bcrypt = require('bcryptjs');

  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    NOT NULL UNIQUE,
      display_name  TEXT    NOT NULL,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'staff' CHECK(role IN ('admin', 'staff')),
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME
    )
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  d.exec(`
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
    )
  `);

  d.exec(`
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
    )
  `);

  d.exec('CREATE INDEX IF NOT EXISTS idx_work_entries_batch    ON work_entries(batch_id)');
  d.exec('CREATE INDEX IF NOT EXISTS idx_work_entries_date     ON work_entries(work_date)');
  d.exec('CREATE INDEX IF NOT EXISTS idx_work_entries_category ON work_entries(category)');
  d.exec('CREATE INDEX IF NOT EXISTS idx_work_entries_author   ON work_entries(created_by)');
  d.exec('CREATE INDEX IF NOT EXISTS idx_work_images_entry     ON work_images(work_entry_id)');

  d.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    )
  `);

  d.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('unitName', '');

  saveDb();

  const catCount = d.prepare('SELECT COUNT(*) as cnt FROM categories').get();
  if (catCount.cnt === 0) {
    const insert = d.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
    insert.run('民生实事', 1);
    insert.run('环境整治', 2);
    insert.run('安全生产', 3);
    saveDb();
  }

  const userCount = d.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (userCount.cnt === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    d.prepare('INSERT INTO users (username, display_name, password_hash, role) VALUES (?, ?, ?, ?)')
      .run('admin', '系统管理员', hash, 'admin');
    saveDb();
    console.log('[DB] 默认管理员已创建: admin / admin123');
  }
}

module.exports = { getDb, initDb, runMigrations, saveDb };
