CREATE TABLE IF NOT EXISTS historical_event_evidence (
  id VARCHAR(80) PRIMARY KEY,
  event_id VARCHAR(50) REFERENCES landslide_events(id),
  media_type VARCHAR(50) NOT NULL,
  title TEXT,
  url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT,
  capture_date DATE,
  license_text TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_event_id ON historical_event_evidence(event_id);
