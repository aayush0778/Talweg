# Deploying Talweg on Railway

This guide walks you through deploying the complete **Talweg** stack on [Railway](https://railway.app).

---

## Architecture Overview

```
[ Browser ] ─── HTTPS ───> [ Talweg Client (React/Vite) ]
                               │
                               │ REST API (VITE_API_URL)
                               v
                         [ Talweg API Server (Express) ]
                               │                 │
             Private Network   │                 │ PostgreSQL connection
         (ML_SERVICE_URL:8000) │                 v
                               v           [ PostGIS Database ]
                    [ ML Surrogate Model ]
                       (FastAPI / PyTorch)
```

---

## Step 1: Create a Railway Project

1. Go to [railway.app](https://railway.app) and sign in.
2. Click **+ New Project** and select **Deploy from GitHub repo**.
3. Choose your repository: `aayush0778/Talweg` (or your fork).

---

## Step 2: Provision PostgreSQL with PostGIS

1. In your Railway project canvas, click **+ Create** $\rightarrow$ **Database** $\rightarrow$ **Add PostgreSQL**.
2. Once the database is provisioned, click on it and open the **Connect** or **Data** tab.
3. Open the query editor or run using any PostgreSQL client to enable the PostGIS extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
4. Copy the `DATABASE_URL` from the **Variables** tab (it will look like `postgresql://postgres:...@...railway.app:5432/railway`).

---

## Step 3: Deploy the ML Service (`ml-service`)

1. Click **+ Create** $\rightarrow$ **GitHub Repo** $\rightarrow$ select `Talweg`.
2. Go to the new service's **Settings** tab:
   - **Service Name**: rename to `talweg-ml`.
   - **Root Directory**: set to `/ml-service`.
   - **Build**: Railway will automatically detect `ml-service/Dockerfile`.
3. In the **Variables** tab, add:
   - `PORT`: `8000`
4. Under **Settings** $\rightarrow$ **Networking**, generate a private domain or note the internal hostname: `talweg-ml.railway.internal` (or `talweg-ml`).

---

## Step 4: Deploy the Express API Server (`server`)

1. Click **+ Create** $\rightarrow$ **GitHub Repo** $\rightarrow$ select `Talweg`.
2. Go to the new service's **Settings** tab:
   - **Service Name**: rename to `talweg-server`.
   - **Root Directory**: set to `/server`.
3. In the **Variables** tab, add the following environment variables:
   - `PORT`: (Railway provides this automatically, server defaults to 3001 if unset)
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: `${{Postgres.DATABASE_URL}}` (or paste your database connection string)
   - `ML_SERVICE_URL`: `talweg-ml` (or `http://talweg-ml.railway.internal:8000`)
   - `ML_SERVICE_PORT`: `8000`
   - `RISK_ENGINE_MODE`: `ml` (falls back to `deterministic` automatically if ML service is unreachable)
   - `LLM_API_KEY`: *(optional)* OpenAI or compatible API key for LLM-powered Copilot answers
   - `LLM_MODEL`: `gpt-4o-mini` *(optional)*
4. Run migrations and seed data:
   - Open the service's **Deployments** tab, click the active deployment, open the **Terminal** tab, and run:
     ```bash
     npm run migrate:prod
     npm run seed:prod
     ```
5. Under **Settings** $\rightarrow$ **Networking**, click **Generate Domain** (e.g. `https://talweg-server-production.up.railway.app`).

---

## Step 5: Deploy the Web Client (`client`)

1. Click **+ Create** $\rightarrow$ **GitHub Repo** $\rightarrow$ select `Talweg`.
2. Go to the service's **Settings** tab:
   - **Service Name**: rename to `talweg-client`.
   - **Root Directory**: set to `/client`.
3. In the **Variables** tab, configure the client environment variables:
   - `VITE_API_URL`: your server public URL from Step 4 (e.g. `https://talweg-server-production.up.railway.app`)
   - `VITE_TERRAIN_DEM_URL`: *(optional)* raster-DEM elevation tile URL template. Defaults automatically to AWS Terrarium (`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`).
4. Under **Settings** $\rightarrow$ **Networking**, click **Generate Domain** (e.g. `https://talweg-client-production.up.railway.app`).

---

## Verifying the Deployment

### Automated Smoke Test (Handbook P1 Verification)
Run the automated deployment verification script against your deployed URLs:
```bash
python scripts/deploy_smoke_test.py \
  --server https://talweg-server-production.up.railway.app \
  --client https://talweg-client-production.up.railway.app
```
This tests 8 critical capabilities:
1. **Client App Bundle**: HTTP 200 with complete HTML5 entrypoint.
2. **API Health Status**: PostgreSQL and PostGIS connectivity verified.
3. **Regions & Spatial Bounds**: GeoJSON polygons and Sikkim bounding box.
4. **Risk Zones Inventory**: All monitored corridors loaded.
5. **Historical Replays List**: Seeded replays list reachable.
6. **Verified Real Event Replay**: Reconstructs the October 4, 2023 North Sikkim debris flow (NASA GLC #15243) with REAL IMD rainfall, DERIVED slope, and returns `WOULD HAVE FLAGGED: YES`.
7. **Truthful Validation Summary**: Confirms `status: 'methodology_only'` without fabricating premature metrics.
8. **3D Terrain Raster DEM Tile**: Verifies raster elevation tile availability.

### Manual Verification Checklist
1. Visit your client URL in the browser (`https://talweg-client-production.up.railway.app`).
2. Verify:
   - **Top View**: State-wide nadir overview (`pitch: 0`) showing all 6 Sikkim risk zones.
   - **Zone Inspection**: Click **North Sikkim (Mangan)** to view live telemetry and factor breakdown without losing Top View framing.
   - **3D Terrain**: Click **3D Terrain** in top-left controls to tilt camera to $55^\circ$ with elevation relief.
   - **Historical Replay**: Click **Replay** on the October 4, 2023 event card. Verify green **REAL** provenance badges, **WOULD HAVE FLAGGED: YES**, and the escalation timeline.
   - **Talweg Copilot**: Click suggested prompt chips (*"Why is this zone high risk?"*, *"Would TALWEG have flagged this event?"*, *"Show me this terrain in 3D"*) to test grounded answers.
