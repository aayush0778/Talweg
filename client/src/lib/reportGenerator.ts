import type { RiskZone, RiskPredictionResponse, EnvironmentObservation, LandslideEvent, RiskLevel } from '../types/api';
import { getResponseGuidance } from './responseGuidance';
import { RISK_COLORS } from './riskColors';
import { formatObsTimestamp } from './format';

/**
 * Generates a print-optimized HTML document for a corridor risk assessment report.
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
    LOW: RISK_COLORS.LOW,
    MODERATE: RISK_COLORS.MODERATE,
    HIGH: RISK_COLORS.HIGH,
    SEVERE: RISK_COLORS.SEVERE,
  };

  const factorRows = (prediction?.contributing_factors ?? [])
    .map((f) => {
      const pct = riskScore > 0 ? Math.round((f.contribution / riskScore) * 100) : 0;
      return `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #bac2bb;">${formatFactorName(f.factor)}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #bac2bb;text-align:center;font-family:'IBM Plex Mono',monospace;">${f.raw}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #bac2bb;text-align:center;font-family:'IBM Plex Mono',monospace;">${(f.normalized * 100).toFixed(0)}%</td>
        <td style="padding:6px 12px;border-bottom:1px solid #bac2bb;text-align:center;font-family:'IBM Plex Mono',monospace;">${(f.weight * 100).toFixed(0)}%</td>
        <td style="padding:6px 12px;border-bottom:1px solid #bac2bb;text-align:center;font-weight:600;font-family:'IBM Plex Mono',monospace;">${pct}%</td>
      </tr>`;
    })
    .join('\n');

  const eventRows = (events ?? [])
    .slice(0, 10)
    .map((e) => `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #bac2bb;font-family:'IBM Plex Mono',monospace;">${e.date}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #bac2bb;">${e.trigger ?? '—'}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #bac2bb;">${e.category ?? '—'}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #bac2bb;">${e.description ?? '—'}</td>
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
    body { font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif; color: #17201e; background: #ffffff; line-height: 1.6; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 20px; font-weight: 700; color: #101417; margin-bottom: 4px; }
    h2 { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #303c40; margin: 24px 0 8px; padding-bottom: 4px; border-bottom: 1.5px solid #bac2bb; }
    h3 { font-size: 13px; font-weight: 600; color: #303c40; margin: 16px 0 6px; }
    p { font-size: 13px; color: #405054; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 8px 0 16px; page-break-inside: avoid; break-inside: avoid; }
    th { padding: 8px 12px; text-align: left; background: #f2efe9; border-bottom: 2px solid #89938b; font-weight: 600; color: #17201e; font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; font-size: 11px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid #101417; }
    .logo { font-size: 22px; font-weight: 700; color: #101417; letter-spacing: -0.02em; }
    .logo span { color: #678229; }
    .meta { text-align: right; font-size: 11px; color: #5f6963; font-family: 'IBM Plex Mono', monospace; }
    .risk-badge { display: inline-block; padding: 3px 12px; border-radius: 4px; font-weight: 700; font-size: 12px; color: #101417; font-family: 'IBM Plex Mono', monospace; letter-spacing: 0.05em; }
    .risk-summary { display: flex; align-items: center; gap: 20px; margin: 16px 0; padding: 16px; background: #f2efe9; border-radius: 6px; border: 1px solid #bac2bb; page-break-inside: avoid; break-inside: avoid; }
    .risk-score { font-size: 42px; font-weight: 700; font-family: 'IBM Plex Mono', monospace; line-height: 1; }
    .guidance-box { padding: 12px 16px; background: #f2efe9; border: 1px solid #bac2bb; border-radius: 6px; margin: 8px 0; page-break-inside: avoid; break-inside: avoid; }
    .guidance-box.severe { border-left: 4px solid #ef7070; }
    ul { padding-left: 20px; font-size: 12px; }
    li { margin-bottom: 3px; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #bac2bb; font-size: 10px; color: #89938b; text-align: center; font-family: 'IBM Plex Mono', monospace; }
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
      <p style="font-size:11px;color:#5f6963;margin-top:2px;">Landslide Risk Intelligence — Field Instrument Report</p>
    </div>
    <div class="meta">
      <div><strong>Report Generated:</strong> ${now}</div>
      <div><strong>Zone ID:</strong> ${zone.id}</div>
      <div><strong>Engine:</strong> ${engine === 'ml' ? 'ML Surrogate · Extra Trees' : 'Deterministic Heuristic'}</div>
      <div><strong>Data Source:</strong> ${prediction?.data_source ?? zone.data_source ?? 'synthetic_seed'}</div>
    </div>
  </div>

  <h1>Risk Assessment Report: ${zone.name}</h1>
  <p>${zone.description ?? 'Monitored risk corridor in Sikkim, Eastern Himalaya.'}</p>

  <div class="risk-summary">
    <div>
      <div class="risk-score" style="color:${levelColor[riskLevel]}">${scorePct}</div>
      <div style="font-size:11px;color:#5f6963;font-family:'IBM Plex Mono',monospace;">INDEX / 100</div>
    </div>
    <div>
      <span class="risk-badge" style="background:${levelColor[riskLevel]}">${riskLevel}</span>
      <p style="margin-top:6px;font-size:12px;">Severity Tier — ${riskLevel === 'LOW' ? 'Within baseline stability envelope' : riskLevel === 'MODERATE' ? 'Elevated rainfall-induced risk, active monitoring' : riskLevel === 'HIGH' ? 'Advisory active, pre-position local emergency assets' : 'EVACUATION PROTOCOL ACTIVE'}</p>
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
      <tr><td style="padding:6px 12px;border-bottom:1px solid #bac2bb;">24-Hour Rainfall</td><td style="padding:6px 12px;border-bottom:1px solid #bac2bb;text-align:center;font-weight:600;font-family:'IBM Plex Mono',monospace;">${environment.rainfall_24h ?? '—'}</td><td style="padding:6px 12px;border-bottom:1px solid #bac2bb;">mm</td></tr>
      <tr><td style="padding:6px 12px;border-bottom:1px solid #bac2bb;">3-Day Cumulative Rainfall</td><td style="padding:6px 12px;border-bottom:1px solid #bac2bb;text-align:center;font-weight:600;font-family:'IBM Plex Mono',monospace;">${environment.rainfall_3d ?? '—'}</td><td style="padding:6px 12px;border-bottom:1px solid #bac2bb;">mm</td></tr>
      <tr><td style="padding:6px 12px;border-bottom:1px solid #bac2bb;">7-Day Cumulative Rainfall</td><td style="padding:6px 12px;border-bottom:1px solid #bac2bb;text-align:center;font-weight:600;font-family:'IBM Plex Mono',monospace;">${environment.rainfall_7d ?? '—'}</td><td style="padding:6px 12px;border-bottom:1px solid #bac2bb;">mm</td></tr>
      <tr><td style="padding:6px 12px;border-bottom:1px solid #bac2bb;">Soil Moisture Saturation</td><td style="padding:6px 12px;border-bottom:1px solid #bac2bb;text-align:center;font-weight:600;font-family:'IBM Plex Mono',monospace;">${environment.soil_moisture != null ? Math.round(environment.soil_moisture * 100) + '%' : '—'}</td><td style="padding:6px 12px;border-bottom:1px solid #bac2bb;"></td></tr>
      <tr><td style="padding:6px 12px;border-bottom:1px solid #bac2bb;">Local Slope Gradient</td><td style="padding:6px 12px;border-bottom:1px solid #bac2bb;text-align:center;font-weight:600;font-family:'IBM Plex Mono',monospace;">${environment.slope ?? '—'}</td><td style="padding:6px 12px;border-bottom:1px solid #bac2bb;">degrees</td></tr>
    </tbody>
  </table>
  <p style="font-size:10px;color:#5f6963;font-family:'IBM Plex Mono',monospace;">Observation epoch: ${formatObsTimestamp(environment.timestamp)} | Data provenance: ${environment.source === 'chirps_real' ? 'REAL (NASA/USAID ClimateSERV CHIRPS satellite baseline, ~30–45d calibration latency)' : environment.source}</p>` : '<p><em>No environmental telemetry recorded for this zone.</em></p>'}

  <h2>Recommended Response Actions</h2>
  <div class="guidance-box${riskLevel === 'SEVERE' ? ' severe' : ''}">
    <h3 style="margin-top:0;">PROTOCOL: ${guidance.urgencyLevel} — Response Time: ${guidance.estimatedResponseTime}</h3>
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
    <p><strong>Talweg</strong> — AI-Based Landslide Early Warning & Risk Intelligence System</p>
    <p>DISCLAIMER: This assessment is generated for decision-support and planning. Operational decisions should synthesize ground reports with IMD alerts and state disaster authorities.</p>
  </div>

  <script>
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
