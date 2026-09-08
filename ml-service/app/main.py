"""FastAPI Inference Service for Talweg ML Surrogate

Hosts the Scikit-Learn ExtraTreesRegressor surrogate model.
Serves internal risk calculation requests from Node.js with strict loopback-only binding.
"""

import hashlib
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
model_artifact_hash = None


def compute_sha256(filepath: str) -> str:
    """Computes SHA-256 hash of a file on disk."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def load_model():
    """Loads model bundle from disk if present and computes SHA-256 hash."""
    global model_bundle, model_artifact_hash
    if os.path.exists(MODEL_PATH):
        try:
            model_bundle = joblib.load(MODEL_PATH)
            model_artifact_hash = compute_sha256(MODEL_PATH)
            print(f"[ml-service] Successfully loaded model from {MODEL_PATH} (SHA-256: {model_artifact_hash[:16]}...)")
        except Exception as e:
            print(f"[ml-service] Error loading model from {MODEL_PATH}: {e}")
            model_bundle = None
            model_artifact_hash = None
    else:
        print(f"[ml-service] Model file not found at {MODEL_PATH}")
        model_bundle = None
        model_artifact_hash = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield


app = FastAPI(
    title="Talweg — ML Surrogate Service",
    description="FastAPI microservice for synthetic function approximation surrogate model",
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
    """Health check endpoint providing model status, hash, and scientific surrogate metadata."""
    is_loaded = model_bundle is not None and "model" in model_bundle
    domains = {
        "rainfall_24h": [0.0, float(NORMALIZATION_MAX["rainfall_24h"])],
        "rainfall_3d": [0.0, float(NORMALIZATION_MAX["rainfall_3d"])],
        "soil_moisture": [0.0, float(NORMALIZATION_MAX["soil_moisture"])],
        "slope": [0.0, float(NORMALIZATION_MAX["slope"])],
        "historical_density": [0.0, float(NORMALIZATION_MAX["historical_density"])],
    }

    return HealthResponse(
        status="ok" if is_loaded else "degraded",
        model_loaded=is_loaded,
        model_type=model_bundle.get("model_type", "ExtraTreesRegressor (Surrogate)") if is_loaded else "unloaded",
        version=model_bundle.get("version", "synthetic-surrogate-0.1.0") if is_loaded else "synthetic-surrogate-0.1.0",
        model_version=model_bundle.get("model_version", "synthetic-surrogate-0.1.0") if is_loaded else "synthetic-surrogate-0.1.0",
        model_role="synthetic_function_approximation",
        is_probability=False,
        artifact_hash=model_artifact_hash,
        training_data_version=model_bundle.get("training_data_version", "synthetic-grid-uniform-seed42-v1") if is_loaded else None,
        feature_domains=domains if is_loaded else None,
    )


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    """Calculates landslide risk approximation using the trained synthetic surrogate model.

    Evaluates input against domain boundaries. Out-of-domain features are clamped to
    boundary maximums and surfaced transparently in the uncertainty payload.
    """
    if model_bundle is None or "model" not in model_bundle:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Surrogate model is not loaded or unavailable",
        )

    model = model_bundle["model"]

    # 1. Check feature domain bounds and detect clamping
    clamped_features = []
    if req.rainfall_24h > NORMALIZATION_MAX["rainfall_24h"]:
        clamped_features.append("rainfall_24h")
    if req.rainfall_3d > NORMALIZATION_MAX["rainfall_3d"]:
        clamped_features.append("rainfall_3d")
    if req.soil_moisture > NORMALIZATION_MAX["soil_moisture"]:
        clamped_features.append("soil_moisture")
    if req.slope > NORMALIZATION_MAX["slope"]:
        clamped_features.append("slope")
    if req.historical_density > NORMALIZATION_MAX["historical_density"]:
        clamped_features.append("historical_density")

    r24_clamped = float(np.clip(req.rainfall_24h, 0.0, NORMALIZATION_MAX["rainfall_24h"]))
    r3d_clamped = float(np.clip(req.rainfall_3d, 0.0, NORMALIZATION_MAX["rainfall_3d"]))
    sm_clamped = float(np.clip(req.soil_moisture, 0.0, NORMALIZATION_MAX["soil_moisture"]))
    slope_clamped = float(np.clip(req.slope, 0.0, NORMALIZATION_MAX["slope"]))
    hd_clamped = float(np.clip(req.historical_density, 0.0, NORMALIZATION_MAX["historical_density"]))

    uncertainty = {
        "in_domain": len(clamped_features) == 0,
        "clamped_features": clamped_features,
        "domain_warning": (
            f"Input features {clamped_features} exceeded surrogate model training boundaries "
            f"and were clamped to domain maximums."
        ) if clamped_features else None,
    }

    X = np.array([[r24_clamped, r3d_clamped, sm_clamped, slope_clamped, hd_clamped]], dtype=np.float64)

    # 2. Run surrogate model inference
    raw_pred = float(model.predict(X)[0])
    risk_score = round(float(np.clip(raw_pred, 0.0, 1.0)), 3)
    risk_level = classify_risk(risk_score)

    # 3. Compute contributing factors
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

    # Sort factors by contribution descending
    contributing_factors.sort(key=lambda f: f.contribution, reverse=True)

    # Data quality score: slightly lower if features were out-of-domain
    data_quality_score = 0.85 if clamped_features else 1.0

    return PredictResponse(
        risk_score=risk_score,
        risk_level=risk_level,
        contributing_factors=contributing_factors,
        engine="ml",
        model_version="synthetic-surrogate-0.1.0",
        model_role="synthetic_function_approximation",
        is_probability=False,
        data_quality_score=data_quality_score,
        uncertainty=uncertainty,
        fallback_used=False,
        fallback_reason=None,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
