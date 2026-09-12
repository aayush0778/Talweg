/**
 * Data Source Registry (Final Upgrade Spec §5.3, §26)
 *
 * Canonical catalog of every environmental source TALWEG knows about,
 * with status and provenance. Used by GET /api/data-sources and the
 * Data & Sources UI page.
 *
 * HONESTY RULES (spec §26):
 * - Never show LIVE unless the application actually receives a live feed.
 * - Every registry entry carries a provenance class:
 *   REAL (a real published dataset we ingest), SYNTHETIC (demo values),
 *   UNAVAILABLE (known source, not yet connected).
 */

import { query } from '../db/query';

export type DataSourceStatus =
  | 'LIVE'
  | 'RECENT'
  | 'HISTORICAL'
  | 'DERIVED'
  | 'SYNTHETIC'
  | 'UNAVAILABLE';

export type SourceProvenance = 'REAL' | 'DERIVED' | 'SYNTHETIC';

export interface DataSourceInfo {
  id: string;
  name: string;
  type: string;
  provider: string;
  /** What TALWEG currently ingests from it */
  usage: string;
  last_update: string | null;
  update_frequency: string;
  spatial_resolution: string;
  temporal_resolution: string;
  coverage: string;
  status: DataSourceStatus;
  provenance: SourceProvenance;
  license: string | null;
  citation: string | null;
}

/**
 * Canonical registry. `status` describes what TALWEG actually receives:
 * - CHIRPS: ingested via scripts/data/import_chirps.py for replay anchors → HISTORICAL/RECENT
 *   (no live feed connected; ~6 week calibration latency means never LIVE in this prototype).
 * - NASA GLC: real published inventory, static → HISTORICAL.
 * - SRTM DEM: real DEM used for slope/terrain derivation → HISTORICAL (static snapshot).
 * - SoilGrids: real global soil product; prototype values for Sikkim are demo estimates → UNAVAILABLE
 *   (real ingestion not wired yet; UI must not claim REAL soil).
 * - IMD station records: cited for real replay anchors, not auto-ingested → HISTORICAL.
 * - In-zone environmental observations (seeded demo telemetry) → SYNTHETIC.
 */
