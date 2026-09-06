export interface FallbackRegion {
  id: string;
  name: string;
  state: string;
  min_x: number;
  min_y: number;
  max_x: number;
  max_y: number;
  geometry: {
    type: string;
    coordinates: number[][][];
  };
}

export interface FallbackZone {
  id: string;
  region_id: string;
  name: string;
  description: string;
  base_slope: number;
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  centroid_lat: number;
  centroid_lng: number;
  rainfall_24h: number;
  rainfall_3d: number;
  rainfall_7d: number;
  soil_moisture: number;
  obs_slope: number;
  obs_timestamp: string;
  obs_source: string;
  historical_density: number;
}

export interface FallbackEvent {
  id: string;
  date: string;
  latitude: number;
  longitude: number;
  trigger: string;
  category: string;
  fatalities: number;
  description: string;
  source: string;
  zone_id: string;
  geometry: {
    type: string;
    coordinates: number[];
  };
}

export const FALLBACK_REGIONS: FallbackRegion[] = [
  {
    id: 'sikkim',
    name: 'Sikkim',
    state: 'Sikkim',
    min_x: 88.0,
    min_y: 27.08,
    max_x: 88.92,
    max_y: 28.13,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [88.0, 27.08],
          [88.92, 27.08],
          [88.92, 28.13],
          [88.0, 28.13],
          [88.0, 27.08],
        ],
      ],
    },
  },
];

export const FALLBACK_ZONES: FallbackZone[] = [
  {
    id: 'gangtok',
    region_id: 'sikkim',
    name: 'Gangtok Corridor',
    description:
      'State capital and NH10 highway corridor. Steep terrain with dense habitation and significant historical landslide activity.',
    base_slope: 19.6,
    centroid_lat: 27.34,
    centroid_lng: 88.615,
    rainfall_24h: 91.4,
    rainfall_3d: 137.2,
    rainfall_7d: 165.5,
    soil_moisture: 0.82,
    obs_slope: 19.6,
    obs_timestamp: '2023-07-13T06:00:00Z',
    obs_source: 'chirps_imd',
    historical_density: 13,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [88.58, 27.3],
          [88.65, 27.3],
          [88.65, 27.38],
          [88.58, 27.38],
          [88.58, 27.3],
        ],
      ],
    },
  },
  {
    id: 'mangan',
    region_id: 'sikkim',
    name: 'Mangan - Teesta Valley',
    description:
      'North Sikkim district headquarters along the Teesta River valley. Prone to flash floods and debris flows.',
    base_slope: 30.6,
    centroid_lat: 27.515,
    centroid_lng: 88.54,
    rainfall_24h: 177.8,
    rainfall_3d: 398.1,
    rainfall_7d: 545.0,
    soil_moisture: 0.86,
    obs_slope: 30.6,
    obs_timestamp: '2023-07-13T06:00:00Z',
    obs_source: 'chirps_imd',
    historical_density: 5,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [88.5, 27.48],
          [88.58, 27.48],
          [88.58, 27.55],
          [88.5, 27.55],
          [88.5, 27.48],
        ],
      ],
    },
  },
  {
    id: 'namchi',
    region_id: 'sikkim',
    name: 'Namchi Zone',
    description:
      'South Sikkim district headquarters. Moderate slopes with seasonal rainfall-triggered slides.',
    base_slope: 23.7,
    centroid_lat: 27.185,
    centroid_lng: 88.36,
    rainfall_24h: 98.5,
    rainfall_3d: 157.8,
    rainfall_7d: 229.7,
    soil_moisture: 0.80,
    obs_slope: 23.7,
    obs_timestamp: '2023-07-13T06:00:00Z',
    obs_source: 'chirps_imd',
    historical_density: 6,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [88.32, 27.15],
          [88.4, 27.15],
          [88.4, 27.22],
          [88.32, 27.22],
          [88.32, 27.15],
        ],
      ],
    },
  },
  {
    id: 'pakyong',
    region_id: 'sikkim',
    name: 'Pakyong Area',
    description:
      'Airport corridor with extensive slope modification and cut-and-fill construction.',
    base_slope: 24.0,
    centroid_lat: 27.265,
    centroid_lng: 88.62,
    rainfall_24h: 77.3,
    rainfall_3d: 117.6,
    rainfall_7d: 189.8,
    soil_moisture: 0.78,
    obs_slope: 24.0,
    obs_timestamp: '2023-07-13T06:00:00Z',
    obs_source: 'chirps_imd',
    historical_density: 2,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [88.58, 27.23],
          [88.66, 27.23],
          [88.66, 27.3],
          [88.58, 27.3],
          [88.58, 27.23],
        ],
      ],
    },
  },
  {
    id: 'gyalshing',
    region_id: 'sikkim',
    name: 'Gyalshing - West Sikkim',
    description:
      'West Sikkim administrative center. Moderate to steep forested slopes with localized failures.',
    base_slope: 21.3,
    centroid_lat: 27.315,
    centroid_lng: 88.29,
    rainfall_24h: 27.3,
    rainfall_3d: 40.0,
    rainfall_7d: 80.8,
    soil_moisture: 0.70,
    obs_slope: 21.3,
    obs_timestamp: '2023-07-13T06:00:00Z',
    obs_source: 'chirps_imd',
    historical_density: 4,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [88.25, 27.28],
          [88.33, 27.28],
          [88.33, 27.35],
          [88.25, 27.35],
          [88.25, 27.28],
        ],
      ],
    },
  },
  {
    id: 'soreng',
    region_id: 'sikkim',
    name: 'Soreng Sub-division',
    description:
      'Border zone with agricultural terracing and Rangit River drainage influence.',
    base_slope: 20.4,
    centroid_lat: 27.195,
    centroid_lng: 88.24,
    rainfall_24h: 164.6,
    rainfall_3d: 348.9,
    rainfall_7d: 534.4,
    soil_moisture: 0.85,
    obs_slope: 20.4,
    obs_timestamp: '2023-07-13T06:00:00Z',
    obs_source: 'chirps_imd',
    historical_density: 3,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [88.2, 27.16],
          [88.28, 27.16],
          [88.28, 27.23],
          [88.2, 27.23],
          [88.2, 27.16],
        ],
      ],
    },
  },
];

