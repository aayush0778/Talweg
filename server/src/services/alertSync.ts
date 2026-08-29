import { query } from '../db/query';
import { RiskResult } from './riskEngine';

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

    const { rows } = await query<{ id: number; severity: string }>(
      `SELECT id, severity FROM alerts WHERE zone_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
      [zoneId]
    );

    const existing = rows[0];
    const isEscalated = calc.risk_level === 'HIGH' || calc.risk_level === 'SEVERE';

    if (isEscalated) {
      if (!existing) {
        // Rule 1: INSERT new active alert
        await query(
          `INSERT INTO alerts (zone_id, severity, risk_score, message, evidence_json, status)
           VALUES ($1, $2, $3, $4, $5, 'active')`,
          [zoneId, calc.risk_level, calc.risk_score, message, JSON.stringify(evidence)]
        );
      } else if (existing.severity === calc.risk_level) {
        // Rule 2: UPDATE existing alert with same severity
        await query(
          `UPDATE alerts
           SET risk_score = $1, message = $2, evidence_json = $3
           WHERE id = $4`,
          [calc.risk_score, message, JSON.stringify(evidence), existing.id]
        );
      } else {
        // Rule 3: RESOLVE old alerts for zone and INSERT new alert with new severity
        await query(
          `UPDATE alerts SET status = 'resolved' WHERE zone_id = $1 AND status = 'active'`,
          [zoneId]
        );
        await query(
          `INSERT INTO alerts (zone_id, severity, risk_score, message, evidence_json, status)
           VALUES ($1, $2, $3, $4, $5, 'active')`,
          [zoneId, calc.risk_level, calc.risk_score, message, JSON.stringify(evidence)]
        );
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
