CREATE TABLE IF NOT EXISTS historical_event_replays (
  id VARCHAR(80) PRIMARY KEY,
  event_id VARCHAR(50) REFERENCES landslide_events(id),
  event_date DATE NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  zone_id VARCHAR(50) REFERENCES risk_zones(id),
  source VARCHAR(100) NOT NULL,
  rainfall_24h REAL,
  rainfall_3d REAL,
  rainfall_7d REAL,
  soil_moisture REAL,
  slope REAL,
  historical_density INTEGER,
  data_quality VARCHAR(40) NOT NULL,
  data_notes TEXT,
  actual_event BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historical_replays_event_date ON historical_event_replays(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_historical_replays_zone ON historical_event_replays(zone_id);
CREATE INDEX IF NOT EXISTS idx_historical_replays_source ON historical_event_replays(source);
