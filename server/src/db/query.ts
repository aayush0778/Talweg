import { QueryResult, QueryResultRow } from 'pg';
import { pool } from './index';
import { ApiError } from '../middleware/apiError';

const DB_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  '57014', // query_canceled / statement_timeout
  '28P01', // invalid_password
  '3D000', // invalid_catalog_name
  '08000', // connection_exception
  '08003', // connection_does_not_exist
  '08006', // connection_failure
]);

export function isDbError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const error = err as { code?: string; errno?: number | string; syscall?: string };
  if (error.code && DB_ERROR_CODES.has(String(error.code))) return true;
  if (error.syscall === 'connect') return true;
  return false;
}

export function mapDbError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (isDbError(err)) {
    return ApiError.database('Database service temporarily unavailable', err);
  }
  if (err instanceof Error) {
    return ApiError.internal(err.message, err);
  }
  return ApiError.internal('Unknown database error', err);
}

import {
  FALLBACK_REGIONS,
  FALLBACK_ZONES,
  FALLBACK_EVENTS,
  FALLBACK_ALERTS,
} from './fallbackData';

function getFallbackQueryResult<R extends QueryResultRow>(
  text: string,
  params?: unknown[]
): QueryResult<R> | null {
  const normalized = text.toLowerCase().trim();

  // Regions query
  if (normalized.includes('from regions')) {
    const rows = FALLBACK_REGIONS.map((r) => ({
      id: r.id,
      name: r.name,
      state: r.state,
      geometry: r.geometry,
      min_x: r.min_x,
      min_y: r.min_y,
      max_x: r.max_x,
      max_y: r.max_y,
    })) as unknown as R[];
    return { rows, command: 'SELECT', rowCount: rows.length, oid: 0, fields: [] };
  }

  // Risk zones single check: SELECT id FROM risk_zones WHERE id = $1
  if (
    normalized.includes('from risk_zones') &&
    (normalized.includes('where id = $1') || normalized.includes('where id=$1')) &&
    normalized.includes('select id')
  ) {
    const targetId = String(params?.[0] || '');
    const found = FALLBACK_ZONES.filter((z) => z.id === targetId);
    const rows = found.map((z) => ({ id: z.id, name: z.name, base_slope: z.base_slope })) as unknown as R[];
    return { rows, command: 'SELECT', rowCount: rows.length, oid: 0, fields: [] };
  }

  // Risk zones query (all or single by id)
  if (normalized.includes('from risk_zones')) {
    let zones = FALLBACK_ZONES;
    if (normalized.includes('where z.id = $1') || normalized.includes('where ($1::text is null or z.id = $1)')) {
      if (params?.[0]) {
        zones = zones.filter((z) => z.id === String(params[0]));
      }
    } else if (normalized.includes('where ($1::text is null or z.region_id = $1)')) {
      if (params?.[0]) {
        zones = zones.filter((z) => z.region_id === String(params[0]));
      }
    }

    const rows = zones.map((z) => ({
      id: z.id,
      region_id: z.region_id,
      name: z.name,
      description: z.description,
      base_slope: z.base_slope,
      geometry: z.geometry,
      centroid_lat: z.centroid_lat,
      centroid_lng: z.centroid_lng,
      rainfall_24h: z.rainfall_24h,
      rainfall_3d: z.rainfall_3d,
      rainfall_7d: z.rainfall_7d,
      soil_moisture: z.soil_moisture,
      obs_slope: z.obs_slope,
      obs_timestamp: z.obs_timestamp,
      obs_source: z.obs_source,
      historical_density: z.historical_density,
      event_count: z.historical_density,
    })) as unknown as R[];
    return { rows, command: 'SELECT', rowCount: rows.length, oid: 0, fields: [] };
  }

  // Landslide events query
  if (normalized.includes('from landslide_events')) {
    let events = FALLBACK_EVENTS;
    const zoneId = params?.[0] ? String(params[0]) : null;
    if (zoneId) {
      events = events.filter((e) => e.zone_id === zoneId);
    }
    if (normalized.includes('count(*)')) {
      const rows = [{ event_count: events.length }] as unknown as R[];
      return { rows, command: 'SELECT', rowCount: 1, oid: 0, fields: [] };
    }
    const limit =
      typeof params?.[2] === 'number'
        ? params[2]
        : typeof params?.[1] === 'number'
        ? params[1]
        : 50;
    const rows = events.slice(0, limit).map((e) => ({
      id: e.id,
      date: e.date,
      latitude: e.latitude,
      longitude: e.longitude,
      trigger: e.trigger,
      category: e.category,
      fatalities: e.fatalities,
      description: e.description,
      source: e.source,
      geometry: e.geometry,
    })) as unknown as R[];
    return { rows, command: 'SELECT', rowCount: rows.length, oid: 0, fields: [] };
  }

  // Environmental observations query
  if (normalized.includes('from environmental_observations')) {
    const targetZone = String(params?.[0] || 'gangtok');
    const z = FALLBACK_ZONES.find((zone) => zone.id === targetZone) || FALLBACK_ZONES[0];
    const rows = [
      {
        zone_id: z.id,
        zone_name: z.name,
        timestamp: z.obs_timestamp,
        rainfall_24h: z.rainfall_24h,
        rainfall_3d: z.rainfall_3d,
        rainfall_7d: z.rainfall_7d,
        soil_moisture: z.soil_moisture,
        slope: z.obs_slope,
        source: z.obs_source,
      },
    ] as unknown as R[];
    return { rows, command: 'SELECT', rowCount: rows.length, oid: 0, fields: [] };
  }

  // Alerts query
  if (normalized.includes('from alerts')) {
    let rows = FALLBACK_ALERTS;
    let statusVal: string | null = null;
    let zoneVal: string | null = null;

    if (normalized.includes("status = 'active'")) {
      statusVal = 'active';
    }

    if (normalized.includes('where ($1::text is null or a.status = $1)')) {
      if (params?.[0]) statusVal = String(params[0]);
      if (params?.[1]) zoneVal = String(params[1]);
    } else if (normalized.includes('where zone_id = $1')) {
      if (params?.[0]) zoneVal = String(params[0]);
    }

    if (statusVal && statusVal !== 'all') {
      rows = rows.filter((a) => a.status === statusVal);
    }
    if (zoneVal) {
      rows = rows.filter((a) => a.zone_id === zoneVal);
    }
    return { rows: rows as unknown as R[], command: 'SELECT', rowCount: rows.length, oid: 0, fields: [] };
  }

  // Mutations (INSERT, UPDATE, DELETE for alerts)
  if (normalized.startsWith('insert into alerts')) {
    const newAlert = {
      id: FALLBACK_ALERTS.length + 1,
      zone_id: String(params?.[0] || ''),
      severity: String(params?.[1] || 'HIGH'),
      risk_score: Number(params?.[2] || 0.7),
      message: String(params?.[3] || ''),
      evidence_json: params?.[4] || {},
      status: String(params?.[5] || 'active'),
      created_at: new Date().toISOString(),
    };
    (FALLBACK_ALERTS as any).push(newAlert);
    return { rows: [newAlert] as unknown as R[], command: 'INSERT', rowCount: 1, oid: 0, fields: [] };
  }

  if (normalized.startsWith('delete from alerts')) {
    (FALLBACK_ALERTS as any[]).length = 0;
    return { rows: [] as unknown as R[], command: 'DELETE', rowCount: 1, oid: 0, fields: [] };
  }

  if (normalized.startsWith('update alerts')) {
    if (normalized.includes("status = 'resolved'") || normalized.includes('status = $1')) {
      const zid = params?.[1] ? String(params[1]) : (params?.[0] ? String(params[0]) : null);
      for (const a of FALLBACK_ALERTS) {
        if (!zid || a.zone_id === zid) {
          (a as any).status = 'resolved';
        }
      }
    }
    return { rows: [] as unknown as R[], command: 'UPDATE', rowCount: 1, oid: 0, fields: [] };
  }

  if (
    normalized.startsWith('insert') ||
    normalized.startsWith('update') ||
    normalized.startsWith('delete')
  ) {
    return { rows: [] as unknown as R[], command: 'OK', rowCount: 1, oid: 0, fields: [] };
  }

  return null;
}

/**
 * Parameterized query helper using the shared PostgreSQL pool.
 * Automatically catches database connection/timeout failures, falling back to
 * in-memory seed catalog if offline, or maps to 503 ApiError.database.
 */
export async function query<R extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<R>> {
  try {
    return await pool.query<R>(text, params);
  } catch (err) {
    if (isDbError(err)) {
      const fallback = getFallbackQueryResult<R>(text, params);
      if (fallback) return fallback;
    }
    throw mapDbError(err);
  }
}
