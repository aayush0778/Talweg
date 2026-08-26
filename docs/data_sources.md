# Data Sources & Region Selection Scorecard

## Region Selection: Sikkim

Sikkim was selected as the prototype region for the following reasons:

### Data Scorecard

| Criterion | Score (1-5) | Notes |
|---|---|---|
| Historical landslide record density | 3 | NASA GLC has global coverage; Sikkim events exist but NER is underreported relative to the Himalayan belt. GSI reports supplement. |
| Rainfall data availability | 4 | CHIRPS provides daily gridded precipitation at 0.05° resolution covering Sikkim. |
| DEM/slope availability | 5 | SRTM 30m and Copernicus 30m DEM both cover Sikkim with good resolution. |
| Soil moisture/proxy availability | 2 | Direct soil moisture ground truth is limited. Rainfall-derived proxy is feasible. |
| Spatial resolution | 4 | Small state (~7,096 km²) means 30m DEM gives fine-grained coverage. |
| Temporal coverage | 3 | CHIRPS available from 1981. NASA GLC from 2007. |
| Preprocessing effort | 4 | Small area means manageable download/processing size. |
| **Total** | **25/35** | |

### Why Sikkim is Defensible

- High landslide density along the Gangtok–NH10 corridor, Teesta valley, and Rangit basin
- Small geographic area → manageable prototype scope
- Well-documented disaster history (2011 earthquake-triggered slides, 2023 GLOF event)
- Active research interest from GSI and NDMA

### Honest Limitations

- NASA GLC may have sparse Sikkim-specific events (global catalog, NER underreported)
- Soil moisture ground truth is limited — we use a rainfall-derived proxy
- Prototype zones do not model every square kilometre with equal scientific validity

---

## Datasets

### Historical Landslide Events

| Field | Value |
|---|---|
| **Name** | NASA Global Landslide Catalog (GLC) |
| **URL** | https://catalog.data.gov/dataset/global-landslide-catalog-export |
| **Mirror** | Kaggle mirror acceptable for development |
| **License** | Public domain (NASA) |
| **Coverage** | Global, 2007–2019 |
| **Fields used** | date, latitude, longitude, trigger, landslide_category, country_name, admin_division_name |
| **Preprocessing** | Filter to country="India", admin division matching Sikkim. Parse dates. |
| **Classification** | **REAL** (when sourced from NASA GLC) or **SYNTHETIC** (when using demo seed data) |

### Terrain / Elevation

| Field | Value |
|---|---|
| **Name** | SRTM 30m DEM / Copernicus 30m DEM |
| **URL** | https://earthexplorer.usgs.gov/ or https://opentopography.org/ |
| **License** | Public domain (USGS) / ESA open access |
| **Coverage** | Sikkim bounding box (~27.0°–28.2°N, 88.0°–89.0°E) |
| **Fields derived** | elevation (m), slope (degrees) |
| **Preprocessing** | Download GeoTIFF tiles, mosaic, clip to Sikkim boundary, compute slope with GDAL. |
| **Classification** | **DERIVED** (slope computed from real DEM) |

### Rainfall

| Field | Value |
|---|---|
| **Name** | CHIRPS (Climate Hazards Group InfraRed Precipitation with Station data) |
| **URL** | https://www.chc.ucsb.edu/data/chirps |
| **License** | Open access |
| **Resolution** | 0.05° (~5.5 km), daily |
| **Coverage** | Sikkim, available from 1981 |
| **Fields used** | rainfall_24h, rainfall_3d, rainfall_7d (aggregated) |
| **Preprocessing** | Download NetCDF/GeoTIFF, clip to Sikkim, aggregate to zone centroids. |
| **Classification** | **REAL** (when sourced from CHIRPS) or **SYNTHETIC** (when using demo seed values) |

### Soil Moisture

| Field | Value |
|---|---|
| **Name** | Rainfall-derived proxy / NASA SMAP (if resolution sufficient) |
| **URL** | https://smap.jpl.nasa.gov/ |
| **Resolution** | ~9 km (SMAP) — coarse for district-level zones |
| **Fields used** | soil_moisture (0–1 normalized) |
| **Preprocessing** | If SMAP: resample to zones. Otherwise: compute proxy from cumulative rainfall. |
| **Classification** | **DERIVED** (proxy from rainfall) or **SYNTHETIC** (demo seed values) |

---

## Data Classification Rules

Every record in the database must carry a `source` field indicating provenance:

| Classification | Source field value | Meaning |
|---|---|---|
| **REAL** | `"nasa_glc"`, `"chirps"`, `"srtm"` | Directly from a published dataset |
| **DERIVED** | `"derived_slope_srtm"`, `"derived_moisture_proxy"` | Computed from real data |
| **SYNTHETIC** | `"synthetic_seed"` | Fabricated for development/demo — never presented as real |
