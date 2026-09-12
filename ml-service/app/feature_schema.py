"""Canonical Feature Schema — Python mirror of server/src/schemas/featureSchema.ts
(TALWEG Final Upgrade Spec §4.1).

Shared conceptually by ingestion, ML, API and UI. Every value carries
provenance and quality status. `null` means missing — NEVER zero-filled.
"""

from __future__ import annotations

from typing import Literal, Optional, Union

from pydantic import BaseModel, Field

FEATURE_SCHEMA_VERSION = "1.0.0"

ProvenanceType = Literal["REAL", "DERIVED", "SYNTHETIC", "UNKNOWN"]
QualityStatus = Literal["VALID", "PARTIAL", "MISSING", "INVALID"]
AlignmentStatus = Literal["aligned", "partial", "unknown", "invalid"]

# Core prototype inputs used for completeness accounting (spec §4.1)
CORE_FEATURE_KEYS = (
    "rainfall_24h",
    "rainfall_3d",
    "slope",
    "soil_moisture",
    "historical_density",
)


class FeatureValue(BaseModel):
    value: Optional[Union[float, int, str]] = None
    unit: str
    source_id: str
    provenance_type: ProvenanceType = "UNKNOWN"
    observed_at: Optional[str] = None
    window_start: Optional[str] = None
    window_end: Optional[str] = None
    spatial_reference: Optional[str] = None
    spatial_distance_km: Optional[float] = None
    transformation: Optional[str] = None
    quality_status: QualityStatus = "VALID"


class FeatureLocation(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    zone_id: Optional[str] = None


class FeatureRecord(BaseModel):
    feature_schema_version: str = FEATURE_SCHEMA_VERSION
    location: FeatureLocation
    as_of: str
    features: dict[str, Optional[FeatureValue]] = Field(default_factory=dict)
    completeness: float = Field(0.0, ge=0.0, le=1.0)
    alignment_status: AlignmentStatus = "unknown"


def make_feature_value(
    value: Optional[Union[float, int, str]],
    *,
    unit: str,
    source_id: str,
    provenance: ProvenanceType,
    transformation: Optional[str] = None,
    observed_at: Optional[str] = None,
    window_start: Optional[str] = None,
    window_end: Optional[str] = None,
) -> FeatureValue:
    """Factory mirroring makeFeatureValue(): null → MISSING; non-finite → INVALID."""
    if value is None:
        quality: QualityStatus = "MISSING"
    elif isinstance(value, float) and (value != value or value in (float("inf"), float("-inf"))):
        quality = "INVALID"
    else:
        quality = "VALID"
    return FeatureValue(
        value=value,
        unit=unit,
        source_id=source_id,
        provenance_type=provenance,
        observed_at=observed_at,
        window_start=window_start,
        window_end=window_end,
        transformation=transformation,
        quality_status=quality,
    )


def compute_completeness(features: dict[str, Optional[FeatureValue]]) -> float:
    """Fraction of core features that are present and VALID."""
    valid = 0
    for key in CORE_FEATURE_KEYS:
        fv = features.get(key)
        if fv is not None and fv.value is not None and fv.quality_status == "VALID":
            valid += 1
    return round(valid / len(CORE_FEATURE_KEYS), 3)


def compute_alignment_status(features: dict[str, Optional[FeatureValue]]) -> AlignmentStatus:
    saw_partial = False
    for key in CORE_FEATURE_KEYS:
        fv = features.get(key)
        if fv is None or fv.value is None:
            continue
        if fv.quality_status == "INVALID":
            return "invalid"
        if fv.provenance_type == "UNKNOWN":
            return "unknown"
        if fv.provenance_type in ("DERIVED", "SYNTHETIC"):
            saw_partial = True
        if fv.spatial_distance_km is not None and fv.spatial_distance_km > 0:
            saw_partial = True
    return "partial" if saw_partial else "aligned"
