# TALWEG — FINAL UPGRADE AUDIT

> Machine-readable audit of the repository **before modification**, as required by
> Section 3 of the TALWEG Final Upgrade Specification.
> Audit date: 2026-09-11. Base: working prototype (pre-final-upgrade).

## 1. Repository Layout

```
Talweg-master/
├── client/          React 19 + Vite + MapLibre GL + Tailwind 4 (SPA, map-first)
├── server/          Express + pg + zod (Node API, node:test)
├── ml-service/      FastAPI + scikit-learn ExtraTrees surrogate (pytest)
├── scripts/         data import helpers (CHIRPS, NASA GLC), deploy smoke test
├── seeds/           SQL seeds + CHIRPS raw responses
├── migrations/      001–005 Postgres/PostGIS migrations
├── docs/            existing docs (api_contracts, data_sources, demo guides)
├── docker-compose.yml, railway.json, Dockerfiles (client, server, ml-service)
```

## 2. Frontend (client/)

- **Entry point**: `src/main.tsx` → renders `App` (`src/App.tsx`). No router is mounted;
  the app is a single full-screen map workspace (`react-router-dom@7` is a dependency but unused).
- **Route structure**: none (single view). Navigation is selection-driven (zones, modals, shortcuts 1–6, Esc/T/F/D/R/?).
- **Component hierarchy**:
  - `App` → `Header` (system status), `ShortcutOverlay`, `AlertBanner` (top-floating active alerts),
    `MapView` (MapLibre GL, 2D/3D terrain, hazard progression overlay), `ZonePanel`
    (zone list → `ZoneDetail` + `ScenarioSimulator` + `FactorBreakdown` + `WeatherForecast`
    + `HistoricalEvidencePanel`/`HistoricalTimeline` + `HistoricalReplayModal` + `ZoneComparison`
    + `ResponseGuidance` + `NotificationChain` + `DataSourcePanel` + `ProvenanceBadge`
    + `RiskTrend` + `RiskBadge` + `MapLegend`), `HazardProgressionPlayer` (3D replay player),
    `ConceptualMotionModal`, `MapErrorBoundary`, `Skeleton`, `StatusMessage`.
- **Map implementation**: `components/MapView.tsx` — MapLibre GL with terrain (DEM raster),
  zone polygons colored by `riskColors.ts`, event markers, hazard corridor layers.
- **API client**: `lib/apiClient.ts` — typed fetch wrapper (`apiGet`/`apiPost` + `ApiClientError`),
  X-API-Key header support, VITE_API_URL base.
- **State/hooks**: `useApiResource`, `useHealth` (20s), `useAlerts` (20s), `useScenario`
  (debounced what-if simulation against `/api/risk/simulate`), `useSidebarResize`.
- **Client tests**: vitest — `apiClient`, `factors`, `forecastGenerator`, `format`, `geo`,
  `reportGenerator`, `responseGuidance`, `riskColors`, `scenario`, `stakeholders` (all `lib/` unit tests).

## 3. Server (server/)

- **Routes registered in `src/app.ts`** (all under `/api`):
  - `GET /health` — DB connectivity + PostGIS version (falls back to in-memory catalog when DB offline).
  - `GET /regions`, `GET /risk-zones`, `GET /risk-zones/:id`, `GET /risk-zones/:id/hazard-progression`.
  - `GET /events` (filter region/zone, limit).
  - `GET /environment/:zoneId` — latest observation + REAL/SYNTHETIC provenance.
  - `POST /risk/predict`, `POST /risk/simulate` — both via `computeZoneRisk` → `evaluateRisk`.
  - `GET/POST /alerts` — active alert list / manual insert.
  - `POST /copilot/ask` — LLM or deterministic fallback explainer.
  - `GET /model-validation`, `GET /model-validation/summary` — backtest + honest validation summary.
  - `GET /historical-replays`, `GET /historical-replays/:id`, `GET /historical-replays/:id/replay`,
    `GET /historical-replays/:id/hazard-progression`.
  - `GET /forecast/:zoneId` — IMD/NCMRWF forecast with synthetic fallback.
