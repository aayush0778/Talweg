/**
 * Model Validation Backtest — Scenario Definitions
 *
 * WHAT THIS IS:
 * For each of the 15 seeded historical landslide events (source: synthetic_seed
 * in landslide_events), this assigns a representative "trigger-day" environmental
 * snapshot and asks: would the deterministic risk engine have flagged HIGH or
 * SEVERE risk under conditions consistent with that event's reported severity?
 *
 * WHAT THIS IS NOT:
 * This is NOT a replay of the actual historical rainfall/soil-moisture recorded
 * on each event's date — we have no such time-series (IMD gridded rainfall
 * archive is not integrated). The events themselves are also synthetic demo
 * data, not a real NASA/GLC import (see server/seeds/seed.sql).
 *
 * WHAT IT VALIDATES:
 * Given trigger-day conditions consistent with a rain-triggered event of a
 * given category and fatality count (a defensible, documented proxy — not a
 * random guess), does the engine's threshold structure correctly separate
 * "this should have been flagged" from "this should not have been"? This is
 * a methodology/threshold-calibration check, not a ground-truth accuracy
 * measurement. Both facts are surfaced together in the API response so the
 * client never has to re-derive or lose this context.
 */

import { RiskInput } from './riskEngine';

export interface BacktestEvent {
  id: string;
  date: string;
  zoneId: string;
  zoneName: string;
  category: string;
  fatalities: number;
  description: string;
  input: RiskInput;
  /** True for events that are themselves real, independently verifiable
   *  disasters (not seed.sql demo fixtures) — even though, like every other
   *  entry here, their quantitative trigger inputs are still a documented
   *  proxy rather than measured historical weather. See citationSource. */
  eventVerified?: boolean;
  /** Required when eventVerified is true — the real, checkable source. */
  citationSource?: string;
}

// historical_density = count of seeded events in that zone (matches how the
// live system computes this factor from real event counts, not fabricated).
// Updated to include 2 additional real, independently verified 2025 events
// (see VERIFIED_2025_EVENTS below) alongside the original 15 seed.sql events.
const ZONE_DENSITY: Record<string, number> = {
  gangtok: 6,
  mangan: 4,
  namchi: 2,
  pakyong: 2,
  gyalshing: 1,
  soreng: 2,
};

const ZONE_SLOPE: Record<string, number> = {
  gangtok: 35.0,
  mangan: 38.0,
  namchi: 25.0,
  pakyong: 30.0,
  gyalshing: 28.0,
  soreng: 32.0,
};

const ZONE_NAMES: Record<string, string> = {
  gangtok: 'Gangtok Corridor',
  mangan: 'Mangan - Teesta Valley',
  namchi: 'Namchi Zone',
  pakyong: 'Pakyong Area',
  gyalshing: 'Gyalshing - West Sikkim',
  soreng: 'Soreng Sub-division',
};

/**
 * Assigns a representative trigger-day rainfall/soil-moisture snapshot from
 * (category, fatalities). More severe outcomes imply more extreme trigger
 * conditions — this is the documented proxy described above, applied
 * consistently across all 15 events (no per-event manual tuning).
 */
function triggerDayInputs(category: string, fatalities: number): {
  rainfall_24h: number;
  rainfall_3d: number;
  soil_moisture: number;
} {
  const fatal = fatalities > 0;

  if (category === 'debris_flow' && fatal) {
    return { rainfall_24h: 165, rainfall_3d: 340, soil_moisture: 0.9 };
  }
  if (category === 'debris_flow') {
    return { rainfall_24h: 110, rainfall_3d: 240, soil_moisture: 0.8 };
  }
  if (category === 'landslide' && fatal) {
    return { rainfall_24h: 130, rainfall_3d: 280, soil_moisture: 0.85 };
  }
  if (category === 'landslide') {
    return { rainfall_24h: 90, rainfall_3d: 190, soil_moisture: 0.72 };
  }
  // rockfall — sharp but less sustained rainfall typically precedes these
  return { rainfall_24h: 75, rainfall_3d: 150, soil_moisture: 0.65 };
}

