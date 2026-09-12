/**
 * Final Upgrade Routes (TALWEG Final Upgrade Specification §28)
 *
 * Spec-conformant endpoints (additive — existing routes unchanged):
 *   GET  /zones                       (alias of /risk-zones)
 *   GET  /zones/:id                   (alias of /risk-zones/:id)
 *   GET  /zones/:id/risk              canonical hybrid risk
 *   GET  /zones/:id/features          canonical FeatureRecord (provenance per value)
 *   POST /predict                     canonical hybrid prediction (§16 shape)
 *   POST /simulate                    baseline vs scenario + delta (§28)
 *   POST /simulate/sensitivity        controlled perturbation runs (§17.4)
 *   GET  /simulations/presets         scenario preset catalog
 *   GET  /data-sources                source registry with status/provenance (§26)
 *   GET  /model                       model card/mode/governance (§25)
 *   GET  /system-health               honest component health (§27)
 *   GET  /historical-events           event registry (alias of /historical-replays)
 *   GET  /historical-events/:id/replay  replay + T-7d→Event timeline (§18)
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { ApiError } from '../middleware/apiError';
import {
  predictBodySchema,
  simulateBodySchema,
  sensitivityBodySchema,
  idParamSchema,
  zonesQuerySchema,
} from '../validation/schemas';
import { composeHybrid } from '../services/hybridComposer';
import { resolveZoneRiskInputs } from '../services/zoneRiskInputs';
import { buildZoneFeatureRecord } from '../services/featureBuilder';
import {
  runScenario,
  runSensitivity,
  SCENARIO_PRESETS,
} from '../services/simulation';
import { listDataSources } from '../services/dataSources';
import { getModelInfo } from '../services/modelRegistry';
import { getSystemHealth } from '../services/systemHealth';
import { listHistoricalReplays, replayHistoricalEvent } from '../services/historicalReplay';
import { buildReplayTimeline } from '../services/replayTimeline';
import { FEATURE_SCHEMA_VERSION } from '../schemas/featureSchema';
import { listRiskZonesService, getRiskZoneService } from './riskZones';

const router = Router();

// ----- Zones (spec §28 aliases + extensions) -----

router.get(
  '/zones',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = zonesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw ApiError.badRequest('Invalid query parameters', 'VALIDATION_ERROR', parsed.error.format());
    }
    const zones = await listRiskZonesService(parsed.data.region_id || null);
    res.json(zones);
  })
);

router.get(
  '/zones/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) {
      throw ApiError.badRequest('Invalid zone ID parameter', 'VALIDATION_ERROR', parsed.error.format());
    }
    const zone = await getRiskZoneService(parsed.data.id);
    res.json(zone);
  })
);

router.get(
  '/zones/:id/risk',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) {
      throw ApiError.badRequest('Invalid zone ID parameter', 'VALIDATION_ERROR', parsed.error.format());
    }
    const resolved = await resolveZoneRiskInputs(parsed.data.id);
    if (!resolved.context) {
      throw ApiError.notFound(`Risk zone '${parsed.data.id}' not found`, 'ZONE_NOT_FOUND');
    }
    if (!resolved.ok || !resolved.input) {
      throw ApiError.notFound(
        `Insufficient environmental observation data for zone '${parsed.data.id}'. Missing: ${resolved.missing.join(', ')}`,
        'ENVIRONMENT_NOT_FOUND'
      );
    }
    const risk = await composeHybrid(resolved.input, {
      provenanceByFeature: resolved.provenanceByFeature,
      rainfallProvenance: resolved.rainfallProvenance,
      rainfallSourceId: resolved.rainfallSourceId,
    });
    res.json({ zone_id: resolved.context.zone_id, zone_name: resolved.context.zone_name, ...risk });
  })
);

router.get(
  '/zones/:id/features',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) {
      throw ApiError.badRequest('Invalid zone ID parameter', 'VALIDATION_ERROR', parsed.error.format());
    }
    const built = await buildZoneFeatureRecord(parsed.data.id);
    if (!built) {
      throw ApiError.notFound(`Risk zone '${parsed.data.id}' not found`, 'ZONE_NOT_FOUND');
    }
    res.json({
      ...built.record,
      demo_fallback_mode: built.fallback_mode,
      rainfall_provenance: built.rainfall_provenance,
    });
  })
);

// ----- Canonical prediction (§16/§28) -----

router.post(
  '/predict',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = predictBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest('Invalid prediction payload', 'VALIDATION_ERROR', parsed.error.format());
    }
    const resolved = await resolveZoneRiskInputs(parsed.data.zone_id);
    if (!resolved.context) {
      throw ApiError.notFound(`Risk zone '${parsed.data.zone_id}' not found`, 'ZONE_NOT_FOUND');
    }
    if (!resolved.ok || !resolved.input) {
      throw ApiError.notFound(
        `Insufficient environmental observation data for zone '${parsed.data.zone_id}'. Missing: ${resolved.missing.join(', ')}`,
        'ENVIRONMENT_NOT_FOUND'
      );
    }
    const risk = await composeHybrid(resolved.input, {
      provenanceByFeature: resolved.provenanceByFeature,
      rainfallProvenance: resolved.rainfallProvenance,
      rainfallSourceId: resolved.rainfallSourceId,
    });
    res.json({ zone_id: resolved.context.zone_id, zone_name: resolved.context.zone_name, ...risk });
  })
);

// ----- Simulation (§17/§28) -----

router.get('/simulations/presets', (_req: Request, res: Response) => {
  res.json({
    presets: SCENARIO_PRESETS.map((p) => ({ id: p.id, label: p.label, description: p.description })),
  });
});

router.post(
  '/simulate',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = simulateBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest('Invalid simulation payload', 'VALIDATION_ERROR', parsed.error.format());
    }
    const { zone_id, preset } = parsed.data;
    // Named presets expand internally against the zone baseline
    // (request overrides win on conflicts) — see services/simulation.ts.
    const result = await runScenario(zone_id, preset, { ...(parsed.data.overrides ?? {}) });
    if (!result) {
      throw ApiError.notFound(
        `Insufficient environmental observation data for zone '${zone_id}'`,
        'ENVIRONMENT_NOT_FOUND'
      );
    }
    res.json(result);
  })
);

router.post(
  '/simulate/sensitivity',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = sensitivityBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest('Invalid sensitivity payload', 'VALIDATION_ERROR', parsed.error.format());
    }
    const result = await runSensitivity(
      parsed.data.zone_id,
      parsed.data.n_runs,
      parsed.data.seed ?? 42
    );
    if (!result) {
      throw ApiError.notFound(
        `Insufficient environmental observation data for zone '${parsed.data.zone_id}'`,
        'ENVIRONMENT_NOT_FOUND'
      );
    }
    res.json(result);
  })
);

// ----- Data sources (§26) -----

router.get(
  '/data-sources',
  asyncHandler(async (_req: Request, res: Response) => {
    const sources = await listDataSources();
    res.json({ sources, feature_schema_version: FEATURE_SCHEMA_VERSION });
  })
);

// ----- Model (§25) -----

router.get(
  '/model',
  asyncHandler(async (_req: Request, res: Response) => {
    const info = await getModelInfo(FEATURE_SCHEMA_VERSION);
    res.json(info);
  })
);

// ----- System health (§27) -----

router.get(
  '/system-health',
  asyncHandler(async (_req: Request, res: Response) => {
    const health = await getSystemHealth();
    res.json(health);
  })
);

// ----- Historical events (§9/§18 aliases with timeline) -----

router.get(
  '/historical-events',
  asyncHandler(async (_req: Request, res: Response) => {
    const events = await listHistoricalReplays();
    res.json(events);
  })
);

router.get(
  '/historical-events/:id/replay',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) {
      throw ApiError.badRequest('Invalid event ID parameter', 'VALIDATION_ERROR', parsed.error.format());
    }
    const replay = await replayHistoricalEvent(parsed.data.id);
    if (!replay) {
      throw ApiError.notFound(`Historical event '${parsed.data.id}' not found`, 'EVENT_NOT_FOUND');
    }
    // Extract numeric inputs for the timeline (nulls → 0 for engine; the
    // engine itself is only run on aggregates that exist in the record).
    const numeric = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const timeline = buildReplayTimeline({
      rainfall_24h: numeric(replay.inputs.rainfall_24h.value),
      rainfall_3d: numeric(replay.inputs.rainfall_3d.value),
      rainfall_7d: numeric(replay.inputs.rainfall_7d.value),
      soil_moisture: numeric(replay.inputs.soil_moisture.value),
      slope: numeric(replay.inputs.slope.value),
      historical_density: numeric(replay.inputs.historical_density.value),
      event_date: replay.event.date,
    });
    res.json({
      ...replay,
      timeline,
      replay_classification: {
        status: replay.validation.status,
        label:
          replay.validation.status === 'real_replay'
            ? 'REAL REPLAY'
            : replay.validation.status === 'methodology_only'
              ? 'METHODOLOGY ONLY'
              : 'SYNTHETIC SCENARIO',
        caveat: replay.validation.caveat,
      },
    });
  })
);

export default router;
