'use strict';

const { randomUUID } = require('crypto');
const { getDb } = require('../db/database');

const VALID_STATUSES = ['active', 'suspended', 'stolen'];

/**
 * GET /api/v1/vehicles
 * Query params: status, plate_no, page, limit
 */
function list(req, res, next) {
  try {
    const { status, plate_no, page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));
    const take = Math.min(100, parseInt(limit, 10));

    let sql = 'SELECT * FROM vehicles WHERE 1=1';
    const params = [];

    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (plate_no) { sql += ' AND plate_no LIKE ?'; params.push(`%${plate_no}%`); }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(take, offset);

    const db = getDb();
    const vehicles = db.prepare(sql).all(...params);
    return res.json({ data: vehicles, page: parseInt(page, 10), limit: take });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/vehicles
 */
function create(req, res, next) {
  try {
    const { plate_no, make, model, year, colour, status } = req.body;
    if (!plate_no) {
      return res.status(400).json({ error: 'plate_no is required' });
    }

    const vehicleStatus = status || 'active';
    if (!VALID_STATUSES.includes(vehicleStatus)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM vehicles WHERE plate_no = ?').get(plate_no);
    if (existing) {
      return res.status(409).json({ error: 'Vehicle with this plate number already exists' });
    }

    const id = randomUUID();
    db.prepare(
      `INSERT INTO vehicles (id, plate_no, make, model, year, colour, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, plate_no, make || 'Three-Wheeler', model || null, year || null, colour || null, vehicleStatus);

    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);
    return res.status(201).json(vehicle);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/vehicles/:id
 */
function getById(req, res, next) {
  try {
    const db = getDb();
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    return res.json(vehicle);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/vehicles/:id
 */
function update(req, res, next) {
  try {
    const { plate_no, make, model, year, colour, status } = req.body;
    const db = getDb();

    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    db.prepare(
      `UPDATE vehicles SET
        plate_no   = COALESCE(?, plate_no),
        make       = COALESCE(?, make),
        model      = COALESCE(?, model),
        year       = COALESCE(?, year),
        colour     = COALESCE(?, colour),
        status     = COALESCE(?, status),
        updated_at = datetime('now')
       WHERE id = ?`
    ).run(plate_no || null, make || null, model || null, year || null, colour || null, status || null, req.params.id);

    const updated = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id);
    return res.json(updated);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/vehicles/:id
 */
function remove(req, res, next) {
  try {
    const db = getDb();
    const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ?').get(req.params.id);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    db.prepare('DELETE FROM vehicles WHERE id = ?').run(req.params.id);
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, getById, update, remove };
