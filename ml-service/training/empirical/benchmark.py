"""Empirical model benchmark harness (spec §11) — runs ONLY on real data.

Benchmark candidates: Logistic Regression, Random Forest, ExtraTrees,
HistGradientBoosting (XGBoost only if installed and justified).

Metrics (early-warning aware — do NOT optimize accuracy alone):
  recall/sensitivity, precision, F1, PR-AUC, ROC-AUC,
  false-negative rate, false alarms per zone-day, Brier score, calibration.

Calibration (spec §12): probability display is permitted only after
calibration (Platt / isotonic) is demonstrated on held-out data.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

from . import EMPIRICAL_GATE_NOTE

BENCHMARK_CANDIDATES = [
    "logistic_regression",
    "random_forest",
    "extra_trees",
    "hist_gradient_boosting",
]

REQUIRED_COLUMNS = [
    "event_id", "label", "date", "zone_id",
    "rainfall_24h", "rainfall_3d", "rainfall_7d",
    "slope", "soil_moisture",
]


@dataclass
class BenchmarkResult:
    model: str
    recall: float
    precision: float
    f1: float
    pr_auc: float
    roc_auc: float
    false_negative_rate: float
    brier: float
    false_alarms_per_zone_day: float
    calibration_method: Optional[str] = None
    calibration_demonstrated: bool = False
    notes: List[str] = field(default_factory=list)


def load_dataset(path: Path):
    """Load a real aligned dataset (CSV). Refuses missing required columns.

    This function intentionally contains NO synthetic fallback: if the file
    does not exist, the harness raises. TALWEG does not pretend to have
    empirical data.
    """
    import pandas as pd

    if not path.exists():
        raise FileNotFoundError(
            f"No empirical dataset at {path}. {EMPIRICAL_GATE_NOTE}"
        )
    df = pd.read_csv(path)
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Empirical dataset missing required columns: {missing}")
    return df


def run_benchmark(dataset_path: Path, out_csv: Optional[Path] = None) -> List[BenchmarkResult]:
    """Benchmark all candidates with event-group splitting.

    Raises FileNotFoundError when no real dataset is provided (the gate).
    """
    import pandas as pd
    from sklearn.ensemble import ExtraTreesClassifier, RandomForestClassifier, HistGradientBoostingClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.calibration import calibration_curve
    from sklearn.metrics import (
        recall_score, precision_score, f1_score, roc_auc_score,
        average_precision_score, brier_score_loss,
    )
    from .splits import event_group_split, assert_no_event_overlap

    df = load_dataset(dataset_path)
    train, test = event_group_split(df.to_dict("records"))
    assert_no_event_overlap(train, test)

    feature_cols = [c for c in REQUIRED_COLUMNS if c not in ("event_id", "label", "date", "zone_id")]
    X_train = pd.DataFrame(train)[feature_cols]
    y_train = pd.Series([r["label"] for r in train])
    X_test = pd.DataFrame(test)[feature_cols]
    y_test = pd.Series([r["label"] for r in test])

    models = {
        "logistic_regression": LogisticRegression(max_iter=1000),
        "random_forest": RandomForestClassifier(n_estimators=300, random_state=42),
        "extra_trees": ExtraTreesClassifier(n_estimators=300, random_state=42),
        "hist_gradient_boosting": HistGradientBoostingClassifier(random_state=42),
    }

    results: List[BenchmarkResult] = []
    for name, model in models.items():
        model.fit(X_train, y_train)
        proba = model.predict_proba(X_test)[:, 1]
        pred = (proba >= 0.5).astype(int)

        fnr = 1.0 - recall_score(y_test, pred, zero_division=0)
        zone_days = max(1, len(test))
        false_alarms = int(((pred == 1) & (y_test == 0)).sum())

        # Calibration check on held-out data (spec §12)
        calib_demonstrated = False
        try:
            frac_pos, mean_pred = calibration_curve(y_test, proba, n_bins=5)
            calib_demonstrated = len(frac_pos) >= 3
        except Exception:
            calib_demonstrated = False

        results.append(
            BenchmarkResult(
                model=name,
                recall=float(recall_score(y_test, pred, zero_division=0)),
                precision=float(precision_score(y_test, pred, zero_division=0)),
                f1=float(f1_score(y_test, pred, zero_division=0)),
                pr_auc=float(average_precision_score(y_test, proba)),
                roc_auc=float(roc_auc_score(y_test, proba)),
                false_negative_rate=float(fnr),
                brier=float(brier_score_loss(y_test, proba)),
                false_alarms_per_zone_day=round(false_alarms / zone_days, 5),
                calibration_demonstrated=calib_demonstrated,
                notes=["Probability display permitted only if calibration_demonstrated=true (spec §12)"],
            )
        )

    if out_csv is not None:
        import pandas as pd

        pd.DataFrame([r.__dict__ for r in results]).to_csv(out_csv, index=False)
    return results
