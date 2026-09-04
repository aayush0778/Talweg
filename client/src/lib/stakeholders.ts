import type { RiskLevel } from '../types/api';

/**
 * Stakeholder notification hierarchy for landslide response.
 * Maps each risk level to the appropriate chain of command and notification methods.
 */

export interface Stakeholder {
  role: string;
  method: string;
  responseTime: string;
  active: boolean; // whether this stakeholder is activated at the given risk level
}

export interface NotificationTier {
  level: RiskLevel;
  label: string;
  stakeholders: Stakeholder[];
}

/**
 * Returns the full notification chain showing which stakeholders
 * are activated at each risk level. Stakeholders at lower levels
 * remain active at higher levels (cumulative escalation).
 */
export function getNotificationChain(currentLevel: RiskLevel): NotificationTier[] {
  const levelOrder: RiskLevel[] = ['LOW', 'MODERATE', 'HIGH', 'SEVERE'];
  const currentIdx = levelOrder.indexOf(currentLevel);

  return [
    {
      level: 'LOW',
      label: 'Routine',
      stakeholders: [
        { role: 'Field Monitoring Team', method: 'Scheduled check-in', responseTime: '24h', active: currentIdx >= 0 },
        { role: 'Data Analytics Unit', method: 'Dashboard alert', responseTime: 'Continuous', active: currentIdx >= 0 },
      ],
    },
    {
      level: 'MODERATE',
      label: 'Enhanced',
      stakeholders: [
        { role: 'Block Development Officer', method: 'Email + SMS', responseTime: '4h', active: currentIdx >= 1 },
        { role: 'Community Volunteers', method: 'WhatsApp group', responseTime: '2h', active: currentIdx >= 1 },
        { role: 'PWD Road Division', method: 'Advisory notice', responseTime: '6h', active: currentIdx >= 1 },
      ],
    },
    {
      level: 'HIGH',
      label: 'Advisory',
      stakeholders: [
        { role: 'District Collector', method: 'Phone + SMS', responseTime: '30 min', active: currentIdx >= 2 },
        { role: 'SDMA Control Room', method: 'Hotline + IDRN', responseTime: '15 min', active: currentIdx >= 2 },
        { role: 'District Hospital', method: 'Mass casualty alert', responseTime: '1h', active: currentIdx >= 2 },
        { role: 'Indian Railways', method: 'Track advisory', responseTime: '1h', active: currentIdx >= 2 },
        { role: 'Police Control Room', method: 'Road closure order', responseTime: '30 min', active: currentIdx >= 2 },
      ],
    },
    {
      level: 'SEVERE',
      label: 'Emergency',
      stakeholders: [
        { role: 'NDRF Battalion', method: 'Deployment order', responseTime: 'Immediate', active: currentIdx >= 3 },
        { role: "Chief Minister's Office", method: 'Situation report', responseTime: '15 min', active: currentIdx >= 3 },
        { role: 'All India Radio', method: 'Emergency broadcast', responseTime: '30 min', active: currentIdx >= 3 },
        { role: 'IAF Station Bagdogra', method: 'MEDEVAC standby', responseTime: '45 min', active: currentIdx >= 3 },
        { role: 'Relief Commissioner', method: 'Shelter activation', responseTime: '1h', active: currentIdx >= 3 },
      ],
    },
  ];
}
