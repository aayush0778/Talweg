# API Contracts

All endpoints are served by the Node/Express backend. The browser never communicates with FastAPI or PostgreSQL directly.

## Base URL

Development: `http://localhost:3001/api`

## Standard Error Response

All endpoints return errors in this consistent envelope:

```json
{
  "error": {
    "message": "Human-readable description",
    "code": "VALIDATION_ERROR",
    "details": "Formatted details (development only)"
  }
}
```

### Error Codes

| Error Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid payload, query parameters, path variables, or malformed JSON |
| `ZONE_NOT_FOUND` | 404 | Specified risk zone ID does not exist |
| `ENVIRONMENT_NOT_FOUND` | 404 | No environmental observation available for the zone, and incomplete overrides supplied |
| `DATABASE_ERROR` | 503 | PostgreSQL/PostGIS connection failure, pool exhaustion, or query timeout |
| `INTERNAL_ERROR` | 500 | Unhandled server error |

---

## P0-A Endpoints

### GET /api/health

Health check — returns server status and database connectivity.

**Response 200:**
```json
{
  "status": "ok",
  "timestamp": "2026-08-29T07:03:53.394Z",
  "database": "connected",
  "postgis": "3.4 USE_GEOS=1 USE_PROJ=1 USE_STATS=1"
}
```

**Response 503:**
```json
{
  "status": "degraded",
  "timestamp": "2026-08-29T07:03:53.394Z",
  "database": "disconnected",
  "postgis": "unknown"
}
```

---

### GET /api/regions

List all monitored regions with their GeoJSON boundary and bounding box.

**Response 200:**
```json
[
  {
    "id": "sikkim",
    "name": "Sikkim",
    "state": "Sikkim",
    "bounds": [88.0, 27.08, 88.92, 28.13],
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[88.0, 27.08], [88.92, 27.08], [88.92, 28.13], [88.0, 28.13], [88.0, 27.08]]]
    }
  }
]
```

---

### GET /api/risk-zones

List all risk zones with current calculated risk score, risk level, centroid, and geometry.

**Query parameters:**
- `region_id` (optional, string) — filter by region (e.g. `sikkim`)

**Response 200:**
```json
[
  {
    "id": "gangtok",
    "region_id": "sikkim",
    "name": "Gangtok Corridor",
    "description": "State capital and NH10 highway corridor. Steep terrain with dense habitation and significant historical landslide activity.",
    "base_slope": 35.0,
    "centroid": {
      "latitude": 27.34,
      "longitude": 88.615
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[88.58, 27.3], [88.65, 27.3], [88.65, 27.38], [88.58, 27.38], [88.58, 27.3]]]
    },
    "risk_score": 0.508,
    "risk_level": "MODERATE",
    "timestamp": "2026-08-01T06:00:00.000Z",
    "data_source": "synthetic_seed"
  }
]
```

---

### GET /api/risk-zones/:id

Single risk zone with full detail and current assessment.

**Path parameter:**
- `id` (required, string) — risk zone ID (e.g. `gangtok`)

**Response 200:** Same single-object shape as `GET /api/risk-zones`.

**Response 404:**
```json
{
  "error": {
    "message": "Risk zone 'unknown-zone' not found",
    "code": "ZONE_NOT_FOUND"
  }
}
```

---

### GET /api/events

Historical landslide events with spatial points and data provenance.

**Query parameters:**
- `region_id` (optional, string)
- `zone_id` (optional, string)
- `limit` (optional, integer 1–500, default: 200)

**Response 200:**
```json
[
  {
    "id": "evt-001",
    "date": "2023-10-04",
    "latitude": 27.33,
    "longitude": 88.61,
    "trigger": "rain",
    "category": "landslide",
    "fatalities": 2,
    "description": "Monsoon-triggered debris flow along NH10 near Gangtok",
    "source": "synthetic_seed",
    "geometry": {
      "type": "Point",
      "coordinates": [88.61, 27.33]
    }
  }
]
```

---

### GET /api/environment/:zoneId

Latest environmental observation/telemetry for a specified risk zone.

**Path parameter:**
- `zoneId` (required, string) — risk zone ID

**Response 200:**
```json
{
  "zone_id": "gangtok",
  "zone_name": "Gangtok Corridor",
  "timestamp": "2026-08-01T06:00:00.000Z",
  "rainfall_24h": 85.0,
  "rainfall_3d": 180.0,
  "rainfall_7d": 320.0,
  "soil_moisture": 0.78,
  "slope": 35.0,
  "source": "synthetic_seed"
}
```

---

### POST /api/risk/predict

Calculate current risk for a zone using stored baseline observations and spatial density. Also triggers server-authoritative alert synchronization.

**Request:**
```json
{
  "zone_id": "gangtok"
}
```

