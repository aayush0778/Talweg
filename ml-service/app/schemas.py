import math
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, field_validator


class PredictRequest(BaseModel):
    # Core 5 features
    rainfall_24h: float = Field(..., ge=0.0, le=1000.0, description="Rainfall in last 24 hours (mm)")
    rainfall_3d: float = Field(..., ge=0.0, le=2500.0, description="Cumulative rainfall in last 3 days (mm)")
    soil_moisture: float = Field(..., ge=0.0, le=1.0, description="Soil saturation ratio [0.0, 1.0]")
    slope: float = Field(..., ge=0.0, le=90.0, description="Slope gradient in degrees [0, 90]")
    historical_density: int = Field(..., ge=0, le=1000, description="Historical landslide incident count in zone")

    # Optional contextual and derived fields
    rainfall_5d: Optional[float] = Field(None, ge=0.0, le=5000.0, description="Cumulative rainfall in last 5 days (mm)")
    rainfall_7d: Optional[float] = Field(None, ge=0.0, le=7000.0, description="Cumulative rainfall in last 7 days (mm)")
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0, description="WGS84 latitude")
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0, description="WGS84 longitude")
    zone_id: Optional[str] = Field(None, max_length=50, description="Risk zone identifier")
    as_of: Optional[str] = Field(None, description="Observation timestamp in ISO 8601")
    provenance: Optional[Dict[str, Any]] = Field(None, description="Data provenance annotations")
    options: Optional[Dict[str, Any]] = Field(None, description="Execution options (e.g. allow_out_of_domain)")

    model_config = {
        "extra": "forbid"
    }

    @field_validator("rainfall_24h", "rainfall_3d", "soil_moisture", "slope", mode="after")
    @classmethod
    def check_finite_floats(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("Feature value must be a finite number (not NaN or Infinity)")
        return v


class FactorContribution(BaseModel):
    factor: str
    raw: float
    normalized: float
    weight: float
    contribution: float


class PredictResponse(BaseModel):
    risk_score: float = Field(..., ge=0.0, le=1.0)
    risk_level: Literal["LOW", "MODERATE", "HIGH", "SEVERE"]
    contributing_factors: List[FactorContribution]
    engine: Literal["ml", "synthetic_surrogate"] = "ml"
    model_version: str = "synthetic-surrogate-0.1.0"
    model_role: str = "synthetic_function_approximation"
    is_probability: bool = False
    data_quality_score: float = Field(default=1.0, ge=0.0, le=1.0)
    uncertainty: Optional[Dict[str, Any]] = None
    threshold_signal: Optional[Dict[str, Any]] = None
    fallback_used: bool = False
    fallback_reason: Optional[str] = None
    timestamp: str


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    model_loaded: bool
    model_type: str
    version: str = "synthetic-surrogate-0.1.0"
    model_version: str = "synthetic-surrogate-0.1.0"
    model_role: str = "synthetic_function_approximation"
    is_probability: bool = False
    artifact_hash: Optional[str] = None
    training_data_version: Optional[str] = None
    feature_domains: Optional[Dict[str, List[float]]] = None
