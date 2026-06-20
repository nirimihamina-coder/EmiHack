import { useEffect, useState, useCallback, useRef } from 'react';
import L from 'leaflet';
import boundaryFianarantsoaRaw from '../data/fianarantsoa-boundary.json';
import { useRoadsStore, getAllRoads, getRoadsGeoJSON } from '../stores/roads';
import { SimulationEngine } from '../simulation/engine';
import { useSimulationStore } from '../stores/simulation';
import type { MapLayerConfig, GeoJSONFeature, GeoJSONCollection } from '../interface/Map';
import type { SpeedMode, VehiclePosition } from '../simulation/types';

// ── Constants ────────────────────────────────────────────────────────────────
const TILES = {
  osm: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: 'OpenStreetMap' },
  topo: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: 'OpenTopoMap' },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri',
  },
} as const;

type TileKey = keyof typeof TILES;

const DEFAULT_STYLES: Record<string, L.PathOptions> = {
  adminBoundary: { color: '#1d4ed8', weight: 2, fillColor: '#3b82f6', fillOpacity: 0.08 },
  roadPrimary: { color: '#f97316', weight: 3.5, fillOpacity: 0, lineCap: 'round', lineJoin: 'round' },
  roadSecondary: { color: '#eab308', weight: 2.8, fillOpacity: 0, lineCap: 'round', lineJoin: 'round' },
  roadTertiary: { color: '#334155', weight: 2.5, fillOpacity: 0, lineCap: 'round', lineJoin: 'round' },
  roadResidential: { color: '#475569', weight: 2, fillOpacity: 0, lineCap: 'round', lineJoin: 'round' },
  selected: { color: '#10b981', weight: 5, fillOpacity: 0, lineCap: 'round', lineJoin: 'round' },
};

export const vehicleIcons = {
  car: L.divIcon({ className: 'vehicle-icon', html: '🚗', iconSize: [20, 20] }),
  moto: L.divIcon({ className: 'vehicle-icon', html: '🏍️', iconSize: [20, 20] }),
  bike: L.divIcon({ className: 'vehicle-icon', html: '🚲', iconSize: [20, 20] }),
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function getDefaultStyleForKey(key: string): L.PathOptions {
  return DEFAULT_STYLES[key] ?? DEFAULT_STYLES.roadPrimary;
}

function getLayerStyleKey(feature: GeoJSONFeature): string {
  const props = feature.properties as Record<string, unknown> | undefined;
  const type = props?.type as string | undefined;
  if (type === 'primary') return 'roadPrimary';
  if (type === 'secondary') return 'roadSecondary';
  if (type === 'tertiary') return 'roadTertiary';
  if (type === 'residential') return 'roadResidential';
  return 'roadPrimary';
}

function getFeatureId(feature: GeoJSONFeature, layerId: string): string {
  const props = feature.properties ?? {};
  return (props.id as string) ?? `${layerId}-${(props.osmId as string) ?? Math.random()}`;
}

function mergeSegmentsIntoRings(segments: number[][][]): number[][][] {
  if (segments.length === 0) return [];
  const remaining = segments.map((s) => [...s]);
  const rings: number[][][] = [];
  while (remaining.length > 0) {
    let ring = [...remaining.shift()!];
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i];
        const ringEnd = ring[ring.length - 1];
        const segStart = seg[0];
        const segEnd = seg[seg.length - 1];
        const ringStart = ring[0];
        const eq = (a: number[], b: number[]) =>
          Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
        if (eq(ringEnd, segStart)) {
          ring = [...ring, ...seg.slice(1)];
          remaining.splice(i, 1);
          changed = true;
          break;
        } else if (eq(ringEnd, segEnd)) {
          ring = [...ring, ...[...seg].reverse().slice(1)];
          remaining.splice(i, 1);
          changed = true;
          break;
        } else if (eq(ringStart, segEnd)) {
          ring = [...seg, ...ring.slice(1)];
          remaining.splice(i, 1);
          changed = true;
          break;
        } else if (eq(ringStart, segStart)) {
          ring = [...[...seg].reverse(), ...ring.slice(1)];
          remaining.splice(i, 1);
          changed = true;
          break;
        }
      }
    }
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (Math.abs(first[0] - last[0]) > 1e-6 || Math.abs(first[1] - last[1]) > 1e-6) ring.push(ring[0]);
    if (ring.length >= 4) rings.push(ring);
  }
  return rings;
}

