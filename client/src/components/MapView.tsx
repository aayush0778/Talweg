import React, { useEffect, useRef, useState } from 'react';
import maplibregl, { GeoJSONSource, MapLayerMouseEvent, MapMouseEvent } from 'maplibre-gl';
import { Region, RiskZone, LandslideEvent } from '../types/api';
import { MAP_STYLE, PANEL_WIDTH, DEFAULT_CENTER, DEFAULT_ZOOM } from '../config/map';
import { toZoneFeatureCollection, toEventFeatureCollection, toZoneLabelFeatures } from '../lib/geo';
import { buildEventPopup } from '../lib/popup';
import { MapLegend } from './MapLegend';

interface MapViewProps {
  regions: Region[] | null;
  zones: RiskZone[] | null;
  events: LandslideEvent[] | null;
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  regions,
  zones,
  events,
  selectedZoneId,
  onSelectZone,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const didFitRef = useRef<boolean>(false);
  const [mapReady, setMapReady] = useState<boolean>(false);
  const [terrain3D, setTerrain3D] = useState<boolean>(false);

  const DEFAULT_TERRAIN_DEM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

  function enable3DTerrain(map: maplibregl.Map): boolean {
    const url = import.meta.env.VITE_TERRAIN_DEM_URL || DEFAULT_TERRAIN_DEM_URL;
    try {
      if (!map.getSource('terrain-dem')) {
        map.addSource('terrain-dem', {
          type: 'raster-dem',
          tiles: [url],
          encoding: 'terrarium',
          tileSize: 256,
          maxzoom: 15,
        });
      }
      map.setTerrain({ source: 'terrain-dem', exaggeration: 1.25 });
    } catch (e) {
      console.warn('[map] Could not attach 3D raster terrain source, applying 3D pitch perspective', e);
    }
    map.easeTo({ pitch: 55, duration: 900 });
    return true;
  }

  function disable3DTerrain(map: maplibregl.Map): void {
    try {
      map.setTerrain(null);
    } catch {
      // Ignored if terrain was not active
    }
    map.easeTo({ pitch: 0, duration: 700 });
  }

  const handleToggleTerrain = () => {
    if (!mapRef.current) return;
    if (!terrain3D) {
      enable3DTerrain(mapRef.current);
      setTerrain3D(true);
    } else {
      disable3DTerrain(mapRef.current);
      setTerrain3D(false);
    }
  };

  const closePopup = () => {
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
  };

