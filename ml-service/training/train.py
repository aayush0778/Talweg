"""Surrogate Model Training Script for SlopeGuard AI

Trains a Scikit-Learn tree-ensemble surrogate model on systematically generated
multi-factor feature combinations spanning the operational boundaries.

Architecture role:
- Demonstrates production ML model-serving and model-swap seam without fabricating real-world sensor ground truth.
- Executed during Docker build ('RUN python training/train.py') to produce reproducible artifacts without checking binaries into Git.
- Quality gates: R² > 0.99, MAE < 0.005.
"""

import os
import sys
from datetime import datetime, timezone
import numpy as np
from sklearn.ensemble import ExtraTreesRegressor
from sklearn.metrics import r2_score, mean_absolute_error, max_error
import joblib

# Ensure ml-service root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.constants import NORMALIZATION_MAX, RISK_WEIGHTS, FEATURE_NAMES


def generate_training_data(n_random: int = 100_000, random_seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    """Generates synthetic feature matrices including boundary grid and random uniform samples."""
    np.random.seed(random_seed)

    # 1. Systematic grid sampling covering corners, midpoints, and extremes (8^5 = 32,768 samples)
    r24_grid = np.linspace(0.0, NORMALIZATION_MAX["rainfall_24h"], 8)
    r3d_grid = np.linspace(0.0, NORMALIZATION_MAX["rainfall_3d"], 8)
    sm_grid = np.linspace(0.0, NORMALIZATION_MAX["soil_moisture"], 8)
    slope_grid = np.linspace(0.0, NORMALIZATION_MAX["slope"], 8)
    hd_grid = np.linspace(0.0, NORMALIZATION_MAX["historical_density"], 8)

    grid_mesh = np.meshgrid(r24_grid, r3d_grid, sm_grid, slope_grid, hd_grid)
    X_grid = np.column_stack([m.ravel() for m in grid_mesh])

    # 2. Random uniform samples across domain bounds
    r24 = np.random.uniform(0.0, NORMALIZATION_MAX["rainfall_24h"], size=n_random)
    r3d = np.random.uniform(0.0, NORMALIZATION_MAX["rainfall_3d"], size=n_random)
    sm = np.random.uniform(0.0, NORMALIZATION_MAX["soil_moisture"], size=n_random)
    slope = np.random.uniform(0.0, NORMALIZATION_MAX["slope"], size=n_random)
    hd = np.random.uniform(0.0, NORMALIZATION_MAX["historical_density"], size=n_random)

    X_rand = np.column_stack([r24, r3d, sm, slope, hd])

    # Combine grid and random samples
    X = np.vstack([X_grid, X_rand])

    # Compute ground-truth normalized target score
    norm_r24 = X[:, 0] / NORMALIZATION_MAX["rainfall_24h"]
    norm_r3d = X[:, 1] / NORMALIZATION_MAX["rainfall_3d"]
    norm_sm = X[:, 2] / NORMALIZATION_MAX["soil_moisture"]
    norm_slope = X[:, 3] / NORMALIZATION_MAX["slope"]
    norm_hd = X[:, 4] / NORMALIZATION_MAX["historical_density"]

    y = (
        RISK_WEIGHTS["rainfall_24h"] * norm_r24
        + RISK_WEIGHTS["rainfall_3d"] * norm_r3d
        + RISK_WEIGHTS["soil_moisture"] * norm_sm
        + RISK_WEIGHTS["slope"] * norm_slope
        + RISK_WEIGHTS["historical_density"] * norm_hd
    )

    y = np.clip(y, 0.0, 1.0)
    return X, y


def train_surrogate_model(output_path: str | None = None) -> dict:
    """Fits ExtraTreesRegressor and serializes model bundle."""
    if output_path is None:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        models_dir = os.path.join(base_dir, "models")
        os.makedirs(models_dir, exist_ok=True)
        output_path = os.path.join(models_dir, "surrogate_model.joblib")

    print("[train] Generating synthetic feature samples (grid + uniform)...")
    X, y = generate_training_data(n_random=100_000, random_seed=42)

    # Shuffle before split
    perm = np.random.permutation(len(X))
    X, y = X[perm], y[perm]

    # 80/20 train/test split
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]

    print(f"[train] Fitting ExtraTreesRegressor on {len(X_train)} samples...")
    model = ExtraTreesRegressor(
        n_estimators=100,
        max_depth=25,
        min_samples_split=2,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    r2 = float(r2_score(y_test, y_pred))
    mae = float(mean_absolute_error(y_test, y_pred))
    max_err = float(max_error(y_test, y_pred))

    print(f"[train] Evaluation Metrics: R² = {r2:.5f}, MAE = {mae:.5f}, Max Error = {max_err:.5f}")
    assert r2 > 0.99, f"Model quality assertion failed: R²={r2:.5f} <= 0.99"
    assert mae < 0.005, f"Model quality assertion failed: MAE={mae:.5f} >= 0.005"

    artifact = {
        "model": model,
        "feature_names": FEATURE_NAMES,
        "normalization_max": NORMALIZATION_MAX,
        "risk_weights": RISK_WEIGHTS,
        "metrics": {"r2": r2, "mae": mae, "max_error": max_err},
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "model_type": "ExtraTreesRegressor (Surrogate)",
        "version": "0.1.0",
    }

    joblib.dump(artifact, output_path)
    print(f"[train] Model artifact saved to: {output_path}")
    return artifact


if __name__ == "__main__":
    train_surrogate_model()
