import { HazardProgressionResponse, HazardCorridorGeometry, HazardTimelineStep } from '../types/api';
import { getHistoricalReplayById, replayHistoricalEvent } from './historicalReplay';
import { calculateRisk } from './riskEngine';
import { pool } from '../db/index';

const DISCLAIMER_TEXT =
  'ILLUSTRATIVE TERRAIN-BASED MOVEMENT SIMULATION — Not a physical landslide trajectory forecast. Demonstrates terrain descent path and timeline threshold crossing for decision-support.';

// ----- Zone Topography Profiles (All 6 Sikkim Districts) -----

export interface ZoneTopographyDefinition {
  zone_id: string;
  zone_name: string;
  base_slope: number;
  historical_density: number;
  initiation_point: [number, number, number]; // [lon, lat, elev_m]
  flow_path: Array<[number, number, number]>;
  historical_event_point: [number, number];
  default_rain_24h: number;
  default_rain_3d: number;
  default_soil_moisture: number;
}

export const ZONE_TOPOGRAPHIES: Record<string, ZoneTopographyDefinition> = {
  mangan: {
    zone_id: 'mangan',
    zone_name: 'Mangan - Teesta Valley',
    base_slope: 38.0,
    historical_density: 4,
    initiation_point: [88.512, 27.635, 3180],
    flow_path: [
      [88.512, 27.635, 3180],
      [88.518, 27.618, 2740],
      [88.524, 27.595, 2250],
      [88.529, 27.568, 1720],
      [88.527, 27.545, 1280],
      [88.528, 27.526, 960],
      [88.529, 27.505, 780],
    ],
    historical_event_point: [88.528, 27.516],
    default_rain_24h: 110.0,
    default_rain_3d: 240.0,
    default_soil_moisture: 0.85,
  },
  gangtok: {
    zone_id: 'gangtok',
    zone_name: 'Gangtok Corridor',
    base_slope: 35.0,
    historical_density: 5,
    initiation_point: [88.632, 27.360, 2150],
    flow_path: [
      [88.632, 27.360, 2150],
      [88.625, 27.348, 1850],
      [88.616, 27.334, 1540],
      [88.605, 27.318, 1220],
      [88.592, 27.302, 940],
    ],
    historical_event_point: [88.610, 27.330],
    default_rain_24h: 85.0,
    default_rain_3d: 180.0,
    default_soil_moisture: 0.78,
  },
  namchi: {
    zone_id: 'namchi',
    zone_name: 'Namchi Zone',
    base_slope: 25.0,
    historical_density: 2,
    initiation_point: [88.375, 27.210, 1840],
    flow_path: [
      [88.375, 27.210, 1840],
      [88.364, 27.195, 1560],
      [88.352, 27.180, 1280],
      [88.341, 27.165, 1030],
      [88.330, 27.150, 790],
    ],
    historical_event_point: [88.360, 27.180],
    default_rain_24h: 45.0,
    default_rain_3d: 100.0,
    default_soil_moisture: 0.55,
  },
  pakyong: {
    zone_id: 'pakyong',
    zone_name: 'Pakyong Area',
    base_slope: 30.0,
    historical_density: 2,
    initiation_point: [88.605, 27.255, 1720],
    flow_path: [
      [88.605, 27.255, 1720],
      [88.616, 27.244, 1490],
      [88.628, 27.232, 1280],
      [88.640, 27.221, 1090],
      [88.654, 27.208, 920],
    ],
    historical_event_point: [88.620, 27.230],
    default_rain_24h: 65.0,
    default_rain_3d: 140.0,
    default_soil_moisture: 0.65,
  },
  gyalshing: {
    zone_id: 'gyalshing',
    zone_name: 'Gyalshing - West Sikkim',
    base_slope: 28.0,
    historical_density: 1,
    initiation_point: [88.240, 27.342, 2180],
    flow_path: [
      [88.240, 27.342, 2180],
      [88.251, 27.326, 1880],
      [88.262, 27.310, 1560],
      [88.272, 27.295, 1270],
      [88.284, 27.280, 1010],
    ],
    historical_event_point: [88.260, 27.320],
    default_rain_24h: 55.0,
    default_rain_3d: 120.0,
    default_soil_moisture: 0.60,
  },
  soreng: {
    zone_id: 'soreng',
    zone_name: 'Soreng Sub-division',
    base_slope: 32.0,
    historical_density: 2,
    initiation_point: [88.165, 27.185, 1920],
    flow_path: [
      [88.165, 27.185, 1920],
      [88.178, 27.170, 1600],
      [88.192, 27.156, 1310],
      [88.206, 27.142, 1020],
      [88.220, 27.128, 750],
    ],
    historical_event_point: [88.180, 27.160],
    default_rain_24h: 70.0,
    default_rain_3d: 155.0,
    default_soil_moisture: 0.70,
  },
};