**Response 200:**
```json
{
  "zone_id": "gangtok",
  "zone_name": "Gangtok Corridor",
  "risk_score": 0.508,
  "risk_level": "MODERATE",
  "contributing_factors": [
    { "factor": "rainfall_24h", "raw": 85.0, "normalized": 0.425, "weight": 0.3, "contribution": 0.128 },
    { "factor": "soil_moisture", "raw": 0.78, "normalized": 0.78, "weight": 0.15, "contribution": 0.117 },
    { "factor": "slope", "raw": 35.0, "normalized": 0.583, "weight": 0.2, "contribution": 0.117 },
    { "factor": "historical_density", "raw": 5, "normalized": 0.5, "weight": 0.15, "contribution": 0.075 },
    { "factor": "rainfall_3d", "raw": 180.0, "normalized": 0.36, "weight": 0.2, "contribution": 0.072 }
  ],
  "engine": "deterministic",
  "timestamp": "2026-08-29T08:10:00.000Z",
  "inputs_used": {
    "rainfall_24h": 85.0,
    "rainfall_3d": 180.0,
    "soil_moisture": 0.78,
    "slope": 35.0,
    "historical_density": 5
  },
  "data_source": "synthetic_seed"
}
```

---

### POST /api/risk/simulate

What-if scenario simulation (e.g. dragging rainfall slider in UI). Overrides take precedence over stored baseline observation. Automatically manages active alert status when thresholds are crossed.

**Request:**
```json
{
  "zone_id": "gangtok",
  "rainfall_24h": 150.0
}
```

**Response 200:**
```json
{
  "zone_id": "gangtok",
  "zone_name": "Gangtok Corridor",
  "risk_score": 0.606,
  "risk_level": "HIGH",
  "contributing_factors": [
    { "factor": "rainfall_24h", "raw": 150.0, "normalized": 0.75, "weight": 0.3, "contribution": 0.225 },
    { "factor": "soil_moisture", "raw": 0.78, "normalized": 0.78, "weight": 0.15, "contribution": 0.117 },
    { "factor": "slope", "raw": 35.0, "normalized": 0.583, "weight": 0.2, "contribution": 0.117 },
    { "factor": "historical_density", "raw": 5, "normalized": 0.5, "weight": 0.15, "contribution": 0.075 },
    { "factor": "rainfall_3d", "raw": 180.0, "normalized": 0.36, "weight": 0.2, "contribution": 0.072 }
  ],
  "engine": "deterministic",
  "timestamp": "2026-08-29T08:10:00.000Z",
  "inputs_used": {
    "rainfall_24h": 150.0,
    "rainfall_3d": 180.0,
    "soil_moisture": 0.78,
    "slope": 35.0,
    "historical_density": 5
  },
  "data_source": "synthetic_seed"
}
```

---

## P0-B Endpoints

### GET /api/alerts

List active, acknowledged, or resolved alerts.

**Query parameters:**
- `status` (optional, enum: `active` | `acknowledged` | `resolved` | `all`, default: `active`)
- `zone_id` (optional, string) — filter by zone ID

**Response 200:**
```json
[
  {
    "id": 1,
    "zone_id": "gangtok",
    "zone_name": "Gangtok Corridor",
    "severity": "HIGH",
    "risk_score": 0.606,
    "message": "Gangtok Corridor escalated to HIGH risk (61/100). Primary driver: 24h Rainfall.",
    "evidence": {
      "engine": "deterministic",
      "risk_level": "HIGH",
      "risk_score": 0.606,
      "data_source": "synthetic_seed",
      "inputs_used": {
        "rainfall_24h": 150,
        "rainfall_3d": 180,
        "soil_moisture": 0.78,
        "slope": 35,
        "historical_density": 5
      }
    },
    "status": "active",
    "created_at": "2026-08-29T12:00:00.000Z"
  }
]
```

---

### POST /api/alerts

Manually register an alert record for a corridor.

**Request:**
```json
{
  "zone_id": "gangtok",
  "severity": "HIGH",
  "risk_score": 0.65,
  "message": "Gangtok Corridor escalated to HIGH risk (65/100). Primary driver: 24h Rainfall.",
  "evidence": {
    "rainfall_24h": 150,
    "slope": 35
  }
}
```

**Response 201:** Full `AlertResponse` object.

---

### POST /api/copilot/ask

Ask the constrained AI Copilot for grounded corridor risk explanations or historical incident insights.

**Request:**
```json
{
  "zone_id": "gangtok",
  "question": "Why is Gangtok at moderate risk and what are the main drivers?"
}
```

**Response 200:**
```json
{
  "answer": "Gangtok Corridor is evaluated at MODERATE risk (51/100). The primary risk drivers are 24h Rainfall (25% share) and Soil Saturation (23% share). Current telemetry shows 24h rainfall at 85 mm, 3-day cumulative at 180 mm, and soil saturation at 78%. Note: current data is synthetic demo data (synthetic_seed).",
  "evidence": {
    "zone_id": "gangtok",
    "zone_name": "Gangtok Corridor",
    "risk_score": 0.508,
    "risk_level": "MODERATE",
    "top_factors": [
      { "factor": "rainfall_24h", "contribution": 0.128 },
      { "factor": "soil_moisture", "contribution": 0.117 },
      { "factor": "slope", "contribution": 0.117 }
    ],
    "recent_events": [
      {
        "date": "2023-10-04",
        "description": "Monsoon-triggered debris flow along NH10 near Gangtok"
      }
    ],
    "data_source": "synthetic_seed"
  },
  "source": "deterministic",
  "timestamp": "2026-08-29T12:00:00.000Z"
}
```

