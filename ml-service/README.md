# ML Service — FastAPI & Scikit-Learn Surrogate Model

> **Status: IMPLEMENTED** — Phase 5 surrogate-model architecture demonstration.

This microservice hosts a Scikit-Learn `RandomForestRegressor` surrogate model for landslide risk prediction.

## Scientific Honesty & Architecture Role

- **Surrogate Model Role:** As documented in `docs/data_sources.md`, this prototype does not fabricate claims of real sensor ground truth. The Random Forest surrogate model is trained systematically across the 5-factor normalized parameter space to demonstrate the production model-serving pipeline, inference latency, and failover mechanics.
- **Internal Only:** The browser **never** communicates with this service directly. All calls are routed from Node/Express over internal loopback networking (`127.0.0.1:8000`).
- **Failover Seam:** If this microservice is unreachable or shut down, Node/Express automatically and silently falls back to the in-process deterministic risk engine with zero downtime.

## Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/predict` | POST | Run surrogate model prediction on input features with domain clamping |
| `/health` | GET | Service health and model status metadata |

## Directory Structure

```
ml-service/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI application
│   ├── schemas.py       # Pydantic request/response schemas
│   └── constants.py     # Domain bounds, weights, and risk thresholds
├── training/
│   ├── __init__.py
│   └── train.py         # Surrogate training script (50k samples, R² > 0.99)
├── models/              # Model artifacts (.joblib, generated during build, gitignored)
├── test_app.py          # Pytest test suite
├── Dockerfile           # Python 3.11-slim container with build-time training
├── requirements.txt
└── README.md
```

## Running Locally

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Train surrogate model (required before first local run or pytest)
python training/train.py

# 3. Run unit tests
pytest test_app.py

# 4. Start local development server
uvicorn app.main:app --host 127.0.0.1 --port 8000
```
