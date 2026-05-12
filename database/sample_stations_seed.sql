-- Sample Fuel Stations Seed (FQMS)
-- Safe to import multiple times (uses INSERT IGNORE / ON DUPLICATE KEY UPDATE where possible)
-- Requires: database/fqms.sql already imported (tables exist)

USE `fqms`;

START TRANSACTION;

-- ---------------------------------------------------------------------------
-- 1) Fuel stations with coordinates (Sri Lanka)
-- ---------------------------------------------------------------------------
-- Note: station_id is auto-increment; we identify rows by station_name for id lookup.
INSERT IGNORE INTO fuel_stations (station_name, location, latitude, longitude)
VALUES
  ('Ceypetco — Colombo', 'Colombo', 6.92710000, 79.86120000),
  ('IOC — Kandy', 'Kandy', 7.29060000, 80.63370000),
  ('Ceypetco — Galle', 'Galle', 6.05350000, 80.22100000),
  ('IOC — Jaffna', 'Jaffna', 9.66150000, 80.02550000),
  ('Ceypetco — Kurunegala', 'Kurunegala', 7.48630000, 80.36220000),
  ('IOC — Anuradhapura', 'Anuradhapura', 8.31140000, 80.40370000),
  ('Ceypetco — Trincomalee', 'Trincomalee', 8.58740000, 81.21520000),
  ('IOC — Matara', 'Matara', 5.95490000, 80.55490000);

UPDATE fuel_stations
SET approval_status = 'approved',
    approved_at = COALESCE(approved_at, CURRENT_TIMESTAMP)
WHERE station_name IN (
  'Ceypetco â€” Colombo',
  'IOC â€” Kandy',
  'Ceypetco â€” Galle',
  'IOC â€” Jaffna',
  'Ceypetco â€” Kurunegala',
  'IOC â€” Anuradhapura',
  'Ceypetco â€” Trincomalee',
  'IOC â€” Matara'
);

-- ---------------------------------------------------------------------------
-- 2) Ensure queue_status exists for each station (1 row per station)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO queue_status (station_id, queue_length, waiting_time, service_rate, active_pumps)
SELECT fs.station_id, 0, 0, 5.00, 2
FROM fuel_stations fs
WHERE fs.station_name IN (
  'Ceypetco — Colombo',
  'IOC — Kandy',
  'Ceypetco — Galle',
  'IOC — Jaffna',
  'Ceypetco — Kurunegala',
  'IOC — Anuradhapura',
  'Ceypetco — Trincomalee',
  'IOC — Matara'
)
ON DUPLICATE KEY UPDATE
  queue_length = VALUES(queue_length),
  waiting_time = VALUES(waiting_time),
  service_rate = VALUES(service_rate),
  active_pumps = VALUES(active_pumps),
  updated_at = CURRENT_TIMESTAMP;

-- ---------------------------------------------------------------------------
-- 3) Ensure fuel availability rows exist (1 row per (station, fuel_type))
-- fuel_type_id: 1 = Petrol, 2 = Diesel
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO fuel_availability (station_id, fuel_type_id, is_available)
SELECT fs.station_id, 1, 1
FROM fuel_stations fs
WHERE fs.station_name IN (
  'Ceypetco — Colombo',
  'IOC — Kandy',
  'Ceypetco — Galle',
  'IOC — Jaffna',
  'Ceypetco — Kurunegala',
  'IOC — Anuradhapura',
  'Ceypetco — Trincomalee',
  'IOC — Matara'
);

INSERT IGNORE INTO fuel_availability (station_id, fuel_type_id, is_available)
SELECT fs.station_id, 2, 1
FROM fuel_stations fs
WHERE fs.station_name IN (
  'Ceypetco — Colombo',
  'IOC — Kandy',
  'Ceypetco — Galle',
  'IOC — Jaffna',
  'Ceypetco — Kurunegala',
  'IOC — Anuradhapura',
  'Ceypetco — Trincomalee',
  'IOC — Matara'
);

-- ---------------------------------------------------------------------------
-- 4) Set some realistic demo values (queue + availability)
-- ---------------------------------------------------------------------------
-- Colombo: Petrol yes, Diesel no, queue 24
UPDATE queue_status qs
JOIN fuel_stations fs ON fs.station_id = qs.station_id
SET qs.queue_length = 24,
    qs.waiting_time = 48,
    qs.updated_at = CURRENT_TIMESTAMP
WHERE fs.station_name = 'Ceypetco — Colombo';

UPDATE fuel_availability fa
JOIN fuel_stations fs ON fs.station_id = fa.station_id
SET fa.is_available = CASE WHEN fa.fuel_type_id = 1 THEN 1 ELSE 0 END,
    fa.last_updated = CURRENT_TIMESTAMP
