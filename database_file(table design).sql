-- ============================================
-- NEON POSTGRESQL DATABASE SETUP
-- Tuk-Tuk Tracking System
-- ============================================

-- ============================================
-- DROP TABLES (OPTIONAL RESET)
-- ============================================

DROP TABLE IF EXISTS location_logs CASCADE;
DROP TABLE IF EXISTS tuk_tuks CASCADE;
DROP TABLE IF EXISTS gps_devices CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS police_stations CASCADE;
DROP TABLE IF EXISTS districts CASCADE;
DROP TABLE IF EXISTS provinces CASCADE;

-- ============================================
-- CREATE TABLES
-- ============================================

CREATE TABLE provinces (
    province_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE districts (
    district_id SERIAL PRIMARY KEY,
    province_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_district_province
        FOREIGN KEY (province_id)
        REFERENCES provinces(province_id)
        ON DELETE CASCADE
);

CREATE TABLE police_stations (
    station_id SERIAL PRIMARY KEY,
    district_id INTEGER NOT NULL,
    station_name VARCHAR(150) NOT NULL,
    address TEXT,
    contact_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_station_district
        FOREIGN KEY (district_id)
        REFERENCES districts(district_id)
        ON DELETE CASCADE
);

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    station_id INTEGER,

    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,

    role VARCHAR(50) NOT NULL CHECK (
        role IN (
            'HQ_ADMIN',
            'PROVINCIAL_OFFICER',
            'DISTRICT_OFFICER',
            'STATION_OFFICER'
        )
    ),

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_station
        FOREIGN KEY (station_id)
        REFERENCES police_stations(station_id)
        ON DELETE SET NULL
);