---

# Final Upgrade Endpoints (SIH26001 Final Upgrade)

All responses are additive to the existing contract. Canonical shape per
Final Upgrade Spec §16/§28. Every risk response includes `model_mode`,
`model_version`, `is_probability: false`, `feature_schema_version`,
`fallback_used`, `fallback_reason` and `data_quality`.

## POST /api/predict
Request: `{ "zone_id": "gangtok" }`
Response (abridged):
```json
{
  "zone_id": "gangtok",
  "zone_name": "Gangtok Corridor",
  "risk_index": 0.356,
  "risk_level": "MODERATE",
  "model_mode": "hybrid_prototype",
  "ml": { "score": 0.356, "model_version": "synthetic-surrogate-0.1.0", "is_probability": false, "used": true },
  "deterministic": { "score": 0.339, "contributing_factors": [ /* … */ ] },
  "rainfall_threshold": {
    "duration_days": 3, "observed_intensity": 13.0, "threshold": 55.088,
    "ratio": 0.708, "band": "below", "safety_level": "LOW",
    "evaluation": { "durations": [ /* D = 1, 3, 5, 7 */ ], "citation": "Regional Sikkim threshold: I = 43.26 × D^-0.78 (mm/day)", "rainfall_provenance": "SYNTHETIC" }
  },
  "antecedent_rainfall_index": 29.89,
  "data_quality": { "completeness": 0.8, "data_quality_score": 0.8, "source_quality": 0.8, "temporal_alignment": 1.0, "spatial_alignment": 1.0 },
  "uncertainty": { "domain_warning": false, "clamped_features": [], "message": null },
  "triggered_rules": [ { "rule": "rainfall_threshold", "status": "LOW", "detail": "3-day rainfall at 0.71× the regional threshold" } ],
  "feature_schema_version": "1.0.0"
}
```

## POST /api/simulate
Request: `{ "zone_id": "gangtok", "preset": "rainfall_plus_100", "overrides": { "rainfall_24h": 120 } }`
Presets: `baseline · rainfall_plus_25 · rainfall_plus_50 · rainfall_plus_100 ·
sustained_rainfall · high_antecedent · wet_soil · steep_slope · custom`.
Response: `{ baseline, scenario, delta: { risk_index, risk_level_from, risk_level_to, threshold_ratio_change }, largest_change_driver, threshold_ratio, model_mode, data_quality, label }`.

## POST /api/simulate/sensitivity
Request: `{ "zone_id": "gangtok", "n_runs": 40, "seed": 42 }`
Response: `{ median_risk_index, p10_risk_index, p90_risk_index, proportion_high_severe, perturbations, label: "Scenario sensitivity, not statistical prediction uncertainty." }`

## GET /api/zones, GET /api/zones/:id
Spec-conformant aliases of `/api/risk-zones` (+ `/api/zones/:id/risk`).

## GET /api/zones/:id/features
Canonical `FeatureRecord` (schema `1.0.0`): per-feature `FeatureValue` with
`value | null` (null = missing, never zero-filled), `unit`, `source_id`,
`provenance_type`, `quality_status`, windows and transformation.

## GET /api/data-sources
`{ sources: [ { id, name, type, provider, usage, last_update, update_frequency, spatial_resolution, temporal_resolution, coverage, status, provenance, license, citation } ] }`.
Statuses used: `HISTORICAL · DERIVED · SYNTHETIC · UNAVAILABLE` (never LIVE).

## GET /api/model
Model card + governance: `current_mode`, `ml_model` (version, role,
`is_probability: false`, training data), `artifact.checksum_verified`,
`pipeline`, `governance.fallback_policy / promotion_policy`.

## GET /api/system-health
`{ status, components: { node_api, database{mode}, ml_service, model_artifact, data_pipeline }, metrics: { last_successful_prediction_at, fallback_count_24h, predictions_24h } }`.
`database.mode = "in_memory_fallback"` is reported honestly when Postgres is down.

## GET /api/historical-events, GET /api/historical-events/:id/replay
Spec-conformant aliases of `/api/historical-replays` + replay response extended with:
```json
{
  "timeline": { "steps": [ { "phase": "T-7d", "daily_rainfall_mm": 18.5, "cumulative_rainfall_mm": 18.5, "antecedent_rainfall_index": 18.5, "threshold_ratio": 0.428, "final_risk_index": 0.34, "risk_level": "MODERATE", "alert_state": "NONE" } ], "reconstruction": "uniform_window_reconstruction", "methodology_note": "…" },
  "replay_classification": { "status": "real_replay", "label": "REAL REPLAY", "caveat": "…" }
}
```
