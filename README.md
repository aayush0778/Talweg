# SlopeGuard AI

**AI-Based Landslide Early Warning & Risk Monitoring System for the North Eastern Region of India**

SIH26001 — Prototype decision-support system for landslide risk assessment in Sikkim.

> **⚠️ Prototype disclaimer:** This is a decision-support prototype built for SIH 2026. It is NOT an operational emergency warning system and must NOT be used as one.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS, MapLibre GL JS, Recharts |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL + PostGIS |
| ML (future) | Python, FastAPI, scikit-learn |

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

# 4. Run migrations
cd server && npm run migrate

# 5. Start the backend
cd server && npm run dev

# 6. Start the frontend (separate terminal)
cd client && npm run dev
```

Open http://localhost:5173 in your browser.

## Project Status

- [x] Phase 0: Project scaffolding & foundation
- [ ] Phase 1: PostGIS schema + seed data + deterministic risk engine
- [ ] Phase 2: REST API endpoints (P0-A)
- [ ] Phase 3: GIS dashboard (P0-A)
- [ ] Phase 4: P0-A integration + rainfall simulator
- [ ] Phase 5: ML training + FastAPI service
- [ ] Phase 6: P0-B (explanations, alerts, Copilot)

## Data Provenance

See [docs/data_sources.md](docs/data_sources.md) for dataset documentation, provenance, and the NER region selection scorecard.

All data in this prototype is classified as:
- **REAL** — sourced from published datasets (NASA GLC, CHIRPS, SRTM)
- **DERIVED** — computed from real data (e.g., slope from DEM)
- **SYNTHETIC** — clearly labelled demo/seed data for development

## License

Internal project — SIH 2026.
