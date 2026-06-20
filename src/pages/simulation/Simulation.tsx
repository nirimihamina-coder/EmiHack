import { useEffect, useState, useCallback, useRef } from 'react';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { fetchAdminBoundaries, createBoundaryMask } from '../../services/geoService';
import { getRoadsGeoJSON, getAllRoads } from '../../data/roads';
import { SimulationEngine } from '../../simulation/engine';
import { useSimulationStore } from '../../stores/simulation';
import type { MapLayerConfig, GeoJSONFeature } from '../../interface/Map';
import type { SpeedMode, VehiclePosition } from '../../simulation/types';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

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
  adminBoundary: { color: '#2563eb', weight: 2, fillColor: '#3b82f6', fillOpacity: 0.08 },
  roadPrimary: { color: '#ea580c', weight: 3, fillOpacity: 0 },
  roadSecondary: { color: '#ca8a04', weight: 2.5, fillOpacity: 0 },
  roadTertiary: { color: '#6b7280', weight: 2, fillOpacity: 0 },
  roadResidential: { color: '#9ca3af', weight: 1.5, fillOpacity: 0 },
  selected: { color: '#10b981', weight: 5, fillOpacity: 0 },
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

type SimParams = Record<string, { vehicleCount: number; speed: SpeedMode }>;

