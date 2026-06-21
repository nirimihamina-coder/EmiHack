import { useEffect } from 'react';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
// import { useSimulation, vehicleIcons } from '../hooks/useSimulation';
import useSimulation from '../../hooks/useSimulation';
import { getAllRoads } from '../../stores/roads';

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

export default function Simulation() {
  const {
    layers,
    selectedRoads,
    loading,
    loadError,
    params,
    tileKey,
    positionsCount,
    configsCount,
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
    TILES,
  } = useSimulation();

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        Chargement des routes...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-red-500 text-sm gap-3 p-4">
        <p className="text-center">{loadError}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-xs px-3 py-1.5 rounded border border-red-200 text-red-500 hover:bg-red-50 cursor-pointer"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="flex flex-col-reverse lg:grid lg:grid-cols-[1fr_320px] gap-3 h-full">
        {/* ── Carte ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col shadow-sm relative h-64 lg:h-auto lg:flex-1">
          <div ref={containerRef} className="w-full h-full" />

          {layers.length > 0 && (
            <div className="absolute top-2 left-2 z-[1000] flex gap-1">
              {(Object.keys(TILES) as (keyof typeof TILES)[]).map((k) => (
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

          {selectedRoads.size === 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow text-xs text-gray-500 border border-gray-200 pointer-events-none">
              Cliquez sur une route pour la sélectionner
            </div>
          )}
          {simRunningRoads.length > 0 && (
            <div className="absolute top-2 right-2 z-[1000] bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow text-xs text-gray-600 border border-gray-200">
              {positionsCount} véhicules
            </div>
          )}
        </div>

        {/* ── Sidebar ───────────────────────────────────────────────── */}
        <aside className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 overflow-y-auto flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
                Simulation
              </p>
              <h2 className="text-lg font-bold text-gray-800">Trafic Fianarantsoa</h2>
            </div>
            {configsCount > 0 && (
              <button
                onClick={handleReset}
                className="text-xs px-2.5 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          <hr className="border-gray-100" />

          {selectedRoadObjects.length === 0 && configsCount === 0 && (
            <div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Cliquez sur une route dans la carte pour configurer une simulation.
              </p>
            </div>
          )}

          {selectedRoadObjects.map((road) => {
            const { isRunning, isPaused } = getSimState(road.id);
            const p = getParamsForRoad(road.id);

            return (
              <div key={road.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{road.name}</p>
                    <p className="text-xs text-gray-400">{road.type}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isRunning && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                        Actif
                      </span>
                    )}
                    {isPaused && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                        En pause
                      </span>
                    )}
                    {!isRunning && !isPaused && (
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

                {!isRunning && !isPaused && (
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
                            [road.id]: { ...p, speed: e.target.value as any },
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

                {(isRunning || isPaused) && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        if (isRunning) handleStopSim(road.id);
                        else handleStartSim(road.id);
                      }}
                      className={`flex-1 text-xs rounded-lg py-1.5 font-medium cursor-pointer transition-colors ${
                        isRunning
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {isRunning ? 'Pause' : 'Reprendre'}
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

          {simRunningRoads
            .filter((config) => !selectedRoads.has(config.roadId))
            .map((config) => {
              const road = selectedRoadObjects.find((r) => r.id === config.roadId)
                ? undefined
                : getAllRoads().find((r) => r.id === config.roadId);
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