function overpassElementsToGeoJSON(elements: any[]): GeoJSON.FeatureCollection {
  const features = elements
    .map((el: any) => {
      const outerSegments: number[][][] = (el.members || [])
        .filter((m: any) => m.role === 'outer' && m.geometry?.length > 1)
        .map((m: any) => m.geometry.map((g: any) => [g.lon, g.lat]));
      const innerSegments: number[][][] = (el.members || [])
        .filter((m: any) => m.role === 'inner' && m.geometry?.length > 1)
        .map((m: any) => m.geometry.map((g: any) => [g.lon, g.lat]));
      if (!outerSegments.length) return null;
      const outerRings = mergeSegmentsIntoRings(outerSegments);
      const innerRings = mergeSegmentsIntoRings(innerSegments);
      if (!outerRings.length) return null;
      return {
        type: 'Feature',
        properties: { id: el.id, name: el.tags?.['name:fr'] || el.tags?.name || 'Fianarantsoa' },
        geometry: { type: 'MultiPolygon', coordinates: outerRings.map((outer) => [outer, ...innerRings]) },
      } as GeoJSON.Feature;
    })
    .filter(Boolean) as GeoJSON.Feature[];
  return { type: 'FeatureCollection', features };
}

function createBoundaryMask(boundary: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const world = [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]];
  const holes: number[][][] = [];
  for (const feature of boundary.features) {
    const geom = feature.geometry as GeoJSON.MultiPolygon | GeoJSON.Polygon;
    if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        for (const ring of poly) holes.push(ring as number[][]);
      }
    } else if (geom.type === 'Polygon') {
      for (const ring of geom.coordinates) holes.push(ring as number[][]);
    }
  }
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { id: 'mask', name: 'Mask' },
        geometry: { type: 'Polygon', coordinates: [world[0] as number[][], ...(holes as number[][][])] },
      },
    ],
  };
}

function loadBoundaryFromJson(): GeoJSON.FeatureCollection {
  const raw = boundaryFianarantsoaRaw as unknown as { elements?: any[] };
  if (!raw.elements?.length) throw new Error('Aucune donnée de limite dans le JSON');
  return overpassElementsToGeoJSON(raw.elements);
}

// ── Types ────────────────────────────────────────────────────────────────────
type SimParams = Record<string, { vehicleCount: number; speed: SpeedMode }>;

export interface UseSimulationReturn {
  // States
  layers: MapLayerConfig[];
  selectedRoads: Set<string>;
  loading: boolean;
  loadError: string | null;
  params: SimParams;
  tileKey: TileKey;
  positionsCount: number;
  configsCount: number;

  // Refs
  containerRef: React.RefObject<HTMLDivElement | null>;

  // Derived data
  selectedRoadObjects: ReturnType<typeof getAllRoads>;
  simRunningRoads: ReturnType<typeof useSimulationStore.getState>['configs'];

  // Handlers
  setTileKey: (key: TileKey) => void;
  handleDeselectRoad: (roadId: string) => void;
  handleStartSim: (roadId: string) => void;
  handleStopSim: (roadId: string) => void;
  handleRemoveSim: (roadId: string) => void;
  handleReset: () => void;
  setParams: React.Dispatch<React.SetStateAction<SimParams>>;

  // Helpers
  getSimState: (roadId: string) => { isRunning: boolean; isPaused: boolean };
  getParamsForRoad: (roadId: string) => { vehicleCount: number; speed: SpeedMode };
  toggleTile: (key: TileKey) => void;
  TILES: typeof TILES;
  DEFAULT_STYLES: typeof DEFAULT_STYLES;
}

