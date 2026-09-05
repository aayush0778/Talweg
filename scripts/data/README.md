# TALWEG Real-Data Ingestion Scaffold (Phase P0.1)

This directory contains scripts for ingesting real historical data into the TALWEG pipeline.

## Data Sources
- **NASA GLC**: Global Landslide Catalog containing real historical landslide events.
- **CHIRPS**: Climate Hazards Group InfraRed Precipitation with Station data, providing daily rainfall observations.

## Workflow
All scripts accept **LOCAL** downloaded files. No runtime downloads are performed to ensure stability and reproducibility.
The workflow is:
1. **Download**: Manually download raw CSV files from NASA and CHIRPS.
2. **Validate**: Scripts enforce required columns and formats.
3. **Normalize**: Dates convert to ISO format, coordinates filter to the Sikkim bounding box (lat 27.0-28.2, lon 88.0-89.0).
4. **Tag Provenance**: Records receive tags (`provenance: 'REAL'` or `'DERIVED'`) and source identifiers.
5. **Output**: Clean JSON and SQL files are generated for downstream use.

## Expected Input CSV Schemas

### NASA GLC
- `event_date` (or `date`)
- `latitude` (or `lat`)
- `longitude` (or `lon`)
- `trigger`
- `category`
- `country`
- `admin_region` (or `state`/`region`)

### CHIRPS
- `date`
- `latitude` (or `lat`)
- `longitude` (or `lon`)
- `precipitation_mm` (or `precip`)

## Usage Examples

```bash
# 1. Ingest NASA GLC data
python import_nasa_glc.py --input raw_glc.csv --output clean_glc.json

# 2. Ingest CHIRPS data
python import_chirps.py --input raw_chirps.csv --output clean_chirps.json

# 3. Build historical replay records (JSON and SQL)
python build_historical_replay.py --events clean_glc.json --rainfall clean_chirps.json --output replay.sql --json-output replay.json
```
