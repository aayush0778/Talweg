-- ============================================================
-- 005_data_sources_and_predictions.sql
-- ============================================================
-- Data source registry, time-series feature observations,
-- and prediction audit trails with strict provenance.
-- ============================================================

-- ----- DATA SOURCES REGISTRY -----
CREATE TABLE IF NOT EXISTS data_sources (
  id                  VARCHAR(50) PRIMARY KEY,
  name                VARCHAR(100) NOT NULL,
  type                VARCHAR(50) NOT NULL, -- satellite_precipitation, dem_topography, in_situ_sensors, reanalysis, inventory
  provider            VARCHAR(100) NOT NULL,
  license             VARCHAR(100),
  update_frequency    VARCHAR(50),
  spatial_resolution  VARCHAR(50),
  temporal_resolution VARCHAR(50),
  latency             VARCHAR(50),
  status              VARCHAR(50) NOT NULL DEFAULT 'operational',
  citation            TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ----- FEATURE OBSERVATIONS (TIME-SERIES) -----
CREATE TABLE IF NOT EXISTS feature_observations (
  id                          BIGSERIAL PRIMARY KEY,
  zone_id                     VARCHAR(50) REFERENCES risk_zones(id),
  timestamp                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_id                   VARCHAR(50) REFERENCES data_sources(id),
  rainfall_24h                REAL,
  rainfall_3d                 REAL,
  rainfall_5d                 REAL,
  rainfall_7d                 REAL,
  rainfall_intensity          REAL,
  antecedent_rainfall_index   REAL,
  soil_moisture               REAL,
  slope                       REAL,
  historical_density          INTEGER,
  quality_score               REAL DEFAULT 1.0,
  provenance                  VARCHAR(50) NOT NULL DEFAULT 'SYNTHETIC',
  notes                       TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_obs_zone_time ON feature_observations(zone_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_feature_obs_source ON feature_observations(source_id);

-- ----- RISK PREDICTIONS AUDIT TRAIL -----
CREATE TABLE IF NOT EXISTS risk_predictions (
  id                          BIGSERIAL PRIMARY KEY,
  zone_id                     VARCHAR(50) REFERENCES risk_zones(id),
  evaluated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  engine                      VARCHAR(50) NOT NULL, -- deterministic, ml, hybrid
  model_version               VARCHAR(50),
  risk_score                  REAL NOT NULL,
  risk_level                  VARCHAR(20) NOT NULL,
  is_probability              BOOLEAN NOT NULL DEFAULT FALSE,
  fallback_used               BOOLEAN NOT NULL DEFAULT FALSE,
  fallback_reason             TEXT,
  data_quality_score          REAL NOT NULL DEFAULT 1.0,
  ml_score                    REAL,
  deterministic_score         REAL,
  ml_vs_deterministic_delta   REAL,
  threshold_exceeded          BOOLEAN DEFAULT FALSE,
  threshold_ratio             REAL,
  input_features              JSONB NOT NULL,
  contributing_factors        JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_risk_pred_zone_time ON risk_predictions(zone_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_pred_engine ON risk_predictions(engine);

-- ----- HISTORICAL REPLAYS AUDIT EXTENSION -----
ALTER TABLE historical_event_replays
  ADD COLUMN IF NOT EXISTS event_time_precision VARCHAR(50) DEFAULT 'day',
  ADD COLUMN IF NOT EXISTS location_precision_m REAL DEFAULT 1000.0,
  ADD COLUMN IF NOT EXISTS feature_completeness REAL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS eligibility_for_training BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ineligibility_reason TEXT,
  ADD COLUMN IF NOT EXISTS source_identifiers JSONB,
  ADD COLUMN IF NOT EXISTS environmental_observation_status VARCHAR(50) DEFAULT 'unverified';
