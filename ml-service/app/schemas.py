from typing import List, Literal
from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    rainfall_24h: float = Field(..., ge=0.0, le=1000.0, description="Rainfall in last 24 hours (mm)")
    rainfall_3d: float = Field(..., ge=0.0, le=2500.0, description="Cumulative rainfall in last 3 days (mm)")
    soil_moisture: float = Field(..., ge=0.0, le=1.0, description="Soil saturation ratio [0.0, 1.0]")
    slope: float = Field(..., ge=0.0, le=90.0, description="Slope gradient in degrees [0, 90]")
    historical_density: int = Field(..., ge=0, le=1000, description="Historical landslide incident count in zone")

    model_config = {
        "extra": "forbid"
    }


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
    engine: Literal["ml"] = "ml"
    timestamp: str


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    model_loaded: bool
    model_type: str
    version: str = "0.1.0"
