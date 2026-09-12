# TALWEG Model Card (Final Upgrade Spec §34)

| Field | Value |
| --- | --- |
| **Model** | ExtraTreesRegressor (scikit-learn), frozen artifact |
| **Version** | `synthetic-surrogate-0.1.0` |
| **Role** | `synthetic_function_approximation` |
| **Is probability** | **NO** — output is a risk index in [0, 1], displayed as `Risk Index xx/100` |
| **Inputs** | Five prototype environmental variables: `rainfall_24h`, `rainfall_3d`, `soil_moisture`, `slope`, `historical_density` (optional context: `rainfall_5d`, `rainfall_7d`, `zone_id`, lat/lon) |
| **Training data** | `synthetic-grid-uniform-seed42-v1` — synthetic grid generated from a deterministic prototype risk function |
| **Training pipeline** | `ml-service/training/train.py` (synthetic only) |
| **Artifact** | `ml-service/models/surrogate_model.joblib` + `surrogate_model.joblib.sha256` checksum sidecar |
| **Checksum verification** | ML service computes SHA-256 at load; server surfaces verification via `/api/model` and `/api/system-health` |

## Intended use

Prototype decision-support and software-integration demonstration for
SIH26001 (landslide risk monitoring, Sikkim / NER): showing how a risk engine,
GIS UI, threshold intelligence, replay, simulation and alerting integrate
end-to-end with explicit provenance.

## Not intended for

- Operational disaster warning or evacuation decision-making.
- Calibrated probability estimation — a score of `0.80` is **not** an 80%
  probability of landslide.
- Any claim of real-world landslide prediction accuracy. The R² > 0.998
  reported at training time measures how well the model approximates a
  deterministic synthetic function — nothing else.

## Limitations

- Synthetic target: the model approximates a hand-designed prototype function.
- No real-world calibration; heuristic normalization (fixed reference maximums).
- Limited environmental coverage (five core inputs; no soil/vegetation
  dynamics in the model input vector).
- No field validation; the 17-event prototype benchmark is a synthetic replay
  of historical triggers (methodology demonstration), **not** detection accuracy.

## Future validation

Real event/non-event aligned dataset with spatial/temporal leakage control
(see `ml-service/training/empirical/` — scaffolding implemented, training
gate closed until genuine aligned data exists). Benchmarking must prioritize
recall / false-negative rate, report PR-AUC / ROC-AUC / Brier score, and
demonstrate probability calibration on held-out data before any
"Probability" display is permitted (spec §11–§12).

## Execution modes (spec §1.2)

| Mode | Status | Meaning |
| --- | --- | --- |
| `synthetic_surrogate` | ACTIVE | Frozen ExtraTrees surrogate; deterministic engine when `RISK_ENGINE_MODE=deterministic` or on ML fallback |
| `hybrid_prototype` | ACTIVE (when `RISK_ENGINE_MODE=ml` and ML service healthy) | Surrogate output composed with the rainfall-threshold safety floor (`final = max(model, threshold safety)`) |
| `empirical_model` | RESERVED | Never silently selected; requires the empirical promotion gate |

Every prediction response carries `model_mode`, `model_version`,
`feature_schema_version`, `fallback_used`, `fallback_reason` and data-quality
metadata (spec §15).
