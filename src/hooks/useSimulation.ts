import { useEffect, useState, useCallback, useRef } from 'react';
import L from 'leaflet';
import boundaryFianarantsoaRaw from '../data/fianarantsoa-boundary.json';
import axiosInstance from '../api/axios';
import { useRoadsStore, getAllRoads, getRoadsGeoJSON } from '../stores/roads';
import { useSimulationScenariosStore } from '../stores/simulationScenarios';
import { SimulationEngine } from '../simulation/engine';
import type { VehiclePosition, Intersection, RouteIntersection, TrafficIncident, Bottleneck, Suggestion } from '../simulation/types';
import type { IntersectionState } from '../simulation/intersectionManager';
import type { MapLayerConfig, GeoJSONFeature, GeoJSONCollection } from '../interface/Map';

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
  roadPrimary: { color: '#2563eb', weight: 3, fillOpacity: 0, lineCap: 'round', lineJoin: 'round' },
  roadSecondary: { color: '#16a34a', weight: 3, fillOpacity: 0, lineCap: 'round', lineJoin: 'round' },
  roadTertiary: { color: '#f97316', weight: 3, fillOpacity: 0, lineCap: 'round', lineJoin: 'round' },
  roadResidential: { color: '#7c3aed', weight: 3, fillOpacity: 0, lineCap: 'round', lineJoin: 'round' },
  selected: { color: '#0f172a', weight: 4, fillOpacity: 0, lineCap: 'round', lineJoin: 'round' },
};

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

type SimParams = Record<string, { vehicleCount: number; avgSpeed: number }>;

export interface UseSimulationReturn {
  layers: MapLayerConfig[];
  selectedRoads: Set<string>;
  loading: boolean;
  loadError: string | null;
  params: SimParams;
  tileKey: TileKey;
  containerRef: React.RefObject<HTMLDivElement | null>;
  selectedRoadObjects: ReturnType<typeof getAllRoads>;

  setTileKey: (key: TileKey) => void;
  handleDeselectRoad: (roadId: string) => void;
  handleStartSim: (roadId: string) => void;
  handleRemoveSim: (configId: string) => void;
  handleReset: () => void;
  setParams: React.Dispatch<React.SetStateAction<SimParams>>;
  getParamsForRoad: (roadId: string) => { vehicleCount: number; avgSpeed: number };
  TILES: typeof TILES;
  bottlenecks: Bottleneck[];
  suggestions: Suggestion[];
  roadCongestion: Map<string, { total: number; stopped: number; status: 'fluid' | 'congested' | 'blocked' }>;
  intersectionStates: IntersectionState[];
}

function flattenMultiLineString(lines: number[][][]): number[][] {
  if (lines.length === 0) return [];
  const result: number[][] = [];
  for (const line of lines) {
    for (const coord of line) {
      result.push(coord);
    }
  }
  return result;
}

