-- ============================================================
-- SlopeGuard AI — Core Schema
-- ============================================================
-- Creates all tables needed for P0-A:
--   regions, risk_zones, landslide_events,
--   environmental_observations, alerts
--
-- All spatial columns use SRID 4326 (WGS 84) with GiST indexes.
-- Every observation/event table has a `source` column for data provenance.
-- ============================================================

-- ----- REGIONS -----
-- Top-level monitored areas (e.g., "Sikkim").
CREATE TABLE regions (
  id          VARCHAR(50)  PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  state       VARCHAR(100) NOT NULL,
  geometry    geometry(Polygon, 4326) NOT NULL,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_regions_geometry ON regions USING GIST (geometry);

-- ----- RISK ZONES -----
-- Sub-areas within a region where risk is assessed (e.g., "Gangtok Corridor").
CREATE TABLE risk_zones (
  id            VARCHAR(50)  PRIMARY KEY,
  region_id     VARCHAR(50)  NOT NULL REFERENCES regions(id),
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  geometry      geometry(Polygon, 4326) NOT NULL,
  base_slope    REAL,           -- average slope in degrees (derived from DEM)
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_risk_zones_region   ON risk_zones(region_id);
CREATE INDEX idx_risk_zones_geometry ON risk_zones USING GIST (geometry);

-- ----- LANDSLIDE EVENTS -----
-- Historical landslide occurrences.
-- source: "nasa_glc", "gsi", "synthetic_seed", etc.
CREATE TABLE landslide_events (
  id          VARCHAR(50)  PRIMARY KEY,
  date        DATE         NOT NULL,
  latitude    REAL         NOT NULL,
  longitude   REAL         NOT NULL,
  geometry    geometry(Point, 4326) NOT NULL,
  trigger     VARCHAR(100),         -- e.g., "rain", "earthquake"
  category    VARCHAR(100),         -- e.g., "landslide", "debris_flow"
  fatalities  INTEGER,
  description TEXT,
  source      VARCHAR(100) NOT NULL, -- data provenance
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_events_date     ON landslide_events(date);
CREATE INDEX idx_events_source   ON landslide_events(source);
CREATE INDEX idx_events_geometry ON landslide_events USING GIST (geometry);

-- ----- ENVIRONMENTAL OBSERVATIONS -----
-- Per-zone environmental snapshot at a point in time.
-- source: "chirps", "synthetic_seed", "derived_moisture_proxy", etc.
CREATE TABLE environmental_observations (
  id            SERIAL       PRIMARY KEY,
  zone_id       VARCHAR(50)  NOT NULL REFERENCES risk_zones(id),
  timestamp     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  rainfall_24h  REAL,          -- mm in last 24 hours
  rainfall_3d   REAL,          -- mm in last 3 days
  rainfall_7d   REAL,          -- mm in last 7 days
  soil_moisture REAL,          -- 0.0 to 1.0 normalized
  slope         REAL,          -- degrees
  source        VARCHAR(100) NOT NULL,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_env_zone      ON environmental_observations(zone_id);
CREATE INDEX idx_env_timestamp ON environmental_observations(timestamp DESC);

-- ----- ALERTS -----
-- Generated alerts for risk zones.
CREATE TABLE alerts (
  id            SERIAL       PRIMARY KEY,
  zone_id       VARCHAR(50)  NOT NULL REFERENCES risk_zones(id),
  severity      VARCHAR(20)  NOT NULL CHECK (severity IN ('LOW','MODERATE','HIGH','SEVERE')),
  risk_score    REAL         NOT NULL,
  message       TEXT         NOT NULL,
  evidence_json JSONB,
  status        VARCHAR(20)  NOT NULL DEFAULT 'active' CHECK (status IN ('active','acknowledged','resolved')),
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_alerts_zone   ON alerts(zone_id);
CREATE INDEX idx_alerts_status ON alerts(status);
