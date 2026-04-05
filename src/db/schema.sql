-- Police officers who use the system
CREATE TABLE IF NOT EXISTS officers (
  id         TEXT PRIMARY KEY,
  badge_no   TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  password   TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'officer',  -- 'officer' | 'admin'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Registered three-wheelers (tuk-tuks)
CREATE TABLE IF NOT EXISTS vehicles (
  id              TEXT PRIMARY KEY,
  plate_no        TEXT NOT NULL UNIQUE,
  make            TEXT NOT NULL DEFAULT 'Three-Wheeler',
  model           TEXT,
  year            INTEGER,
  colour          TEXT,
  status          TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'suspended' | 'stolen'
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Registered drivers
CREATE TABLE IF NOT EXISTS drivers (
  id            TEXT PRIMARY KEY,
  nic           TEXT NOT NULL UNIQUE,  -- National Identity Card number
  name          TEXT NOT NULL,
  licence_no    TEXT NOT NULL UNIQUE,
  phone         TEXT,
  address       TEXT,
  status        TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'suspended'
  vehicle_id    TEXT REFERENCES vehicles(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- GPS location events submitted by tracking devices
CREATE TABLE IF NOT EXISTS locations (
  id           TEXT PRIMARY KEY,
  vehicle_id   TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  latitude     REAL NOT NULL,
  longitude    REAL NOT NULL,
  speed        REAL,           -- km/h
  heading      REAL,           -- degrees (0-360)
  recorded_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Alerts / incidents raised by officers
CREATE TABLE IF NOT EXISTS alerts (
  id           TEXT PRIMARY KEY,
  vehicle_id   TEXT REFERENCES vehicles(id) ON DELETE SET NULL,
  driver_id    TEXT REFERENCES drivers(id) ON DELETE SET NULL,
  officer_id   TEXT NOT NULL REFERENCES officers(id),
  type         TEXT NOT NULL,  -- 'stolen' | 'suspicious' | 'traffic_violation' | 'other'
  description  TEXT,
  latitude     REAL,
  longitude    REAL,
  status       TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'resolved'
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at  TEXT
);
