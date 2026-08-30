"""Tests for SlopeGuard AI ML Surrogate Service"""

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
    assert data["version"] == "0.1.0"


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
    assert data["risk_level"] == "MODERATE"
    # Ground truth is 0.508; surrogate model is within ±0.015
    assert 0.49 <= data["risk_score"] <= 0.53
    assert len(data["contributing_factors"]) == 5
    assert data["contributing_factors"][0]["contribution"] >= data["contributing_factors"][1]["contribution"]


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


def test_predict_clamping_for_out_of_bounds_inputs(client):
    # rainfall_24h > 200 is legally allowed by schema (up to 1000) and clamped by service
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


def test_predict_validation_error_on_invalid_payload(client):
    # Negative rainfall
    res = client.post("/predict", json={"rainfall_24h": -10.0, "rainfall_3d": 10, "soil_moisture": 0.5, "slope": 20, "historical_density": 1})
    assert res.status_code == 422

    # Extra unknown properties
    res = client.post("/predict", json={"rainfall_24h": 10.0, "rainfall_3d": 10, "soil_moisture": 0.5, "slope": 20, "historical_density": 1, "unknown_field": True})
    assert res.status_code == 422
