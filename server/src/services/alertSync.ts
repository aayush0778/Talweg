import { query } from '../db/query';
import { RiskResult, RiskLevel } from './riskEngine';

export const ALERT_FACTOR_LABELS: Record<string, string> = {
  rainfall_24h: '24h Rainfall',
  rainfall_3d: '3-Day Rainfall',
  slope: 'Slope',
  soil_moisture: 'Soil Saturation',
  historical_density: 'Historical Incidents',
};

/**
 * Server-authoritative alert synchronization following 4 rules:
 * 1. result >= HIGH, no active alert -> INSERT new alert
 * 2. result >= HIGH, active alert exists with same severity -> UPDATE alert score, message, evidence
 * 3. result >= HIGH, active alert exists with different severity -> RESOLVE old, INSERT new
 * 4. result < HIGH, active alert exists -> RESOLVE active alerts for zone
 *
 * Final Upgrade: alerts additionally carry operational fields (alert_code,
 * trigger summary, threshold ratio, evidence quality, recommended action,
 * expiry). If migration 006 has not been applied, the sync transparently
 * falls back to the legacy columns so alerting never breaks.
 *
 * This function NEVER throws; all errors are logged as warnings so risk computation responses
 * are never disrupted.
 */
export async function syncAlertForZone(
  zoneId: string,
  zoneName: string,
  calc: RiskResult,
  evidence: object
): Promise<void> {
  try {
    const topFactorKey = calc.contributing_factors?.[0]?.factor ?? 'environmental_factors';
    const topFactorLabel = ALERT_FACTOR_LABELS[topFactorKey] || topFactorKey;
    const message = `${zoneName} escalated to ${calc.risk_level} risk (${Math.round(
      calc.risk_score * 100
    )}/100). Primary driver: ${topFactorLabel}.`;

    // Operational fields (Final Upgrade §19)
    const thresholdRatio = calc.threshold_signal?.max_ratio ?? null;
    const triggerSummary =
      thresholdRatio !== null && thresholdRatio >= 1.0
        ? `${calc.threshold_signal?.critical_duration_days ?? 3}-day rainfall threshold exceeded ${thresholdRatio.toFixed(2)}×`
        : `Composite risk drivers: ${topFactorLabel} dominant`;
    const evidenceQuality = calc.data_quality_score ?? 1.0;
    const recommendedAction = recommendedActionForLevel(calc.risk_level);
    const alertCode = `TLW-${zoneId.toUpperCase().replace(/[^A-Z0-9]/g, '-')}-${calc.risk_level}`;
    const expiresAt = new Date(Date.now() + 6 * 3_600_000).toISOString(); // 6h operational expiry

    const { rows } = await query<{ id: number; severity: string }>(
      `SELECT id, severity FROM alerts WHERE zone_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
      [zoneId]
    );

    const existing = rows[0];
    const isEscalated = calc.risk_level === 'HIGH' || calc.risk_level === 'SEVERE';

    const insertEnhanced = async (): Promise<boolean> => {
      try {
        await query(
          `INSERT INTO alerts (zone_id, severity, risk_score, message, evidence_json, status,
                               alert_code, trigger_summary, threshold_ratio, evidence_quality,
                               recommended_action, expires_at)
           VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, $9, $10, $11)`,
          [
            zoneId, calc.risk_level, calc.risk_score, message, JSON.stringify(evidence),
            alertCode, triggerSummary, thresholdRatio, evidenceQuality,
            recommendedAction, expiresAt,
          ]
        );
        return true;
      } catch (err) {
        if (isUndefinedColumn(err)) return false; // migration 006 not applied
        throw err;
      }
    };

    const insertLegacy = async (): Promise<void> => {
      await query(
        `INSERT INTO alerts (zone_id, severity, risk_score, message, evidence_json, status)
         VALUES ($1, $2, $3, $4, $5, 'active')`,
        [zoneId, calc.risk_level, calc.risk_score, message, JSON.stringify(evidence)]
      );
    };

    const updateEnhanced = async (id: number): Promise<boolean> => {
      try {
        await query(
          `UPDATE alerts
           SET risk_score = $1, message = $2, evidence_json = $3,
               trigger_summary = $4, threshold_ratio = $5, evidence_quality = $6,
               recommended_action = $7, expires_at = $8
           WHERE id = $9`,
          [calc.risk_score, message, JSON.stringify(evidence), triggerSummary, thresholdRatio, evidenceQuality, recommendedAction, expiresAt, id]
        );
        return true;
      } catch (err) {
        if (isUndefinedColumn(err)) return false;
        throw err;
      }
    };

    const updateLegacy = async (id: number): Promise<void> => {
      await query(
        `UPDATE alerts
         SET risk_score = $1, message = $2, evidence_json = $3
         WHERE id = $4`,
        [calc.risk_score, message, JSON.stringify(evidence), id]
      );
    };

    if (isEscalated) {
      if (!existing) {
        if (!(await insertEnhanced())) await insertLegacy();
      } else if (existing.severity === calc.risk_level) {
        if (!(await updateEnhanced(existing.id))) await updateLegacy(existing.id);
      } else {
        await query(
          `UPDATE alerts SET status = 'resolved' WHERE zone_id = $1 AND status = 'active'`,
          [zoneId]
        );
        if (!(await insertEnhanced())) await insertLegacy();
      }
    } else if (existing) {
      // Rule 4: RESOLVE all active alerts for this zone
      await query(
        `UPDATE alerts SET status = 'resolved' WHERE zone_id = $1 AND status = 'active'`,
        [zoneId]
      );
    }
  } catch (err) {
    console.warn('[alerts] sync failed (non-fatal):', err instanceof Error ? err.message : err);
  }
}

function isUndefinedColumn(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { code?: string }).code === '42703');
}

function recommendedActionForLevel(level: RiskLevel): string {
  switch (level) {
    case 'SEVERE':
      return 'Move people away from steep slopes and drainages; activate evacuation protocol and close vulnerable roads.';
    case 'HIGH':
      return 'Monitor slopes and drainages hourly; restrict movement on identified vulnerable routes; prepare for possible evacuation.';
    case 'MODERATE':
      return 'Maintain watch; verify drainage blockages; brief local response teams.';
    default:
      return 'Routine monitoring.';
  }
}
