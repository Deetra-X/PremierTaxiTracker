'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '8h';

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable must be set in production');
  }
  console.warn('[WARNING] JWT_SECRET is not set. Using an insecure default – do not use in production.');
}

const EFFECTIVE_SECRET = JWT_SECRET || 'slp-tracker-dev-secret';

/**
 * Middleware: verify Bearer JWT in Authorization header.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    req.officer = jwt.verify(token, EFFECTIVE_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware: require 'admin' role.
 */
function requireAdmin(req, res, next) {
  if (!req.officer || req.officer.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required' });
  }
  next();
}

/**
 * Sign a JWT for a police officer record.
 */
function signToken(officer) {
  return jwt.sign(
    { id: officer.id, badgeNo: officer.badge_no, role: officer.role },
    EFFECTIVE_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

module.exports = { authenticate, requireAdmin, signToken };