CREATE TABLE drivers (
    driver_id SERIAL PRIMARY KEY,

    full_name VARCHAR(150) NOT NULL,
    nic_number VARCHAR(20) UNIQUE NOT NULL,
    phone_number VARCHAR(20),
    address TEXT,
    license_number VARCHAR(50),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE gps_devices (
    device_id SERIAL PRIMARY KEY,

    imei_number VARCHAR(50) UNIQUE NOT NULL,
    sim_number VARCHAR(20),

    status VARCHAR(30) DEFAULT 'ACTIVE' CHECK (
        status IN (
            'ACTIVE',
            'INACTIVE',
            'MAINTENANCE'
        )
    ),

    installed_date DATE
);

CREATE TABLE tuk_tuks (
    tuk_tuk_id SERIAL PRIMARY KEY,

    driver_id INTEGER NOT NULL,
    device_id INTEGER NOT NULL,

    registration_number VARCHAR(20) UNIQUE NOT NULL,

    model VARCHAR(100),
    color VARCHAR(50),
    manufacture_year INTEGER,

    province_id INTEGER,
    district_id INTEGER,

    is_active BOOLEAN DEFAULT TRUE,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_tuktuk_driver
        FOREIGN KEY (driver_id)
        REFERENCES drivers(driver_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_tuktuk_device
        FOREIGN KEY (device_id)
        REFERENCES gps_devices(device_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_tuktuk_province
        FOREIGN KEY (province_id)
        REFERENCES provinces(province_id)
        ON DELETE SET NULL,

    CONSTRAINT fk_tuktuk_district
        FOREIGN KEY (district_id)
        REFERENCES districts(district_id)
        ON DELETE SET NULL
);

CREATE TABLE location_logs (
    log_id BIGSERIAL PRIMARY KEY,

    tuk_tuk_id INTEGER NOT NULL,

    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,

    speed_kmh DECIMAL(5,2),

    recorded_at TIMESTAMP NOT NULL,

    location_description VARCHAR(255),

    CONSTRAINT fk_location_tuktuk
        FOREIGN KEY (tuk_tuk_id)
        REFERENCES tuk_tuks(tuk_tuk_id)
        ON DELETE CASCADE
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_location_time
ON location_logs(recorded_at);

CREATE INDEX idx_location_tuktuk
ON location_logs(tuk_tuk_id);

CREATE INDEX idx_tuktuk_district
ON tuk_tuks(district_id);

CREATE INDEX idx_tuktuk_province
ON tuk_tuks(province_id);

-- ============================================
-- INSERT PROVINCES
-- ============================================

INSERT INTO provinces (name) VALUES
('Western'),
('Central'),
('Southern'),
('Northern'),
('Eastern'),
('North Western'),
('North Central'),
('Uva'),
('Sabaragamuwa');

-- ============================================
-- INSERT DISTRICTS
-- ============================================

INSERT INTO districts (province_id, name) VALUES
(1, 'Colombo'),
(1, 'Gampaha'),
(1, 'Kalutara'),

(2, 'Kandy'),
(2, 'Matale'),
(2, 'Nuwara Eliya'),

(3, 'Galle'),
(3, 'Matara'),
(3, 'Hambantota'),

(4, 'Jaffna'),
(4, 'Kilinochchi'),

(5, 'Batticaloa'),
(5, 'Ampara'),

(6, 'Kurunegala'),
(6, 'Puttalam'),

(7, 'Anuradhapura'),
(7, 'Polonnaruwa'),

(8, 'Badulla'),
(8, 'Monaragala'),

(9, 'Ratnapura'),
(9, 'Kegalle');

-- ============================================
-- INSERT POLICE STATIONS
-- ============================================

INSERT INTO police_stations
(district_id, station_name, address, contact_number)
VALUES

(1, 'Colombo Fort Police Station', 'Fort, Colombo', '0112421111'),
(1, 'Pettah Police Station', 'Pettah, Colombo', '0112433333'),
(1, 'Wellawatte Police Station', 'Wellawatte, Colombo', '0112588888'),

(2, 'Negombo Police Station', 'Negombo', '0312222222'),
(2, 'Kadawatha Police Station', 'Kadawatha', '0112929292'),

(4, 'Kandy Police Station', 'Kandy City', '0812222222'),
(4, 'Peradeniya Police Station', 'Peradeniya', '0812388888'),

(7, 'Galle Police Station', 'Galle Fort', '0912233445'),
(8, 'Matara Police Station', 'Matara Town', '0412221111'),

(10, 'Jaffna Police Station', 'Jaffna Town', '0212222222'),

(12, 'Batticaloa Police Station', 'Batticaloa Town', '0652222222'),

(14, 'Kurunegala Police Station', 'Kurunegala', '0372222222'),

(16, 'Anuradhapura Police Station', 'Anuradhapura', '0252222222'),

(18, 'Badulla Police Station', 'Badulla Town', '0552222222'),

(20, 'Ratnapura Police Station', 'Ratnapura Town', '0452222222');

-- ============================================
-- INSERT USERS
-- ============================================

INSERT INTO users
(station_id, full_name, email, password_hash, role)
VALUES

(NULL,
'HQ Administrator',
'hqadmin@police.lk',
'$2b$10$examplehashedpassword',
'HQ_ADMIN'),

(1,
'Colombo Station Officer',
'colombo.station@police.lk',
'$2b$10$examplehashedpassword',
'STATION_OFFICER'),

(6,
'Kandy Provincial Officer',
'kandy.province@police.lk',
'$2b$10$examplehashedpassword',
'PROVINCIAL_OFFICER');

-- ============================================
-- INSERT DRIVERS
-- ============================================

INSERT INTO drivers
(full_name, nic_number, phone_number, address, license_number)
VALUES

('Kasun Perera',
'199812345678',
'0771234567',
'Maharagama',
'B1234567'),

('Nimal Silva',
'198745612345',
'0719876543',
'Kandy',
'B9876543'),

('Saman Kumara',
'199345678912',
'0754567890',
'Galle',
'B4567890'),

('Ruwan Fernando',
'199078945612',
'0762345678',
'Negombo',
'B7654321'),

('Dilan Jayasinghe',
'198912345111',
'0775554444',
'Matara',
'B9988776');

-- ============================================
-- INSERT GPS DEVICES
-- ============================================

INSERT INTO gps_devices
(imei_number, sim_number, status, installed_date)
VALUES

('356789123456789',
'94771234567',
'ACTIVE',
'2026-01-10'),

('356789123456790',
'94779876543',
'ACTIVE',
'2026-01-11'),

('356789123456791',
'94775678901',
'ACTIVE',
'2026-01-12'),

('356789123456792',
'94772345678',
'MAINTENANCE',
'2026-01-13'),

('356789123456793',
'94770123456',
'ACTIVE',
'2026-01-14');

-- ============================================
-- INSERT TUK TUKS
-- ============================================

INSERT INTO tuk_tuks
(
driver_id,
device_id,
registration_number,
model,
color,
manufacture_year,
province_id,
district_id
)
VALUES

(
1,
1,
'WP CAB-1234',
'Bajaj RE',
'Green',
2020,
1,
1
),

(
2,
2,
'CP CAD-5678',
'TVS King',
'Blue',
2021,
2,
4
),

(
3,
3,
'SP BAF-8899',
'Piaggio Ape',
'Red',
2019,
3,
7
),

(
4,
4,
'WP CAA-4567',
'Bajaj RE',
'Yellow',
2022,
1,
2
),

(
5,
5,
'SP CAD-2233',
'TVS King',
'Black',
2021,
3,
8
);

-- ============================================
-- INSERT LOCATION LOGS
-- ============================================

INSERT INTO location_logs
(
tuk_tuk_id,
latitude,
longitude,
speed_kmh,
recorded_at,
location_description
)
VALUES

(
1,
6.86490800,
79.89970400,
42.50,
'2026-04-30 10:15:00',
'Maharagama Town'
),

(
1,
6.87000000,
79.91000000,
38.20,
'2026-04-30 10:20:00',
'Nugegoda'
),

(
1,
6.87500000,
79.91500000,
25.00,
'2026-04-30 10:30:00',
'Kirulapone'
),

(
2,
7.29060000,
80.63370000,
35.00,
'2026-04-30 11:00:00',
'Kandy City Center'
),

(
2,
7.29500000,
80.64000000,
28.50,
'2026-04-30 11:10:00',
'Peradeniya'
),

(
3,
6.03290000,
80.21680000,
45.00,
'2026-04-30 09:45:00',
'Galle Fort'
),

(
4,
7.20830000,
79.83580000,
50.00,
'2026-04-30 08:30:00',
'Negombo Beach Road'
),

(
5,
5.95490000,
80.55500000,
40.00,
'2026-04-30 12:00:00',
'Matara Bus Stand'
);

-- ============================================
-- USEFUL QUERIES
-- ============================================

-- Get all tuk-tuks with drivers

SELECT
    t.tuk_tuk_id,
    t.registration_number,
    t.model,
    d.full_name AS driver_name,
    d.phone_number
FROM tuk_tuks t
JOIN drivers d
ON t.driver_id = d.driver_id;

-- Get latest location of all tuk-tuks

SELECT DISTINCT ON (tuk_tuk_id)
    tuk_tuk_id,
    latitude,
    longitude,
    speed_kmh,
    recorded_at
FROM location_logs
ORDER BY tuk_tuk_id, recorded_at DESC;

-- Get movement history of a tuk-tuk

SELECT *
FROM location_logs
WHERE tuk_tuk_id = 1
ORDER BY recorded_at DESC;

-- Get tuk-tuks by district

SELECT
    t.registration_number,
    d.name AS district_name
FROM tuk_tuks t
JOIN districts d
ON t.district_id = d.district_id
WHERE d.name = 'Colombo';

-- Count tuk-tuks per province

SELECT
    p.name AS province,
    COUNT(t.tuk_tuk_id) AS total_tuktuks
FROM provinces p
LEFT JOIN tuk_tuks t
ON p.province_id = t.province_id
GROUP BY p.name
ORDER BY total_tuktuks DESC;

-- Get active GPS devices

SELECT *
FROM gps_devices
WHERE status = 'ACTIVE';

-- Get police stations with districts

SELECT
    ps.station_name,
    d.name AS district
FROM police_stations ps
JOIN districts d
ON ps.district_id = d.district_id;

-- Delete old logs (example)

DELETE FROM location_logs
WHERE recorded_at < NOW() - INTERVAL '30 days';

-- ============================================
-- END OF DATABASE SCRIPT
-- ============================================

