import { pool } from '../db/index';
import { calculateRisk } from './riskEngine';
import { BACKTEST_EVENTS } from './backtestScenarios';
import {
  HistoricalReplayListItem,
  HistoricalReplayResponse,
  ValidationSummaryResponse,
  HistoricalReplayValidation,
  ProvenanceInfo
} from '../types/api';

/**
 * Get the replay classification based on source and data quality.
 */
export function getReplayStatus(source: string, dataQuality: string): HistoricalReplayValidation {
  if (dataQuality === 'real_replay') {
    return {
      status: 'real_replay',
      caveat: 'Environmental inputs were reconstructed from verified historical datasets.',
    };
  }
  if (source === 'synthetic_seed') {
    return {
      status: 'synthetic_demo',
      caveat: 'Representative synthetic conditions; not recorded historical weather.',
    };
  }
  return {
    status: 'methodology_only',
    caveat: 'Insufficient verified historical environmental ground truth.',
  };
}

/**
 * Build provenance info for a value based on the data source.
 */
function buildProvenance(source: string, dataQuality: string): ProvenanceInfo {
  if (dataQuality === 'real_replay') {
    return { type: 'REAL', source, note: 'Sourced from verified historical dataset' };
  }
  if (source === 'synthetic_seed') {
    return { type: 'SYNTHETIC', source, note: 'Representative trigger-day conditions for demo' };
  }
  return { type: 'DERIVED', source, note: 'Calculated from available data sources' };
}

/**
 * List all historical replay records.
 * Falls back to in-memory BACKTEST_EVENTS if the table doesn't exist yet.
 */
export async function listHistoricalReplays(): Promise<HistoricalReplayListItem[]> {
  try {
    const result = await pool.query(
      `SELECT id, event_id, event_date, latitude, longitude, zone_id, source, data_quality, actual_event, data_notes
       FROM historical_event_replays
       ORDER BY event_date DESC`
    );
    if (result.rows.length > 0) return result.rows;
  } catch {
    // Table may not exist yet — fall through to in-memory fallback
  }
  
  // Fallback: build from BACKTEST_EVENTS
  return BACKTEST_EVENTS.map(evt => ({
    id: `replay-${evt.id}`,
    event_id: evt.id,
    event_date: evt.date,
    latitude: 0, // Not available in backtest events
    longitude: 0,
    zone_id: evt.zoneId,
    source: 'synthetic_seed',
    data_quality: 'synthetic_demo',
    actual_event: true,
    data_notes: evt.description,
  }));
}

/**
 * Get a single replay record by ID.
 */
export async function getHistoricalReplayById(id: string): Promise<HistoricalReplayListItem | null> {
  try {
    const result = await pool.query(
      `SELECT id, event_id, event_date, latitude, longitude, zone_id, source, data_quality, actual_event, data_notes
       FROM historical_event_replays
       WHERE id = $1`,
      [id]
    );
    if (result.rows.length > 0) return result.rows[0];
  } catch {
    // Table may not exist
  }
  
  // Fallback: check BACKTEST_EVENTS
  const backtestId = id.startsWith('replay-') ? id.slice(7) : id;
  const evt = BACKTEST_EVENTS.find(e => e.id === backtestId);
  if (!evt) return null;
  
  return {
    id: `replay-${evt.id}`,
    event_id: evt.id,
    event_date: evt.date,
    latitude: 0,
    longitude: 0,
    zone_id: evt.zoneId,
    source: 'synthetic_seed',
    data_quality: 'synthetic_demo',
    actual_event: true,
    data_notes: evt.description,
  };
}

/**
 * Run a full historical replay for a given record.
 * Evaluates the environmental inputs through the deterministic risk engine
 * and returns the complete assessment with provenance.
 */