- **Risk engine** (`services/riskEngine.ts`): deterministic weighted heuristic
  (0.30 rainfall_24h + 0.20 rainfall_3d + 0.20 slope + 0.15 soil_moisture + 0.15 historical_density),
  normalization maxes (200/500/60°/1.0/10), levels LOW<0.30≤MODERATE<0.56≤HIGH<0.80≤SEVERE.
  Includes `calculateThresholdSignal` (Sikkim I=43.26·D^−0.78; D=1,3,7), `calculateARI` (τ=3d),
  `composeHybridRisk` (safety floor: ratio≥1.3→≥HIGH, ≥2.0→≥SEVERE; never suppressed by ML).
- **Risk evaluator** (`services/riskEvaluator.ts`): mode `deterministic|ml` (env `RISK_ENGINE_MODE`,
  default deterministic); ML path composes hybrid and enforces safety floor; ML failure → transparent
  deterministic fallback with `fallback_used`/`fallback_reason`.
- **ML client** (`services/mlClient.ts`): AbortController timeout (default 1000 ms), strict shape validation.
- **Historical replay** (`services/historicalReplay.ts`): classification
  `real_replay | methodology_only | synthetic_demo`, per-input provenance wrapping, deterministic-engine
  replay evaluation, honest validation summary (methodology_only unless ≥20 verified real replays).
- **Backtest** (`services/backtestScenarios.ts`, `services/modelValidation.ts`): 17-event prototype
  benchmark (synthetic replay of historical triggers — labeled methodology, not accuracy).
- **Alert sync** (`services/alertSync.ts`): server-authoritative 4-rule state machine
  (insert/update/escalate/resolve) on every prediction; never fatal.
- **DB layer** (`db/query.ts` + `db/fallbackData.ts`): pool query with in-memory fallback for
  regions/zones/events/observations/alerts when Postgres is unreachable (demo reliability layer).
  `db/migrate.ts` runs `migrations/*.sql`; `db/seed.ts` runs `seeds/seed.sql` + GLC seed (idempotent).
- **Validation**: zod schemas (`validation/schemas.ts`) for bodies/params/queries.
- **Server tests**: node:test — riskEngine (442 lines), riskEvaluator, riskInput, alerts (route+sync),
  risk route, riskZones, regions, events, copilot (route+engine+service), hazardProgression,
  historicalReplay, modelValidation, weatherForecast, db (query+db), validation schemas.

## 4. ML Service (ml-service/)

- **Endpoints** (`app/main.py`): `GET /health` (model loaded, artifact SHA-256, feature domains,
  `is_probability:false`, role `synthetic_function_approximation`), `POST /predict` (5 core features;
  out-of-domain clamping with explicit `uncertainty.clamped_features` + `domain_warning`).
- **Model artifact**: `models/surrogate_model.joblib` (ExtraTreesRegressor frozen surrogate) +
  `surrogate_model.joblib.sha256` checksum sidecar. Version `synthetic-surrogate-0.1.0`,
  training data `synthetic-grid-uniform-seed42-v1`.
- **Schemas** (`app/schemas.py`): pydantic v2, finite-value validation (NaN/Inf rejected),
  `extra="forbid"`, optional rainfall_5d/7d, provenance/options passthrough.
- **Constants** (`app/constants.py`): exact 1:1 parity with server riskEngine weights/maxes/thresholds.
- **Training** (`training/train.py`): synthetic grid from deterministic prototype function → ExtraTrees fit →
  joblib bundle + SHA-256 sidecar.
- **Tests** (`test_app.py`): pytest + httpx (health, predict, finite validation, fallback classification).

## 5. Database Migrations (existing)

- `001_enable_postgis.sql` — PostGIS extension.
- `002_create_core_tables.sql` — regions, risk_zones (geometry), landslide_events,
  environmental_observations, alerts.
- `003_create_historical_replays.sql` — historical_event_replays.
- `004_create_event_evidence.sql` — historical_event_evidence.
- `005_data_sources_and_predictions.sql` — data_sources registry, feature_observations (time-series),
  risk_predictions audit trail, replay precision/eligibility columns.

## 6. Feature Schemas (current)

- Inference input: 5 core numeric features (`rainfall_24h`, `rainfall_3d`, `soil_moisture`, `slope`,
  `historical_density`) + optional `rainfall_5d/7d`. **No canonical per-value provenance/quality
  contract exists yet** (provenance is per-response, not per-feature).
