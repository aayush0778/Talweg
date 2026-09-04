# Talweg — 150-Second Demonstration Script

**SIH26001: AI-Based Landslide Early Warning & Risk Monitoring System for the North Eastern Region**

---

## Pre-Demo Setup Checklist

1. PostgreSQL + PostGIS container is up: `docker compose up -d`
2. Fresh database seed: `cd server && npm run seed`
3. ML surrogate service running: `cd ml-service && uvicorn app.main:app --port 8000`
4. Confirm `.env` has `RISK_ENGINE_MODE=ml` — the failover beat (1:20–1:40) only means
   something if the demo starts on the live ML engine, not the deterministic fallback.
5. Backend running: `cd server && npm run dev` (:3001)
6. Frontend running: `cd client && npm run dev` (:5173)
7. Open browser at `http://localhost:5173` in full screen.
8. **Record a backup video of a full clean run before presenting live.** Live kill-container
   demos are the single highest-risk moment in this script — have the recording ready to cut to.
9. Know the exact terminal/Docker Desktop control you'll use to stop the ML container
   for the 1:20–1:40 beat, and rehearse it — fumbling here costs more than skipping it.

---

## 150-Second Walkthrough Script

| Time | Action | What to Say / Point Out | What Renders on Screen |
|---|---|---|---|
| **0:00–0:15** | Open application | "Talweg is a unified GIS decision-support system monitoring high-risk landslide corridors across Sikkim, integrating rainfall, terrain, soil saturation, and historical mass-wasting events." | Full-screen MapLibre satellite basemap of Sikkim; 6 monitored zone polygons; 15 historical incident pins; header showing system connectivity and DEMO DATA provenance badge. |
| **0:15–0:35** | Click **Gangtok Corridor** polygon or list item | "Selecting Gangtok reveals the current risk index and a full **Risk Factor Breakdown** below it — it answers *why* the zone is at risk without black-box opacity. 24h Rainfall, Soil Saturation, and Slope each contribute a transparent, weighted share." | Detail drawer opens; camera `flyTo` centers on Gangtok; risk score card renders with an `OBSERVED` badge; 5 ranked contribution bars display with weight percentages. |
| **0:35–0:45** | Scroll down slightly to reveal **Response Guidance** | "This isn't just a monitoring dashboard — it's decision support. At the current risk tier, the system already surfaces the operational checklist: who to notify, what perimeter to hold, what action to take next." | Response Guidance card visible below the factor breakdown, showing tiered actions and stakeholder contacts for the current risk level. |
| **0:45–1:05** | Drag **24h Rainfall** slider to **150 mm** | "Operators can simulate severe weather scenarios live. As heavy monsoon rain is simulated, the risk engine recalculates in-process — Gangtok escalates, the breakdown re-ranks in real time, and the Response Guidance panel updates its recommended actions to match." | Slider drags smoothly with debounce; polygon recolors; risk card transitions with an amber `SCENARIO` chip; Response Guidance actions update to the new tier; Active Alert Banner slides in. |
| **1:05–1:20** | Max out all 3 sliders (200mm rain, 500mm 3d, 100% soil) | "Under multi-day extreme downpours, the corridor hits Severe risk. The alert banner escalates and supersedes the prior alert, and Response Guidance now shows evacuation-tier actions — NDRF activation, school closures, the full protocol." | Polygon turns red; score jumps to `SEVERE`; alert banner turns red; Response Guidance shows the SEVERE tier action list and contacts. |
| **1:20–1:40** | **Kill the ML service container live** (`docker stop <ml-service container>` or equivalent) | "This assessment has been running on our live ML surrogate model — watch what happens when it goes down." *(kill it)* "...the system seamlessly falls back to our deterministic safety engine. Same UI, same alert, zero interruption to the operator. This is the architectural guarantee that makes the system safe to deploy — it never goes dark." | Engine badge in ZoneDetail flips from `ML` to `Deterministic`; risk score and alert remain live and correct; no error state, no downtime. |
| **1:40–1:55** | Scroll down, expand **Ask Copilot**, ask *"Why is Gangtok at severe risk?"* | "Our constrained AI Copilot operates with deterministic grounding. Even with zero internet or API keys, it generates a concise, evidence-backed brief citing real telemetry and event history under our reliability-first offline architecture." | Copilot section expands; question submitted; instant response returned with `Offline mode` badge, citing exact measurements and data provenance. |
| **1:55–2:10** | Click the **DEMO DATA** badge in the header | "We're upfront about what's real and what's demo seed data — every source is labeled, and we don't just claim the model works, we show it. This backtest runs our live deterministic engine against 15 historical landslide events: every fatal event in that set would have been flagged high-risk, with zero false positives on the non-fatal ones." | Data Source panel opens; each source shows its REAL/DERIVED/SYNTHETIC label; Model Validation Backtest section shows the live-computed flagged-event count and methodology note. |
| **2:10–2:20** | Click **Reset to observed** in the simulator | "Resetting returns the corridor to observed ground truth — factor bars, Response Guidance, and the alert all animate back to baseline." | Polygon returns to baseline color; score resets; `OBSERVED` badge restored; alert banner clears. |
| **2:20–2:30** | Concluding pitch | "Talweg delivers actionable lead time, full explainability, architectural resilience, and — critically — honesty about its own data. That combination is what makes it deployable, not just demoable." | Clean overview of Sikkim map. |

---

## Visual Smoke Verification Checklist

- [ ] WebGL map tiles load cleanly without CORS or WebGL context loss
- [ ] 6 risk polygons render with correct initial colors
- [ ] 15 historical incident markers appear with clickable popups
- [ ] Zone selection triggers smooth camera animation and drawer opening
- [ ] Factor breakdown displays 5 ranked bars with correct percentage shares
- [ ] Response Guidance panel renders and updates its tier as risk level changes
- [ ] Live simulator sliders update score, recolor map polygon, and update Response Guidance
- [ ] Alert banner slides down when risk crosses High/Severe
- [ ] **Engine badge correctly shows `ML` at demo start (confirms `RISK_ENGINE_MODE=ml` took effect)**
- [ ] **Killing the ML container flips the engine badge to `Deterministic` within the configured timeout, with no error state and no interruption to the displayed risk score**
- [ ] Copilot answers with grounded data and `Offline mode` reliability badge
- [ ] DEMO DATA panel opens and shows accurate REAL/DERIVED/SYNTHETIC labels for every source
- [ ] Model Validation Backtest section loads and displays a flagged-event count without error
- [ ] Reset button restores observed baseline state cleanly across all panels (factor breakdown, Response Guidance, alert banner)
