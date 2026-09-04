import type { RiskZone, RiskPredictionResponse, EnvironmentObservation, LandslideEvent, RiskLevel } from '../types/api';
import { getResponseGuidance } from './responseGuidance';

/**
 * Generates a print-optimized HTML document for a zone risk assessment report.
 * Uses native browser print dialog (Ctrl+P → Save as PDF). Zero dependencies.
 */
export function generateReportHTML(
  zone: RiskZone,
  prediction: RiskPredictionResponse | null,
  environment: EnvironmentObservation | null,
  events: LandslideEvent[] | null,
): string {
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const riskLevel = prediction?.risk_level ?? zone.risk_level ?? 'LOW';
  const riskScore = prediction?.risk_score ?? zone.risk_score ?? 0;
  const scorePct = Math.round(riskScore * 100);
  const engine = prediction?.engine ?? 'deterministic';
  const guidance = getResponseGuidance(riskLevel as RiskLevel, zone.name);

  const levelColor: Record<string, string> = {
    LOW: '#22c55e',
    MODERATE: '#eab308',
    HIGH: '#f97316',
    SEVERE: '#ef4444',
  };

  const factorRows = (prediction?.contributing_factors ?? [])
    .map((f) => {
      const pct = riskScore > 0 ? Math.round((f.contribution / riskScore) * 100) : 0;
      return `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">${formatFactorName(f.factor)}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${f.raw}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${(f.normalized * 100).toFixed(0)}%</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${(f.weight * 100).toFixed(0)}%</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:600;">${pct}%</td>
      </tr>`;
    })
    .join('\n');

  const eventRows = (events ?? [])
    .slice(0, 10)
    .map((e) => `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">${e.date}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">${e.trigger ?? '—'}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">${e.category ?? '—'}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">${e.description ?? '—'}</td>
    </tr>`)
    .join('\n');

  const guidanceItems = guidance.actions
    .map((a, i) => `<li style="margin-bottom:4px;"><strong>${i + 1}.</strong> ${a.action}</li>`)
    .join('\n');

  const contactItems = guidance.contacts
    .map((c) => `<li>${c.role} — <em>${c.method}</em></li>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Talweg — Risk Assessment Report: ${zone.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1e293b; line-height: 1.6; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 22px; color: #0f172a; margin-bottom: 4px; }
    h2 { font-size: 16px; color: #334155; margin: 24px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #e2e8f0; }
    h3 { font-size: 14px; color: #475569; margin: 16px 0 6px; }
    p { font-size: 13px; color: #475569; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 8px 0 16px; }
    th { padding: 8px 12px; text-align: left; background: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-weight: 600; color: #334155; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 3px solid #0f172a; }
    .logo { font-size: 24px; font-weight: 800; color: #0f172a; }
    .logo span { color: #22c55e; }
    .meta { text-align: right; font-size: 11px; color: #64748b; }
    .risk-badge { display: inline-block; padding: 4px 16px; border-radius: 6px; font-weight: 700; font-size: 14px; color: white; }
    .risk-summary { display: flex; align-items: center; gap: 20px; margin: 16px 0; padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
    .risk-score { font-size: 48px; font-weight: 800; }
    .guidance-box { padding: 12px 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; margin: 8px 0; }
    .guidance-box.severe { background: #fef2f2; border-color: #fca5a5; }
    ul { padding-left: 20px; font-size: 12px; }
    li { margin-bottom: 3px; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Tal<span>weg</span></div>
      <p style="font-size:11px;color:#64748b;margin-top:2px;">Landslide Early Warning & Risk Intelligence — SIH 2026</p>
    </div>
    <div class="meta">
      <div><strong>Report Generated:</strong> ${now}</div>
      <div><strong>Zone ID:</strong> ${zone.id}</div>
      <div><strong>Engine:</strong> ${engine === 'ml' ? 'ML Surrogate (ExtraTrees)' : 'Deterministic Heuristic'}</div>
      <div><strong>Data Source:</strong> ${prediction?.data_source ?? zone.data_source ?? 'synthetic_seed'}</div>
    </div>
  </div>

  <h1>Risk Assessment Report: ${zone.name}</h1>
  <p>${zone.description ?? 'Monitored risk corridor in Sikkim, NER India.'}</p>

  <div class="risk-summary">
    <div>
      <div class="risk-score" style="color:${levelColor[riskLevel]}">${scorePct}</div>
      <div style="font-size:12px;color:#64748b;">out of 100</div>
    </div>
    <div>
      <span class="risk-badge" style="background:${levelColor[riskLevel]}">${riskLevel}</span>
      <p style="margin-top:8px;font-size:12px;">Severity Index — ${riskLevel === 'LOW' ? 'Within normal parameters' : riskLevel === 'MODERATE' ? 'Elevated monitoring recommended' : riskLevel === 'HIGH' ? 'Advisory issued, pre-position response assets' : 'EVACUATION PROTOCOL ACTIVATED'}</p>
    </div>
  </div>

  <h2>Risk Factor Contribution Analysis</h2>
  ${factorRows ? `<table>
    <thead><tr>
      <th>Factor</th><th style="text-align:center">Raw Value</th><th style="text-align:center">Normalized</th><th style="text-align:center">Weight</th><th style="text-align:center">Contribution</th>
    </tr></thead>
    <tbody>${factorRows}</tbody>
  </table>` : '<p><em>Factor analysis unavailable for this assessment.</em></p>'}

  <h2>Environmental Telemetry Snapshot</h2>
  ${environment ? `<table>
    <thead><tr><th>Parameter</th><th style="text-align:center">Value</th><th>Unit</th></tr></thead>
    <tbody>
      <tr><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">24-Hour Rainfall</td><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:600;">${environment.rainfall_24h ?? '—'}</td><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">mm</td></tr>
      <tr><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">3-Day Cumulative Rainfall</td><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:600;">${environment.rainfall_3d ?? '—'}</td><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">mm</td></tr>
      <tr><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">7-Day Cumulative Rainfall</td><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:600;">${environment.rainfall_7d ?? '—'}</td><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">mm</td></tr>
      <tr><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">Soil Moisture Saturation</td><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:600;">${environment.soil_moisture != null ? Math.round(environment.soil_moisture * 100) + '%' : '—'}</td><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;"></td></tr>
      <tr><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">Local Slope Gradient</td><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:600;">${environment.slope ?? '—'}</td><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">degrees</td></tr>
    </tbody>
  </table>
  <p style="font-size:10px;color:#94a3b8;">Data provenance: ${environment.source} | Observation timestamp: ${environment.timestamp}</p>` : '<p><em>No environmental telemetry recorded for this zone.</em></p>'}

  <h2>Recommended Response Actions</h2>
  <div class="guidance-box${riskLevel === 'SEVERE' ? ' severe' : ''}">
    <h3 style="margin-top:0;">🚨 ${guidance.urgencyLevel} — Response Time: ${guidance.estimatedResponseTime}</h3>
    <ul style="margin-top:8px;">
      ${guidanceItems}
    </ul>
    <h3>Key Contacts</h3>
    <ul>${contactItems}</ul>
  </div>

  <h2>Historical Landslide Incidents in Corridor</h2>
  ${eventRows ? `<table>
    <thead><tr>
      <th>Date</th><th>Trigger</th><th>Category</th><th>Description</th>
    </tr></thead>
    <tbody>${eventRows}</tbody>
  </table>` : '<p><em>No historical incidents recorded for this corridor.</em></p>'}

  <div class="footer">
    <p><strong>Talweg</strong> — AI-Based Landslide Early Warning & Risk Intelligence System | SIH 2026</p>
    <p>⚠️ PROTOTYPE DISCLAIMER: This report is generated by a decision-support prototype. It is NOT an official government assessment and must NOT be used as the sole basis for emergency decisions. All current data is synthetic demo data for development purposes.</p>
  </div>

  <script>
    // Auto-trigger print dialog
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;
}

function formatFactorName(factor: string): string {
  const labels: Record<string, string> = {
    rainfall_24h: '24-Hour Rainfall',
    rainfall_3d: '3-Day Cumulative Rainfall',
    soil_moisture: 'Soil Moisture Saturation',
    slope: 'Terrain Slope Gradient',
    historical_density: 'Historical Incident Density',
  };
  return labels[factor] ?? factor;
}

/**
 * Opens a new browser window with the generated report and triggers print dialog.
 */
export function openReportWindow(
  zone: RiskZone,
  prediction: RiskPredictionResponse | null,
  environment: EnvironmentObservation | null,
  events: LandslideEvent[] | null,
): void {
  const html = generateReportHTML(zone, prediction, environment, events);
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