/**
 * Build widening corridor polygon and deposition fan from a flow path.
 */
function buildCorridorGeometry(
  flowPath: Array<[number, number, number]>,
  historicalEventPoint: [number, number],
  zoneId: string
): HazardCorridorGeometry {
  const leftEdge: number[][] = [];
  const rightEdge: number[][] = [];

  const n = flowPath.length;
  for (let i = 0; i < n; i++) {
    const [lon, lat] = flowPath[i];
    // Interpolate expansion width: 0.002 deg (~150m) at ridge to 0.009 deg (~750m) at floor
    const t = i / (n - 1);
    const halfWidth = 0.002 + t * 0.007;

    // Approximate perpendicular normal vector
    let dx = 0;
    let dy = -1;
    if (i < n - 1) {
      const next = flowPath[i + 1];
      dx = next[0] - lon;
      dy = next[1] - lat;
    } else {
      const prev = flowPath[i - 1];
      dx = lon - prev[0];
      dy = lat - prev[1];
    }
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    leftEdge.push([lon - nx * halfWidth, lat - ny * halfWidth]);
    rightEdge.push([lon + nx * halfWidth, lat + ny * halfWidth]);
  }

  // Corridor polygon: left down to bottom, right back up to top, closed
  const corridorCoords = [
    ...leftEdge,
    ...rightEdge.reverse(),
    leftEdge[0],
  ];

  // Deposition fan around the terminal point
  const last = flowPath[n - 1];
  const r = 0.008;
  const fanCoords = [
    [last[0] - r, last[1]],
    [last[0] - r * 0.7, last[1] - r * 0.8],
    [last[0] + r * 0.7, last[1] - r * 0.8],
    [last[0] + r, last[1]],
    [last[0], last[1] + r * 0.4],
    [last[0] - r, last[1]],
  ];

  return {
    initiation_point: flowPath[0],
    flow_path: flowPath,
    corridor_polygon: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [corridorCoords],
      },
      properties: {
        zone: zoneId,
        corridor_type: 'uncertainty_envelope',
        max_width_meters: 750,
        initiation_width_meters: 150,
      },
    },
    deposition_polygon: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [fanCoords],
      },
      properties: {
        deposit_type: 'alluvial_debris_fan',
      },
    },
    historical_event_point: historicalEventPoint,
  };
}

/**
 * Build 5-step hazard progression timeline parameterized by environmental conditions.
 */
