"""Tests for Talweg ML Surrogate Service"""

import os
import sys
import pytest
from fastapi.testclient import TestClient

# Ensure ml-service root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from training.train import train_surrogate_model
from app.main import app, load_model


@pytest.fixture(scope="session", autouse=True)
def ensure_model_trained():
    """Ensures surrogate model artifact is trained and loaded before test execution."""
    model_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "models", "surrogate_model.joblib"))
    if not os.path.exists(model_path):
        print("\n[test_fixture] Training surrogate model fixture...")
        train_surrogate_model(model_path)
    load_model()


@pytest.fixture
def client():
    return TestClient(app)


def test_health_check(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["model_loaded"] is True
    assert "Surrogate" in data["model_type"] or "Regressor" in data["model_type"]
    assert "synthetic-surrogate" in data["version"]
    assert data["model_role"] == "synthetic_function_approximation"
    assert data["is_probability"] is False
    assert data["artifact_hash"] is not None
    assert len(data["artifact_hash"]) == 64
    assert data["feature_domains"] is not None
    assert "rainfall_24h" in data["feature_domains"]


def test_predict_gangtok_baseline(client):
    payload = {
        "rainfall_24h": 85.0,
        "rainfall_3d": 180.0,
        "soil_moisture": 0.78,
        "slope": 35.0,
        "historical_density": 5,
    }
    res = client.post("/predict", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["engine"] == "ml"
    assert data["model_role"] == "synthetic_function_approximation"
    assert data["is_probability"] is False
    assert data["risk_level"] == "MODERATE"
    assert 0.49 <= data["risk_score"] <= 0.53
    assert len(data["contributing_factors"]) == 5
    assert data["contributing_factors"][0]["contribution"] >= data["contributing_factors"][1]["contribution"]
    assert data["uncertainty"]["in_domain"] is True
    assert len(data["uncertainty"]["clamped_features"]) == 0
    assert data["data_quality_score"] == 1.0


def test_predict_severe_storm(client):
    payload = {
        "rainfall_24h": 200.0,
        "rainfall_3d": 500.0,
        "soil_moisture": 1.0,
        "slope": 60.0,
        "historical_density": 10,
    }
    res = client.post("/predict", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["engine"] == "ml"
    assert data["risk_level"] == "SEVERE"
    assert data["risk_score"] >= 0.95
    assert data["uncertainty"]["in_domain"] is True


def test_predict_clamping_for_out_of_bounds_inputs(client):
    payload = {
        "rainfall_24h": 500.0,
        "rainfall_3d": 1200.0,
        "soil_moisture": 1.0,
        "slope": 75.0,
        "historical_density": 25,
    }
    res = client.post("/predict", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["engine"] == "ml"
    assert data["risk_level"] == "SEVERE"
    assert data["risk_score"] >= 0.95
    # Domain boundaries were exceeded; must be reported in uncertainty
    assert data["uncertainty"]["in_domain"] is False
    assert "rainfall_24h" in data["uncertainty"]["clamped_features"]
    assert "rainfall_3d" in data["uncertainty"]["clamped_features"]
    assert "slope" in data["uncertainty"]["clamped_features"]
    assert "historical_density" in data["uncertainty"]["clamped_features"]
    assert data["uncertainty"]["domain_warning"] is not None
    assert data["data_quality_score"] < 1.0


def test_predict_validation_error_on_invalid_payload(client):
    # Negative rainfall
    res = client.post("/predict", json={"rainfall_24h": -10.0, "rainfall_3d": 10, "soil_moisture": 0.5, "slope": 20, "historical_density": 1})
    assert res.status_code == 422

    # Extra unknown properties
    res = client.post("/predict", json={"rainfall_24h": 10.0, "rainfall_3d": 10, "soil_moisture": 0.5, "slope": 20, "historical_density": 1, "unknown_field": True})
    assert res.status_code == 422


def test_predict_rejects_nan_and_inf(client):
    # NaN
    res = client.post("/predict", json={"rainfall_24h": "NaN", "rainfall_3d": 10.0, "soil_moisture": 0.5, "slope": 20.0, "historical_density": 1})
    assert res.status_code == 422

    # Infinity
    res = client.post("/predict", json={"rainfall_24h": "Infinity", "rainfall_3d": 10.0, "soil_moisture": 0.5, "slope": 20.0, "historical_density": 1})
    assert res.status_code == 422


def test_predict_accepts_optional_context_fields(client):
    payload = {
        "rainfall_24h": 45.0,
        "rainfall_3d": 90.0,
        "rainfall_5d": 140.0,
        "rainfall_7d": 190.0,
        "soil_moisture": 0.65,
        "slope": 28.0,
        "historical_density": 2,
        "zone_id": "gangtok",
        "latitude": 27.33,
        "longitude": 88.61,
        "as_of": "2026-09-08T12:00:00Z",
    }
    res = client.post("/predict", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["risk_level"] in ["LOW", "MODERATE", "HIGH", "SEVERE"]
    assert data["model_version"] == "synthetic-surrogate-0.1.0"

