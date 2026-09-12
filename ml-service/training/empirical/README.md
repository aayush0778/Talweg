# Empirical ML Pipeline — Scaffolding (Phase 7)

**Status: SCAFFOLD ONLY. No empirical model has been trained. The frozen
ExtraTrees synthetic surrogate remains the only model artifact.**

This package implements the pipeline TALWEG will use when genuine aligned
event/non-event data exists (Final Upgrade Spec §10–§12, §37 Phase 7):

| Module | Purpose |
| --- | --- |
| `build_dataset.py` | Event-centered rainfall windows + positive-row assembly. Windows never read past the event day. |
| `negative_sampling.py` | Documented negative strategies (nearby non-event, matched terrain, non-event days, spatial separation, temporal controls) + leakage assertion. |
| `splits.py` | Leakage-safe splits: temporal, spatial-group, event-group + no-event-overlap assertion. |
| `benchmark.py` | LR / RF / ExtraTrees / HGB benchmark with early-warning metrics (recall, FNR, PR-AUC, false alarms per zone-day, Brier) and a held-out calibration check. **Raises if no real dataset file exists — no synthetic fallback.** |

## Promotion gate

An empirical model may only be promoted when ALL of the following hold:

1. Real verified events with aligned environmental observations (spec §9-A/B).
2. Documented negative-sampling strategy (§10.2) and leakage-safe splits (§10.3).
3. Benchmark across candidates with recall/FNR prioritized over accuracy (§11).
4. Calibration demonstrated on held-out data before any "Probability" display (§12).
5. Explicit, operator-driven `model_mode: empirical_model` switch (§1.2) — never silent.
6. Comparison against the frozen surrogate documented in `docs/EVALUATION_REPORT.md`.
