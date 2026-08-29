# SlopeGuard AI — Phase 4 Engineering Plan
## P0-A Integration & Live Rainfall Scenario Simulator

**Repository:** [https://github.com/aayush0778/SlopeGuard-AI](https://github.com/aayush0778/SlopeGuard-AI)  
**Base commit:** `ba58b28` (Phase 3 complete, code-verified)  
**Scope:** React client ONLY. Zero server changes. Zero new runtime dependencies.  
**Status of this phase:** Completes the final P0-A MUST-SHIP item (rainfall scenario simulator) and closes P0-A entirely.

> **PRECONDITION:** Phase 3 visual smoke checklist passes (6 colored polygons render over satellite imagery, zone labels at centroids, 15 event pins, polygon click → selection + flyTo + detail panel, event popup content correct, back → list, dev console clean).

---

## A. STARTING POINT & SCOPE

### A.1 What exists (verified at ba58b28)
- `POST /api/risk/simulate`: Implemented, tested, documented. Accepts optional overrides for `rainfall_24h`, `rainfall_3d`, `soil_moisture`, `slope`, `historical_density`; merges with stored observation; returns full `RiskPredictionResponse` including `contributing_factors`, `inputs_used`, `data_source`.
- Server test coverage: 90/90, including golden values: Gangtok baseline 0.508 MODERATE; Gangtok + `rainfall_24h:150` → 0.606 HIGH.
- Client dashboard: Full GIS map (6 zones, labels, 15 event pins, popups, selection, flyTo), zone list, zone detail with risk card + telemetry, health badge, DEMO DATA badge. 14/14 client tests.
- The Phase 4 seam: `ZonePanel`/`ZoneDetail` already accept `assessment?: { risk_score, risk_level, timestamp } | null`, with fallback to the zone baseline.
- Map data pipeline: `MapView` Effect 2 re-runs `setData(toZoneFeatureCollection(zones))` whenever the `zones` prop reference changes. This is the recoloring mechanism — no `MapView` changes required.

### A.2 Phase 4 deliverables
1. `ScenarioSimulator` UI — three sliders (24h rainfall, 3-day rainfall, soil saturation) with baseline reset.
2. Debounced live calls to `POST /api/risk/simulate` (server is the sole risk authority — no client-side formula, ever).
3. Live map recoloring of the selected zone as simulated risk changes.
4. Baseline → scenario transition display in the risk card.
5. `apiPost` support + `RiskPredictionResponse` client types + tests.
6. Final 90-second demo script and demo-hardening checklist.

### A.3 Explicitly out of scope
- Any server change (the simulate endpoint already does everything needed).
- Any change to `MapView.tsx` (the recolor flows through the existing `zones` prop pipeline).
- Recharts charts, alert generation, Copilot, ML, persistence of scenarios (simulation is transient UI state only — resets on reload by design).

---

## B. ARCHITECTURE & DESIGN DECISIONS

### B.1 Data flow
```
User drags slider (ScenarioSimulator, controlled component)
    ↓ setValues
useScenario hook (App-level)
    ↓ 400ms debounce + sequence guard (last-write-wins)
POST /api/risk/simulate { zone_id, rainfall_24h, rainfall_3d, soil_moisture }
    ↓ RiskPredictionResponse
App state: simulation
 ├→ displayZones = useMemo(applySimulationToZones(zones, selectedZoneId, simulation))
 │   └→ MapView zones prop → existing Effect 2 → setData → POLYGON RECOLORS
 ├→ ZonePanel/ZoneDetail assessment = simulation ?? selectedZone (existing seam)
 │   └→ risk card: score, level, bar, chip OBSERVED⇄SCENARIO, baseline line
 └→ (ZoneList deliberately keeps OBSERVED baseline values)
```

Scenario state lifecycle: transient and selection-scoped. Initialized from the zone's environmental observation when a zone is selected; cleared when the zone is deselected or switched; cleared when sliders return to exact baseline; never persisted, never written back to the server.

### B.2 Three sliders reachability

| Slider | Range | Step | Sent as |
|---|---|---|---|
| 24h rainfall | 0–200 mm (engine normalization max) | 5 | `rainfall_24h` (mm) |
| 3-day cumulative rainfall | 0–500 mm | 10 | `rainfall_3d` (mm) |
| Soil saturation | 0–100 % (display) | 5 | `soil_moisture` (0–1) |

Reachability with all three sliders:
| Zone | Baseline | All-sliders-max score | Max level |
|---|---|---|---|
| gangtok | 0.508 MODERATE | 0.842 | SEVERE |
| mangan | 0.560 MODERATE | 0.822 | SEVERE |
| soreng | 0.409 MODERATE | 0.787 | HIGH |
| pakyong | 0.381 MODERATE | 0.780 | HIGH |
| namchi | 0.303 MODERATE | 0.763 | HIGH |
| gyalshing | 0.329 MODERATE | 0.758 | HIGH |

---

## C. FILE PLAN

### Create:
- `client/src/lib/scenario.ts`
- `client/src/lib/scenario.test.ts`
- `client/src/hooks/useScenario.ts`
- `client/src/components/ScenarioSimulator.tsx`

### Modify:
- `client/src/types/api.ts`
- `client/src/lib/apiClient.ts`
- `client/src/lib/apiClient.test.ts`
- `client/src/components/ZoneDetail.tsx`
- `client/src/components/ZonePanel.tsx`
- `client/src/App.tsx`
- `README.md`

---

## D. GOLDEN VALUES
- `gangtok`, sliders at baseline (no call — baseline short-circuit): `0.508 MODERATE`
- `gangtok`, `rainfall_24h: 150` (others baseline): `0.606 HIGH`
- `gangtok`, `rainfall_24h: 200`, `rainfall_3d: 500` (soil `0.78`): `0.809 SEVERE`
- `gangtok`, all three maxed (`200 / 500 / 1.0`): `0.842 SEVERE`
- `mangan`, all three maxed (`200 / 500 / 1.0`): `0.822 SEVERE`
- `namchi`, all three maxed: `0.763 HIGH`
