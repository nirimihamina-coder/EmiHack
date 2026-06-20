import { useEffect, useState, useCallback, useRef } from 'react';
import L from 'leaflet';
import MapView from '../../components/MapView';
import { fetchAdminBoundaries, createBoundaryMask } from '../../services/geoService';
import { getRoadsGeoJSON, getAllRoads } from '../../data/roads';
import { SimulationEngine } from '../../simulation/engine';
import { useSimulationStore } from '../../stores/simulation';
import type { MapLayerConfig } from '../../interface/Map';
import type { SpeedMode, VehiclePosition } from '../../simulation/types';

type SimParams = Record<string, { vehicleCount: number; speed: SpeedMode }>;

export default function Simulation() {
  const [layers, setLayers] = useState<MapLayerConfig[]>([]);
  const [selectedRoads, setSelectedRoads] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const { configs, positions, addConfig, removeConfig, setRunning, setPositions, reset } =
    useSimulationStore();

  const [params, setParams] = useState<SimParams>({});

  const engineRef = useRef<SimulationEngine | null>(null);
  const vehicleLayerRef = useRef<L.LayerGroup | null>(null);
  const mapRef = useRef<L.Map | null>(null);

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
          setPositions(positions);
        });
        engineRef.current = engine;
        setLoading(false);
      } catch {
        const roadData = getRoadsGeoJSON();
        const engine = new SimulationEngine(roadData.features);
        engine.setOnUpdate((positions: VehiclePosition[]) => {
          setPositions(positions);
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
  }, [setPositions]);

  const handleFeatureClick = useCallback((featureId: string, _layerId: string) => {
    setSelectedRoads((prev) => {
      const next = new Set(prev);
      if (next.has(featureId)) next.delete(featureId);
      else next.add(featureId);
      return next;
    });
  }, []);

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
    vehicleLayerRef.current = L.layerGroup().addTo(map);
  }, []);

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
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col shadow-sm">
          <MapView
            center={[-21.45, 47.085]}
            zoom={13}
            layers={layers}
            selectedFeatureIds={selectedRoads}
            onFeatureClick={handleFeatureClick}
            onMapReady={handleMapReady}
            className="h-64 lg:h-auto lg:flex-1"
          >
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
          </MapView>
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