export default function useSimulation(): UseSimulationReturn {
  const [layers, setLayers] = useState<MapLayerConfig[]>([]);
  const [selectedRoads, setSelectedRoads] = useState<Set<string>>(new Set());
  const selectedRoadsRef = useRef(selectedRoads);
  useEffect(() => { selectedRoadsRef.current = selectedRoads; }, [selectedRoads]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [params, setParams] = useState<SimParams>({});
  const [tileKey, setTileKey] = useState<TileKey>('osm');

  const { load: loadRoads, loaded: roadsLoaded, loading: roadsLoading } = useRoadsStore();
  const simStore = useSimulationScenariosStore();

  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const layerMapRef = useRef<Map<string, L.GeoJSON>>(new Map());
  const prevLayersJson = useRef('');
  const engineRef = useRef<SimulationEngine | null>(null);
  const vehicleLayerRef = useRef<L.LayerGroup | null>(null);
  const vehicleMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const prevConfigsJson = useRef('');
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [roadCongestion, setRoadCongestion] = useState<Map<string, { total: number; stopped: number; status: 'fluid' | 'congested' | 'blocked' }>>(new Map());
  const [intersectionStates, setIntersectionStates] = useState<IntersectionState[]>([]);
  const [intersectionMarkers, setIntersectionMarkers] = useState<any[]>([]);
  const [incidentMarkers, setIncidentMarkers] = useState<any[]>([]);
  const intersectionLayerRef = useRef<L.LayerGroup | null>(null);
  const incidentLayerRef = useRef<L.LayerGroup | null>(null);
  const congestionZoneLayerRef = useRef<L.LayerGroup | null>(null);
  const congestionAnimRef = useRef<number | null>(null);
  const prevCongestedIdsRef = useRef('');

const syncEngine = useCallback(() => {
  const engine = engineRef.current;
  if (!engine || !mapRef.current) return;
  
  const configs = useSimulationScenariosStore.getState().configs;
  if (!Array.isArray(configs)) return;
  
  const json = JSON.stringify(configs.map((c) => ({ id: c.id, vehicleCount: c.vehicleCount, avgSpeed: c.avgSpeed })));
  
  if (json === prevConfigsJson.current) return;
  prevConfigsJson.current = json;

  engine.reset();

  const roadGeoJSON = getRoadsGeoJSON() as unknown as GeoJSONCollection;
  const allFeatures = (roadGeoJSON as any)?.features ?? [];

  for (const cfg of configs) {
    try {
      const coords = cfg?.route?.coordinates;
      
      if (Array.isArray(coords) && coords.length > 0) {
        const firstCoord = coords[0];
        
        if (!Array.isArray(firstCoord) || firstCoord.length < 2) continue;
        
        const firstLat = firstCoord[0];
        const firstLng = firstCoord[1];
        
        let path: [number, number][];
        
        if (Math.abs(firstLat) <= 90 && Math.abs(firstLng) > 90) {
          path = coords.map((c: number[]) => [c[0], c[1]] as [number, number]);
        } else if (Math.abs(firstLng) <= 90 && Math.abs(firstLat) > 90) {
          path = coords.map((c: number[]) => [c[1], c[0]] as [number, number]);
        } else {
          path = coords.map((c: number[]) => [c[0], c[1]] as [number, number]);
        }
        
        const success = engine.setRoadPath(cfg.routeId, path);
        
        if (success) {
          engine.addConfig({
            roadId: cfg.routeId,
            roadName: '',
            vehicleCount: cfg.vehicleCount,
            speed: cfg.avgSpeed ?? 40,
            running: true,
          });
        }
      } else {
        const feat = allFeatures.find((f: any) => f.properties?.id === cfg.routeId);
        if (feat?.geometry) {
          let coords: [number, number][] = [];
          
          if (feat.geometry.type === 'LineString') {
            coords = (feat.geometry.coordinates as number[][]).map(([lng, lat]) => [lat, lng] as [number, number]);
          } else if (feat.geometry.type === 'MultiLineString') {
            const lines = feat.geometry.coordinates as number[][][];
            const flatCoords = flattenMultiLineString(lines);
            coords = flatCoords.map(([lng, lat]) => [lat, lng] as [number, number]);
          }
          
          if (coords.length >= 2) {
            const success = engine.setRoadPath(cfg.routeId, coords);
            if (success) {
              engine.addConfig({
                roadId: cfg.routeId,
                roadName: '',
                vehicleCount: cfg.vehicleCount,
                speed: cfg.avgSpeed ?? 40,
                running: true,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('Erreur syncEngine pour config:', cfg, err);
    }
  }
  
  if (configs.length > 0) {
    engine.start();
  } else {
    engine.stop();
  }
}, []);

  useEffect(() => {
    if (!roadsLoaded && !roadsLoading) loadRoads();
  }, [roadsLoaded, roadsLoading, loadRoads]);

  useEffect(() => {
    if (!roadsLoaded) return;
    let cancelled = false;
    try {
      const boundaryData = loadBoundaryFromJson();
      const maskData = createBoundaryMask(boundaryData);
      const roadData = getRoadsGeoJSON();
      if (cancelled) return;

      setLayers([
        { id: 'boundary-mask', name: 'Extérieur (masque noir)', data: maskData as unknown as GeoJSONCollection, visible: true, interactive: false, style: { color: 'transparent', fillColor: '#000000', fillOpacity: 0.55 } },
        { id: 'boundary-line', name: 'Limite Fianarantsoa', data: boundaryData as GeoJSONCollection, visible: true, interactive: false, style: { color: '#000000', weight: 2.5, fillColor: 'transparent', fillOpacity: 0 } },
        { id: 'roads', name: 'Routes', data: roadData, visible: true, interactive: true, selectedStyle: { color: '#10b981', weight: 5, fillOpacity: 0 } },
      ]);
      setLoading(false);
    } catch (err: any) {
      setLoadError(err?.message || 'Erreur de chargement');
      setLoading(false);
    }
    return () => { cancelled = true; };
  }, [roadsLoaded]);

  const handleFeatureClick = useCallback((featureId: string, _layerId: string) => {
    const configs = useSimulationScenariosStore.getState().configs;
    if (configs.some((c) => c.routeId === featureId)) return;
    setSelectedRoads((prev) => { const n = new Set(prev); n.add(featureId); return n; });
  }, []);

  const handleDeselectRoad = useCallback((roadId: string) => {
    setSelectedRoads((prev) => { const n = new Set(prev); n.delete(roadId); return n; });
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView([-21.45, 47.085], 13);
    mapRef.current = map;
    tileRef.current = L.tileLayer(TILES.osm.url, { attribution: TILES.osm.attribution, maxZoom: 19 }).addTo(map);
    return () => {
      if (engineRef.current) { engineRef.current.stop(); engineRef.current = null; }
      vehicleMarkersRef.current.clear();
      vehicleLayerRef.current = null;
      if (intersectionLayerRef.current) { intersectionLayerRef.current.remove(); intersectionLayerRef.current = null; }
      if (incidentLayerRef.current) { incidentLayerRef.current.remove(); incidentLayerRef.current = null; }
      if (congestionZoneLayerRef.current) { congestionZoneLayerRef.current.remove(); congestionZoneLayerRef.current = null; }
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      tileRef.current = null;
      layerMapRef.current.clear();
    };
  }, [loading]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileRef.current) return;
    if (tileRef.current.options.attribution === TILES[tileKey].attribution) return;
    map.removeLayer(tileRef.current);
    tileRef.current = L.tileLayer(TILES[tileKey].url, { attribution: TILES[tileKey].attribution, maxZoom: 19 }).addTo(map);
  }, [tileKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const currentJson = JSON.stringify(layers.map((l) => l.id));
    if (currentJson === prevLayersJson.current) return;
    prevLayersJson.current = currentJson;
    const existing = layerMapRef.current;
    const newIds = new Set(layers.map((l) => l.id));
    existing.forEach((geoLayer, id) => { if (!newIds.has(id)) { map.removeLayer(geoLayer); existing.delete(id); } });
    layers.forEach((layer) => {
      if (existing.has(layer.id)) return;
      const geoLayer = L.geoJSON(layer.data as unknown as GeoJSON.GeoJsonObject, {
        style: (f) => { const gf = f as unknown as GeoJSONFeature; const key = getLayerStyleKey(gf); return layer.style ?? getDefaultStyleForKey(key); },
        onEachFeature: (_f, l) => {
          const f = _f as unknown as GeoJSONFeature;
          layer.onEachFeature?.(f, l);
          if (layer.interactive ?? true) {
            const pathLayer = l as L.Path;
            l.on('click', () => { const fid = getFeatureId(f, layer.id); handleFeatureClick(fid, layer.id); });
            l.on('mouseover', () => pathLayer.setStyle({ weight: (pathLayer.options.weight ?? 3) + 3 }));
            l.on('mouseout', () => {
              const key = getLayerStyleKey(f);
              const fid = getFeatureId(f, layer.id);
              pathLayer.setStyle(selectedRoadsRef.current.has(fid) ? (layer.selectedStyle ?? DEFAULT_STYLES.selected) : (layer.style ?? getDefaultStyleForKey(key)));
            });
          }
        },
      });
      geoLayer.addTo(map);
      existing.set(layer.id, geoLayer);
    });
  }, [layers, handleFeatureClick]);

  useEffect(() => {
    layerMapRef.current.forEach((geoLayer, layerId) => {
      const layerConfig = layers.find((l) => l.id === layerId);
      if (!layerConfig || layerId !== 'roads') return;
      geoLayer.eachLayer((path) => {
        const feat = (path as unknown as { feature?: GeoJSONFeature }).feature;
        if (!feat) return;
        const lPath = path as L.Path;
        const fid = getFeatureId(feat, layerId);
        const cong = roadCongestion.get(fid);
        if (cong?.status === 'blocked') {
          lPath.setStyle({ color: '#dc2626', weight: 5, fillOpacity: 0 });
        } else if (cong?.status === 'congested') {
          lPath.setStyle({ color: '#f97316', weight: 4, fillOpacity: 0 });
        } else {
          lPath.setStyle(selectedRoads.has(fid) ? (layerConfig.selectedStyle ?? DEFAULT_STYLES.selected) : (layerConfig.style ?? getDefaultStyleForKey(getLayerStyleKey(feat))));
        }
      });
    });
  }, [selectedRoads, layers, roadCongestion]);

  useEffect(() => {
    const map = mapRef.current;
    const roadsLayer = layerMapRef.current.get('roads');
    if (!map || !roadsLayer) return;

    const congestedIds = Array.from(roadCongestion.entries())
      .filter(([_, c]) => c.status !== 'fluid')
      .map(([rid]) => rid)
      .sort()
      .join(',');

    if (congestedIds === prevCongestedIdsRef.current) return;
    prevCongestedIdsRef.current = congestedIds;

    if (!congestionZoneLayerRef.current) {
      congestionZoneLayerRef.current = L.layerGroup().addTo(map);
    }
    const layer = congestionZoneLayerRef.current;
    layer.clearLayers();

    if (congestedIds === '') return;

    roadsLayer.eachLayer((path) => {
      const feat = (path as unknown as { feature?: GeoJSONFeature }).feature;
      if (!feat) return;
      const fid = getFeatureId(feat, 'roads');
      const congestion = roadCongestion.get(fid);
      if (!congestion || congestion.status === 'fluid') return;

      const geom = feat.geometry;
      if (!geom) return;
      let rawCoords: number[][] = [];
      if (geom.type === 'LineString') {
        rawCoords = geom.coordinates as number[][];
      } else if (geom.type === 'MultiLineString') {
        const lines = geom.coordinates as number[][][];
        if (lines.length > 0) rawCoords = lines[0];
      }
      if (rawCoords.length === 0) return;

      const midIdx = Math.floor(rawCoords.length / 2);
      const midLatLng: [number, number] = [rawCoords[midIdx][1], rawCoords[midIdx][0]];
      const radius = congestion.status === 'blocked' ? 160 : 110;

      L.circle(midLatLng, {
        radius,
        color: '#dc2626',
        fillColor: '#dc2626',
        fillOpacity: 0,
        weight: 3,
        opacity: 0.8,
      }).addTo(layer);

      L.circle(midLatLng, {
        radius: radius * 0.55,
        color: '#dc2626',
        fillColor: '#dc2626',
        fillOpacity: 0.15,
        weight: 0,
      }).addTo(layer);
    });
  }, [roadCongestion]);

  useEffect(() => {
    let tick = 0;
    let running = true;

    const animate = () => {
      if (!running) return;
      tick += 0.03;

      const layer = congestionZoneLayerRef.current;
      if (layer) {
        const circles = layer.getLayers() as L.Circle[];
        circles.forEach((circle, i) => {
          const phase = (Math.sin(tick + i * 2.1) + 1) / 2;
          if (i % 2 === 0) {
            circle.setStyle({ opacity: 0.2 + phase * 0.6 });
          } else {
            circle.setStyle({ fillOpacity: 0.05 + phase * 0.3 });
          }
        });
      }

      congestionAnimRef.current = requestAnimationFrame(animate);
    };

    congestionAnimRef.current = requestAnimationFrame(animate);
    return () => {
      running = false;
      if (congestionAnimRef.current !== null) {
        cancelAnimationFrame(congestionAnimRef.current);
        congestionAnimRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (loading || !mapRef.current) return;
    const roadGeoJSON = getRoadsGeoJSON() as unknown as GeoJSONCollection;
    const features = (roadGeoJSON as any)?.features ?? [];

    const engine = new SimulationEngine(features as GeoJSONFeature[]);
    engineRef.current = engine;
    vehicleLayerRef.current = L.layerGroup().addTo(mapRef.current);

    engine.setOnUpdate((positions: VehiclePosition[]) => {
      const markers = vehicleMarkersRef.current;
      const newIds = new Set(positions.map((p) => p.id));

      markers.forEach((m, id) => {
        if (!newIds.has(id)) {
          mapRef.current?.removeLayer(m);
          markers.delete(id);
        }
      });

      positions.forEach((p) => {
        const existing = markers.get(p.id);
        if (existing) {
          existing.setLatLng([p.lat, p.lng]);
        } else {
          if (!vehicleLayerRef.current) {
            return;
          }

          const emoji = p.type === 'motorcycle' ? '🏍️' : p.type === 'bike' ? '🚲' : '🚗';
          const el = document.createElement('div');
          el.innerHTML = emoji;
          const iconSz = p.type === 'bike' ? 16 : 20;
          const rot = p.type === 'bike' ? p.heading - 90 : p.heading + 90;
          el.style.cssText = `font-size:${iconSz}px;line-height:1;text-align:center;transform:rotate(${rot}deg);filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5))`;
          const anchor = iconSz / 2;

          const marker = L.marker([p.lat, p.lng], {
            icon: L.divIcon({ html: el, iconSize: [iconSz, iconSz], iconAnchor: [anchor, anchor], className: '' }),
            zIndexOffset: 10000,
            interactive: false,
          }).addTo(vehicleLayerRef.current);

          markers.set(p.id, marker);
        }
      });
    });

    (async () => {
      try {
        const [ixns, rxis, reps] = await Promise.all([
          axiosInstance.get('/intersections').catch(() => ({ data: [] })),
          axiosInstance.get('/route-intersections').catch(() => ({ data: [] })),
          axiosInstance.get('/reports/all').catch(() => ({ data: [] })),
        ]);

        const ixData = ixns.data as any[];
        const rxData = rxis.data as any[];
        const repData = reps.data as any[];

        const intersections: Intersection[] = ixData.map((r: any) => ({
          id: r.id,
          lat: Number(r.lat),
          lon: Number(r.lon),
          type: r.type,
          connectedRoadIds: [],
          priorityRoadId: undefined,
        }));

        const routeIntersections: RouteIntersection[] = rxData.map((r: any) => ({
          id: r.id,
          intersectionId: r.intersection?.id ?? r.intersectionId,
          routeId1: r.route1?.id ?? r.routeId1,
          routeId2: r.route2?.id ?? r.routeId2,
          priorityRouteId: r.priorityRoute?.id ?? r.priorityRouteId,
          positionOnRoute1: Number(r.positionOnRoute1 ?? 50),
          positionOnRoute2: Number(r.positionOnRoute2 ?? 50),
        }));

        engine.setIntersections(intersections, routeIntersections);

        const incidents: TrafficIncident[] = repData
          .filter((r: any) => r.status === 'active' && (r.routeId ?? r.route?.id))
          .map((r: any) => ({
            id: r.id,
            routeId: r.routeId ?? r.route?.id,
            type: r.type,
            severity: r.severity,
            positionOnRoute: Number(r.positionOnRoute ?? 50),
            lanesBlocked: r.lanesBlocked ?? 0,
            active: true,
          }));

        engine.setIncidents(incidents);

        setIntersectionMarkers(ixData);
        setIncidentMarkers(repData);
      } catch {
        // Intersections / incidents non disponibles
      }
    })();

    syncEngine();

    return () => {
      engine.stop();
      engineRef.current = null;
      vehicleMarkersRef.current.forEach((m) => mapRef.current?.removeLayer(m));
      vehicleMarkersRef.current.clear();
      if (vehicleLayerRef.current) {
        mapRef.current?.removeLayer(vehicleLayerRef.current);
        vehicleLayerRef.current = null;
      }
    };
  }, [loading, syncEngine]);

useEffect(() => {
  syncEngine();
}, [syncEngine, simStore.configs]);

useEffect(() => {
  const configs = simStore.configs ?? [];
  if (configs.length === 0) { 
    setBottlenecks([]); 
    setSuggestions([]); 
    setRoadCongestion(new Map()); 
    setIntersectionStates([]); 
    return; 
  }
  const poll = () => {
    const engine = engineRef.current;
    if (!engine) return;
    setBottlenecks(engine.getBottlenecks());
    setSuggestions(engine.getSuggestions());
    const cong = engine.getRoadCongestion();
    setRoadCongestion(new Map(cong.map((c) => [c.roadId, c])));
    setIntersectionStates(engine.getIntersectionStates());
  };
  poll();
  const id = setInterval(poll, 5000);
  return () => clearInterval(id);
}, [simStore.configs?.length ?? 0]);

useEffect(() => {
  const configs = simStore.configs ?? [];
  if (configs.length === 0) return;
  const pollIncidents = async () => {
    try {
      const { data: reps } = await axiosInstance.get('/reports/all');
      const engine = engineRef.current;
      if (!engine || !Array.isArray(reps)) return;

      const active: TrafficIncident[] = reps
        .filter((r: any) => r.status === 'active' && (r.routeId ?? r.route?.id))
        .map((r: any) => ({
          id: r.id,
          routeId: r.routeId ?? r.route?.id,
          type: r.type,
          severity: r.severity,
          positionOnRoute: Number(r.positionOnRoute ?? 50),
          lanesBlocked: r.lanesBlocked ?? 0,
          active: true,
        }));
      engine.setIncidents(active);
      setIncidentMarkers(reps);
    } catch { /* ignore */ }
  };
  pollIncidents();
  const id = setInterval(pollIncidents, 10000);
  return () => clearInterval(id);
}, [simStore.configs?.length ?? 0]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!intersectionLayerRef.current) {
      intersectionLayerRef.current = L.layerGroup().addTo(map);
    }
    if (!incidentLayerRef.current) {
      incidentLayerRef.current = L.layerGroup().addTo(map);
    }

    intersectionLayerRef.current.clearLayers();
    incidentLayerRef.current.clearLayers();

    const stateMap = new Map(intersectionStates.map((s) => [s.intersectionId, s]));

    for (const ix of intersectionMarkers) {
      const lat = Number(ix.lat);
      const lon = Number(ix.lon);
      if (!isFinite(lat) || !isFinite(lon)) continue;

      const st = stateMap.get(ix.id);
      let color = '#6b7280';
      let label = ix.type;
      if (st?.lockStatus === 'locked') { color = '#ef4444'; label = 'Verrouillé'; }
      else if (st?.lockStatus === 'waiting') { color = '#eab308'; label = 'En attente'; }
      else { const colors: Record<string, string> = { stop: '#ef4444', priority: '#f97316', roundabout: '#3b82f6', uncontrolled: '#22c55e' }; color = colors[ix.type] ?? '#6b7280'; }

      const marker = L.circleMarker([lat, lon], {
        radius: st?.lockStatus === 'locked' ? 10 : 8, color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.9,
      }).addTo(intersectionLayerRef.current);
      marker.bindPopup(`
        <div style="font-family:system-ui;font-size:13px;line-height:1.5">
          <b style="font-size:14px">Intersection ${ix.name ?? ''}</b><br/>
          Type: <span style="text-transform:capitalize">${ix.type}</span><br/>
          État: ${label}${st?.lockedByRoad ? `<br/>Verrouillé par: ${st.lockedByRoad.slice(0, 8)}` : ''}${st && st.waitingCount > 0 ? `<br/>En attente: ${st.waitingCount} véhicule(s)` : ''}<br/>
          Lat: ${lat.toFixed(5)}<br/>
          Lon: ${lon.toFixed(5)}
        </div>
      `);
    }

    const sevColors: Record<string, string> = {
      low: '#eab308', medium: '#f97316', high: '#ef4444', critical: '#8b5cf6',
    };

    for (const rep of incidentMarkers) {
      const lat = Number(rep.lat);
      const lon = Number(rep.lon);
      if (!isFinite(lat) || !isFinite(lon)) continue;
      const color = sevColors[rep.severity] ?? '#6b7280';
      const marker = L.circleMarker([lat, lon], {
        radius: 7, color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.9,
      }).addTo(incidentLayerRef.current);
      marker.bindPopup(`
        <div style="font-family:system-ui;font-size:13px;line-height:1.5">
          <b style="font-size:14px">${rep.type === 'accident' ? '🚗 Accident' : rep.type === 'construction' ? '🚧 Construction' : rep.type === 'road_work' ? '🛠 Travaux' : '⚠️ Obstacle'}</b><br/>
          Sévérité: <span style="text-transform:capitalize">${rep.severity}</span><br/>
          ${rep.fokontanyName ? `Fokontany: ${rep.fokontanyName}<br/>` : ''}
          ${rep.description ? `Description: ${rep.description}<br/>` : ''}
          Voies bloquées: ${rep.lanesBlocked ?? 0}<br/>
          Lat: ${lat.toFixed(5)}<br/>
          Lon: ${lon.toFixed(5)}
        </div>
      `);
    }
  }, [intersectionMarkers, incidentMarkers, intersectionStates]);

  const handleStartSim = useCallback((roadId: string) => {
    const p = params[roadId] ?? { vehicleCount: 5, avgSpeed: 40 };
    simStore.addConfig(roadId, p.vehicleCount, p.avgSpeed);
    setParams((prev) => { const n = { ...prev }; delete n[roadId]; return n; });
    handleDeselectRoad(roadId);
  }, [params, simStore, handleDeselectRoad]);

  const handleRemoveSim = useCallback((configId: string) => {
    simStore.removeConfig(configId);
  }, [simStore]);

  const handleReset = useCallback(() => {
    simStore.reset();
    setSelectedRoads(new Set());
    setParams({});
  }, [simStore]);

  const selectedRoadObjects = getAllRoads().filter((r) => selectedRoads.has(r.id));

  const getParamsForRoad = useCallback((roadId: string) => {
    return params[roadId] ?? { vehicleCount: 5, avgSpeed: 40 };
  }, [params]);

  return {
    layers, selectedRoads, loading: loading || roadsLoading, loadError, params, tileKey,
    containerRef, selectedRoadObjects,
    setTileKey, handleDeselectRoad, handleStartSim, handleRemoveSim, handleReset, setParams, getParamsForRoad,
    TILES, bottlenecks, suggestions, roadCongestion, intersectionStates,
  };
}