# TALWEG Data Dictionary (Final Upgrade Spec §33)

Canonical feature contract version: **`1.0.0`**
Source of truth: `server/src/schemas/featureSchema.ts` (mirrored in `ml-service/app/feature_schema.py`).

## 1. Value-level contract

Every environmental value is a `FeatureValue`:

| Field | Type | Meaning |
| --- | --- | --- |
| `value` | number / string / **null** | The observed or derived value. **`0` is an observed zero; `null` means missing.** Never zero-fill. |
| `unit` | string | e.g. `mm`, `mm/day`, `degrees`, `ratio`, `m`, `fraction` |
| `source_id` | string | Registry key in `data_sources` (e.g. `chirps`, `seed-telemetry`) |
| `provenance_type` | enum | `REAL` \| `DERIVED` \| `SYNTHETIC` \| `UNKNOWN` |
| `observed_at` | ISO 8601 | When the value was observed (drives temporal alignment) |
| `window_start` / `window_end` | ISO date | Coverage window for rolling features |
| `spatial_reference` | string | e.g. `SRTM 30m DEM`, `zone polygon containment` |
| `spatial_distance_km` | number | Offset between observation location and target location |
| `transformation` | string | e.g. `rolling_sum_3d`, `exp_weighted_memory_tau3d` |
| `quality_status` | enum | `VALID` \| `PARTIAL` \| `MISSING` \| `INVALID` |

A `FeatureRecord` additionally carries `feature_schema_version`, `location`,
`as_of`, `completeness` (fraction of the 5 core inputs VALID) and
`alignment_status` (`aligned` / `partial` / `unknown` / `invalid`).

## 2. Feature families

### Rainfall (temporal pipeline — spec §7)
| Feature | Unit | Derivation |
| --- | --- | --- |
| `rainfall_24h` | mm | Rolling sum, last 1 day of the daily series |
| `rainfall_3d` | mm | Rolling sum, 3 days |
| `rainfall_5d` | mm | Rolling sum, 5 days |
| `rainfall_7d` | mm | Rolling sum, 7 days |
| `rainfall_intensity` | mm/day | Mean over the available (covered) 7-day window; time resolution stated per response |
| `antecedent_rainfall_index` | mm (index) | `ARI_t = P_t + e^(−Δt/3d) · ARI_{t−1}` — an index, NOT a probability |
| `rainfall_anomaly` | mm/day | Window mean − climatological mean; **only computed when a baseline is supplied** |
| `threshold_exceedance_ratio` | ratio | Observed cumulative ÷ regional cumulative threshold |
| `threshold_exceedance_duration` | days | Duration (1/3/5/7) giving the maximum ratio |

### Terrain (spec §6)
`slope` (degrees, raw — normalization only inside the transformation layer),
`aspect` (degrees), `elevation` (m), `curvature` (1/m), `terrain_ruggedness`
(index), `relative_relief` (m). DEM-derived values require CRS/resolution/
nodata verification before ingestion; demo values are labeled `SYNTHETIC`.

### Soil (spec §5)
`soil_type`/`soil_texture` (class), `soil_depth` (m), `sand_fraction`,
`silt_fraction`, `clay_fraction` (fraction), `bulk_density` (g/cm³),
`hydraulic_conductivity` (mm/h), `available_water_capacity` (mm),
`organic_carbon` (%), `soil_moisture` (ratio 0–1).
Source hierarchy: local/field → validated regional → global products →
derived proxy → synthetic demonstration. Current seed data sits at the
SYNTHETIC rung and is labeled as such everywhere.

### History / context
`historical_density` (events inside zone polygon), `distance_to_historical_event`
(km from zone centroid), `geology_class`, `land_cover`, `vegetation_index`
(latter three reserved — absent until a source is ingested).

## 3. Risk engine constants (frozen prototype)

| Constant | Value |
| --- | --- |
| Deterministic weights | `rainfall_24h` 0.30 · `rainfall_3d` 0.20 · `slope` 0.20 · `soil_moisture` 0.15 · `historical_density` 0.15 |
| Normalization maxima | 200 mm · 500 mm · 60° · 1.0 · 10 events |
| Risk levels | LOW ≤ 0.30 < MODERATE ≤ 0.56 < HIGH ≤ 0.80 < SEVERE ≤ 1.00 |
| Rainfall threshold | `I = 43.26 × D^(−0.78)` mm/day, D ∈ {1, 3, 5, 7} |
| Cumulative thresholds | 43.26 / 55.088 / 61.640 / 66.376 mm |
| Ratio bands | <1.0 below · 1.0–1.3 approached · 1.3–2.0 strong · ≥2.0 extreme |
| Safety floor | ratio ≥ 1.3 → minimum HIGH · ≥ 2.0 → minimum SEVERE (`final = max(base, safety)`) |
| ARI decay constant | τ = 3 days |
| Domain bounds (warnings) | 0–200 mm · 0–500 mm · 0–1 · 0–60° · 0–10 events |

## 4. Database tables (data foundation)

| Table | Purpose |
| --- | --- |
| `regions`, `risk_zones`, `landslide_events`, `environmental_observations`, `alerts` | Core prototype (migrations 001–002) |
| `historical_event_replays`, `historical_event_evidence` | Replay registry + evidence (003–004) |
| `data_sources`, `feature_observations`, `risk_predictions` | Source registry, time-series, prediction audit (005) |
| `rainfall_observations` | Daily rainfall series per zone → windows + ARI (006) |
| `soil_observations` | Soil feature family with per-row provenance + quality (006) |
| `terrain_features` | Terrain family beyond slope (006) |
| `simulation_runs` | Scenario + sensitivity persistence (006) |
| `alerts` (extensions) | `alert_code`, `trigger_summary`, `threshold_ratio`, `evidence_quality`, `recommended_action`, `expires_at` (006) |
| `risk_predictions` (extensions) | `model_mode`, `feature_schema_version`, `threshold_duration_days`, `deterministic_rules` (006) |
