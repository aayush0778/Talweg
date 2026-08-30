# SlopeGuard AI — 100-Second Demonstration Script

**SIH26001: AI-Based Landslide Early Warning & Risk Monitoring System for the North Eastern Region**

---

## Pre-Demo Setup Checklist

1. PostgreSQL + PostGIS container is up: `docker compose up -d`
2. Fresh database seed: `cd server && npm run seed`
3. Backend running: `cd server && npm run dev` (:3001)
4. Frontend running: `cd client && npm run dev` (:5173)
5. Open browser at `http://localhost:5173` in full screen.

---

## 100-Second Walkthrough Script

| Time | Action | What to Say / Point Out | What Renders on Screen |
|---|---|---|---|
| **0:00–0:15** | Open application | "SlopeGuard AI is a unified GIS decision-support system monitoring high-risk landslide corridors across Sikkim, integrating rainfall, terrain, soil saturation, and historical mass-wasting events." | Full-screen MapLibre satellite basemap of Sikkim; 6 monitored zone polygons; 15 historical incident pins; Header showing system connectivity and DEMO DATA provenance badge. |
| **0:15–0:35** | Click **Gangtok Corridor** polygon or list item | "Selecting Gangtok reveals the current risk index (51/100, Moderate). Notice the **Risk Factor Breakdown** below the score card — it answers *why* the zone is at risk without black-box opacity. 24h Rainfall contributes 25%, Soil Saturation 23%, and Slope 23%." | Detail drawer opens; camera smoothly `flyTo` centers on Gangtok; Risk score card renders `51/100 MODERATE` with slate `OBSERVED` badge; 5 ranked contribution bars display with weight percentages. |
| **0:35–0:55** | Drag **24h Rainfall** slider from 85 mm to **150 mm** | "Operators can simulate severe weather scenarios live. As heavy monsoon rain is simulated, the risk engine calculates in-process: Gangtok escalates to 61/100 High Risk. The breakdown re-ranks in real time, and the system automatically generates an Active Alert." | Slider drags smoothly with 400ms debounce; polygon recolors from Yellow to Orange; Risk card shows `MODERATE → HIGH` transition with amber `SCENARIO` chip; **Active Alert Banner** slides in at top center. |
| **0:55–1:15** | Max out all 3 sliders (200mm rain, 500mm 3d, 100% soil) | "Under multi-day extreme downpours, the corridor hits 84/100 Severe Risk. Notice how the alert banner automatically escalates and supersedes the prior alert with audit evidence." | Polygon turns Red; Score jumps to `84/100 SEVERE`; Alert banner updates to Red SEVERE alert with primary driver note. |
| **1:15–1:35** | Scroll down in drawer, expand **Ask SlopeGuard Copilot**, ask *"Why is Gangtok at severe risk?"* | "Our constrained AI Copilot operates with deterministic grounding. Even with zero internet or API keys, it generates a concise, evidence-backed brief citing real telemetry and event history under our reliability-first offline architecture." | Drawer scrolls; Copilot section expands; question submitted; instant response returned with `Offline mode` badge, citing exact measurements and data provenance. |
| **1:35–1:45** | Click **Reset to observed** button in simulator | "Resetting returns the corridor to observed ground truth. The factor bars animate back to baseline, and the active alert is cleared on the next assessment." | Polygon returns to Yellow; score resets to `51/100`; OBSERVED badge restored; Alert banner clears. |
| **1:45–1:50** | Concluding Pitch | "SlopeGuard AI delivers actionable lead time, explainability, and guaranteed deterministic reliability for disaster management authorities in the North Eastern Region." | Clean overview of Sikkim map. |

---

## Visual Smoke Verification Checklist

- [x] WebGL Map tiles load cleanly without CORS or WebGL context loss
- [x] 6 Risk polygons render with correct initial colors (5 Moderate yellow, 1 Low green)
- [x] 15 Historical incident markers appear with clickable popups
- [x] Zone selection triggers smooth camera animation and drawer opening
- [x] Factor breakdown displays 5 ranked bars with correct percentage shares
- [x] Live simulator sliders update score and recolor map polygon
- [x] Alert banner slides down when risk crosses High/Severe (>= 0.57)
- [x] Copilot answers with grounded data and `Offline mode` reliability badge
- [x] Reset button restores observed baseline state cleanly
