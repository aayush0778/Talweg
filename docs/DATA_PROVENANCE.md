# TALWEG Data Provenance (Final Upgrade Spec §5.3, §13, §26)

TALWEG's core honesty rule: **every environmental value is traceable to a
source, and synthetic, derived, real and unknown values remain
distinguishable end-to-end** — through the API, into the UI, and into
alerts and reports.

## 1. Provenance classes

| Class | Meaning | Examples in TALWEG |
| --- | --- | --- |
| `REAL` | From a verified published dataset or observation record | CHIRPS event rainfall, IMD gauge records, NASA GLC event points, SRTM-derived zone base slope |
| `DERIVED` | Computed by TALWEG from other values with a documented transformation | Rolling rainfall windows, ARI, threshold ratios, historical density counts |
| `SYNTHETIC` | Demonstration values — never presented as observations | Seed zone telemetry, demo daily rainfall series, demo soil/terrain values, scenario override inputs |
| `UNKNOWN` | Source not established | Values whose source record is missing (reported as UNKNOWN, never silently relabeled) |

## 2. Source registry (GET /api/data-sources)

| Source | Status | Provenance | Notes |
| --- | --- | --- | --- |
| CHIRPS Satellite Precipitation | HISTORICAL | REAL | Ingested per-event for replay anchors; ~6-week calibration latency → never claimed LIVE |
| IMD Station Rain Gauge Records | HISTORICAL | REAL | Cited for the 2023-10-04 Mangan anchor |
| NASA Global Landslide Catalog | HISTORICAL | REAL | Verified event inventory (Sikkim subset) |
| SRTM 30m DEM | HISTORICAL | REAL | Zone slope derivation |
| SoilGrids / ISRIC | UNAVAILABLE | REAL | Real product, **not yet ingested** — demo soil values are SYNTHETIC |
| Sentinel-2 NDVI | UNAVAILABLE | REAL | Vegetation/land-cover family reserved |
| In-zone demo telemetry (`seed-telemetry`) | SYNTHETIC | SYNTHETIC | Representative monsoon conditions for zones |
| Sikkim Regional Threshold | DERIVED | REAL | Published relationship `I = 43.26 × D^-0.78` |

**No source is ever labeled LIVE** — the prototype has no live feed connected.

## 3. Provenance flow through the system

```
data_sources registry  ──►  feature observations (per-value provenance)
        │                           │
        ▼                           ▼
  feature builder  ──►  FeatureRecord (FEATURE_SCHEMA_VERSION 1.0.0)
        │                           │
        ▼                           ▼
  hybrid composer  ──►  risk responses (data_quality, model_mode,
        │               rainfall_threshold.evaluation.rainfall_provenance)
        ▼
  UI pages (feature record table, zone detail, data & sources page)
```

- `GET /api/zones/:id/features` returns the per-value provenance table
  (source, provenance class, quality status, transformation, window).
- Zone detail (Zones page) shows each value's `REAL/DERIVED/SYNTHETIC/UNKNOWN`
  tag and `VALID/PARTIAL/MISSING/INVALID` quality status.
- Simulation responses tag overridden inputs as SYNTHETIC (the user invented
  them) while preserving the baseline's provenance.
- Replay records carry `REAL REPLAY` / `METHODOLOGY ONLY` / `SYNTHETIC
  SCENARIO` badges; the timeline states its reconstruction method explicitly.
- Historical-event absence is never treated as proof of no landslide:
  `historical_density` is a context feature, not a negative-evidence rule.

## 4. In-memory demo mode

When PostgreSQL is unreachable, the server serves a seeded in-memory catalog
(`server/src/db/fallbackData.ts`) so the demo never dies. This mode is
**disclosed, not hidden**: `GET /api/system-health` reports
`database.mode = 'in_memory_fallback'`, the zones page flags
`demo_fallback_mode`, and values keep their seed provenance labels.

## 5. Replay classification rules (spec §9, §18)

| Label | Criteria |
| --- | --- |
| REAL REPLAY | Verified event **and** environmental observations actually aligned to the event (CHIRPS/IMD-derived values) |
| METHODOLOGY ONLY | Verified event, insufficient environmental telemetry — trigger values are representative estimates and are labeled as such |
| SYNTHETIC SCENARIO | Controlled demonstration data (seeded trigger-day conditions) |
