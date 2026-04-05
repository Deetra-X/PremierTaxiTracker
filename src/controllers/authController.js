'use strict';

const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const { getDb } = require('../db/database');
const { signToken } = require('../middleware/auth');

/**
 * POST /api/v1/auth/register
 * Register a new police officer account (admin only in production;
 * open for the initial deployment seed).
 */
function register(req, res, next) {
  try {
    const { badge_no, name, password, role } = req.body;
    if (!badge_no || !name || !password) {
      return res.status(400).json({ error: 'badge_no, name and password are required' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM officers WHERE badge_no = ?').get(badge_no);
    if (existing) {
      return res.status(409).json({ error: 'Badge number already registered' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const id = randomUUID();
    const officerRole = role === 'admin' ? 'admin' : 'officer';

    db.prepare(
      'INSERT INTO officers (id, badge_no, name, password, role) VALUES (?, ?, ?, ?, ?)'
    ).run(id, badge_no, name, hash, officerRole);

    return res.status(201).json({ id, badge_no, name, role: officerRole });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/login
 */
function login(req, res, next) {
  try {
    const { badge_no, password } = req.body;
    if (!badge_no || !password) {
      return res.status(400).json({ error: 'badge_no and password are required' });
    }

    const db = getDb();
    const officer = db.prepare('SELECT * FROM officers WHERE badge_no = ?').get(badge_no);
    if (!officer || !bcrypt.compareSync(password, officer.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(officer);
    return res.json({ token, officer: { id: officer.id, badge_no: officer.badge_no, name: officer.name, role: officer.role } });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/auth/me
 */
function me(req, res, next) {
  try {
    const db = getDb();
    const officer = db.prepare('SELECT id, badge_no, name, role, created_at FROM officers WHERE id = ?').get(req.officer.id);
    if (!officer) return res.status(404).json({ error: 'Officer not found' });
    return res.json(officer);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, me };