export default function Simulation() {
  const [layers, setLayers] = useState<MapLayerConfig[]>([]);
  const [selectedRoads, setSelectedRoads] = useState<Set<string>>(new Set());
  const selectedRoadsRef = useRef(selectedRoads);
  useEffect(() => { selectedRoadsRef.current = selectedRoads; }, [selectedRoads]);
  const [loading, setLoading] = useState(true);

  const { configs, positions, addConfig, removeConfig, setRunning, setPositions, reset } =
    useSimulationStore();

  const [params, setParams] = useState<SimParams>({});

  const engineRef = useRef<SimulationEngine | null>(null);
  const vehicleLayerRef = useRef<L.LayerGroup | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const layerMapRef = useRef<Map<string, L.GeoJSON>>(new Map());
  const [tileKey, setTileKey] = useState<TileKey>('osm');

  const setPositionsRef = useRef(setPositions);
  useEffect(() => {
    setPositionsRef.current = setPositions;
  }, [setPositions]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const boundaryData = await fetchAdminBoundaries();
        if (cancelled) return;
        const roadData = getRoadsGeoJSON();
        const maskData = createBoundaryMask(boundaryData);

        setLayers([
          {
            id: 'boundary-mask',
            name: 'Limite Fianarantsoa',
            data: maskData,
            visible: true,
            interactive: false,
            style: { color: 'transparent', fillColor: '#000', fillOpacity: 0.35 },
          },
          {
            id: 'boundary-line',
            name: 'Limite (ligne)',
            data: boundaryData,
            visible: true,
            interactive: false,
            style: { color: '#374151', weight: 2, fillColor: 'transparent', fillOpacity: 0 },
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
      } catch {
        const roadData = getRoadsGeoJSON();
        const engine = new SimulationEngine(roadData.features);
        engine.setOnUpdate((positions: VehiclePosition[]) => {
          setPositionsRef.current(positions);
        });
        engineRef.current = engine;
        setLayers([
          {
            id: 'roads',
            name: 'Routes',
            data: roadData,
            visible: true,
            interactive: true,
            selectedStyle: { color: '#10b981', weight: 5, fillOpacity: 0 },
          },
        ]);
        setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
      engineRef.current?.stop();
    };
  }, []);

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

  // ── Map initialization (stable) ──────────────────────────────────────────
  // Depends on `loading` because the container div is not in the DOM while loading is true.
  // The guard `mapRef.current` ensures the map is created only once.
  useEffect(() => {
    if (loading) return;
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: true }).setView([-21.45, 47.085], 13);
    mapRef.current = map;
    tileRef.current = L.tileLayer(TILES.osm.url, { attribution: TILES.osm.attribution, maxZoom: 19 }).addTo(map);
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
    tileRef.current = L.tileLayer(TILES[tileKey].url, { attribution: TILES[tileKey].attribution, maxZoom: 19 }).addTo(map);
  }, [tileKey]);

  // ── Sync GeoJSON Layers ──────────────────────────────────────────────────
  const prevLayersJson = useRef('');
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
              pathLayer.setStyle(isSelected ? (layer.selectedStyle ?? DEFAULT_STYLES.selected) : (layer.style ?? getDefaultStyleForKey(key)));
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

  const updateVehicleMarkers = useCallback(() => {
    const layer = vehicleLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const pos of positions) {
      const config = configs.find((c) => c.roadId === pos.roadId);
      const isRunning = config?.running ?? false;
      L.circleMarker([pos.lat, pos.lng], {
        radius: 5,
        color: isRunning ? '#f59e0b' : '#9ca3af',
        weight: 2,
        fillColor: isRunning ? '#fbbf24' : '#d1d5db',
        fillOpacity: 0.8,
      }).addTo(layer);
    }
  }, [positions, configs]);

  useEffect(() => {
    if (!vehicleLayerRef.current) return;
    updateVehicleMarkers();
  }, [updateVehicleMarkers]);

  const selectedRoadObjects = getAllRoads().filter((r) => selectedRoads.has(r.id));

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

  const handleStopSim = useCallback((roadId: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setRunning(roadId, false);
    setRunning(roadId, false);
  }, [setRunning]);

  const handleRemoveSim = useCallback((roadId: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.removeConfig(roadId);
    removeConfig(roadId);

    const hasRunning = engine.getState().configs.some((c) => c.running);
    if (!hasRunning) engine.stop();
  }, [removeConfig]);

  const handleReset = useCallback(() => {
    engineRef.current?.reset();
    reset();
    setSelectedRoads(new Set());
    setParams({});
  }, [reset]);

  const simRunningRoads = configs.filter((c) => c.running);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        Chargement de la simulation...
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="flex flex-col-reverse lg:grid lg:grid-cols-[1fr_320px] gap-3 h-full">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col shadow-sm relative h-64 lg:h-auto lg:flex-1">
          {/* Leaflet Map Target */}
          <div ref={containerRef} className="w-full h-full" />
          
          {/* Tile Selector */}
          {layers.length > 0 && (
            <div className="absolute top-2 left-2 z-[1000] flex gap-1">
              {(Object.keys(TILES) as TileKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setTileKey(k)}
                  className={`text-xs px-2 py-1 rounded border cursor-pointer transition-colors ${
                    tileKey === k
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white/80 text-gray-600 border-gray-300 hover:bg-white'
                  }`}
                >
                  {k === 'osm' ? 'Carte' : k === 'topo' ? 'Relief' : 'Satellite'}
                </button>
              ))}
            </div>
          )}

          {/* Overlays */}
          {selectedRoads.size === 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow text-xs text-gray-500 border border-gray-200 pointer-events-none">
              Cliquez sur une route pour la sélectionner
            </div>
          )}
          {simRunningRoads.length > 0 && (
            <div className="absolute top-2 right-2 z-[1000] bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow text-xs text-gray-600 border border-gray-200">
              {positions.length} véhicules
            </div>
          )}
        </div>

        <aside className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 overflow-y-auto flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Simulation</p>
              <h2 className="text-lg font-bold text-gray-800">Trafic Fianarantsoa</h2>
            </div>
            {configs.length > 0 && (
              <button
                onClick={handleReset}
                className="text-xs px-2.5 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          <hr className="border-gray-100" />

          {selectedRoadObjects.length === 0 && configs.length === 0 && (
            <div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Cliquez sur une route dans la carte pour configurer une simulation.
              </p>
            </div>
          )}

          {selectedRoadObjects.map((road) => {
            const isSimRunning = configs.some((c) => c.roadId === road.id && c.running);
            const isSimPaused = configs.some((c) => c.roadId === road.id && !c.running);
            const p = params[road.id] ?? { vehicleCount: 5, speed: 'normal' as SpeedMode };

            return (
              <div key={road.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{road.name}</p>
                    <p className="text-xs text-gray-400">{road.type}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isSimRunning && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                        Actif
                      </span>
                    )}
                    {isSimPaused && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                        En pause
                      </span>
                    )}
                    {!isSimRunning && !isSimPaused && (
                      <button
                        onClick={() => handleDeselectRoad(road.id)}
                        className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors cursor-pointer"
                        title="Désélectionner"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                </div>

                {!isSimRunning && !isSimPaused && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-20">Véhicules</span>
                      <input
                        type="range"
                        min={1}
                        max={30}
                        value={p.vehicleCount}
                        onChange={(e) =>
                          setParams((prev) => ({
                            ...prev,
                            [road.id]: { ...p, vehicleCount: Number(e.target.value) },
                          }))
                        }
                        className="flex-1 h-1.5 cursor-pointer"
                      />
                      <span className="text-xs font-medium text-gray-600 w-6 text-right">
                        {p.vehicleCount}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-20">Vitesse</span>
                      <select
                        value={p.speed}
                        onChange={(e) =>
                          setParams((prev) => ({
                            ...prev,
                            [road.id]: { ...p, speed: e.target.value as SpeedMode },
                          }))
                        }
                        className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                      >
                        <option value="slow">Lente</option>
                        <option value="normal">Normale</option>
                        <option value="fast">Rapide</option>
                      </select>
                    </div>
                    <button
                      onClick={() => handleStartSim(road.id)}
                      className="w-full text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-1.5 font-medium cursor-pointer transition-colors"
                    >
                      Lancer la simulation
                    </button>
                  </div>
                )}

                {(isSimRunning || isSimPaused) && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        if (isSimRunning) handleStopSim(road.id);
                        else handleStartSim(road.id);
                      }}
                      className={`flex-1 text-xs rounded-lg py-1.5 font-medium cursor-pointer transition-colors ${
                        isSimRunning
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {isSimRunning ? 'Pause' : 'Reprendre'}
                    </button>
                    <button
                      onClick={() => handleRemoveSim(road.id)}
                      className="flex-1 text-xs bg-gray-100 text-gray-500 rounded-lg py-1.5 hover:bg-gray-200 cursor-pointer transition-colors"
                    >
                      Arrêter
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {configs.map((config) => {
            if (selectedRoads.has(config.roadId)) return null;
            const road = getAllRoads().find((r) => r.id === config.roadId);
            if (!road) return null;
            return (
              <div key={config.roadId} className="border border-gray-200 rounded-lg p-3 opacity-60">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800 truncate">{road.name}</p>
                    <p className="text-xs text-gray-400">
                      {config.vehicleCount} véhicules &middot; {config.speed}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveSim(config.roadId)}
                    className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 cursor-pointer"
                  >
                    &times;
                  </button>
                </div>
              </div>
            );
          })}
        </aside>
      </div>
    </div>
  );
}
