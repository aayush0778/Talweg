# TALWEG Evaluation Report (Final Upgrade Spec §35)

> Results are strictly separated by evidence class. **They are never combined
> into a single accuracy percentage.**

## A. Synthetic approximation

**Question**: how accurately does the frozen ExtraTrees surrogate approximate
the deterministic synthetic prototype function?

| Item | Value |
| --- | --- |
| Training data | `synthetic-grid-uniform-seed42-v1` (deterministic prototype function, uniform grid) |
| Model | ExtraTreesRegressor, `synthetic-surrogate-0.1.0` |
| Approximation R² | > 0.998 on the synthetic function |
| Interpretation | Measures agreement with a hand-designed formula — **NOT** real-world landslide prediction accuracy |

The live round-trip was verified during the final upgrade: the Node service
queries the surrogate, composes with the deterministic baseline and the
rainfall threshold engine, and returns `ml.score` alongside
`deterministic.score` with the explicit `is_probability: false` marker.

## B. Real replay

**Question**: does the system, driven by real aligned environmental
observations, flag verified historical events?

Current status: **1 fully verified anchor** (NASA GLC #15243 — 2023-10-04
Chungthang–Mangan debris flow; CHIRPS/IMD-derived rainfall) plus 2 CHIRPS-
verified backtest events. Replay of the anchor via
`GET /api/historical-events/replay-real-glc-2023-10-04/replay`:

| Metric | Result |
| --- | --- |
| Risk at event | 0.618 → HIGH (deterministic engine, pre-safety-floor) |
| Threshold ratio at event | 4.70× (7-day), 2.55× (T-24h) — extreme exceedance |
| Timeline behavior | MONOTONIC escalation MODERATE → HIGH → SEVERE across T-7d → Event; alert state NONE → WATCH → HIGH → SEVERE |

With so few verified anchors this is **evidence of correct plumbing**, not a
validation statistic. No recall/precision numbers are computed for this class.

## C. Methodology-only replay

**Question**: does the end-to-end methodology (event → reconstructed
environmental inputs → engine → flagging) behave coherently for events
lacking verified environmental telemetry?

The 17-event prototype benchmark (`GET /api/model-validation`) replays
historical Sikkim events through the deterministic engine using
representative trigger-day inputs. Per the current honesty gate
(`buildValidationSummary`), fewer than 20 verified real replays exist, so the
summary returns `status: methodology_only` with `metrics: null` — no metrics
are fabricated.

## D. Synthetic scenarios

**Question**: do scenario simulations correctly propagate input changes
through the full risk pipeline?

Verified behavior (implemented and covered by tests):

| Check | Result |
| --- | --- |
| `+100% rainfall` preset | baseline 0.356/MODERATE → scenario 0.58/HIGH, Δ +22 pts, threshold 0.71× → 1.42× |
| Wet-soil, steep-slope, sustained, high-antecedent presets | Each recomputes risk through the hybrid composer; deltas and drivers reported |
| Largest-change driver | Reported per run (e.g. `rainfall_3d 39.02 → 78.04`) |
| Safety floor | Threshold ratio ≥ 1.3 forces ≥ HIGH; ≥ 2.0 forces ≥ SEVERE; never suppresses ML |
| Sensitivity mode (N=40, seeded) | Median/p10/p90 + proportion ≥ HIGH reported; labeled *"Scenario sensitivity, not statistical prediction uncertainty."* |

## Empirical benchmarking (not yet performed)

`ml-service/training/empirical/` contains the leakage-safe harness
(event-group splits, documented negative sampling, LR/RF/ET/HGB benchmark,
held-out calibration check). It **refuses to run without a real dataset
file** — no synthetic fallback. Promotion criteria live in
`ml-service/training/empirical/README.md`; results will be reported here.

## Calibration statement

The synthetic surrogate's output is not calibrated and is never displayed as
a probability. The UI shows `Risk Index xx/100`. Probability display is only
permitted after calibration is demonstrated on held-out empirical data
(spec §12).
