"""Shared constants for normalization, factor weights, and risk classification thresholds.

Kept in exact 1:1 mathematical parity with server/src/services/riskEngine.ts.
"""

from typing import Dict, List, Tuple

# Reference maximums for normalization (domain clamping boundaries)
NORMALIZATION_MAX: Dict[str, float] = {
    "rainfall_24h": 200.0,
    "rainfall_3d": 500.0,
    "slope": 60.0,
    "soil_moisture": 1.0,
    "historical_density": 10.0,
}

# Heuristic factor weights (sum to 1.0)
RISK_WEIGHTS: Dict[str, float] = {
    "rainfall_24h": 0.30,
    "rainfall_3d": 0.20,
    "slope": 0.20,
    "soil_moisture": 0.15,
    "historical_density": 0.15,
}

# Risk level thresholds (score intervals)
# LOW: <= 0.30, MODERATE: <= 0.56, HIGH: <= 0.80, SEVERE: > 0.80
RISK_THRESHOLDS: List[Tuple[float, str]] = [
    (0.30, "LOW"),
    (0.56, "MODERATE"),
    (0.80, "HIGH"),
    (1.00, "SEVERE"),
]

# Canonical order of feature names used for model training and inference
FEATURE_NAMES: List[str] = [
    "rainfall_24h",
    "rainfall_3d",
    "soil_moisture",
    "slope",
    "historical_density",
]


def classify_risk(score: float) -> str:
    """Classifies a continuous risk score into categorical risk level."""
    for max_val, level in RISK_THRESHOLDS:
        if score <= max_val:
            return level
    return "SEVERE"
