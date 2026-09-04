# Talweg

**AI-Based Landslide Early Warning & Risk Intelligence System for the North Eastern Region of India**

SIH26001 — Prototype decision-support system for landslide risk assessment in Sikkim.

> **⚠️ Prototype disclaimer:** This is a decision-support prototype built for SIH 2026. It is NOT an operational emergency warning system and must NOT be used as one.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 6, TypeScript, Tailwind CSS v4, MapLibre GL JS, Recharts |
| Backend | Node.js 20, Express, TypeScript, Zod, pg |
| Database | PostgreSQL 16 + PostGIS 3.4 |
| ML (Sidecar) | Python 3.11/3.14, FastAPI, Scikit-Learn (Random Forest surrogate model) |

## Architecture

```
React/Vite (client :5173)
    ↓ REST/JSON
Node/Express (server :3001)
    ↓ SQL
PostgreSQL/PostGIS (:5432)

Node/Express
    ↓ internal HTTP (127.0.0.1:8000 only)
FastAPI ML surrogate service (:8000)
```

The browser communicates **only** with the Node/Express backend.
FastAPI is an internal service for ML inference only — never browser-accessible.
If the ML service is down or times out, Node/Express automatically and silently falls back to the in-process deterministic risk engine with zero downtime.

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for PostgreSQL/PostGIS and ML sidecar)
- Python 3.11+ (if running ML service locally outside Docker)

### Setup

```bash
# 1. Start the database (and optionally ML service)
docker compose up -d

# 2. Configure environment
cp .env.example .env

# 3. Install dependencies
cd server && npm install
cd ../client && npm install
cd ../ml-service && pip install -r requirements.txt

# 4. Run migrations and seed data
cd server && npm run migrate
cd server && npm run seed

# 5. Run tests (155 automated tests across all tiers)
cd server && npm test         # 115 tests
cd ../client && npm test      # 35 tests
cd ../ml-service && pytest    # 5 tests

# 6. Start the backend
cd server && npm run dev

# 7. Start the frontend (separate terminal)
cd client && npm run dev
```

Open http://localhost:5173 in your browser.

## Project Status

- [x] **Phase 0:** Project scaffolding & foundation
- [x] **Phase 1:** PostGIS schema + seed data + deterministic risk engine
- [x] **Phase 2:** REST API endpoints (P0-A)
- [x] **Phase 3:** React GIS dashboard & satellite map (P0-A)
- [x] **Phase 4:** Live rainfall scenario simulator & sequence guards (P0-A)
- [x] **P0-B.1:** Risk factor contribution breakdown & explainability
- [x] **P0-B.2:** Server-authoritative alert generation & active alert banner
- [x] **P0-B.3:** Grounded AI Copilot with zero-dependency deterministic fallback
- [x] **Phase 5:** Honestly-scoped ML surrogate sidecar & live failover seam
- [x] **Phase 6:** SIH competitive package (Response guidance, Zone comparison dashboard, PDF reports, 7-day risk sparkline, 5-day weather forecast, alert audit log, stakeholder escalation chain, data source dashboard, keyboard shortcuts, skeleton loaders)

## Documentation

- [API Contracts](docs/api_contracts.md) — Comprehensive REST specifications and response schemas
- [100-Second Demo Script](docs/demo_script.md) — Step-by-step presentation and recording script
- [Data Sources & Provenance](docs/data_sources.md) — NER region selection scorecard and provenance classification
- [Architecture](docs/architecture.md) — Monorepo system architecture and design principles

## Data Provenance

All data in this prototype is classified as:
- **REAL** — sourced from published datasets (NASA GLC, CHIRPS, SRTM)
- **DERIVED** — computed from real data (e.g., slope from DEM)
- **SYNTHETIC** — clearly labelled demo/seed data for development

## License

Internal project — SIH 2026.
