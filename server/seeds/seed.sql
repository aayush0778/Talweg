-- ============================================================
-- SlopeGuard AI — Seed Data
-- ============================================================
-- Deterministic, reproducible demo data for P0-A.
--
-- DATA HONESTY:
--   source = 'synthetic_seed'  → fabricated for demo purposes
--   source = 'nasa_glc'        → real NASA Global Landslide Catalog records
--   source = 'derived_slope_srtm' → SRTM 30m via opentopodata.org, finite-difference estimate
--
-- The coordinates for regions and risk zones are based on real
-- Sikkim geography (approximate boundaries). Environmental observations
-- and most events are SYNTHETIC — clearly marked as such.
--
-- This seed makes the P0-A demo reproducible from a fresh database.
-- ============================================================

-- ----- REGION: Sikkim -----
-- Approximate bounding polygon of Sikkim state.
INSERT INTO regions (id, name, state, geometry) VALUES (
  'sikkim',
  'Sikkim',
  'Sikkim',
  ST_GeomFromText('POLYGON((88.00 27.08, 88.92 27.08, 88.92 28.13, 88.00 28.13, 88.00 27.08))', 4326)
);

-- ----- RISK ZONES -----
-- Six prototype micro-zones centered on key Sikkim corridors.
-- Polygons are approximate bounding boxes (~5-10 km) around each area.

-- Gangtok: state capital, NH10 corridor, high population + steep terrain
INSERT INTO risk_zones (id, region_id, name, description, base_slope, geometry) VALUES (
  'gangtok',
  'sikkim',
  'Gangtok Corridor',
  'State capital and NH10 highway corridor. Steep terrain with dense habitation and significant historical landslide activity.',
  19.6,
  ST_GeomFromText('POLYGON((88.58 27.30, 88.65 27.30, 88.65 27.38, 88.58 27.38, 88.58 27.30))', 4326)
);

-- Mangan: North Sikkim district HQ, Teesta valley
INSERT INTO risk_zones (id, region_id, name, description, base_slope, geometry) VALUES (
  'mangan',
  'sikkim',
  'Mangan - Teesta Valley',
  'North Sikkim district headquarters along the Teesta River valley. Prone to flash floods and debris flows.',
  30.6,
  ST_GeomFromText('POLYGON((88.50 27.48, 88.58 27.48, 88.58 27.55, 88.50 27.55, 88.50 27.48))', 4326)
);

-- Namchi: South Sikkim district HQ
INSERT INTO risk_zones (id, region_id, name, description, base_slope, geometry) VALUES (
  'namchi',
  'sikkim',
  'Namchi Zone',
  'South Sikkim district headquarters. Moderate slopes with seasonal rainfall-triggered slides.',
  23.7,
  ST_GeomFromText('POLYGON((88.32 27.15, 88.40 27.15, 88.40 27.22, 88.32 27.22, 88.32 27.15))', 4326)
);

-- Pakyong: East Sikkim, airport area
INSERT INTO risk_zones (id, region_id, name, description, base_slope, geometry) VALUES (
  'pakyong',
  'sikkim',
  'Pakyong Area',
  'East Sikkim near the Pakyong airport. Cut slopes from construction increase vulnerability.',
  24.0,
  ST_GeomFromText('POLYGON((88.58 27.20, 88.66 27.20, 88.66 27.26, 88.58 27.26, 88.58 27.20))', 4326)
);

-- Gyalshing: West Sikkim district HQ
INSERT INTO risk_zones (id, region_id, name, description, base_slope, geometry) VALUES (
  'gyalshing',
  'sikkim',
  'Gyalshing - West Sikkim',
  'West Sikkim district headquarters. Moderate-to-high slopes, lower population density.',
  21.3,
  ST_GeomFromText('POLYGON((88.22 27.28, 88.30 27.28, 88.30 27.35, 88.22 27.35, 88.22 27.28))', 4326)
);

-- Soreng: West Sikkim sub-division
INSERT INTO risk_zones (id, region_id, name, description, base_slope, geometry) VALUES (
  'soreng',
  'sikkim',
  'Soreng Sub-division',
  'West Sikkim sub-division. Hilly terrain along the Rangit basin with seasonal instability.',
  20.4,
  ST_GeomFromText('POLYGON((88.15 27.12, 88.24 27.12, 88.24 27.19, 88.15 27.19, 88.15 27.12))', 4326)
);

-- ----- HISTORICAL LANDSLIDE EVENTS -----
-- Mix of synthetic demo events for each zone.
-- All clearly marked source = 'synthetic_seed'.
-- Coordinates fall within or near the corresponding risk zone polygons.