- `feature_observations` table exists but has no API endpoint and no ingest path in code.

## 7. Fallback / Simulation / Replay Inventory

- **Fallback engine**: deterministic risk engine (in-process) — always available, transparent metadata.
- **Simulation**: `/api/risk/simulate` = `/predict` with overrides (rainfall_24h/3d, soil_moisture from
  client sliders). No baseline-vs-scenario delta object, no scenario presets, no sensitivity mode,
  no persistence.
- **Historical replay**: list/detail/replay/hazard-progression implemented with honest classification;
  **no explicit T-7d→Event timeline** with per-step ARI/threshold/score/alert state.

## 8. Tests Inventory

- server: `node --test` (ts-node register) — 20 test files listed in §3.
- client: `vitest run` — 10 lib test files.
- ml-service: `pytest` — 1 test module.

## 9. Deployment Configuration

- `docker-compose.yml`: postgres (postgis/postgis), server, ml-service, client (nginx).
- `railway.json`: monorepo deploy (server + ml-service), env-driven config.
- Env vars: `DATABASE_URL`, `ML_SERVICE_URL`, `ML_SERVICE_PORT`, `ML_TIMEOUT_MS`,
  `RISK_ENGINE_MODE` (deterministic|ml), `PORT`, `LLM_API_KEY`/`LLM_BASE_URL`/`LLM_MODEL`,
  `COPILOT_TIMEOUT_MS`, client `VITE_API_URL`/`VITE_API_KEY`. `.env.example` present, no secrets committed.
- Client nginx: SPA fallback (`try_files ... /index.html`) — BrowserRouter-safe.

## 10. Current Data Sources

- Seed: synthetic zones/observations (provenance `synthetic_seed`), NASA GLC Sikkim real events,
  CHIRPS raw responses for 6 zones + 2 events (real replay anchors), NOAA/IMD citations.
- `data_sources` table exists (registry) but is unseeded and unexposed via API.

## 11. Known Gaps vs Final Upgrade Spec (to be implemented additively)

1. `docs/FINAL_UPGRADE_AUDIT.md` (this file) — missing before now.
2. Canonical `FeatureValue`/`FeatureRecord` schema (per-value provenance, quality_status, alignment) — missing.
3. `GET /api/data-sources` registry endpoint — missing (table exists).
4. Data-quality service (completeness, source quality, temporal/spatial alignment) — heuristic only.
5. Threshold engine durations: D=5 missing (only 1/3/7); no threshold ratio bands surfaced.
6. ARI surfaced in API/UI as labeled "Antecedent Rainfall Index" — partial (computed, not exposed).
7. Rainfall rolling windows from timestamped observations (24h/3d/5d/7d) — not computed from a series.
8. `POST /api/predict` + `POST /api/simulate` canonical hybrid responses (spec §16/§28 shape) — missing.
9. Scenario presets, delta, triggered rules, largest-mover, Monte-Carlo sensitivity — missing.
10. Replay timeline (T-7d→Event per-step rainfall/ARI/ratio/score/alert state) — missing.
11. Alert payload operational fields (trigger, threshold ratio, evidence quality, recommended action,
    expiry, alert ID) — partial (evidence JSON only).
12. `GET /api/model`, `GET /api/system-health` — missing.
13. Soil/terrain feature families (tables + ingestion + API) — missing.
14. Empirical ML pipeline scaffolding (dataset builder, negative sampling, leakage-safe splits,
    benchmark harness) — missing.
15. UI: dashboard shell with main navigation (Overview / Map / Zones / Simulation / Replay / Alerts /
    Data & Sources / Model / System Health) — missing (map-first single view).
16. Model card, data dictionary, evaluation report, provenance doc — missing.

## 12. Constraints Honored During Upgrade

- The frozen surrogate artifact + checksum is preserved; no retraining.
- No functioning module is rewritten for aesthetics; all changes are additive and isolated.
- Synthetic/derived/real/unknown values remain distinguishable; nothing fabricated as REAL.
- The 17-event benchmark and R²>0.998 remain labeled as synthetic-approximation results only.
