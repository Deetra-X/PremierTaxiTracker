'use strict';

const { randomUUID } = require('crypto');
const { getDb } = require('../db/database');

const VALID_TYPES = ['stolen', 'suspicious', 'traffic_violation', 'other'];
const VALID_STATUSES = ['open', 'resolved'];

/**
 * GET /api/v1/alerts
 * Query params: status, type, vehicle_id, page, limit
 */
function list(req, res, next) {
  try {
    const { status, type, vehicle_id, page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));
    const take = Math.min(100, parseInt(limit, 10));

    let sql = 'SELECT * FROM alerts WHERE 1=1';
    const params = [];

    if (status)     { sql += ' AND status = ?'; params.push(status); }
    if (type)       { sql += ' AND type = ?'; params.push(type); }
    if (vehicle_id) { sql += ' AND vehicle_id = ?'; params.push(vehicle_id); }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(take, offset);

    const db = getDb();
    const alerts = db.prepare(sql).all(...params);
    return res.json({ data: alerts, page: parseInt(page, 10), limit: take });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/alerts
 */
function create(req, res, next) {
  try {
    const { vehicle_id, driver_id, type, description, latitude, longitude } = req.body;

    if (!type) return res.status(400).json({ error: 'type is required' });
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }

    const db = getDb();

    if (vehicle_id) {
      const veh = db.prepare('SELECT id FROM vehicles WHERE id = ?').get(vehicle_id);
      if (!veh) return res.status(400).json({ error: 'vehicle_id does not exist' });
    }
    if (driver_id) {
      const drv = db.prepare('SELECT id FROM drivers WHERE id = ?').get(driver_id);
      if (!drv) return res.status(400).json({ error: 'driver_id does not exist' });
    }

    const id = randomUUID();
    db.prepare(
      `INSERT INTO alerts (id, vehicle_id, driver_id, officer_id, type, description, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      vehicle_id || null,
      driver_id || null,
      req.officer.id,
      type,
      description || null,
      latitude !== undefined ? latitude : null,
      longitude !== undefined ? longitude : null
    );

    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id);
    return res.status(201).json(alert);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/alerts/:id
 */
function getById(req, res, next) {
  try {
    const db = getDb();
    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    return res.json(alert);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/alerts/:id/resolve
 * Mark an alert as resolved.
 */
function resolve(req, res, next) {
  try {
    const db = getDb();
    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    if (alert.status === 'resolved') {
      return res.status(409).json({ error: 'Alert is already resolved' });
    }

    db.prepare(
      `UPDATE alerts SET status = 'resolved', resolved_at = datetime('now') WHERE id = ?`
    ).run(req.params.id);

    const updated = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
    return res.json(updated);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/alerts/:id
 * Update alert fields (type, description, vehicle_id, driver_id, latitude, longitude, status).
 */
function update(req, res, next) {
  try {
    const { type, description, vehicle_id, driver_id, latitude, longitude, status } = req.body;
    const db = getDb();

    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    if (type && !VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    db.prepare(
      `UPDATE alerts SET
        type        = COALESCE(?, type),
        description = COALESCE(?, description),
        vehicle_id  = COALESCE(?, vehicle_id),
        driver_id   = COALESCE(?, driver_id),
        latitude    = COALESCE(?, latitude),
        longitude   = COALESCE(?, longitude),
        status      = COALESCE(?, status)
       WHERE id = ?`
    ).run(
      type || null, description || null, vehicle_id || null, driver_id || null,
      latitude !== undefined ? latitude : null, longitude !== undefined ? longitude : null,
      status || null, req.params.id
    );

    const updated = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
    return res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, getById, resolve, update };