export const FALLBACK_EVENTS: FallbackEvent[] = [
  {
    id: 'evt-001',
    date: '2023-10-04',
    latitude: 27.3389,
    longitude: 88.6065,
    trigger: 'rain',
    category: 'landslide',
    fatalities: 2,
    description: 'Monsoon-triggered debris flow along NH10 near Gangtok',
    source: 'synthetic_seed',
    zone_id: 'gangtok',
    geometry: { type: 'Point', coordinates: [88.6065, 27.3389] },
  },
  {
    id: 'evt-002',
    date: '2022-08-15',
    latitude: 27.325,
    longitude: 88.612,
    trigger: 'rain',
    category: 'landslide',
    fatalities: 0,
    description: 'Road-blocking slide near 7th Mile, Gangtok',
    source: 'synthetic_seed',
    zone_id: 'gangtok',
    geometry: { type: 'Point', coordinates: [88.612, 27.325] },
  },
  {
    id: 'evt-003',
    date: '2021-07-22',
    latitude: 27.345,
    longitude: 88.62,
    trigger: 'rain',
    category: 'debris_flow',
    fatalities: 1,
    description: 'Debris flow in Chandmari area during heavy rain',
    source: 'synthetic_seed',
    zone_id: 'gangtok',
    geometry: { type: 'Point', coordinates: [88.62, 27.345] },
  },
  {
    id: 'evt-004',
    date: '2023-06-18',
    latitude: 27.31,
    longitude: 88.595,
    trigger: 'rain',
    category: 'landslide',
    fatalities: 0,
    description: 'Minor slope failure near Ranipool',
    source: 'synthetic_seed',
    zone_id: 'gangtok',
    geometry: { type: 'Point', coordinates: [88.595, 27.31] },
  },
  {
    id: 'evt-005',
    date: '2020-09-10',
    latitude: 27.355,
    longitude: 88.63,
    trigger: 'rain',
    category: 'rockfall',
    fatalities: 0,
    description: 'Rockfall on bypass road during prolonged rain',
    source: 'synthetic_seed',
    zone_id: 'gangtok',
    geometry: { type: 'Point', coordinates: [88.63, 27.355] },
  },
  {
    id: 'evt-006',
    date: '2023-10-04',
    latitude: 27.505,
    longitude: 88.535,
    trigger: 'rain',
    category: 'debris_flow',
    fatalities: 5,
    description: 'GLOF-triggered debris flow in Teesta valley near Mangan',
    source: 'synthetic_seed',
    zone_id: 'mangan',
    geometry: { type: 'Point', coordinates: [88.535, 27.505] },
  },
  {
    id: 'evt-007',
    date: '2022-07-30',
    latitude: 27.52,
    longitude: 88.55,
    trigger: 'rain',
    category: 'landslide',
    fatalities: 0,
    description: 'Landslide blocking North Sikkim Highway near Mangan',
    source: 'synthetic_seed',
    zone_id: 'mangan',
    geometry: { type: 'Point', coordinates: [88.55, 27.52] },
  },
  {
    id: 'evt-008',
    date: '2021-08-05',
    latitude: 27.495,
    longitude: 88.525,
    trigger: 'rain',
    category: 'landslide',
    fatalities: 1,
    description: 'Slope collapse along Teesta riverbank',
    source: 'synthetic_seed',
    zone_id: 'mangan',
    geometry: { type: 'Point', coordinates: [88.525, 27.495] },
  },
  {
    id: 'evt-009',
    date: '2022-09-12',
    latitude: 27.17,
    longitude: 88.35,
    trigger: 'rain',
    category: 'landslide',
    fatalities: 0,
    description: 'Minor slide near Namchi bazaar area',
    source: 'synthetic_seed',
    zone_id: 'namchi',
    geometry: { type: 'Point', coordinates: [88.35, 27.17] },
  },
  {
    id: 'evt-010',
    date: '2023-07-25',
    latitude: 27.195,
    longitude: 88.375,
    trigger: 'rain',
    category: 'landslide',
    fatalities: 0,
    description: 'Seasonal slope failure south of Namchi',
    source: 'synthetic_seed',
    zone_id: 'namchi',
    geometry: { type: 'Point', coordinates: [88.375, 27.195] },
  },
  {
    id: 'evt-011',
    date: '2022-06-20',
    latitude: 27.25,
    longitude: 88.61,
    trigger: 'rain',
    category: 'landslide',
    fatalities: 0,
    description: 'Cut-slope failure near Pakyong airport road',
    source: 'synthetic_seed',
    zone_id: 'pakyong',
    geometry: { type: 'Point', coordinates: [88.61, 27.25] },
  },
  {
    id: 'evt-012',
    date: '2023-08-08',
    latitude: 27.275,
    longitude: 88.635,
    trigger: 'rain',
    category: 'debris_flow',
    fatalities: 0,
    description: 'Debris flow along construction area near Pakyong',
    source: 'synthetic_seed',
    zone_id: 'pakyong',
    geometry: { type: 'Point', coordinates: [88.635, 27.275] },
  },
  {
    id: 'evt-013',
    date: '2021-09-15',
    latitude: 27.3,
    longitude: 88.275,
    trigger: 'rain',
    category: 'landslide',
    fatalities: 0,
    description: 'Seasonal slide west of Gyalshing town',
    source: 'synthetic_seed',
    zone_id: 'gyalshing',
    geometry: { type: 'Point', coordinates: [88.275, 27.3] },
  },
  {
    id: 'evt-014',
    date: '2023-07-10',
    latitude: 27.18,
    longitude: 88.225,
    trigger: 'rain',
    category: 'landslide',
    fatalities: 0,
    description: 'Slope instability near Soreng along Rangit basin',
    source: 'synthetic_seed',
    zone_id: 'soreng',
    geometry: { type: 'Point', coordinates: [88.225, 27.18] },
  },
  {
    id: 'evt-015',
    date: '2022-08-28',
    latitude: 27.21,
    longitude: 88.255,
    trigger: 'rain',
    category: 'debris_flow',
    fatalities: 1,
    description: 'Debris flow during intense monsoon rain near Soreng',
    source: 'synthetic_seed',
    zone_id: 'soreng',
    geometry: { type: 'Point', coordinates: [88.255, 27.21] },
  },
];

export const FALLBACK_ALERTS: any[] = [];
