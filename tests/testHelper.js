'use strict';

/**
 * Shared test helper: initialises an in-memory SQLite database and wires it
 * into the database module before any tests run.
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { setDb, closeDb } = require('../src/db/database');

function setupTestDb() {
  beforeEach(() => {
    const db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    const schema = fs.readFileSync(path.join(__dirname, '../src/db/schema.sql'), 'utf8');
    db.exec(schema);
    setDb(db);
  });

  afterEach(() => {
    closeDb();
  });
}

module.exports = { setupTestDb };
