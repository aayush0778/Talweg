"""FastAPI Inference Service for SlopeGuard AI ML Surrogate

Hosts the Scikit-Learn RandomForestRegressor surrogate model.
Serves internal risk calculation requests from Node.js with strict loopback-only binding.
"""

import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import joblib
import numpy as np
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from .constants import NORMALIZATION_MAX, RISK_WEIGHTS, FEATURE_NAMES, classify_risk
from .schemas import PredictRequest, PredictResponse, FactorContribution, HealthResponse

MODEL_PATH = os.environ.get(
    "MODEL_PATH",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models", "surrogate_model.joblib")),
)

model_bundle = None


def load_model():
    """Loads model bundle from disk if present."""
    global model_bundle
    if os.path.exists(MODEL_PATH):
        try:
            model_bundle = joblib.load(MODEL_PATH)
            print(f"[ml-service] Successfully loaded model from {MODEL_PATH}")
        except Exception as e:
            print(f"[ml-service] Error loading model from {MODEL_PATH}: {e}")
            model_bundle = None
    else:
        print(f"[ml-service] Model file not found at {MODEL_PATH}")
        model_bundle = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield


app = FastAPI(
    title="SlopeGuard AI — ML Surrogate Service",
    description="FastAPI microservice for landslide risk prediction surrogate model",
    version="0.1.0",
    lifespan=lifespan,
)

# Allow loopback requests from Node backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health():
    """Health check endpoint providing model status and type metadata."""
    is_loaded = model_bundle is not None and "model" in model_bundle
    return HealthResponse(
        status="ok" if is_loaded else "degraded",
        model_loaded=is_loaded,
        model_type=model_bundle.get("model_type", "Tree-Ensemble (Surrogate)") if is_loaded else "unloaded",
        version="0.1.0",
    )


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    """Calculates landslide risk prediction using the trained surrogate model.

    Input features are clamped to normalization max boundaries to ensure exact parity
    with the deterministic domain rules.
    """
    if model_bundle is None or "model" not in model_bundle:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Surrogate model is not loaded or unavailable",
        )

    model = model_bundle["model"]

    # 1. Clamp features to exact domain bounds (parity with engine normalize())
    r24_clamped = float(np.clip(req.rainfall_24h, 0.0, NORMALIZATION_MAX["rainfall_24h"]))
    r3d_clamped = float(np.clip(req.rainfall_3d, 0.0, NORMALIZATION_MAX["rainfall_3d"]))
    sm_clamped = float(np.clip(req.soil_moisture, 0.0, NORMALIZATION_MAX["soil_moisture"]))
    slope_clamped = float(np.clip(req.slope, 0.0, NORMALIZATION_MAX["slope"]))
    hd_clamped = float(np.clip(req.historical_density, 0.0, NORMALIZATION_MAX["historical_density"]))

    X = np.array([[r24_clamped, r3d_clamped, sm_clamped, slope_clamped, hd_clamped]], dtype=np.float64)

    # 2. Run surrogate model inference
    raw_pred = float(model.predict(X)[0])
    risk_score = round(float(np.clip(raw_pred, 0.0, 1.0)), 3)
    risk_level = classify_risk(risk_score)

    # 3. Compute contributing factors
    # Note: score is surrogate-predicted by Random Forest; factor decomposition is formula-derived
    factors_raw = [
        ("rainfall_24h", req.rainfall_24h, r24_clamped / NORMALIZATION_MAX["rainfall_24h"]),
        ("rainfall_3d", req.rainfall_3d, r3d_clamped / NORMALIZATION_MAX["rainfall_3d"]),
        ("soil_moisture", req.soil_moisture, sm_clamped / NORMALIZATION_MAX["soil_moisture"]),
        ("slope", req.slope, slope_clamped / NORMALIZATION_MAX["slope"]),
        ("historical_density", float(req.historical_density), hd_clamped / NORMALIZATION_MAX["historical_density"]),
    ]

    contributing_factors = []
    for factor_name, raw_val, norm_val in factors_raw:
        weight = RISK_WEIGHTS[factor_name]
        contribution = round(weight * norm_val, 3)
        contributing_factors.append(
            FactorContribution(
                factor=factor_name,
                raw=round(raw_val, 3),
                normalized=round(norm_val, 3),
                weight=weight,
                contribution=contribution,
            )
        )

    # Sort factors by contribution descending — highest driver first
    contributing_factors.sort(key=lambda f: f.contribution, reverse=True)

    return PredictResponse(
        risk_score=risk_score,
        risk_level=risk_level,
        contributing_factors=contributing_factors,
        engine="ml",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
