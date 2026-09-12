# TALWEG FINAL UPGRADE — IMPLEMENTATION REPORT

> Implementation of the **TALWEG FINAL UPGRADE SPECIFICATION** (SIH26001) as an
> additive, production-style upgrade. Audit-first per spec §3: see
> `docs/FINAL_UPGRADE_AUDIT.md` (written before any modification).
>
> All verification results in this report are from actual runs on 2026-09-11.

## 1. Scientific-integrity rules — compliance

| Rule | Status |
| --- | --- |
| Synthetic surrogate explicitly labeled | ✅ `/api/model`, Model page, model card, every prediction (`model_role`, `model_version`) |
| Risk index never called probability | ✅ `is_probability: false` on every path; UI shows `Risk Index xx/100` and states "not a probability" |
| No fabricated live-data claim | ✅ Source registry has no LIVE status; demo/fallback modes disclosed (`in_memory_fallback`, `demo_fallback_mode`) |
| Real replay separated from methodology-only | ✅ Existing classification preserved + surfaced as `REAL REPLAY / METHODOLOGY ONLY / SYNTHETIC SCENARIO` badges and `replay_classification` |
| Event absence ≠ proof of no landslide | ✅ `historical_density` remains a context feature only |
| Threshold source and units visible | ✅ `rainfall_threshold.evaluation.citation` + mm/mm-per-day units in API and UI tables |
| Soil provenance visible | ✅ Per-value provenance/quality in the feature record and Zones page |
| Frozen artifact + checksum preserved | ✅ No retraining; SHA-256 verified live (`9ac2a4eb…`) |
| No silent replacement of missing data | ✅ `null` = missing everywhere; feature record shows MISSING; timeline never reads future rainfall |
| Fallback transparency | ✅ `fallback_used` + `fallback_reason` on every risk response and in system health |

## 2. Files created

### Server (`server/src`)
| File | Purpose |
| --- | --- |
| `schemas/featureSchema.ts` | Canonical `FeatureValue`/`FeatureRecord` contract (spec §4.1) + completeness/alignment |
| `services/rainfallFeatures.ts` | Rolling windows 24h/3d/5d/7d, intensity, ARI (τ=3d), guarded anomaly |
| `services/rainfallThreshold.ts` | Canonical threshold engine: D=1/3/5/7, ratio bands, safety floor, citation |
| `services/dataQuality.ts` | Completeness, source quality, temporal/spatial alignment, composite score |
| `services/dataSources.ts` | Source registry with honest statuses (spec §26) |
| `services/zoneRiskInputs.ts` | Zone context resolution with per-feature provenance + offline fallback |
| `services/featureBuilder.ts` | Builds canonical FeatureRecord from all feature families (spec §4–§6) |
| `services/hybridComposer.ts` | Spec §16 composer: validate → quality → signals → model → rules → floor → explain |
| `services/simulation.ts` | Scenario presets, baseline/scenario/delta/driver, seeded sensitivity (spec §17) |
| `services/replayTimeline.ts` | T-7d→Event timeline with anti-leakage windows (spec §18) |
| `services/modelRegistry.ts` | Model provenance + governance for `/api/model` (spec §25) |
| `services/systemHealth.ts` | Honest component health (spec §27) |
| `routes/upgrade.ts` | All spec-conformant endpoints (below) |
| `db/seedUpgrade.ts` | Seeds data_sources, rainfall series, soil, terrain (labeled SYNTHETIC) |
| `finalUpgrade.test.ts` | 26 tests: windows, ARI, thresholds, schema, quality, composer, simulation, timeline, registry |

### Migrations & data
- `server/migrations/006_final_upgrade.sql` — `rainfall_observations`,
  `soil_observations`, `terrain_features`, `simulation_runs`, alert operational
  columns, risk_predictions extensions, data_sources extensions.

### ML service (`ml-service`)
| File | Purpose |
| --- | --- |
| `app/feature_schema.py` | Python mirror of the canonical feature contract |
| `training/empirical/__init__.py` | Empirical gate note (spec §37 Phase 7) |
| `training/empirical/build_dataset.py` | Event-centered windows (no future leak) + positive rows |
| `training/empirical/negative_sampling.py` | Documented negative strategies + leakage assertion |
| `training/empirical/splits.py` | Temporal / spatial-group / event-group leakage-safe splits |
| `training/empirical/benchmark.py` | LR/RF/ET/HGB benchmark, early-warning metrics, calibration check — **refuses to run without real data** |
| `training/empirical/README.md` | Promotion gate criteria |
| `test_final_upgrade.py` | 13 tests: schema, splits, negative leakage, windows, benchmark gate |