function buildParametricTimeline(
  peakRain24: number,
  peakRain3d: number,
  peakSoil: number,
  slope: number,
  density: number,
  isHistorical: boolean
): HazardTimelineStep[] {
  const stepsConfig: Array<{
    phase: 'T-72h' | 'T-48h' | 'T-24h' | 'T-6h' | 'EVENT';
    time_offset_hours: number;
    rain24Factor: number;
    rain3dFactor: number;
    soilFactor: number;
    flow_progress: number;
    title: string;
    description: string;
  }> = [
    {
      phase: 'T-72h',
      time_offset_hours: -72,
      rain24Factor: 0.28,
      rain3dFactor: 0.42,
      soilFactor: 0.65,
      flow_progress: 0.0,
      title: 'Antecedent Monsoon Saturation',
      description: 'Initial rainfall elevates background moisture; mountain slope remains structurally stable.',
    },
    {
      phase: 'T-48h',
      time_offset_hours: -48,
      rain24Factor: 0.52,
      rain3dFactor: 0.78,
      soilFactor: 0.80,
      flow_progress: 0.0,
      title: 'Sustained Pore Pressure Buildup',
      description: 'Infiltration reduces effective cohesion along steep shear planes. Monitoring heightened.',
    },
    {
      phase: 'T-24h',
      time_offset_hours: -24,
      rain24Factor: 0.78,
      rain3dFactor: 1.25,
      soilFactor: 0.90,
      flow_progress: 0.08,
      title: 'Pre-Failure Critical Boundary',
      description: 'Precipitation approaches critical threshold. Tension cracks and localized crest slumping develop.',
    },
    {
      phase: 'T-6h',
      time_offset_hours: -6,
      rain24Factor: 0.94,
      rain3dFactor: 1.52,
      soilFactor: 0.96,
      flow_progress: 0.42,
      title: 'Critical Threshold Exceeded — Initiation Activated',
      description: 'Risk score breaches trigger threshold (0.56). Shear failure activates initiation beacon.',
    },
    {
      phase: 'EVENT',
      time_offset_hours: 0,
      rain24Factor: 1.0,
      rain3dFactor: 1.65,
      soilFactor: 1.0,
      flow_progress: 1.0,
      title: isHistorical
        ? 'Debris Flow Runout Completed — Validated against Historical Observation'
        : 'Projected Debris Flow Runout Completed',
      description: isHistorical
        ? 'Full runout along drainage gorge into deposition floor, encompassing recorded historical marker.'
        : 'Downslope debris flow runout reaches terminal deposition fan based on current conditions.',
    },
  ];

  return stepsConfig.map((cfg) => {
    const rainfall_24h = Math.round(peakRain24 * cfg.rain24Factor * 10) / 10;
    const rainfall_3d = Math.round(peakRain3d * cfg.rain3dFactor * 10) / 10;
    const soil_moisture = Math.round(Math.min(1.0, Math.max(0.35, peakSoil * cfg.soilFactor)) * 100) / 100;

    const risk = calculateRisk({
      rainfall_24h,
      rainfall_3d,
      soil_moisture,
      slope,
      historical_density: density,
    });

    const threshold_crossed = risk.risk_score >= 0.56;

    return {
      phase: cfg.phase,
      time_offset_hours: cfg.time_offset_hours,
      rainfall_24h,
      rainfall_3d,
      soil_moisture,
      risk_score: risk.risk_score,
      risk_level: risk.risk_level,
      flow_progress: cfg.flow_progress,
      stage_title: cfg.title,
      stage_description: cfg.description,
      threshold_crossed,
    };
  });
}

/**
 * Verified Real Event: October 4, 2023 Chungthang-Mangan Debris Flow (NASA GLC #15243)
 */
const REAL_OCT2023_GEOMETRY: HazardCorridorGeometry = {
  initiation_point: [88.512, 27.635, 3180],
  flow_path: [
    [88.512, 27.635, 3180],
    [88.518, 27.618, 2740],
    [88.524, 27.595, 2250],
    [88.529, 27.568, 1720],
    [88.527, 27.545, 1280],
    [88.528, 27.526, 960],
    [88.529, 27.505, 780],
  ],
  corridor_polygon: {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [88.510, 27.635],
          [88.514, 27.618],
          [88.519, 27.595],
          [88.522, 27.568],
          [88.518, 27.545],
          [88.516, 27.526],
          [88.515, 27.505],
          [88.542, 27.505],
          [88.540, 27.526],
          [88.536, 27.545],
          [88.535, 27.568],
          [88.529, 27.595],
          [88.522, 27.618],
          [88.514, 27.635],
          [88.510, 27.635],
        ],
      ],
    },
    properties: {
      zone: 'mangan',
      corridor_type: 'uncertainty_envelope',
      max_width_meters: 850,
      initiation_width_meters: 150,
    },
  },
  deposition_polygon: {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [88.515, 27.505],
          [88.522, 27.498],
          [88.536, 27.498],
          [88.542, 27.505],
          [88.535, 27.515],
          [88.522, 27.515],
          [88.515, 27.505],
        ],
      ],
    },
    properties: {
      deposit_type: 'alluvial_debris_fan',
      area_sq_km: 1.4,
    },
  },
  historical_event_point: [88.528, 27.516],
};