WHERE fs.station_name = 'Ceypetco — Colombo';

-- Kandy: both yes, queue 8
UPDATE queue_status qs
JOIN fuel_stations fs ON fs.station_id = qs.station_id
SET qs.queue_length = 8,
    qs.waiting_time = 16,
    qs.updated_at = CURRENT_TIMESTAMP
WHERE fs.station_name = 'IOC — Kandy';

UPDATE fuel_availability fa
JOIN fuel_stations fs ON fs.station_id = fa.station_id
SET fa.is_available = 1,
    fa.last_updated = CURRENT_TIMESTAMP
WHERE fs.station_name = 'IOC — Kandy';

-- Galle: Petrol no, Diesel yes, queue 14
UPDATE queue_status qs
JOIN fuel_stations fs ON fs.station_id = qs.station_id
SET qs.queue_length = 14,
    qs.waiting_time = 28,
    qs.updated_at = CURRENT_TIMESTAMP
WHERE fs.station_name = 'Ceypetco — Galle';

UPDATE fuel_availability fa
JOIN fuel_stations fs ON fs.station_id = fa.station_id
SET fa.is_available = CASE WHEN fa.fuel_type_id = 1 THEN 0 ELSE 1 END,
    fa.last_updated = CURRENT_TIMESTAMP
WHERE fs.station_name = 'Ceypetco — Galle';

-- Jaffna: none, queue 3
UPDATE queue_status qs
JOIN fuel_stations fs ON fs.station_id = qs.station_id
SET qs.queue_length = 3,
    qs.waiting_time = 6,
    qs.updated_at = CURRENT_TIMESTAMP
WHERE fs.station_name = 'IOC — Jaffna';

UPDATE fuel_availability fa
JOIN fuel_stations fs ON fs.station_id = fa.station_id
SET fa.is_available = 0,
    fa.last_updated = CURRENT_TIMESTAMP
WHERE fs.station_name = 'IOC — Jaffna';

-- Kurunegala: both yes, queue 18
UPDATE queue_status qs
JOIN fuel_stations fs ON fs.station_id = qs.station_id
SET qs.queue_length = 18,
    qs.waiting_time = 36,
    qs.updated_at = CURRENT_TIMESTAMP
WHERE fs.station_name = 'Ceypetco — Kurunegala';

UPDATE fuel_availability fa
JOIN fuel_stations fs ON fs.station_id = fa.station_id
SET fa.is_available = 1,
    fa.last_updated = CURRENT_TIMESTAMP
WHERE fs.station_name = 'Ceypetco — Kurunegala';

-- Anuradhapura: Petrol yes, Diesel yes, queue 0
UPDATE queue_status qs
JOIN fuel_stations fs ON fs.station_id = qs.station_id
SET qs.queue_length = 0,
    qs.waiting_time = 0,
    qs.updated_at = CURRENT_TIMESTAMP
WHERE fs.station_name = 'IOC — Anuradhapura';

UPDATE fuel_availability fa
JOIN fuel_stations fs ON fs.station_id = fa.station_id
SET fa.is_available = 1,
    fa.last_updated = CURRENT_TIMESTAMP
WHERE fs.station_name = 'IOC — Anuradhapura';

-- Trincomalee: limited (Diesel only), queue 11
UPDATE queue_status qs
JOIN fuel_stations fs ON fs.station_id = qs.station_id
SET qs.queue_length = 11,
    qs.waiting_time = 22,
    qs.updated_at = CURRENT_TIMESTAMP
WHERE fs.station_name = 'Ceypetco — Trincomalee';

UPDATE fuel_availability fa
JOIN fuel_stations fs ON fs.station_id = fa.station_id
SET fa.is_available = CASE WHEN fa.fuel_type_id = 1 THEN 0 ELSE 1 END,
    fa.last_updated = CURRENT_TIMESTAMP
WHERE fs.station_name = 'Ceypetco — Trincomalee';

-- Matara: both yes, queue 9
UPDATE queue_status qs
JOIN fuel_stations fs ON fs.station_id = qs.station_id
SET qs.queue_length = 9,
    qs.waiting_time = 18,
    qs.updated_at = CURRENT_TIMESTAMP
WHERE fs.station_name = 'IOC — Matara';

UPDATE fuel_availability fa
JOIN fuel_stations fs ON fs.station_id = fa.station_id
SET fa.is_available = 1,
    fa.last_updated = CURRENT_TIMESTAMP
WHERE fs.station_name = 'IOC — Matara';

COMMIT;

