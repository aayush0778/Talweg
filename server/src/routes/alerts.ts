import { Router } from 'express';
import { query } from '../db/query';
import { asyncHandler } from '../middleware/asyncHandler';
import { ApiError } from '../middleware/apiError';
import { alertsQuerySchema, alertBodySchema } from '../validation/schemas';
import { AlertResponse } from '../types/api';

export const alertsRouter = Router();

interface EnhancedAlertRow {
  id: number;
  zone_id: string;
  zone_name: string;
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  risk_score: number;
  message: string;
  evidence: Record<string, unknown> | null;
  status: 'active' | 'acknowledged' | 'resolved';
  created_at: Date | string;
  alert_code?: string | null;
  trigger_summary?: string | null;
  threshold_ratio?: number | null;
  evidence_quality?: number | null;
  recommended_action?: string | null;
  expires_at?: Date | string | null;
}

function isUndefinedColumn(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { code?: string }).code === '42703');
}

alertsRouter.get(
  '/alerts',
  asyncHandler(async (req, res) => {
    const parsed = alertsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ApiError(400, 'Invalid query parameters', 'VALIDATION_ERROR', parsed.error.format());
    }

    const { status, zone_id } = parsed.data;
    const statusParam = status === 'all' ? null : status;

    const alertsWithFields = `
      SELECT
        a.id,
        a.zone_id,
        z.name AS zone_name,
        a.severity,
        a.risk_score,
        a.message,
        a.evidence_json AS evidence,
        a.status,
        a.created_at,
        a.alert_code,
        a.trigger_summary,
        a.threshold_ratio,
        a.evidence_quality,
        a.recommended_action,
        a.expires_at
      FROM alerts a
      JOIN risk_zones z ON z.id = a.zone_id
      WHERE ($1::text IS NULL OR a.status = $1)
        AND ($2::text IS NULL OR a.zone_id = $2)
      ORDER BY a.created_at DESC
      LIMIT 200;
    `;

    const legacyFields = `
      SELECT
        a.id, a.zone_id, z.name AS zone_name, a.severity, a.risk_score,
        a.message, a.evidence_json AS evidence, a.status, a.created_at
      FROM alerts a
      JOIN risk_zones z ON z.id = a.zone_id
      WHERE ($1::text IS NULL OR a.status = $1)
        AND ($2::text IS NULL OR a.zone_id = $2)
      ORDER BY a.created_at DESC
      LIMIT 200;
    `;

    let rows: EnhancedAlertRow[];
    try {
      const result = await query<EnhancedAlertRow>(alertsWithFields, [statusParam, zone_id ?? null]);
      rows = result.rows;
    } catch (err) {
      if (isUndefinedColumn(err)) {
        // Migration 006 not applied — serve legacy alert shape
        const legacy = await query<EnhancedAlertRow>(legacyFields, [statusParam, zone_id ?? null]);
        rows = legacy.rows;
      } else {
        throw err;
      }
    }

    const response: AlertResponse[] = rows.map((r) => ({
      id: r.id,
      zone_id: r.zone_id,
      zone_name: r.zone_name,
      severity: r.severity,
      risk_score: r.risk_score,
      message: r.message,
      evidence: r.evidence,
      status: r.status,
      created_at: new Date(r.created_at).toISOString(),
      alert_code: r.alert_code ?? null,
      trigger_summary: r.trigger_summary ?? null,
      threshold_ratio: r.threshold_ratio ?? null,
      evidence_quality: r.evidence_quality ?? null,
      recommended_action: r.recommended_action ?? null,
      expires_at: r.expires_at ? new Date(r.expires_at).toISOString() : null,
    }));

    res.json(response);
  })
);

alertsRouter.post(
  '/alerts',
  asyncHandler(async (req, res) => {
    const parsed = alertBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, 'Invalid alert payload', 'VALIDATION_ERROR', parsed.error.format());
    }

    const { zone_id, severity, risk_score, message, evidence } = parsed.data;

    // Verify zone exists
    const zoneCheck = await query<{ id: string; name: string }>(
      'SELECT id, name FROM risk_zones WHERE id = $1',
      [zone_id]
    );
    if (zoneCheck.rows.length === 0) {
      throw new ApiError(404, `Risk zone '${zone_id}' not found`, 'ZONE_NOT_FOUND');
    }

    const zoneName = zoneCheck.rows[0].name;

    const insertSql = `
      INSERT INTO alerts (zone_id, severity, risk_score, message, evidence_json, status)
      VALUES ($1, $2, $3, $4, $5, 'active')
      RETURNING id, created_at;
    `;

    const { rows } = await query<{ id: number; created_at: Date | string }>(insertSql, [
      zone_id,
      severity,
      risk_score,
      message,
      evidence ? JSON.stringify(evidence) : null,
    ]);

    const created = rows[0];
    const alertResponse: AlertResponse = {
      id: created.id,
      zone_id,
      zone_name: zoneName,
      severity,
      risk_score,
      message,
      evidence: evidence ?? null,
      status: 'active',
      created_at: new Date(created.created_at).toISOString(),
    };

    res.status(201).json(alertResponse);
  })
);