  // ----- Effect 1: Map Initialization & Cleanup (StrictMode Safe) -----
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
    });

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'bottom-right');

    // Non-fatal error logger for tile/font dropouts
    map.on('error', (e) => {
      console.warn('[MapLibre Warning]', e?.error?.message ?? e);
    });

    map.on('load', () => {
      // 1. Add empty GeoJSON sources (decouples data arrival from map ready timing)
      map.addSource('zones', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource('events', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource('zone-labels', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // 2. Add visual layers in order
      map.addLayer({
        id: 'zones-fill',
        type: 'fill',
        source: 'zones',
        paint: {
          'fill-color': [
            'match',
            ['get', 'risk_level'],
            'LOW',
            '#22c55e',
            'MODERATE',
            '#eab308',
            'HIGH',
            '#f97316',
            'SEVERE',
            '#dc2626',
            '#64748b',
          ],
          'fill-opacity': 0.4,
        },
      });

      map.addLayer({
        id: 'zones-outline',
        type: 'line',
        source: 'zones',
        paint: {
          'line-color': [
            'match',
            ['get', 'risk_level'],
            'LOW',
            '#22c55e',
            'MODERATE',
            '#eab308',
            'HIGH',
            '#f97316',
            'SEVERE',
            '#dc2626',
            '#64748b',
          ],
          'line-width': 1.8,
          'line-opacity': 0.9,
        },
      });

      map.addLayer({
        id: 'zones-selected',
        type: 'line',
        source: 'zones',
        paint: {
          'line-color': '#ffffff',
          'line-width': 3.5,
          'line-opacity': 1.0,
        },
        filter: ['==', ['get', 'id'], ''],
      });

      map.addLayer({
        id: 'events-circles',
        type: 'circle',
        source: 'events',
        paint: {
          'circle-radius': 5.5,
          'circle-color': '#1e293b',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.9,
        },
      });

      map.addLayer({
        id: 'zone-labels',
        type: 'symbol',
        source: 'zone-labels',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
          'text-transform': 'uppercase',
          'text-anchor': 'center',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#0f172a',
          'text-halo-width': 1.5,
        },
      });

      setMapReady(true);
    });

    return () => {
      closePopup();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // ----- Effect 2: Sync Risk Zones & Centroid Labels -----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !zones) return;

    const zoneSource = map.getSource('zones') as GeoJSONSource | undefined;
    if (zoneSource) {
      zoneSource.setData(toZoneFeatureCollection(zones));
    }

    const labelSource = map.getSource('zone-labels') as GeoJSONSource | undefined;
    if (labelSource) {
      labelSource.setData(toZoneLabelFeatures(zones));
    }
  }, [mapReady, zones]);

  // ----- Effect 3: Sync Historical Events -----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !events) return;

    const eventSource = map.getSource('events') as GeoJSONSource | undefined;
    if (eventSource) {
      eventSource.setData(toEventFeatureCollection(events));
    }
  }, [mapReady, events]);

  // ----- Effect 4: One-time Initial Camera Bounds Fit -----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !regions || regions.length === 0 || didFitRef.current) return;

    const bounds = regions[0]?.bounds;
    if (bounds && bounds.length === 4) {
      map.fitBounds(
        [
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]],
        ],
        {
          padding: { top: 40, bottom: 40, left: 40, right: PANEL_WIDTH + 40 },
          duration: 1200,
        }
      );
      didFitRef.current = true;
    }
  }, [mapReady, regions]);

  // ----- Effect 5: Selection Highlight Filter -----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (map.getLayer('zones-selected')) {
      map.setFilter(
        'zones-selected',
        selectedZoneId ? ['==', ['get', 'id'], selectedZoneId] : ['==', ['get', 'id'], '']
      );
    }
  }, [mapReady, selectedZoneId]);

  // ----- Effect 6: Fly to Selected Zone Centroid -----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !selectedZoneId || !zones) return;

    const target = zones.find((z) => z.id === selectedZoneId);
    if (target?.centroid) {
      if (terrain3D) {
        map.flyTo({
          center: [target.centroid.longitude, target.centroid.latitude],
          zoom: 12.2,
          pitch: 55,
          bearing: 15,
          duration: 1200,
          padding: { top: 40, bottom: 40, left: 40, right: PANEL_WIDTH + 40 },
        });
      } else {
        map.flyTo({
          center: [target.centroid.longitude, target.centroid.latitude],
          zoom: 11.5,
          duration: 1200,
          padding: { top: 40, bottom: 40, left: 40, right: PANEL_WIDTH + 40 },
        });
      }
    }
  }, [mapReady, selectedZoneId, zones, terrain3D]);

  // ----- Effect 7: Map Interactions & Event Popups -----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const onZoneClick = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (f?.properties?.id) {
        onSelectZone(String(f.properties.id));
      }
    };

    const onEventClick = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f || !f.properties) return;

      closePopup();

      popupRef.current = new maplibregl.Popup({
        offset: 8,
        closeButton: true,
        className: 'slopeguard-map-popup',
      })
        .setLngLat(e.lngLat)
        .setDOMContent(buildEventPopup(f.properties as Record<string, unknown>))
        .addTo(map);
    };

    const onMapClick = (e: MapMouseEvent) => {
      // Close popup if clicking on blank canvas
      const queryFeatures = map.queryRenderedFeatures(e.point, {
        layers: ['events-circles', 'zones-fill'],
      });
      if (queryFeatures.length === 0) {
        closePopup();
      }
    };

    const onMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };

    const onMouseLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on('click', 'zones-fill', onZoneClick);
    map.on('click', 'events-circles', onEventClick);
    map.on('click', onMapClick);

    map.on('mouseenter', 'zones-fill', onMouseEnter);
    map.on('mouseleave', 'zones-fill', onMouseLeave);
    map.on('mouseenter', 'events-circles', onMouseEnter);
    map.on('mouseleave', 'events-circles', onMouseLeave);

    return () => {
      map.off('click', 'zones-fill', onZoneClick);
      map.off('click', 'events-circles', onEventClick);
      map.off('click', onMapClick);
      map.off('mouseenter', 'zones-fill', onMouseEnter);
      map.off('mouseleave', 'zones-fill', onMouseLeave);
      map.off('mouseenter', 'events-circles', onMouseEnter);
      map.off('mouseleave', 'events-circles', onMouseLeave);
      closePopup();
    };
  }, [mapReady, onSelectZone]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <MapLegend />
      <button
        onClick={handleToggleTerrain}
        className={`absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-lg text-xs font-semibold tracking-wide transition-all cursor-pointer border ${
          terrain3D
            ? 'bg-emerald-600 text-white border-emerald-400 shadow-emerald-950/50'
            : 'bg-slate-900/90 text-slate-200 border-slate-700/80 hover:bg-slate-800 hover:text-white'
        }`}
        title={terrain3D ? 'Switch to 2D Top-down View' : 'Explore in 3D Terrain View'}
      >
        <span>🏔️</span>
        <span>{terrain3D ? '2D View' : '3D Terrain'}</span>
      </button>
    </div>
  );
};
