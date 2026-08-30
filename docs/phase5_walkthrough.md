# Phase 5 Implementation & Verification Walkthrough
## Honestly-Scoped ML Surrogate Sidecar & Live Failover Seam

### 1. Architecture Overview

Phase 5 introduces the internal machine learning surrogate microservice and server failover seam:
- **FastAPI / Scikit-Learn Microservice (`ml-service/`):**
  - Trains a tree-ensemble surrogate model on 100,000+ domain-spanning parameter combinations ($R^2 > 0.998$, $\text{MAE} < 0.0047$).
  - Serves `GET /health` and `POST /predict` endpoints with strict input clamping to domain normalization bounds (`[0,200] / [0,500] / [0,1.0] / [0,60] / [0,10]`).
  - Generates reproducible model artifacts during container build (`RUN python training/train.py`) without committing binaries to Git.
  - Network isolation: Internal service accessible only to the Node/Express backend via loopback (`127.0.0.1:8000:8000`).
- **Resilient Fallback Seam (`server/src/services/riskEvaluator.ts`):**
  - Unified `evaluateRisk(input, opts?)` gateway routing all risk calculations with injectable options for testing.
  - Configurable `ML_TIMEOUT_MS` (default 1000ms) with `AbortController`.
  - In `ml` mode, if the microservice is unreachable, errors, or times out, the backend seamlessly logs a warning and falls back to the in-process deterministic risk engine with **zero downtime**.
  - `Promise.all` parallelization in `server/src/routes/riskZones.ts` ensures all zones evaluate concurrently within a single timeout window.
- **Client Engine Visibility (`client/src/components/ZoneDetail.tsx`):**
  - 2-state badge displaying `ML Surrogate (RF)` (emerald) or `Deterministic Heuristic` (slate).

---

### 2. Multi-Tier Verification Results

| Tier | Test Suite | Tests Passed | Status |
|---|---|---|---|
| **ML Microservice** | `ml-service/test_app.py` (pytest) | **5 / 5** | ✅ PASS |
| **Node Backend** | `server/src/**/*.test.ts` (node:test) | **115 / 115** | ✅ PASS |
| **React Client** | `client/src/**/*.test.ts` (vitest) | **35 / 35** | ✅ PASS |
| **Client Typecheck & Build** | `tsc -b && vite build` | **Clean build** | ✅ PASS |
| **Total Automated Tests** | Across all tiers | **155 / 155** | ✅ PASS |

---

### 3. Verification Protocol Summary

- **B1 (Docker Loopback):** `docker-compose.yml` binds `127.0.0.1:8000:8000` with Node-only internal access comment.
- **B2 (Directory Consolidation):** Single `ml-service/` directory, no `ml/` at root, clean README.
- **B3 (Clamping Parity):** Clamping in `/predict` strictly mirrors `NORMALIZATION_MAX`, decomposition is formula-derived and disclosed.
- **B4 (Build-time Training):** `Dockerfile` runs `python training/train.py`; zero `.joblib` binaries in Git.
- **Seam:** `evaluateRisk` signature with injectable `{ mode, mlPredict }`, `Promise.all` in `riskZones.ts`.
- **Quality Gates:** $R^2 = 0.99807 > 0.99$, $\text{MAE} = 0.00464 < 0.005$, Max Error $= 0.02959$.
