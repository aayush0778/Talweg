import type { StyleSpecification } from 'maplibre-gl';

export const PANEL_WIDTH = 400;
export const DEFAULT_CENTER: [number, number] = [88.55, 27.6]; // Sikkim center
export const DEFAULT_ZOOM = 7.6;

/**
 * Keyless MapLibre style specification using ESRI World Imagery raster basemap
 * and MapLibre demotiles font glyphs.
 * Includes a dark slate background layer as fallback if internet is unavailable.
 */
export const MAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    basemap: {
      type: 'raster',
      // Note z/y/x tile order for ESRI MapServer
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 18,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#0f172a' },
    },
    {
      id: 'basemap',
      type: 'raster',
      source: 'basemap',
    },
  ],
};
