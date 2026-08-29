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

Calculate current risk for a zone using stored baseline observations and spatial density.

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

What-if scenario simulation (e.g. dragging rainfall slider in UI). Overrides take precedence over stored baseline observation.

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

## P0-B Endpoints (Roadmap / Next Layer)

### POST /api/alerts
Create an alert for a risk zone.

### GET /api/alerts
List alerts with optional filters.

### POST /api/copilot/ask
Ask the grounded AI Copilot a question.
