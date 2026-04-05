'use strict';

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

let db;

/**
 * Open (or reuse) the SQLite database connection.
 * Pass ':memory:' as dbPath for in-memory test databases.
 */
function getDb(dbPath) {
  if (db) return db;

  const resolvedPath = dbPath || process.env.DB_PATH || path.join(__dirname, '../../data/tracker.db');

  if (resolvedPath !== ':memory:') {
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  return db;
}

/**
 * Replace the current connection – used by tests to inject an in-memory DB.
 */
function setDb(newDb) {
  db = newDb;
}

/**
 * Close and reset the connection (useful in tests).
 */
function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, setDb, closeDb };
