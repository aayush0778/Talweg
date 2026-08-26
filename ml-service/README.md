# ML Service — FastAPI

> **Status: NOT IMPLEMENTED** — this is a Phase 5 scaffold.

This service will host the trained Random Forest model for landslide risk prediction.

## Architecture Role

- Node/Express calls `POST /predict` internally
- The browser **never** communicates with this service directly
- If this service is unavailable, Node falls back to the deterministic heuristic

## Planned Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/predict` | POST | Run the trained model on input features |
| `/health` | GET | Service health check |

## Directory Structure (planned)

```
ml-service/
├── app/
│   ├── main.py          # FastAPI app
│   ├── model.py          # Model loading + prediction
│   └── schemas.py        # Pydantic request/response schemas
├── training/
│   ├── data_pipeline.py  # Data cleaning + feature engineering
│   ├── train.py          # Model training
│   └── evaluate.py       # Evaluation + metrics
├── models/               # Saved model artifacts (.joblib)
├── requirements.txt
└── README.md
```