### Client (`client/src`)
| File | Purpose |
| --- | --- |
| `App.tsx` (rewritten) | Router shell with the 9-item command-dashboard navigation (spec §20.1) |
| `pages/MapWorkspacePage.tsx` | Original map workspace, preserved verbatim (was `App.tsx`) |
| `pages/OverviewPage.tsx` | KPI cards, zone risk board, active alerts, source status (§21) |
| `pages/ZonesPage.tsx` | Zone registry + explainable detail + feature-record provenance table (§23) |
| `pages/SimulationPage.tsx` | Presets, sliders, baseline-vs-scenario, threshold response table, sensitivity (§17) |
| `pages/ReplayPage.tsx` | Event registry, classification badges, risk-evolution timeline (§18) |
| `pages/AlertsPage.tsx` | Operational alert cards (trigger, ratio, evidence quality, action, expiry) (§19) |
| `pages/DataSourcesPage.tsx` | Source registry table (§26) |
| `pages/ModelPage.tsx` | Model card, mode, pipeline visual, governance, benchmark honesty (§25) |
| `pages/SystemHealthPage.tsx` | Component health grid (§27) |
| `components/page/PageShell.tsx` | Shared page primitives (KPI card, status pills, risk index) |

### Docs
`FINAL_UPGRADE_AUDIT.md` · `MODEL_CARD.md` · `DATA_DICTIONARY.md` ·
`DATA_PROVENANCE.md` · `EVALUATION_REPORT.md` · this report.

## 3. Files modified (minimal, additive)

| File | Change |
| --- | --- |
| `server/src/app.ts` | Register `upgradeRouter` |
| `server/src/routes/riskZones.ts` | Extracted `listRiskZonesService`/`getRiskZoneService` for the `/zones` aliases (no behavior change) |
| `server/src/routes/alerts.ts` | Surface operational columns; legacy-column fallback if migration 006 pending |
| `server/src/services/alertSync.ts` | Enhanced alert fields (code, trigger, ratio, quality, action, expiry) with graceful legacy fallback |
| `server/src/types/api.ts` | Alert operational fields |
| `server/src/db/query.ts` | In-memory fallback shim handles the enhanced alert INSERT (fixed status mapping bug this exposed) |
| `server/src/db/seed.ts` | Calls `seedFinalUpgrade` when upgrade tables exist |
| `server/src/validation/schemas.ts` | `predictBodySchema`, `simulateBodySchema`, `sensitivityBodySchema` |
| `client/src/types/api.ts` | Final-upgrade types; alert operational fields |
| `client/src/lib/apiClient.ts` | Fetchers for all new endpoints |

**Unchanged**: `riskEngine.ts` (frozen deterministic baseline), ML artifact +
training script, existing routes/responses (backward compatible), existing
tests (all pass).

## 4. APIs (new, all verified live)

| Endpoint | Verified result |
| --- | --- |
| `POST /api/predict` | Canonical §16 shape: risk_index 0.356/MODERATE, model_mode `hybrid_prototype`, ARI, data_quality, domain warnings |
| `POST /api/simulate` | baseline 0.356/MODERATE → scenario 0.58/HIGH; Δ +22 pts; threshold 0.708×→1.417×; triggered rules; largest driver `rainfall_3d` |
| `POST /api/simulate/sensitivity` | N=40, median/p10/p90, proportion ≥ HIGH, honest label |
| `GET /api/simulations/presets` | 9 presets |
| `GET /api/zones`, `GET /api/zones/:id` | Spec aliases of risk-zones |
| `GET /api/zones/:id/risk` | Canonical zone risk |
| `GET /api/zones/:id/features` | FeatureRecord v1.0.0 — per-value provenance; offline shows honest MISSING |
| `GET /api/data-sources` | 8-source registry, no LIVE claims |
| `GET /api/model` | Mode, version, `Probability: NO`, checksum verified, governance |
| `GET /api/system-health` | DB `in_memory_fallback` reported honestly when Postgres down; ML + artifact HEALTHY |
| `GET /api/historical-events` | 18-event registry with classifications |
| `GET /api/historical-events/:id/replay` | REAL REPLAY anchor + timeline MODERATE→WATCH→HIGH→SEVERE, threshold 0.43×→4.70× |

## 5. Model & data changes

- **Model**: none (frozen by design). Mode plumbing (`synthetic_surrogate` /
  `hybrid_prototype`) implemented; `empirical_model` reserved with a hard gate.
- **Data**: migration 006 + seeds add the daily-rainfall/soil/terrain feature
  families, all SYNTHETIC-labeled pending real ingestion (SoilGrids ingestion
  path documented as the target source).

## 6. Tests & verification (actual runs)

| Suite | Command | Result |
| --- | --- | --- |
| Server (node:test) | `npm test` (server/) | **190 tests: 184 pass, 0 fail, 6 skipped** (pre-existing DB-dependent skips) |
| ML service (pytest) | `pytest test_app.py test_final_upgrade.py` | **21 passed** |
| Client (vitest) | `npm test` (client/) | **49 passed** |
| TypeScript (server) | `tsc --noEmit` | clean |
| TypeScript + build (client) | `npm run build` | clean (pre-existing chunk-size warning only) |
| Artifact checksum | live `/api/model` | verified `9ac2a4eb…` |
| NaN/Infinity rejection | composer + ML schema tests | rejected with 400 / INVALID |
| Simulation changes outputs | live + tests | verified (Δ+22 pts, ratio 0.71×→1.42×) |
| Provenance reaches UI | browser DOM verification | feature-record table + source page + zone detail |
| ML-down fallback | `RISK_ENGINE_MODE` + timeout paths | deterministic engine takes over with explicit fallback metadata |
| UI rendering | browser DOM snapshots, all 9 routes | rendered with live data; map workspace intact at `/map` |