export const CANONICAL_SOURCES: DataSourceInfo[] = [
  {
    id: 'chirps',
    name: 'CHIRPS Satellite Precipitation',
    type: 'satellite_precipitation',
    provider: 'UCSB Climate Hazards Center / NASA SERVIR',
    usage: 'Daily rainfall observations for verified historical replay anchors',
    last_update: null,
    update_frequency: 'daily (product); ingested per-event in this prototype',
    spatial_resolution: '~5 km (0.05°)',
    temporal_resolution: 'daily',
    coverage: 'Sikkim / NER (event windows)',
    status: 'HISTORICAL',
    provenance: 'REAL',
    license: 'Open (CHIRPS)',
    citation: 'Funk et al., 2015 — Climate Hazards Group InfraRed Precipitation with Station data',
  },
  {
    id: 'imd-stations',
    name: 'IMD Station Rain Gauge Records',
    type: 'in_situ_gauges',
    provider: 'India Meteorological Department',
    usage: 'Cited gauge observations for the 2023-10-04 Mangan replay anchor',
    last_update: null,
    update_frequency: 'daily (product); manually cited in this prototype',
    spatial_resolution: 'station point',
    temporal_resolution: 'daily',
    coverage: 'Selected Sikkim stations',
    status: 'HISTORICAL',
    provenance: 'REAL',
    license: 'Government of India (research use)',
    citation: 'IMD published station records (cited per replay record)',
  },
  {
    id: 'nasa-glc',
    name: 'NASA Global Landslide Catalog',
    type: 'inventory',
    provider: 'NASA Goddard',
    usage: 'Verified historical landslide event points (Sikkim subset)',
    last_update: null,
    update_frequency: 'static snapshot',
    spatial_resolution: 'event point (location precision recorded per event)',
    temporal_resolution: 'per-event',
    coverage: 'Sikkim / NER subset',
    status: 'HISTORICAL',
    provenance: 'REAL',
    license: 'Open (NASA GLC)',
    citation: 'NASA Global Landslide Catalog, https://data.nasa.gov (GLC)',
  },
  {
    id: 'srtm-dem',
    name: 'SRTM 30m DEM',
    type: 'dem_topography',
    provider: 'USGS / NASA',
    usage: 'Slope and terrain derivation for zones and replay anchors',
    last_update: null,
    update_frequency: 'static snapshot',
    spatial_resolution: '30 m',
    temporal_resolution: 'static (SRTM mission)',
    coverage: 'Sikkim zone polygons',
    status: 'HISTORICAL',
    provenance: 'REAL',
    license: 'Open (USGS Earth Explorer)',
    citation: 'Shuttle Radar Topography Mission (SRTM) 1 Arc-Second Global',
  },
  {
    id: 'soilgrids',
    name: 'SoilGrids / ISRIC Soil Products',
    type: 'soil',
    provider: 'ISRIC World Soil Information',
    usage: 'Soil texture/depth parameter hierarchy target (not yet ingested — demo values used)',
    last_update: null,
    update_frequency: 'static snapshot (product)',
    spatial_resolution: '250 m (product)',
    temporal_resolution: 'static',
    coverage: 'Global (Sikkim of interest)',
    status: 'UNAVAILABLE',
    provenance: 'REAL',
    license: 'Open (CC-BY 4.0)',
    citation: 'ISRIC SoilGrids 2.0 (Poggio et al., 2021)',
  },
  {
    id: 'sentinel-2',
    name: 'Sentinel-2 NDVI (land cover / vegetation)',
    type: 'satellite_optical',
    provider: 'ESA Copernicus',
    usage: 'Vegetation/land-cover feature family target (not yet ingested)',
    last_update: null,
    update_frequency: '5-day revisit (product)',
    spatial_resolution: '10–20 m',
    temporal_resolution: '5-day',
    coverage: 'Sikkim / NER',
    status: 'UNAVAILABLE',
    provenance: 'REAL',
    license: 'Open (Copernicus)',
    citation: 'Copernicus Sentinel-2 MSI',
  },
  {
    id: 'seed-telemetry',
    name: 'In-zone Environmental Observations (demo)',
    type: 'in_situ_sensors',
    provider: 'TALWEG seed dataset',
    usage: 'Zone rainfall / soil-moisture telemetry used by predictions when DB is live',
    last_update: null,
    update_frequency: 'per seed run',
    spatial_resolution: 'zone centroid',
    temporal_resolution: 'snapshot',
    coverage: '6 Sikkim risk zones',
    status: 'SYNTHETIC',
    provenance: 'SYNTHETIC',
    license: 'n/a (demo data)',
    citation: 'TALWEG synthetic seed (representative monsoon conditions)',
  },
  {
    id: 'sikkim-threshold',
    name: 'Sikkim Regional Rainfall Threshold',
    type: 'derived_threshold',
    provider: 'Published regional intensity–duration study',
    usage: 'I = 43.26 × D^-0.78 (mm/day) — deterministic rainfall safety engine',
    last_update: null,
    update_frequency: 'static (published relationship)',
    spatial_resolution: 'regional (Sikkim Himalaya)',
    temporal_resolution: 'duration-based (D = 1/3/5/7 days)',
    coverage: 'Sikkim Himalaya',
    status: 'DERIVED',
    provenance: 'REAL',
    license: 'citation-only',
    citation: 'Regional Sikkim intensity–duration threshold: I = 43.26 * D^-0.78 (mm/day)',
  },
];

/**
 * List all registered data sources. Merges any DB-side last-update stamps
 * (data_sources.last_ingest_at) with the canonical registry; the in-code
 * registry is authoritative for honesty fields (status/provenance).
 */
export async function listDataSources(): Promise<DataSourceInfo[]> {
  const dbStamps = new Map<string, { last_update: string | null; status: string | null }>();
  try {
    const { rows } = await query<{ id: string; last_ingest_at: Date | string | null; status: string | null }>(
      `SELECT id, last_ingest_at, status FROM data_sources;`
    );
    for (const r of rows) {
      dbStamps.set(r.id, {
        last_update: r.last_ingest_at ? new Date(r.last_ingest_at).toISOString() : null,
        status: r.status ?? null,
      });
    }
  } catch {
    // DB unavailable (in-memory demo mode) — registry still served from code
  }

  return CANONICAL_SOURCES.map((s) => {
    const stamp = dbStamps.get(s.id);
    return {
      ...s,
      last_update: stamp?.last_update ?? s.last_update,
    };
  });
}
