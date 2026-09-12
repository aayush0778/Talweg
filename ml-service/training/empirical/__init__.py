"""Empirical ML Pipeline (TALWEG Final Upgrade Spec §10–§12) — SCAFFOLDING ONLY.

This package contains the leakage-safe pipeline TALWEG will use when — and
only when — a real, independently aligned event/non-event dataset exists.

HARD GATE (spec §37 Phase 7):
- Do NOT train or promote an empirical model unless genuine aligned data exists.
- The application must never silently switch into `empirical_model` mode.
- A synthetic score must never be presented as a calibrated probability.

Contents:
  negative_sampling.py — documented negative-sample construction strategies
  splits.py            — temporal / spatial-group / event-group split utilities
  benchmark.py         — model benchmark harness (LR, RF, ET, HGB) with
                         early-warning-aware metrics and calibration checks
"""

EMPIRICAL_GATE_NOTE = (
    "Scaffold only: no empirical training has been performed. Promotion of any "
    "empirical model requires real aligned event/non-event data, leakage-safe "
    "benchmarking against the frozen synthetic surrogate, documented acceptance "
    "criteria, and explicit model_mode switching — never silent."
)