## 7. Known limitations

1. **No live feeds**: statuses are HISTORICAL/SYNTHETIC/UNAVAILABLE by design.
2. **Soil/terrain demo values**: SYNTHETIC until SoilGrids/DEM ingestion is wired.
3. **No PostgreSQL during verification**: DB-dependent tests were skipped
   (pre-existing); new tables verified via migration SQL + fallback shims.
   Run `npm run migrate && npm run seed` to materialize everything.
4. **Sensitivity bands are narrow** on the deterministic engine — expected:
   the surrogate floor dominates; labeled honestly as scenario sensitivity.
5. **Legacy 7-day threshold constant** in frozen `riskEngine.ts` (66.255 mm)
   differs from the full-precision value (66.376 mm) by ~0.2 mm; the frozen
   module was intentionally left untouched, and the canonical engine uses the
   precise formula.

## 8. Deployment steps (unchanged infra)

```bash
# 1. Database schema (adds 006)
cd server && npm run migrate
# 2. Seed core + final-upgrade tables
npm run seed
# 3. ML service
cd ../ml-service && uvicorn app.main:app --port 8000
# 4. API
cd ../server && RISK_ENGINE_MODE=ml npm run dev   # hybrid mode
# 5. UI
cd ../client && npm run dev
```

Docker/Railway configs are untouched and reproducible; no secrets committed
(`.env.example` documents all variables).

## 9. Remaining empirical-data work (spec §37 Phase 7)

1. Obtain/inventories real verified events with per-event environmental
   alignment (CHIRPS ingestion at scale + DEM + soil products).
2. Run `training/empirical/build_dataset.py` strategy for positives and the
   documented negative sampling; validate no-leakage assertions.
3. Benchmark with `training/empirical/benchmark.py` (event-group splits,
   recall/FNR-first), document in `docs/EVALUATION_REPORT.md`.
4. Demonstrate held-out calibration before enabling any probability display.
5. Promote only via an explicit, operator-driven `model_mode` switch.

## 10. Judge-facing demo flow (spec §36 — implemented)

1. Select a zone (Zones page) → 2. see real/derived/synthetic provenance per
value → 3. current risk + data quality → 4. "Why this level" explanation →
5. Simulation: increase rainfall → 6. watch threshold ratio rise → 7. risk
escalates with safety-floor enforcement → 8. Historical Replay timeline for
the 2023-10-04 Mangan anchor (REAL REPLAY) → 9. Model page provenance
(`Probability: NO`, checksum verified) → 10. System Health.

## 11. Post-delivery UI fixes (Live Risk Map + theme)

Verified in-browser after user feedback on the map workspace:

| Issue | Fix |
| --- | --- |
| Duplicate "Talweg" brand row on Live Risk Map (shell header + map header) | `Header` gained an `embedded` variant — hides the brand block and renders a slim `MAP WORKSPACE` status strip; the dashboard shell owns branding |
| Data Pipeline panel opened *behind* the zone sidebar with no way to dismiss | Root cause: the header is a flex item with `z-20` + `backdrop-blur` → its `z-50` dropdown was trapped in a lower stacking context than the sidebar painted later. Fix: the header rises to `z-[60]` only while the panel is open (state lifted via `DataSourcePanel#onOpenChange`), plus a `fixed inset-0` click-outside catcher closes the panel; panel is `max-w-[calc(100vw-2rem)]`. Verified: `elementFromPoint` at the panel center hits the panel; outside click closes it |
| Predictive-runout player docked full-width over the bottom (covered sidebar + map) | Player converted from a full-width `fixed bottom-0 left-0 right-0` dock into a floating rounded card anchored bottom-left, with `rightInset = sidebarWidth + 24` so it never covers the sidebar. Default height 320px (was 360–400), drag-resize capped at 440px / 60% viewport, compact bar 64px. Verified: player right edge (848px) meets the sidebar left edge (848px) with zero overlap |
| Dashboard looked grey instead of pitch black | Darkened the `ink` surface scale in `index.css` (`ink-950 #101417→#060708`, `ink-900 #171d20→#0c0e10`, `ink-850/800/750/700` stepped down). Applies consistently across the shell, all dashboard pages and the map workspace |

Files touched: `client/src/components/Header.tsx`, `DataSourcePanel.tsx`,
`HazardProgressionPlayer.tsx`, `pages/MapWorkspacePage.tsx`, `src/index.css`.
Re-verified after the fixes: client production build clean, 49/49 vitest pass.
