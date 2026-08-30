# SlopeGuard AI

**AI-Based Landslide Early Warning & Risk Monitoring System for the North Eastern Region of India**

SIH26001 — Prototype decision-support system for landslide risk assessment in Sikkim.

> **⚠️ Prototype disclaimer:** This is a decision-support prototype built for SIH 2026. It is NOT an operational emergency warning system and must NOT be used as one.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS, MapLibre GL JS, Recharts |
| Backend | Node.js, Express, TypeScript, Zod, pg |
| Database | PostgreSQL + PostGIS |
| ML (Sidecar) | Python, FastAPI, scikit-learn (optional architecture sidecar) |

## Architecture

```
React/Vite (client :5173)
    ↓ REST/JSON
Node/Express (server :3001)
    ↓ SQL
PostgreSQL/PostGIS (:5432)

Node/Express
    ↓ internal HTTP (when ML enabled)
FastAPI ML service (:8000)
```

The browser communicates **only** with the Node/Express backend.
FastAPI is an internal service for ML inference only — never browser-accessible.

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for PostgreSQL/PostGIS)

### Setup

```bash
# 1. Start the database
docker compose up -d

# 2. Configure environment
cp .env.example .env

# 3. Install dependencies
cd server && npm install
cd ../client && npm install

# 4. Run migrations and seed data
cd server && npm run migrate
cd server && npm run seed

# 5. Run tests (146 tests across backend & frontend)
cd server && npm test
cd ../client && npm test

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
- [ ] **Phase 5 (Next):** ML model surrogate sidecar & architecture demonstration

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
