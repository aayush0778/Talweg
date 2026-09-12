import { z } from 'zod';

const idRegex = /^[a-zA-Z0-9_-]+$/;

export const idSchema = z
  .string({ required_error: 'ID is required' })
  .min(1, 'ID cannot be empty')
  .max(50, 'ID cannot exceed 50 characters')
  .regex(idRegex, 'ID may only contain alphanumeric characters, underscores, and dashes');

export const zoneIdParamSchema = z.object({
  zoneId: idSchema,
});

export const idParamSchema = z.object({
  id: idSchema,
});

export const zonesQuerySchema = z
  .object({
    region_id: idSchema.optional(),
  })
  .strict();

export const eventsQuerySchema = z
  .object({
    region_id: idSchema.optional(),
    zone_id: idSchema.optional(),
    limit: z.coerce.number().int().min(1).max(500).default(200),
  })
  .strict();

export const riskBodySchema = z
  .object({
    zone_id: idSchema,
    rainfall_24h: z
      .number({ invalid_type_error: 'rainfall_24h must be a number' })
      .min(0, 'rainfall_24h must be >= 0')
      .max(1000, 'rainfall_24h must be <= 1000')
      .optional(),
    rainfall_3d: z
      .number({ invalid_type_error: 'rainfall_3d must be a number' })
      .min(0, 'rainfall_3d must be >= 0')
      .max(2500, 'rainfall_3d must be <= 2500')
      .optional(),
    soil_moisture: z
      .number({ invalid_type_error: 'soil_moisture must be a number' })
      .min(0, 'soil_moisture must be >= 0')
      .max(1, 'soil_moisture must be <= 1')
      .optional(),
    slope: z
      .number({ invalid_type_error: 'slope must be a number' })
      .min(0, 'slope must be >= 0')
      .max(90, 'slope must be <= 90')
      .optional(),
    historical_density: z
      .number({ invalid_type_error: 'historical_density must be an integer' })
      .int('historical_density must be an integer')
      .min(0, 'historical_density must be >= 0')
      .max(1000, 'historical_density must be <= 1000')
      .optional(),
  })
  .strict();

export const alertsQuerySchema = z
  .object({
    status: z.enum(['active', 'acknowledged', 'resolved', 'all']).optional().default('active'),
    zone_id: idSchema.optional(),
  })
  .strict();

export const alertBodySchema = z
  .object({
    zone_id: idSchema,
    severity: z.enum(['LOW', 'MODERATE', 'HIGH', 'SEVERE']),
    risk_score: z
      .number({ invalid_type_error: 'risk_score must be a number' })
      .min(0, 'risk_score must be >= 0')
      .max(1, 'risk_score must be <= 1'),
    message: z
      .string({ required_error: 'message is required' })
      .min(1, 'message cannot be empty')
      .max(500, 'message cannot exceed 500 characters'),
    evidence: z.record(z.unknown()).optional(),
  })
  .strict();

export const copilotBodySchema = z
  .object({
    zone_id: idSchema,
    question: z
      .string({ required_error: 'Question is required' })
      .min(5, 'Question must be at least 5 characters')
      .max(500, 'Question cannot exceed 500 characters'),
  })
  .strict();

// ----- Final Upgrade schemas -----

export const predictBodySchema = z
  .object({
    zone_id: idSchema,
  })
  .strict();

export const simulateBodySchema = z
  .object({
    zone_id: idSchema,
    preset: z
      .enum([
        'baseline',
        'rainfall_plus_25',
        'rainfall_plus_50',
        'rainfall_plus_100',
        'sustained_rainfall',
        'high_antecedent',
        'wet_soil',
        'steep_slope',
        'custom',
      ])
      .optional()
      .default('custom'),
    baseline: z.boolean().optional(),
    overrides: z
      .object({
        rainfall_24h: z.number().min(0).max(1000).optional(),
        rainfall_3d: z.number().min(0).max(2500).optional(),
        rainfall_5d: z.number().min(0).max(5000).optional(),
        rainfall_7d: z.number().min(0).max(7000).optional(),
        soil_moisture: z.number().min(0).max(1).optional(),
        slope: z.number().min(0).max(90).optional(),
        historical_density: z.number().int().min(0).max(1000).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const sensitivityBodySchema = z
  .object({
    zone_id: idSchema,
    n_runs: z.number().int().min(2).max(200).optional(),
    seed: z.number().int().optional(),
  })
  .strict();

export type PredictBodyInput = z.infer<typeof predictBodySchema>;
export type SimulateBodyInput = z.infer<typeof simulateBodySchema>;
export type SensitivityBodyInput = z.infer<typeof sensitivityBodySchema>;

export type RiskBodyInput = z.infer<typeof riskBodySchema>;
export type EventsQueryInput = z.infer<typeof eventsQuerySchema>;
export type ZonesQueryInput = z.infer<typeof zonesQuerySchema>;
export type AlertsQueryInput = z.infer<typeof alertsQuerySchema>;
export type AlertBodyInput = z.infer<typeof alertBodySchema>;
export type CopilotBodyInput = z.infer<typeof copilotBodySchema>;