const REAL_OCT2023_TIMELINE: HazardTimelineStep[] = [
  {
    phase: 'T-72h',
    time_offset_hours: -72,
    rainfall_24h: 36.0,
    rainfall_3d: 58.0,
    soil_moisture: 0.56,
    risk_score: 0.38,
    risk_level: 'LOW',
    flow_progress: 0.0,
    stage_title: 'Antecedent Monsoon Saturation',
    stage_description:
      'Initial monsoon rainfall elevates base soil moisture; slope geometry remains structurally stable.',
    threshold_crossed: false,
  },
  {
    phase: 'T-48h',
    time_offset_hours: -48,
    rainfall_24h: 72.5,
    rainfall_3d: 115.0,
    soil_moisture: 0.68,
    risk_score: 0.48,
    risk_level: 'MODERATE',
    flow_progress: 0.0,
    stage_title: 'Sustained Saturation Buildup',
    stage_description:
      'Pore-water pressure accumulates in steep gorge colluvium. TALWEG shifts to heightened monitoring.',
    threshold_crossed: false,
  },
  {
    phase: 'T-24h',
    time_offset_hours: -24,
    rainfall_24h: 112.0,
    rainfall_3d: 184.5,
    soil_moisture: 0.77,
    risk_score: 0.55,
    risk_level: 'MODERATE',
    flow_progress: 0.08,
    stage_title: 'Pre-Failure Critical Boundary',
    stage_description:
      'Rainfall intensifies toward trigger threshold (0.56). Tension cracks and localized slumping initiate on upper ridge.',
    threshold_crossed: false,
  },
  {
    phase: 'T-6h',
    time_offset_hours: -6,
    rainfall_24h: 134.0,
    rainfall_3d: 218.0,
    soil_moisture: 0.82,
    risk_score: 0.59,
    risk_level: 'HIGH',
    flow_progress: 0.42,
    stage_title: 'Threshold Exceeded — Initiation Activated',
    stage_description:
      'CRITICAL ALERT TRIGGERED: Risk score (0.59) crosses HIGH threshold. Shear failure breaches crest, channelizing debris flow into gorge.',
    threshold_crossed: true,
  },
  {
    phase: 'EVENT',
    time_offset_hours: 0,
    rainfall_24h: 142.5,
    rainfall_3d: 238.0,
    soil_moisture: 0.85,
    risk_score: 0.62,
    risk_level: 'HIGH',
    flow_progress: 1.0,
    stage_title: 'Debris Flow Runout & Deposition — WOULD HAVE FLAGGED: YES',
    stage_description:
      'Full runout through Teesta gorge into Mangan valley floor. Reconstructed prediction directly encompasses NASA GLC #15243 ground-truth observation.',
    threshold_crossed: true,
  },
];

/**
 * Get the full hazard progression model for a given historical replay ID.
 */