// ── Hook principal ───────────────────────────────────────────────────────────
export default function useSimulation(): UseSimulationReturn {
  const [layers, setLayers] = useState<MapLayerConfig[]>([]);
  const [selectedRoads, setSelectedRoads] = useState<Set<string>>(new Set());
  const selectedRoadsRef = useRef(selectedRoads);
  useEffect(() => {
    selectedRoadsRef.current = selectedRoads;
  }, [selectedRoads]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [params, setParams] = useState<SimParams>({});
  const [tileKey, setTileKey] = useState<TileKey>('osm');

  const { configs, positions, addConfig, removeConfig, setRunning, setPositions, reset } =
    useSimulationStore();
  const { load: loadRoads, loaded: roadsLoaded, loading: roadsLoading } = useRoadsStore();

  const engineRef = useRef<SimulationEngine | null>(null);
  const vehicleLayerRef = useRef<L.LayerGroup | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const layerMapRef = useRef<Map<string, L.GeoJSON>>(new Map());
  const prevLayersJson = useRef('');

  const setPositionsRef = useRef(setPositions);
  useEffect(() => {
    setPositionsRef.current = setPositions;
  }, [setPositions]);

  // ── Chargement des routes via l'API ──────────────────────────────────────
  useEffect(() => {
    if (!roadsLoaded && !roadsLoading) {
      loadRoads();
    }
  }, [roadsLoaded, roadsLoading, loadRoads]);

  // ── Initialisation des layers ────────────────────────────────────────────
  useEffect(() => {
    if (!roadsLoaded) return;
    let cancelled = false;
    try {
      const boundaryData = loadBoundaryFromJson();
      const maskData = createBoundaryMask(boundaryData);
      const roadData = getRoadsGeoJSON();
      if (cancelled) return;

      setLayers([
        {
          id: 'boundary-mask',
          name: 'Extérieur (masque noir)',
          data: maskData as unknown as GeoJSONCollection,
          visible: true,
          interactive: false,
          style: { color: 'transparent', fillColor: '#000000', fillOpacity: 0.55 },
        },
        {
          id: 'boundary-line',
          name: 'Limite Fianarantsoa',
          data: boundaryData as GeoJSONCollection,
          visible: true,
          interactive: false,
          style: { color: '#000000', weight: 2.5, fillColor: 'transparent', fillOpacity: 0 },
        },
        {
          id: 'roads',
          name: 'Routes',
          data: roadData,
          visible: true,
          interactive: true,
          selectedStyle: { color: '#10b981', weight: 5, fillOpacity: 0 },
        },
      ]);

      const engine = new SimulationEngine(roadData.features);
      engine.setOnUpdate((positions: VehiclePosition[]) => {
        setPositionsRef.current(positions);
      });
      engineRef.current = engine;
      setLoading(false);
    } catch (err: any) {
      console.error('Erreur initialisation:', err);
      setLoadError(err?.message || 'Erreur de chargement');
      setLoading(false);
    }

    return () => {
      cancelled = true;
      engineRef.current?.stop();
    };
  }, [roadsLoaded]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleFeatureClick = useCallback((featureId: string, _layerId: string) => {
    setSelectedRoads((prev) => {
      const next = new Set(prev);
      next.add(featureId);
      return next;
    });
  }, []);

  const handleDeselectRoad = useCallback((roadId: string) => {
    setSelectedRoads((prev) => {
      const next = new Set(prev);
      next.delete(roadId);
      return next;
    });
  }, []);

  // ── Map initialization ───────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView([-21.45, 47.085], 13);
    mapRef.current = map;
    tileRef.current = L.tileLayer(TILES.osm.url, {
      attribution: TILES.osm.attribution,
      maxZoom: 19,
    }).addTo(map);
    vehicleLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      tileRef.current = null;
      vehicleLayerRef.current = null;
      layerMapRef.current.clear();
    };
  }, [loading]);

  // ── Tile Layer Switcher ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileRef.current) return;
    if (tileRef.current.options.attribution === TILES[tileKey].attribution) return;
    map.removeLayer(tileRef.current);
    tileRef.current = L.tileLayer(TILES[tileKey].url, {
      attribution: TILES[tileKey].attribution,
      maxZoom: 19,
    }).addTo(map);
  }, [tileKey]);

  // ── Sync GeoJSON Layers ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const currentJson = JSON.stringify(layers.map((l) => l.id));
    if (currentJson === prevLayersJson.current) return;
    prevLayersJson.current = currentJson;

    const existing = layerMapRef.current;
    const newIds = new Set(layers.map((l) => l.id));

    existing.forEach((geoLayer, id) => {
      if (!newIds.has(id)) {
        map.removeLayer(geoLayer);
        existing.delete(id);
      }
    });

    layers.forEach((layer) => {
      if (existing.has(layer.id)) return;
      const geoLayer = L.geoJSON(layer.data as unknown as GeoJSON.GeoJsonObject, {
        style: (f) => {
          const gf = f as unknown as GeoJSONFeature;
          const key = getLayerStyleKey(gf);
          return layer.style ?? getDefaultStyleForKey(key);
        },
        onEachFeature: (_f, l) => {
          const f = _f as unknown as GeoJSONFeature;
          layer.onEachFeature?.(f, l);
          if (layer.interactive ?? true) {
            const pathLayer = l as L.Path;
            l.on('click', () => {
              const fid = getFeatureId(f, layer.id);
              handleFeatureClick(fid, layer.id);
            });
            l.on('mouseover', () => {
              const currentStyle = pathLayer.options;
              pathLayer.setStyle({ weight: (currentStyle.weight ?? 3) + 3 });
            });
            l.on('mouseout', () => {
              const key = getLayerStyleKey(f);
              const fid = getFeatureId(f, layer.id);
              const isSelected = selectedRoadsRef.current.has(fid);
              pathLayer.setStyle(
                isSelected
                  ? (layer.selectedStyle ?? DEFAULT_STYLES.selected)
                  : (layer.style ?? getDefaultStyleForKey(key))
              );
            });
          }
        },
      });
      geoLayer.addTo(map);
      existing.set(layer.id, geoLayer);
    });
  }, [layers, handleFeatureClick]);

  // ── Sync Selected Feature Styles ─────────────────────────────────────────
  useEffect(() => {
    layerMapRef.current.forEach((geoLayer, layerId) => {
      const layerConfig = layers.find((l) => l.id === layerId);
      if (!layerConfig) return;
      geoLayer.eachLayer((path) => {
        const feat = (path as unknown as { feature?: GeoJSONFeature }).feature;
        if (!feat) return;
        const lPath = path as L.Path;
        const fid = getFeatureId(feat, layerId);
        if (selectedRoads.has(fid)) {
          lPath.setStyle(layerConfig.selectedStyle ?? DEFAULT_STYLES.selected);
        } else {
          const key = getLayerStyleKey(feat);
          lPath.setStyle(layerConfig.style ?? getDefaultStyleForKey(key));
        }
      });
    });
  }, [selectedRoads, layers]);

  // ── Update Vehicle Markers ───────────────────────────────────────────────
  const updateVehicleMarkers = useCallback(() => {
    const layer = vehicleLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const pos of positions) {
      const config = configs.find((c) => c.roadId === pos.roadId);
      const isRunning = config?.running ?? false;
      const icon =
        pos.type === 'motorcycle'
          ? vehicleIcons.moto
          : pos.type === 'bike'
          ? vehicleIcons.bike
          : vehicleIcons.car;
      L.marker([pos.lat, pos.lng], { icon }).addTo(layer);
    }
  }, [positions, configs]);

  useEffect(() => {
    if (!vehicleLayerRef.current) return;
    updateVehicleMarkers();
  }, [updateVehicleMarkers]);

  // ── Simulation handlers ──────────────────────────────────────────────────
  const handleStartSim = useCallback(
    (roadId: string) => {
      const p = params[roadId] ?? { vehicleCount: 5, speed: 'normal' as SpeedMode };
      const road = getAllRoads().find((r) => r.id === roadId);
      const engine = engineRef.current;
      if (!engine) return;
      const config = {
        roadId,
        roadName: road?.name ?? roadId,
        vehicleCount: p.vehicleCount,
        speed: p.speed,
        running: true,
      };
      engine.addConfig(config);
      addConfig(config);
      engine.start();
    },
    [params, addConfig]
  );

  const handleStopSim = useCallback(
    (roadId: string) => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.setRunning(roadId, false);
      setRunning(roadId, false);
    },
    [setRunning]
  );

  const handleRemoveSim = useCallback(
    (roadId: string) => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.removeConfig(roadId);
      removeConfig(roadId);
      const hasRunning = engine.getState().configs.some((c) => c.running);
      if (!hasRunning) engine.stop();
    },
    [removeConfig]
  );

  const handleReset = useCallback(() => {
    engineRef.current?.reset();
    reset();
    setSelectedRoads(new Set());
    setParams({});
  }, [reset]);

  // ── Derived values ───────────────────────────────────────────────────────
  const selectedRoadObjects = getAllRoads().filter((r) => selectedRoads.has(r.id));
  const simRunningRoads = configs.filter((c) => c.running);

  const getSimState = useCallback(
    (roadId: string) => {
      const isRunning = configs.some((c) => c.roadId === roadId && c.running);
      const isPaused = configs.some((c) => c.roadId === roadId && !c.running);
      return { isRunning, isPaused };
    },
    [configs]
  );

  const getParamsForRoad = useCallback(
    (roadId: string) => {
      return params[roadId] ?? { vehicleCount: 5, speed: 'normal' as SpeedMode };
    },
    [params]
  );

  const toggleTile = useCallback((key: TileKey) => {
    setTileKey(key);
  }, []);

  return {
    layers,
    selectedRoads,
    loading: loading || roadsLoading,
    loadError,
    params,
    tileKey,
    positionsCount: positions.length,
    configsCount: configs.length,
    containerRef,
    selectedRoadObjects,
    simRunningRoads,
    setTileKey,
    handleDeselectRoad,
    handleStartSim,
    handleStopSim,
    handleRemoveSim,
    handleReset,
    setParams,
    getSimState,
    getParamsForRoad,
    toggleTile,
    TILES,
    DEFAULT_STYLES,
  };
}