function buildEvent(
  id: string,
  date: string,
  zoneId: string,
  category: string,
  fatalities: number,
  description: string,
  citationSource?: string
): BacktestEvent {
  const { rainfall_24h, rainfall_3d, soil_moisture } = triggerDayInputs(category, fatalities);
  return {
    id,
    date,
    zoneId,
    zoneName: ZONE_NAMES[zoneId],
    category,
    fatalities,
    description,
    input: {
      rainfall_24h,
      rainfall_3d,
      soil_moisture,
      slope: ZONE_SLOPE[zoneId],
      historical_density: ZONE_DENSITY[zoneId],
    },
    ...(citationSource ? { eventVerified: true, citationSource } : {}),
  };
}

// Mirrors server/seeds/seed.sql landslide_events (evt-001..evt-015) exactly —
// same dates, zones (matched from event coordinates), categories, fatalities.
export const BACKTEST_EVENTS: BacktestEvent[] = [
  buildEvent('evt-001', '2023-10-04', 'gangtok', 'landslide', 2, 'Monsoon-triggered debris flow along NH10 near Gangtok'),
  buildEvent('evt-002', '2022-08-15', 'gangtok', 'landslide', 0, 'Road-blocking slide near 7th Mile, Gangtok'),
  buildEvent('evt-003', '2021-07-22', 'gangtok', 'debris_flow', 1, 'Debris flow in Chandmari area during heavy rain'),
  buildEvent('evt-004', '2023-06-18', 'gangtok', 'landslide', 0, 'Minor slope failure near Ranipool'),
  buildEvent('evt-005', '2020-09-10', 'gangtok', 'rockfall', 0, 'Rockfall on bypass road during prolonged rain'),
  buildEvent('evt-006', '2023-10-04', 'mangan', 'debris_flow', 5, 'GLOF-triggered debris flow in Teesta valley near Mangan'),
  buildEvent('evt-007', '2022-07-30', 'mangan', 'landslide', 0, 'Landslide blocking North Sikkim Highway near Mangan'),
  buildEvent('evt-008', '2021-08-05', 'mangan', 'landslide', 1, 'Slope collapse along Teesta riverbank'),
  buildEvent('evt-009', '2022-09-12', 'namchi', 'landslide', 0, 'Minor slide near Namchi bazaar area'),
  buildEvent('evt-010', '2023-07-25', 'namchi', 'landslide', 0, 'Seasonal slope failure south of Namchi'),
  buildEvent('evt-011', '2022-06-20', 'pakyong', 'landslide', 0, 'Cut-slope failure near Pakyong airport road'),
  buildEvent('evt-012', '2023-08-08', 'pakyong', 'debris_flow', 0, 'Debris flow along construction area near Pakyong'),
  buildEvent('evt-013', '2021-09-15', 'gyalshing', 'landslide', 0, 'Seasonal slide west of Gyalshing town'),
  buildEvent('evt-014', '2023-07-10', 'soreng', 'landslide', 0, 'Slope instability near Soreng along Rangit basin'),
  buildEvent('evt-015', '2022-08-28', 'soreng', 'debris_flow', 1, 'Debris flow during intense monsoon rain near Soreng'),

  // --- Real, independently verifiable events (not seed.sql demo fixtures) ---
  // Event occurrence, date, location and casualty count are real and
  // checkable against the cited source. Quantitative trigger-day inputs
  // (rainfall/soil moisture) still follow the same documented proxy
  // methodology as every other entry above — they are NOT measured
  // historical weather readings, and eventVerified only marks the event
  // itself as real, not the input values. See interface docs above.
  buildEvent(
    'evt-016',
    '2025-06-01',
    'mangan',
    'landslide',
    3,
    'Slope collapse at an army camp near Lachen, North Sikkim, following five days of continuous heavy rainfall',
    'Sikkim Himalaya early-monsoon landslides, May-Jun 2025 (peer-reviewed, ScienceDirect, published Aug 2025)'
  ),
  buildEvent(
    'evt-017',
    '2025-05-31',
    'gangtok',
    'landslide',
    0,
    'Landslide near the NHPC Teesta Stage VI project site at Sirwani, close to Singtam, triggered by continuous heavy rainfall',
    'Sikkim Himalaya early-monsoon landslides, May-Jun 2025 (peer-reviewed, ScienceDirect, published Aug 2025)'
  ),
];