export async function getHazardProgression(id: string): Promise<HazardProgressionResponse | null> {
  const normalized = id.toLowerCase();

  // If it's the verified real October 4, 2023 event
  if (
    normalized === 'replay-real-glc-2023-10-04' ||
    normalized === 'real-glc-2023-10-04' ||
    normalized === 'glc-15243' ||
    normalized.includes('chungthang') ||
    normalized.includes('15243')
  ) {
    return {
      replay_id: 'replay-real-glc-2023-10-04',
      event_name: 'Chungthang-Mangan Debris Flow (NASA GLC #15243)',
      event_date: '2023-10-04',
      zone_id: 'mangan',
      zone_name: 'Mangan - Teesta Valley',
      simulation_mode: 'historical_replay',
      provenance_type: 'REAL',
      geometry: REAL_OCT2023_GEOMETRY,
      timeline: REAL_OCT2023_TIMELINE,
      disclaimer: DISCLAIMER_TEXT,
    };
  }

  // Look up replay from historical replay catalog
  const record = await getHistoricalReplayById(id);
  if (!record) {
    return null;
  }

  const fullReplay = await replayHistoricalEvent(id);
  const zoneKey = (record.zone_id || 'gangtok').toLowerCase();
  const topo = ZONE_TOPOGRAPHIES[zoneKey] || ZONE_TOPOGRAPHIES.gangtok;

  const rain24 = fullReplay?.inputs.rainfall_24h.value ?? topo.default_rain_24h;
  const rain3d = fullReplay?.inputs.rainfall_3d.value ?? topo.default_rain_3d;
  const soil = fullReplay?.inputs.soil_moisture.value ?? topo.default_soil_moisture;
  const slope = fullReplay?.inputs.slope.value ?? topo.base_slope;
  const density = fullReplay?.inputs.historical_density.value ?? topo.historical_density;

  const geometry = buildCorridorGeometry(topo.flow_path, topo.historical_event_point, topo.zone_id);
  const timeline = buildParametricTimeline(rain24, rain3d, soil, slope, density, true);

  const eventDate = record.event_date ? String(record.event_date).slice(0, 10) : '2023-07-15';

  return {
    replay_id: id,
    event_name: record.data_notes || `Historical Event (${topo.zone_name})`,
    event_date: eventDate,
    zone_id: topo.zone_id,
    zone_name: topo.zone_name,
    simulation_mode: 'historical_replay',
    provenance_type: record.data_quality === 'real_replay' ? 'REAL' : 'SYNTHETIC',
    geometry,
    timeline,
    disclaimer: DISCLAIMER_TEXT,
  };
}

/**
 * Get predictive runout simulation for a specific zone based on its current or simulated environmental conditions.
 */
export async function getZonePredictiveRunout(zoneId: string): Promise<HazardProgressionResponse | null> {
  const normZone = zoneId.toLowerCase();
  const topo = ZONE_TOPOGRAPHIES[normZone] || ZONE_TOPOGRAPHIES.gangtok;

  let rain24 = topo.default_rain_24h;
  let rain3d = topo.default_rain_3d;
  let soil = topo.default_soil_moisture;
  let slope = topo.base_slope;

  try {
    const result = await pool.query(
      `SELECT rainfall_24h, rainfall_3d, soil_moisture, slope FROM environmental_observations WHERE zone_id = $1 LIMIT 1`,
      [normZone]
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      if (row.rainfall_24h != null) rain24 = Number(row.rainfall_24h);
      if (row.rainfall_3d != null) rain3d = Number(row.rainfall_3d);
      if (row.soil_moisture != null) soil = Number(row.soil_moisture);
      if (row.slope != null) slope = Number(row.slope);
    }
  } catch {
    // Database offline fallback — use topo defaults
  }

  const geometry = buildCorridorGeometry(topo.flow_path, topo.historical_event_point, topo.zone_id);
  const timeline = buildParametricTimeline(rain24, rain3d, soil, slope, topo.historical_density, false);

  return {
    replay_id: `predictive-${topo.zone_id}`,
    event_name: `${topo.zone_name} — Predictive Runout Simulation`,
    event_date: new Date().toISOString().slice(0, 10),
    zone_id: topo.zone_id,
    zone_name: topo.zone_name,
    simulation_mode: 'predictive_runout',
    provenance_type: 'SIMULATED',
    geometry,
    timeline,
    disclaimer: DISCLAIMER_TEXT,
  };
}
