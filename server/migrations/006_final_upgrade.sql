-- ============================================================
-- 006_final_upgrade.sql
-- ============================================================
-- Final Upgrade (SIH26001) additive schema:
--   - rainfall_observations : timestamped daily rainfall series (rolling
--     windows / ARI are derived from this series, never fabricated)
--   - soil_observations     : soil/geotechnical feature family
--   - terrain_features      : DEM-derived terrain beyond slope
--   - simulation_runs       : scenario/sensitivity persistence
--   - alerts extensions     : operational alert fields (trigger, threshold
--     ratio, evidence quality, recommended action, expiry, alert code)
--   - risk_predictions ext. : model_mode, feature schema version
--   - data_sources ext.     : last ingest stamp + usage
-- All additions are idempotent (IF NOT EXISTS / IF NOT PRESENT).
-- ============================================================

-- ----- RAINFALL OBSERVATIONS (DAILY SERIES) -----
CREATE TABLE IF NOT EXISTS rainfall_observations (
  id          BIGSERIAL PRIMARY KEY,
  zone_id     VARCHAR(50) REFERENCES risk_zones(id),
  observed_at TIMESTAMPTZ NOT NULL,
  precip_mm   REAL NOT NULL CHECK (precip_mm >= 0),
  source_id   VARCHAR(50) NOT NULL,
  provenance  VARCHAR(20) NOT NULL DEFAULT 'SYNTHETIC'
              CHECK (provenance IN ('REAL','DERIVED','SYNTHETIC','UNKNOWN')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rainfall_obs_zone_time
  ON rainfall_observations(zone_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_rainfall_obs_source ON rainfall_observations(source_id);

-- ----- SOIL OBSERVATIONS (SOIL / GEOTECHNICAL FEATURE FAMILY) -----
CREATE TABLE IF NOT EXISTS soil_observations (
  id                       BIGSERIAL PRIMARY KEY,
  zone_id                  VARCHAR(50) REFERENCES risk_zones(id),
  observed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  soil_type                VARCHAR(100),
  soil_texture             VARCHAR(100),
  soil_depth_m             REAL,
  sand_fraction            REAL,
  silt_fraction            REAL,
  clay_fraction            REAL,
  bulk_density_g_cm3       REAL,
  hydraulic_conductivity_mm_h  REAL,
  available_water_capacity_mm   REAL,
  organic_carbon_percent   REAL,
  source_id                VARCHAR(50) NOT NULL,
  provenance               VARCHAR(20) NOT NULL DEFAULT 'SYNTHETIC'
              CHECK (provenance IN ('REAL','DERIVED','SYNTHETIC','UNKNOWN')),
  quality_status           VARCHAR(20) NOT NULL DEFAULT 'PARTIAL'
              CHECK (quality_status IN ('VALID','PARTIAL','MISSING','INVALID')),
  notes                    TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_soil_obs_zone ON soil_observations(zone_id, observed_at DESC);

-- ----- TERRAIN FEATURES (DEM-DERIVED, BEYOND SLOPE) -----
CREATE TABLE IF NOT EXISTS terrain_features (
  id                    BIGSERIAL PRIMARY KEY,
  zone_id               VARCHAR(50) REFERENCES risk_zones(id),
  observed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  elevation_m           REAL,
  slope_deg             REAL,
  aspect_deg            REAL,
  curvature             REAL,
  terrain_ruggedness    REAL,
  relative_relief_m     REAL,
  drainage_proximity_m  REAL,
  road_cut_proximity_m  REAL,
  source_id             VARCHAR(50) NOT NULL,
  provenance            VARCHAR(20) NOT NULL DEFAULT 'DERIVED'
              CHECK (provenance IN ('REAL','DERIVED','SYNTHETIC','UNKNOWN')),
  dem_reference         VARCHAR(100),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_terrain_zone ON terrain_features(zone_id, observed_at DESC);

-- ----- SIMULATION RUNS (SCENARIO PERSISTENCE) -----
CREATE TABLE IF NOT EXISTS simulation_runs (
  id                BIGSERIAL PRIMARY KEY,
  scenario_id       VARCHAR(80) NOT NULL,
  zone_id           VARCHAR(50) REFERENCES risk_zones(id),
  executed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mode              VARCHAR(30) NOT NULL DEFAULT 'scenario'
                    CHECK (mode IN ('scenario','sensitivity')),
  preset            VARCHAR(50),
  base_inputs       JSONB NOT NULL,
  override_inputs   JSONB NOT NULL,
  baseline_result   JSONB NOT NULL,
  scenario_result   JSONB NOT NULL,
  delta             REAL,
  model_mode        VARCHAR(30),
  threshold_ratio   REAL,
  session_ref       VARCHAR(80)
);
CREATE INDEX IF NOT EXISTS idx_sim_runs_zone_time ON simulation_runs(zone_id, executed_at DESC);

-- ----- ALERTS: OPERATIONAL FIELDS -----
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS alert_code      VARCHAR(60),
  ADD COLUMN IF NOT EXISTS trigger_summary TEXT,
  ADD COLUMN IF NOT EXISTS threshold_ratio REAL,
  ADD COLUMN IF NOT EXISTS evidence_quality REAL,
  ADD COLUMN IF NOT EXISTS recommended_action TEXT,
  ADD COLUMN IF NOT EXISTS expires_at      TIMESTAMPTZ;

-- ----- RISK PREDICTIONS: MODEL MODE + SCHEMA VERSION -----
ALTER TABLE risk_predictions
  ADD COLUMN IF NOT EXISTS model_mode            VARCHAR(30),
  ADD COLUMN IF NOT EXISTS feature_schema_version VARCHAR(20),
  ADD COLUMN IF NOT EXISTS threshold_duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS deterministic_rules   JSONB;

-- ----- DATA SOURCES: INGEST STAMP + USAGE -----
ALTER TABLE data_sources
  ADD COLUMN IF NOT EXISTS last_ingest_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS usage_note     TEXT,
  ADD COLUMN IF NOT EXISTS coverage       TEXT;
