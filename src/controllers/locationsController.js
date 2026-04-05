'use strict';

const { randomUUID } = require('crypto');
const { getDb } = require('../db/database');

/**
 * POST /api/v1/locations
 * Submit a GPS location update for a vehicle.
 */
function create(req, res, next) {
  try {
    const { vehicle_id, latitude, longitude, speed, heading } = req.body;

    if (!vehicle_id || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'vehicle_id, latitude and longitude are required' });
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Invalid latitude or longitude value' });
    }

    const db = getDb();
    const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ?').get(vehicle_id);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const id = randomUUID();
    db.prepare(
      `INSERT INTO locations (id, vehicle_id, latitude, longitude, speed, heading)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, vehicle_id, latitude, longitude, speed !== undefined ? speed : null, heading !== undefined ? heading : null);

    const location = db.prepare('SELECT * FROM locations WHERE id = ?').get(id);
    return res.status(201).json(location);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/locations/vehicle/:vehicleId
 * Get movement history for a vehicle.
 * Query params: from, to (ISO8601), page, limit
 */
function listByVehicle(req, res, next) {
  try {
    const { vehicleId } = req.params;
    const { from, to, page = 1, limit = 50 } = req.query;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(500, parseInt(limit, 10));
    const take = Math.min(500, parseInt(limit, 10));

    const db = getDb();
    const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ?').get(vehicleId);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    let sql = 'SELECT * FROM locations WHERE vehicle_id = ?';
    const params = [vehicleId];

    if (from) { sql += ' AND recorded_at >= ?'; params.push(from); }
    if (to)   { sql += ' AND recorded_at <= ?'; params.push(to); }

    sql += ' ORDER BY recorded_at DESC LIMIT ? OFFSET ?';
    params.push(take, offset);

    const locations = db.prepare(sql).all(...params);
    return res.json({ data: locations, page: parseInt(page, 10), limit: take });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/locations/vehicle/:vehicleId/latest
 * Get the most recent location for a vehicle.
 */
function latestByVehicle(req, res, next) {
  try {
    const { vehicleId } = req.params;
    const db = getDb();

    const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ?').get(vehicleId);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const location = db.prepare(
      'SELECT * FROM locations WHERE vehicle_id = ? ORDER BY recorded_at DESC LIMIT 1'
    ).get(vehicleId);

    if (!location) return res.status(404).json({ error: 'No location data available for this vehicle' });
    return res.json(location);
  } catch (err) {
    next(err);
  }
}

module.exports = { create, listByVehicle, latestByVehicle };
