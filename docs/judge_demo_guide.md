# TALWEG: 2-Minute Judge Demo Guide & Q&A Cheat Sheet

Prepared directly from the **TALWEG P0–P6 Proof, Deployment & Presentation Handbook** (Pages 13, 16, 22, 23).

---

## 1. Exact 2-Minute Demo Script

>**Rule**: The demo is a story, not a tour of every button you have accumulated. If anything breaks, skip it. A shorter working demo beats a longer archaeological expedition through your own frontend.

### [0:00 – 0:15] Hook & Introduction
- **Visual**: Full Sikkim State Map in **Top View** (nadir 0°).
- **Script**:
  > "TALWEG is an AI-assisted landslide risk intelligence and early-warning decision-support system for the Northeast. It combines rainfall, terrain, soil moisture and historical susceptibility in an explainable spatial workflow."

### [0:15 – 0:30] Select High-Risk Zone
- **Action**: Click on a high-risk corridor (e.g. **North Sikkim / Mangan**).
- **Script**:
  > "Here in North Sikkim, we see an elevated risk level. Notice the alert state and telemetry reflecting sustained monsoon rainfall and steep gorge topography."

### [0:30 – 0:50] Explainability / "Why?"
- **Action**: Expand the **Factor Breakdown**.
- **Script**:
  > "Why is this zone flagged? Our deterministic risk engine provides full explainability: 24-hour rainfall contributes 30%, 3-day accumulated rainfall 20%, slope 20%, soil saturation 15%, and historical event density 15%. The deterministic heuristic serves as our interpretable, transparent baseline."

### [0:50 – 1:05] Spatial Intelligence (3D Terrain)
- **Action**: Click the **3D Terrain** button in the top-left map controls.
- **Script**:
  > "Switching to 3D relief view, we can inspect the actual digital elevation terrain. The system renders elevation contours at a 57° pitch, providing spatial context for why this valley funnel is susceptible to mass wasting."

### [1:05 – 1:30] Deep Proof (Real Historical Replay)
- **Action**: Click **Replay** on the **October 4, 2023 Chungthang-Mangan Debris Flow** event card.
- **Script**:
  > "This is our core proof feature: Historical Event Replay. We reconstruct the actual trigger conditions of the October 4, 2023 North Sikkim disaster sourced from the NASA Global Landslide Catalog (GLC #15243) and published IMD station rainfall (142.5 mm in 24 hours). Feeding these verified observations into TALWEG yields a risk score of 0.62 (HIGH). As you can see, TALWEG WOULD HAVE FLAGGED this event."

### [1:30 – 1:45] Scientific Honesty & Provenance
- **Action**: Point to the **REAL** and **DERIVED** badges on the replay modal.
- **Script**:
  > "Notice the provenance badges: every data point is strictly labeled. Rainfall observations are REAL, multi-day windows and DEM slopes are DERIVED, and scenario sliders are SIMULATED. We deliberately separate empirical observations from calculations and demonstrations."

### [1:45 – 1:55] Conceptual Motion (Optional)
- **Action**: Open the conceptual motion modal briefly (only if it loads instantly).
- **Script**:
  > "For stakeholder education, we provide an illustrative motion animation, clearly watermarked as an illustrative simulation, not a physical landslide forecast."

### [1:55 – 2:00] Close
- **Script**:
  > "TALWEG focuses on explainability, data provenance, and reproducible retrospective verification. Our next stage expands the verified event catalog and evaluates detection performance against held-out non-event samples."

---

## 2. Judge Q&A Cheat Sheet
Brief, defensible answers from Handbook Page 16:

| Question | Defensible Answer |
| :--- | :--- |
| **Where does your data come from?** | "NASA Global Landslide Catalog for historical event records, IMD and CHIRPS rainfall datasets for environmental reconstruction, and SRTM DEM/terrain data for spatial features. Each value in TALWEG is provenance-tagged." |
| **Is your historical data real?** | "The seeded demonstrations are synthetic and explicitly labeled. The real historical replay path uses separately imported verified event records and reconstructed environmental observations." |
| **How accurate is your AI?** | "We are not claiming a real-world accuracy percentage yet. The current prototype uses an explainable baseline, while the ML component is a surrogate experiment. We need a larger verified event-observation dataset and held-out evaluation before making an accuracy claim." |
| **Why use a weighted formula if this is AI?** | "The deterministic engine is an interpretable baseline. The architecture separates risk evaluation from data ingestion so it can be calibrated or replaced with a model trained on real labels." |
| **Can it work in the Northeast?** | "The architecture is spatially parameterized around zones, terrain, rainfall and historical events. The prototype is designed around the target geography, while the ingestion pipeline is structured for expansion." |
| **Is the 3D animation a landslide simulation?** | "No. Terrain is a geospatial visualization, and the conceptual motion view is explicitly illustrative. We do not present it as a physical landslide forecast." |
| **What happens when the network is poor?** | "The architecture is designed to support offline/local ingestion and low-bandwidth workflows. The current prototype demonstrates the core software path; full field/offline hardening is a later stage." |

---

## 3. Mode Semantics

- **LIVE**: Current stored/ingested environmental state.
- **WHAT-IF**: User-defined scenario ("Scenario analysis – not a recorded forecast.").
- **HISTORICAL**: Retrospective reconstruction using event-date evidence.
- **3D**: Spatial terrain visualization, not a prediction method.