INSERT INTO landslide_events (id, date, latitude, longitude, geometry, trigger, category, fatalities, description, source) VALUES
  ('glc-15243', '2023-10-04', 27.52, 88.54, ST_SetSRID(ST_MakePoint(88.54, 27.52), 4326), 'rain', 'debris_flow', 5, 'Chungthang-Mangan corridor debris flow following extreme cloudburst (NASA GLC #15243)', 'nasa_glc'),
  ('evt-001', '2023-10-04', 27.33, 88.61, ST_SetSRID(ST_MakePoint(88.61, 27.33), 4326), 'rain', 'landslide', 2, 'Monsoon-triggered debris flow along NH10 near Gangtok', 'synthetic_seed'),
  ('evt-002', '2022-08-15', 27.35, 88.62, ST_SetSRID(ST_MakePoint(88.62, 27.35), 4326), 'rain', 'landslide', 0, 'Road-blocking slide near 7th Mile, Gangtok', 'synthetic_seed'),
  ('evt-003', '2021-07-22', 27.32, 88.60, ST_SetSRID(ST_MakePoint(88.60, 27.32), 4326), 'rain', 'debris_flow', 1, 'Debris flow in Chandmari area during heavy rain', 'synthetic_seed'),
  ('evt-004', '2023-06-18', 27.34, 88.63, ST_SetSRID(ST_MakePoint(88.63, 27.34), 4326), 'rain', 'landslide', 0, 'Minor slope failure near Ranipool', 'synthetic_seed'),
  ('evt-005', '2020-09-10', 27.36, 88.59, ST_SetSRID(ST_MakePoint(88.59, 27.36), 4326), 'rain', 'rockfall', 0, 'Rockfall on bypass road during prolonged rain', 'synthetic_seed'),
  ('evt-006', '2023-10-04', 27.52, 88.54, ST_SetSRID(ST_MakePoint(88.54, 27.52), 4326), 'rain', 'debris_flow', 5, 'GLOF-triggered debris flow in Teesta valley near Mangan', 'synthetic_seed'),
  ('evt-007', '2022-07-30', 27.50, 88.53, ST_SetSRID(ST_MakePoint(88.53, 27.50), 4326), 'rain', 'landslide', 0, 'Landslide blocking North Sikkim Highway near Mangan', 'synthetic_seed'),
  ('evt-008', '2021-08-05', 27.51, 88.56, ST_SetSRID(ST_MakePoint(88.56, 27.51), 4326), 'rain', 'landslide', 1, 'Slope collapse along Teesta riverbank', 'synthetic_seed'),
  ('evt-009', '2022-09-12', 27.18, 88.36, ST_SetSRID(ST_MakePoint(88.36, 27.18), 4326), 'rain', 'landslide', 0, 'Minor slide near Namchi bazaar area', 'synthetic_seed'),
  ('evt-010', '2023-07-25', 27.17, 88.35, ST_SetSRID(ST_MakePoint(88.35, 27.17), 4326), 'rain', 'landslide', 0, 'Seasonal slope failure south of Namchi', 'synthetic_seed'),
  ('evt-011', '2022-06-20', 27.23, 88.62, ST_SetSRID(ST_MakePoint(88.62, 27.23), 4326), 'rain', 'landslide', 0, 'Cut-slope failure near Pakyong airport road', 'synthetic_seed'),
  ('evt-012', '2023-08-08', 27.22, 88.60, ST_SetSRID(ST_MakePoint(88.60, 27.22), 4326), 'rain', 'debris_flow', 0, 'Debris flow along construction area near Pakyong', 'synthetic_seed'),
  ('evt-013', '2021-09-15', 27.32, 88.26, ST_SetSRID(ST_MakePoint(88.26, 27.32), 4326), 'rain', 'landslide', 0, 'Seasonal slide west of Gyalshing town', 'synthetic_seed'),
  ('evt-014', '2023-07-10', 27.15, 88.20, ST_SetSRID(ST_MakePoint(88.20, 27.15), 4326), 'rain', 'landslide', 0, 'Slope instability near Soreng along Rangit basin', 'synthetic_seed'),
  ('evt-015', '2022-08-28', 27.16, 88.18, ST_SetSRID(ST_MakePoint(88.18, 27.16), 4326), 'rain', 'debris_flow', 1, 'Debris flow during intense monsoon rain near Soreng', 'synthetic_seed');


-- ----- ENVIRONMENTAL OBSERVATIONS -----
-- One "current" observation per zone. All SYNTHETIC.
-- These values represent a plausible mid-monsoon scenario.
-- rainfall in mm, soil_moisture 0-1 normalized, slope in degrees.

INSERT INTO environmental_observations (zone_id, timestamp, rainfall_24h, rainfall_3d, rainfall_7d, soil_moisture, slope, source) VALUES
  ('gangtok',   '2026-08-01T06:00:00Z', 85.0,  180.0, 320.0, 0.78, 19.6, 'synthetic_seed'),
  ('mangan',    '2026-08-01T06:00:00Z', 110.0, 240.0, 400.0, 0.85, 30.6, 'synthetic_seed'),
  ('namchi',    '2026-08-01T06:00:00Z', 45.0,  100.0, 180.0, 0.55, 23.7, 'synthetic_seed'),
  ('pakyong',   '2026-08-01T06:00:00Z', 65.0,  140.0, 260.0, 0.65, 24.0, 'synthetic_seed'),
  ('gyalshing', '2026-08-01T06:00:00Z', 55.0,  120.0, 220.0, 0.60, 21.3, 'synthetic_seed'),
  ('soreng',    '2026-08-01T06:00:00Z', 70.0,  155.0, 290.0, 0.70, 20.4, 'synthetic_seed');
