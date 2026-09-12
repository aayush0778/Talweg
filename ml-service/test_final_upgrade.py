"""Final Upgrade tests: canonical feature schema + empirical pipeline scaffolding."""

import math

import pytest
from pydantic import ValidationError

from app.feature_schema import (
    FeatureRecord,
    FeatureLocation,
    make_feature_value,
    compute_completeness,
    compute_alignment_status,
    FEATURE_SCHEMA_VERSION,
)


def _record_with(features: dict) -> FeatureRecord:
    return FeatureRecord(
        location=FeatureLocation(latitude=27.5, longitude=88.5),
        as_of="2026-09-11T00:00:00Z",
        features=features,
        completeness=compute_completeness(features),
        alignment_status=compute_alignment_status(features),
    )


class TestFeatureSchema:
    def test_none_value_is_missing_never_zero(self):
        fv = make_feature_value(None, unit="mm", source_id="s", provenance="SYNTHETIC")
        assert fv.value is None
        assert fv.quality_status == "MISSING"

    def test_zero_is_an_observed_zero(self):
        fv = make_feature_value(0.0, unit="mm", source_id="s", provenance="REAL")
        assert fv.value == 0.0
        assert fv.quality_status == "VALID"

    def test_non_finite_is_invalid(self):
        for bad in (float("nan"), float("inf"), float("-inf")):
            fv = make_feature_value(bad, unit="mm", source_id="s", provenance="REAL")
            assert fv.quality_status == "INVALID"

    def test_completeness_counts_core_features(self):
        features = {
            "rainfall_24h": make_feature_value(10, unit="mm", source_id="s", provenance="REAL"),
            "rainfall_3d": make_feature_value(30, unit="mm", source_id="s", provenance="REAL"),
            "slope": make_feature_value(20, unit="deg", source_id="s", provenance="REAL"),
            "soil_moisture": make_feature_value(0.5, unit="ratio", source_id="s", provenance="REAL"),
            # historical_density missing
        }
        assert compute_completeness(features) == 0.8

    def test_alignment_real_is_aligned(self):
        features = {
            k: make_feature_value(1, unit="x", source_id="s", provenance="REAL")
            for k in ("rainfall_24h", "rainfall_3d", "slope", "soil_moisture", "historical_density")
        }
        assert compute_alignment_status(features) == "aligned"

    def test_alignment_synthetic_is_partial(self):
        features = {
            "rainfall_24h": make_feature_value(1, unit="x", source_id="s", provenance="SYNTHETIC"),
        }
        assert compute_alignment_status(features) == "partial"

    def test_alignment_unknown_short_circuits(self):
        features = {
            "rainfall_24h": make_feature_value(1, unit="x", source_id="s", provenance="UNKNOWN"),
        }
        assert compute_alignment_status(features) == "unknown"

    def test_record_roundtrip(self):
        rec = _record_with(
            {"rainfall_24h": make_feature_value(5, unit="mm", source_id="chirps", provenance="REAL")}
        )
        assert rec.feature_schema_version == FEATURE_SCHEMA_VERSION
        assert rec.completeness == 0.2
        assert rec.alignment_status == "aligned"

    def test_location_bounds_enforced(self):
        with pytest.raises(ValidationError):
            FeatureLocation(latitude=120.0, longitude=0.0)


class TestEmpiricalSplits:
    def test_event_group_split_keeps_events_together(self):
        from training.empirical.splits import event_group_split, assert_no_event_overlap

        rows = (
            [{"event_id": "e1", "v": i} for i in range(3)]
            + [{"event_id": "e2", "v": i} for i in range(3)]
            + [{"event_id": "e3", "v": i} for i in range(3)]
        )
        train, test = event_group_split(rows, train_frac=2 / 3)
        train_events = {r["event_id"] for r in train}
        test_events = {r["event_id"] for r in test}
        assert not (train_events & test_events)
        assert_no_event_overlap(train, test)

    def test_temporal_split_preserves_order(self):
        from training.empirical.splits import temporal_split

        rows = [{"date": f"2026-01-{d:02d}"} for d in range(1, 11)]
        train, test = temporal_split(rows, train_frac=0.8)
        assert len(train) == 8 and len(test) == 2
        assert max(r["date"] for r in train) < min(r["date"] for r in test)

    def test_negative_leakage_detection(self):
        from training.empirical.negative_sampling import assert_no_label_leakage

        class P:
            def __init__(self, lat, lon, date, event_id=None):
                self.latitude, self.longitude, self.date, self.event_id = lat, lon, date, event_id

        positives = [P(27.5, 88.5, "2026-01-01", "e1")]
        bad_negative = [P(27.5, 88.5, "2026-01-01")]
        with pytest.raises(ValueError):
            assert_no_label_leakage(positives, bad_negative)
        ok_negative = [P(27.6, 88.6, "2026-01-01")]
        assert_no_label_leakage(positives, ok_negative)

    def test_event_centered_windows_no_future_leak(self):
        from training.empirical.build_dataset import event_centered_windows

        series = [5.0] * 10
        w = event_centered_windows(series, event_index=3)  # only 4 days of history
        assert w["rainfall_24h"] == 5.0
        assert w["rainfall_3d"] == 15.0
        assert w["rainfall_5d"] is None  # incomplete window → None, not partial sum
        assert w["rainfall_7d"] is None

    def test_benchmark_refuses_without_real_data(self):
        from pathlib import Path
        from training.empirical.benchmark import run_benchmark

        with pytest.raises(FileNotFoundError):
            run_benchmark(Path("definitely/not/a/real/dataset.csv"))
