import { RiskLevel } from '../types/api';

export interface ResponseAction {
  action: string;
  priority: 'routine' | 'elevated' | 'urgent' | 'emergency';
}

export interface ResponseGuidanceData {
  urgencyLevel: string;
  urgencyColor: string; // tailwind color class
  estimatedResponseTime: string;
  actions: ResponseAction[];
  contacts: { role: string; method: string }[];
  populationNote: string;
}

export function getResponseGuidance(riskLevel: RiskLevel, zoneName: string): ResponseGuidanceData {
  switch (riskLevel) {
    case 'LOW':
      return {
        urgencyLevel: 'Routine Monitoring',
        urgencyColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
        estimatedResponseTime: 'No immediate action',
        actions: [
          { action: 'Continue standard sensor monitoring schedule', priority: 'routine' },
          { action: 'Review drainage channel condition reports', priority: 'routine' },
          { action: 'Update weekly risk assessment log', priority: 'routine' },
        ],
        contacts: [
          { role: 'Field monitoring team', method: 'scheduled check-in' }
        ],
        populationNote: `No population impact expected for ${zoneName} at current levels.`
      };
    
    case 'MODERATE':
      return {
        urgencyLevel: 'Enhanced Surveillance',
        urgencyColor: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
        estimatedResponseTime: '4-6 hours readiness',
        actions: [
          { action: 'Increase sensor polling frequency to 30-minute intervals', priority: 'elevated' },
          { action: 'Dispatch field team for visual inspection of vulnerable slopes', priority: 'elevated' },
          { action: 'Brief Block Development Officer on current risk trajectory', priority: 'elevated' },
          { action: 'Check readiness of community warning sirens', priority: 'elevated' },
          { action: 'Pre-stage emergency communication equipment', priority: 'elevated' },
        ],
        contacts: [
          { role: 'Field Team', method: 'SMS alert' },
          { role: 'Block Development Officer', method: 'Email briefing' }
        ],
        populationNote: `Community awareness advised for vulnerable areas in ${zoneName}.`
      };

    case 'HIGH':
      return {
        urgencyLevel: 'Advisory & Pre-positioning',
        urgencyColor: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
        estimatedResponseTime: '1-2 hours mobilization',
        actions: [
          { action: 'Issue public advisory to residents within 2km of high-risk slopes', priority: 'urgent' },
          { action: 'Pre-position NDRF rescue teams at district staging area', priority: 'urgent' },
          { action: 'Alert district hospital for potential mass casualty preparation', priority: 'urgent' },
          { action: 'Restrict heavy vehicle traffic on vulnerable road segments', priority: 'urgent' },
          { action: 'Activate community volunteer network for door-to-door alerts', priority: 'urgent' },
          { action: 'Coordinate with Indian Railways for track inspection in corridor', priority: 'urgent' },
        ],
        contacts: [
          { role: 'District Collector', method: 'Phone + SMS' },
          { role: 'SDMA Control Room', method: 'Hotline' },
          { role: 'District Hospital', method: 'Alert Protocol' },
          { role: 'Indian Railways', method: 'Track advisory' }
        ],
        populationNote: `High probability of impact in ${zoneName}. Prepare for potential localized evacuation.`
      };

    case 'SEVERE':
      return {
        urgencyLevel: 'Evacuation Protocol',
        urgencyColor: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
        estimatedResponseTime: 'IMMEDIATE — 0-30 minutes',
        actions: [
          { action: 'INITIATE EVACUATION of all settlements within 3km perimeter', priority: 'emergency' },
          { action: 'Activate NDRF and SDRF deployment to affected corridor', priority: 'emergency' },
          { action: 'Close all schools and government offices in risk zone', priority: 'emergency' },
          { action: 'Deploy emergency shelters at pre-designated assembly points', priority: 'emergency' },
          { action: 'Establish road blocks on NH10/NH31A through affected sections', priority: 'emergency' },
          { action: 'Request Indian Air Force helicopter standby for medical evacuation', priority: 'emergency' },
          { action: 'Activate All India Radio emergency broadcast for affected district', priority: 'emergency' },
          { action: 'Open emergency relief centers with 72-hour supply capacity', priority: 'emergency' },
        ],
        contacts: [
          { role: 'District Collector', method: 'Emergency line' },
          { role: 'NDRF Battalion', method: 'Deployment order' },
          { role: "Chief Minister's Office", method: 'Situation report' },
          { role: 'All India Radio', method: 'Emergency broadcast' },
          { role: 'IAF Station Bagdogra', method: 'MEDEVAC standby' }
        ],
        populationNote: `CRITICAL: Immediate evacuation required for all populations within impact zone of ${zoneName}.`
      };
      
    default:
      return {
        urgencyLevel: 'Unknown',
        urgencyColor: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
        estimatedResponseTime: 'Unknown',
        actions: [],
        contacts: [],
        populationNote: 'No risk level data available.'
      };
  }
}
