# API Contracts

All endpoints are served by the Node/Express backend. The browser never communicates with FastAPI or PostgreSQL directly.

## Base URL

Development: `http://localhost:3001/api`

## Standard Error Response

All endpoints return errors in this shape:

```json
{
  "error": {
    "message": "Human-readable description",
    "code": "OPTIONAL_ERROR_CODE",
    "details": "Stack trace (development only)"
  }
}
```

---

## P0-A Endpoints

### GET /api/health

Health check — always available.

**Response 200:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "database": "connected",
  "postgis": "3.4 USE_GEOS=1 ..."
}
```

**Response 503:**
```json
{
  "status": "degraded",
  "timestamp": "...",
  "database": "disconnected",
  "postgis": "unknown"
}
```

### GET /api/regions

List all monitored regions.

**Response 200:**
```json
[
  {
    "id": "sikkim",
    "name": "Sikkim",
    "state": "Sikkim",
    "bounds": [88.0, 27.0, 89.0, 28.2]
  }
]
```

### GET /api/risk-zones

List all risk zones with current risk levels.

**Query parameters:**
- `region_id` (optional) — filter by region

**Response 200:**
```json
[
  {
    "id": "z1",
    "region_id": "sikkim",
    "name": "Gangtok Corridor",
    "risk_score": 0.72,
    "risk_level": "HIGH",
    "geometry": { "type": "Polygon", "coordinates": [...] },
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
]
```

### GET /api/risk-zones/:id

Single risk zone with full detail.

**Response 200:** Same shape as above, single object.

### GET /api/events

Historical landslide events.

**Query parameters:**
- `region_id` (optional)
- `zone_id` (optional)

**Response 200:**
```json
[
  {
    "id": "e1",
    "date": "2023-10-04",
    "latitude": 27.33,
    "longitude": 88.62,
    "trigger": "rain",
    "category": "landslide",
    "source": "nasa_glc"
  }
]
```

### GET /api/environment/:zoneId

Current environmental observations for a zone.

**Response 200:**
```json
{
  "zone_id": "z1",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "rainfall_24h": 85.0,
  "rainfall_3d": 180.0,
  "rainfall_7d": 320.0,
  "soil_moisture": 0.72,
  "slope": 32.0,
  "historical_density": 5,
  "source": "synthetic_seed"
}
```

### POST /api/risk/predict

Calculate risk for a zone using the current engine (deterministic or ML).

**Request:**
```json
{
  "zone_id": "z1",
  "rainfall_24h": 142,
  "rainfall_3d": 260,
  "soil_moisture": 0.87,
  "slope": 34,
  "historical_density": 7
}
```

**Response 200:**
```json
{
  "risk_score": 0.82,
  "risk_level": "SEVERE",
  "contributing_factors": [
    { "factor": "rainfall_24h", "normalized": 0.95, "weight": 0.30, "contribution": 0.285 },
    { "factor": "slope", "normalized": 0.68, "weight": 0.20, "contribution": 0.136 }
  ],
  "engine": "deterministic",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

### POST /api/risk/simulate

Simulate risk with modified parameters (e.g., changed rainfall from the slider).

**Request:** Same as /api/risk/predict

**Response 200:** Same as /api/risk/predict

---

## P0-B Endpoints (future)

### POST /api/alerts

Create an alert for a risk zone.

### GET /api/alerts

List alerts with optional filters.

### POST /api/copilot/ask

Ask the grounded AI Copilot a question.

**Request:**
```json
{
  "zone_id": "z1",
  "question": "Why is this zone high risk?"
}
```

**Response 200:**
```json
{
  "answer": "Gangtok Corridor is currently rated HIGH risk ...",
  "evidence": { ... },
  "source": "llm" | "deterministic"
}
```
