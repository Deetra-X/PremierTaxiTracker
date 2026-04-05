'use strict';

const { randomUUID } = require('crypto');
const { getDb } = require('../db/database');

const VALID_STATUSES = ['active', 'suspended'];

/**
 * GET /api/v1/drivers
 * Query params: status, nic, name, page, limit
 */
function list(req, res, next) {
  try {
    const { status, nic, name, page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));
    const take = Math.min(100, parseInt(limit, 10));

    let sql = 'SELECT * FROM drivers WHERE 1=1';
    const params = [];

    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (nic)    { sql += ' AND nic = ?'; params.push(nic); }
    if (name)   { sql += ' AND name LIKE ?'; params.push(`%${name}%`); }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(take, offset);

    const db = getDb();
    const drivers = db.prepare(sql).all(...params);
    return res.json({ data: drivers, page: parseInt(page, 10), limit: take });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/drivers
 */
function create(req, res, next) {
  try {
    const { nic, name, licence_no, phone, address, status, vehicle_id } = req.body;
    if (!nic || !name || !licence_no) {
      return res.status(400).json({ error: 'nic, name and licence_no are required' });
    }

    const driverStatus = status || 'active';
    if (!VALID_STATUSES.includes(driverStatus)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const db = getDb();

    const existingNic = db.prepare('SELECT id FROM drivers WHERE nic = ?').get(nic);
    if (existingNic) return res.status(409).json({ error: 'Driver with this NIC already exists' });

    const existingLicence = db.prepare('SELECT id FROM drivers WHERE licence_no = ?').get(licence_no);
    if (existingLicence) return res.status(409).json({ error: 'Driver with this licence number already exists' });

    if (vehicle_id) {
      const veh = db.prepare('SELECT id FROM vehicles WHERE id = ?').get(vehicle_id);
      if (!veh) return res.status(400).json({ error: 'vehicle_id does not exist' });
    }

    const id = randomUUID();
    db.prepare(
      `INSERT INTO drivers (id, nic, name, licence_no, phone, address, status, vehicle_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, nic, name, licence_no, phone || null, address || null, driverStatus, vehicle_id || null);

    const driver = db.prepare('SELECT * FROM drivers WHERE id = ?').get(id);
    return res.status(201).json(driver);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/drivers/:id
 */
function getById(req, res, next) {
  try {
    const db = getDb();
    const driver = db.prepare('SELECT * FROM drivers WHERE id = ?').get(req.params.id);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    return res.json(driver);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/drivers/:id
 */
function update(req, res, next) {
  try {
    const { nic, name, licence_no, phone, address, status, vehicle_id } = req.body;
    const db = getDb();

    const driver = db.prepare('SELECT * FROM drivers WHERE id = ?').get(req.params.id);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    if (vehicle_id !== undefined) {
      const veh = db.prepare('SELECT id FROM vehicles WHERE id = ?').get(vehicle_id);
      if (vehicle_id !== null && !veh) return res.status(400).json({ error: 'vehicle_id does not exist' });
    }

    db.prepare(
      `UPDATE drivers SET
        nic        = COALESCE(?, nic),
        name       = COALESCE(?, name),
        licence_no = COALESCE(?, licence_no),
        phone      = COALESCE(?, phone),
        address    = COALESCE(?, address),
        status     = COALESCE(?, status),
        vehicle_id = CASE WHEN ? IS NOT NULL THEN ? ELSE vehicle_id END,
        updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      nic || null, name || null, licence_no || null, phone || null, address || null,
      status || null,
      vehicle_id !== undefined ? vehicle_id : null,
      vehicle_id !== undefined ? vehicle_id : driver.vehicle_id,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM drivers WHERE id = ?').get(req.params.id);
    return res.json(updated);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/drivers/:id
 */
function remove(req, res, next) {
  try {
    const db = getDb();
    const driver = db.prepare('SELECT id FROM drivers WHERE id = ?').get(req.params.id);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    db.prepare('DELETE FROM drivers WHERE id = ?').run(req.params.id);
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, getById, update, remove };
