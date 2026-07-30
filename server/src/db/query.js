let _db = null;

function setDb(database) {
  _db = database;
}

function getDbRaw() {
  return _db;
}

class Statement {
  constructor(sql) {
    this.sql = sql;
  }

  _execute(params = []) {
    const flatParams = Array.isArray(params) ? params : [];
    try {
      return _db.exec(this.sql.replace(/\?/g, () => {
        const v = flatParams.shift();
        if (v === undefined) return 'NULL';
        if (v === null) return 'NULL';
        if (typeof v === 'number') return v;
        return `'${String(v).replace(/'/g, "''")}'`;
      }));
    } catch (e) {
      console.error('[SQL Error]', this.sql, params, e.message);
      return [];
    }
  }

  get(...params) {
    const results = this._execute(params);
    if (results.length > 0 && results[0].values.length > 0) {
      const row = {};
      results[0].columns.forEach((col, i) => {
        row[col] = results[0].values[0][i];
      });
      return row;
    }
    return undefined;
  }

  all(...params) {
    const results = this._execute(params);
    if (results.length > 0) {
      return results[0].values.map(vals => {
        const row = {};
        results[0].columns.forEach((col, i) => {
          row[col] = vals[i];
        });
        return row;
      });
    }
    return [];
  }

  run(...params) {
    try {
      _db.run(this.sql, params);
    } catch (e) {
      console.error('[SQL Error]', this.sql, params, e.message);
      throw e;
    }
    return {
      lastInsertRowid: 0,
      changes: 0,
    };
  }
}

function prepare(sql) {
  return new Statement(sql);
}

module.exports = { setDb, getDbRaw, prepare };