export async function replayHistoricalEvent(id: string): Promise<HistoricalReplayResponse | null> {
  // Try DB first
  let record: any = null;
  try {
    const result = await pool.query(
      `SELECT * FROM historical_event_replays WHERE id = $1`,
      [id]
    );
    if (result.rows.length > 0) record = result.rows[0];
  } catch {
    // Table may not exist
  }

  // Fallback to backtest
  if (!record) {
    const backtestId = id.startsWith('replay-') ? id.slice(7) : id;
    const evt = BACKTEST_EVENTS.find(e => e.id === backtestId);
    if (!evt) return null;
    
    record = {
      id: `replay-${evt.id}`,
      event_id: evt.id,
      event_date: evt.date,
      latitude: 0,
      longitude: 0,
      zone_id: evt.zoneId,
      source: 'synthetic_seed',
      rainfall_24h: evt.input.rainfall_24h,
      rainfall_3d: evt.input.rainfall_3d,
      rainfall_7d: null,
      soil_moisture: evt.input.soil_moisture,
      slope: evt.input.slope,
      historical_density: evt.input.historical_density,
      data_quality: 'synthetic_demo',
      data_notes: evt.description,
      actual_event: true,
      category: evt.category,
      zone_name: evt.zoneName,
    };
  }

  const source = record.source || 'synthetic_seed';
  const dataQuality = record.data_quality || 'synthetic_demo';
  const provenance = buildProvenance(source, dataQuality);

  // Run through deterministic risk engine
  const riskInput = {
    rainfall_24h: record.rainfall_24h ?? 0,
    rainfall_3d: record.rainfall_3d ?? 0,
    soil_moisture: record.soil_moisture ?? 0,
    slope: record.slope ?? 0,
    historical_density: record.historical_density ?? 0,
  };

  const riskResult = calculateRisk(riskInput);
  const flagged = riskResult.risk_level === 'HIGH' || riskResult.risk_level === 'SEVERE';

  // Look up event category from backtest if not in record
  const backtestEvt = BACKTEST_EVENTS.find(e => e.id === record.event_id);
  const category = record.category || backtestEvt?.category || 'landslide';
  const description = record.data_notes || backtestEvt?.description || '';

  return {
    id: record.id,
    event: {
      date: record.event_date,
      latitude: record.latitude,
      longitude: record.longitude,
      category,
      description,
      source: {
        type: provenance.type,
        source: source,
        note: dataQuality === 'synthetic_demo'
          ? 'Synthetic seed event for demonstration'
          : 'Historical event record',
      },
    },
    inputs: {
      rainfall_24h: { value: record.rainfall_24h, provenance },
      rainfall_3d: { value: record.rainfall_3d, provenance },
      rainfall_7d: { value: record.rainfall_7d, provenance },
      soil_moisture: { value: record.soil_moisture, provenance },
      slope: { value: record.slope, provenance: { ...provenance, type: 'DERIVED', note: 'Derived from zone base slope or DEM' } },
      historical_density: { value: record.historical_density, provenance: { ...provenance, type: 'DERIVED', note: 'Count of historical events in this zone' } },
    },
    talweg: {
      risk_score: riskResult.risk_score,
      risk_level: riskResult.risk_level,
      engine: riskResult.engine,
      flagged,
      contributing_factors: riskResult.contributing_factors.map(f => ({
        factor: f.factor,
        contribution: f.contribution,
      })),
    },
    validation: getReplayStatus(source, dataQuality),
  };
}

/**
 * Build validation summary without fabricating metrics.
 * If fewer than 20 real labeled events exist, returns methodology_only.
 */
export async function buildValidationSummary(): Promise<ValidationSummaryResponse> {
  let realCount = 0;
  let syntheticCount = 0;

  try {
    const realResult = await pool.query(
      `SELECT COUNT(*) FROM historical_event_replays WHERE data_quality = 'real_replay'`
    );
    realCount = parseInt(realResult.rows[0].count, 10);

    const syntheticResult = await pool.query(
      `SELECT COUNT(*) FROM historical_event_replays WHERE data_quality = 'synthetic_demo'`
    );
    syntheticCount = parseInt(syntheticResult.rows[0].count, 10);
  } catch {
    // Table may not exist — use backtest count as synthetic
    syntheticCount = BACKTEST_EVENTS.length;
  }

  const methodologyCount = BACKTEST_EVENTS.length;

  if (realCount < 20) {
    return {
      status: 'methodology_only',
      real_replay_count: realCount,
      synthetic_replay_count: syntheticCount,
      methodology_count: methodologyCount,
      metrics: null,
      reason: 'Insufficient verified historical environmental ground truth.',
    };
  }

  // If we ever get 20+ real events, calculate real metrics here
  // For now, this code path won't be reached with the prototype data
  return {
    status: 'methodology_only',
    real_replay_count: realCount,
    synthetic_replay_count: syntheticCount,
    methodology_count: methodologyCount,
    metrics: null,
    reason: 'Insufficient verified historical environmental ground truth.',
  };
}
