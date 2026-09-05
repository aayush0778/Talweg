import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import maplibregl, { GeoJSONSource, MapLayerMouseEvent, MapMouseEvent } from 'maplibre-gl';
import { Region, RiskZone, LandslideEvent } from '../types/api';
import { MAP_STYLE, PANEL_WIDTH, DEFAULT_CENTER, DEFAULT_ZOOM } from '../config/map';
import { toZoneFeatureCollection, toEventFeatureCollection, toZoneLabelFeatures } from '../lib/geo';
import { buildEventPopup } from '../lib/popup';
import { MapLegend } from './MapLegend';

export interface MapViewHandle {
  triggerTopView: () => void;
  triggerFrontView: () => void;
  toggle3D: () => void;
}

export interface MapViewProps {
  regions: Region[] | null;
  zones: RiskZone[] | null;
  events: LandslideEvent[] | null;
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
  mapViewMode?: 'top' | 'focus';
  onMapViewModeChange?: (mode: 'top' | 'focus') => void;
  sidebarWidth?: number;
  terrain3D?: boolean;
  onTerrain3DChange?: (enabled: boolean) => void;
}

export const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  {
    regions,
    zones,
    events,
    selectedZoneId,
    onSelectZone,
    mapViewMode,
    onMapViewModeChange,
    sidebarWidth,
    terrain3D: controlledTerrain3D,
    onTerrain3DChange,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const didFitRef = useRef<boolean>(false);
  const [mapReady, setMapReady] = useState<boolean>(false);
  const [internalTerrain3D, setInternalTerrain3D] = useState<boolean>(false);
  const [internalViewMode, setInternalViewMode] = useState<'top' | 'focus'>('top');

  const terrain3D = controlledTerrain3D ?? internalTerrain3D;
  const activeViewMode = mapViewMode ?? internalViewMode;
  const effectiveSidebarWidth = sidebarWidth ?? PANEL_WIDTH;

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

  const handleTopView = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (terrain3D) {
      disable3DTerrain(map);
      setInternalTerrain3D(false);
      onTerrain3DChange?.(false);
    }
    if (onMapViewModeChange) {
      onMapViewModeChange('top');
    } else {
      setInternalViewMode('top');
    }
    const bounds = regions?.[0]?.bounds || [88.0, 27.08, 88.92, 28.13];
    map.fitBounds(
      [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ],
      {
        padding: { top: 50, bottom: 50, left: 50, right: effectiveSidebarWidth + 50 },
        pitch: 0,
        bearing: 0,
        duration: 900,
      }
    );
  }, [regions, terrain3D, effectiveSidebarWidth, onMapViewModeChange, onTerrain3DChange]);

  const handleFocusZone = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const targetId = selectedZoneId || (zones && zones.length > 0 ? zones[0].id : null);
    if (targetId && !selectedZoneId) {
      onSelectZone(targetId);
    }

    if (onMapViewModeChange) {
      onMapViewModeChange('focus');
    } else {
      setInternalViewMode('focus');
    }

    const target = zones?.find((z) => z.id === targetId);
    if (target?.centroid) {
      if (terrain3D) {
        map.flyTo({
          center: [target.centroid.longitude, target.centroid.latitude],
          zoom: 12.2,
          pitch: 55,
          bearing: 15,
          duration: 1100,
          padding: { top: 40, bottom: 40, left: 40, right: effectiveSidebarWidth + 40 },
        });
      } else {
        map.flyTo({
          center: [target.centroid.longitude, target.centroid.latitude],
          zoom: 11.5,
          pitch: 0,
          bearing: 0,
          duration: 1100,
          padding: { top: 40, bottom: 40, left: 40, right: effectiveSidebarWidth + 40 },
        });
      }
    }
  }, [selectedZoneId, zones, terrain3D, effectiveSidebarWidth, onSelectZone, onMapViewModeChange]);

  const handleToggleTerrain = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!terrain3D) {
      enable3DTerrain(map);
      setInternalTerrain3D(true);
      onTerrain3DChange?.(true);
      const target = zones?.find((z) => z.id === selectedZoneId);
      if (target?.centroid) {
        map.flyTo({
          center: [target.centroid.longitude, target.centroid.latitude],
          zoom: 12.2,
          pitch: 55,
          bearing: 15,
          duration: 1000,
          padding: { top: 40, bottom: 40, left: 40, right: effectiveSidebarWidth + 40 },
        });
      } else {
        map.easeTo({ pitch: 55, bearing: 15, duration: 900 });
      }
    } else {
      disable3DTerrain(map);
      setInternalTerrain3D(false);
      onTerrain3DChange?.(false);
      if (activeViewMode === 'top' || !selectedZoneId) {
        const bounds = regions?.[0]?.bounds || [88.0, 27.08, 88.92, 28.13];
        map.fitBounds(
          [
            [bounds[0], bounds[1]],
            [bounds[2], bounds[3]],
          ],
          {
            padding: { top: 50, bottom: 50, left: 50, right: effectiveSidebarWidth + 50 },
            pitch: 0,
            bearing: 0,
            duration: 800,
          }
        );
      } else {
        map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
      }
    }
  }, [terrain3D, zones, selectedZoneId, activeViewMode, regions, effectiveSidebarWidth, onTerrain3DChange]);

  useImperativeHandle(
    ref,
    () => ({
      triggerTopView: handleTopView,
      triggerFrontView: handleFocusZone,
      toggle3D: handleToggleTerrain,
    }),
    [handleTopView, handleFocusZone, handleToggleTerrain]
  );

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

    const bounds = regions[0]?.bounds || [88.0, 27.08, 88.92, 28.13];
    if (bounds && bounds.length === 4) {
      map.fitBounds(
        [
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]],
        ],
        {
          padding: { top: 50, bottom: 50, left: 50, right: effectiveSidebarWidth + 50 },
          pitch: 0,
          bearing: 0,
          duration: 1200,
        }
      );
      didFitRef.current = true;
    }
  }, [mapReady, regions, effectiveSidebarWidth]);

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

  // ----- Effect 6: Fly to Selected Zone Centroid or Preserve Top View -----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !zones) return;

    if (!selectedZoneId) {
      if (activeViewMode === 'top' && !terrain3D) {
        const bounds = regions?.[0]?.bounds || [88.0, 27.08, 88.92, 28.13];
        map.fitBounds(
          [
            [bounds[0], bounds[1]],
            [bounds[2], bounds[3]],
          ],
          {
            padding: { top: 50, bottom: 50, left: 50, right: effectiveSidebarWidth + 50 },
            pitch: 0,
            bearing: 0,
            duration: 800,
          }
        );
      }
      return;
    }

    if (activeViewMode === 'top' && !terrain3D) {
      // In Top View, maintain regional nadir view framing with 0° pitch/bearing
      const bounds = regions?.[0]?.bounds || [88.0, 27.08, 88.92, 28.13];
      map.fitBounds(
        [
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]],
        ],
        {
          padding: { top: 50, bottom: 50, left: 50, right: effectiveSidebarWidth + 50 },
          pitch: 0,
          bearing: 0,
          duration: 800,
        }
      );
      return;
    }

    const target = zones.find((z) => z.id === selectedZoneId);
    if (target?.centroid) {
      if (terrain3D) {
        map.flyTo({
          center: [target.centroid.longitude, target.centroid.latitude],
          zoom: 12.2,
          pitch: 55,
          bearing: 15,
          duration: 1200,
          padding: { top: 40, bottom: 40, left: 40, right: effectiveSidebarWidth + 40 },
        });
      } else {
        map.flyTo({
          center: [target.centroid.longitude, target.centroid.latitude],
          zoom: 11.5,
          pitch: 0,
          bearing: 0,
          duration: 1200,
          padding: { top: 40, bottom: 40, left: 40, right: effectiveSidebarWidth + 40 },
        });
      }
    }
  }, [mapReady, selectedZoneId, zones, terrain3D, activeViewMode, regions, effectiveSidebarWidth]);

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

      {/* Floating Map Perspective & Terrain Controller */}
      <div className="absolute top-4 left-4 z-10 flex items-center bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 shadow-2xl space-x-1">
        <button
          onClick={handleTopView}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
            activeViewMode === 'top' && !terrain3D
              ? 'bg-blue-600 text-white shadow-md shadow-blue-950/50'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
          title="Top View [T] (State Overview - Nadir 0°)"
        >
          <span>🗺️</span>
          <span>Top View</span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800/90 text-[10px] text-slate-300 font-mono border border-slate-700/80">T</kbd>
        </button>

        <button
          onClick={handleFocusZone}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
            activeViewMode === 'focus' && !terrain3D
              ? 'bg-blue-600 text-white shadow-md shadow-blue-950/50'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
          title="Front / Focus View [F] (Focus on Zone Centroid)"
        >
          <span>🎯</span>
          <span>{selectedZoneId ? 'Focus Zone' : 'Front View'}</span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800/90 text-[10px] text-slate-300 font-mono border border-slate-700/80">F</kbd>
        </button>

        <div className="w-[1px] h-4 bg-slate-700 mx-1" />

        <button
          onClick={handleToggleTerrain}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
            terrain3D
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
          title={terrain3D ? 'Disable 3D Terrain [D] (Return to 2D Top View)' : 'Explore in 3D Relief Terrain [D] (55° Pitch)'}
        >
          <span>🏔️</span>
          <span>{terrain3D ? '3D Active' : '3D Terrain'}</span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800/90 text-[10px] text-slate-300 font-mono border border-slate-700/80">D</kbd>
        </button>
      </div>
    </div>
  );
};
