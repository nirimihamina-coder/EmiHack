import { useEffect, useState } from 'react';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import useSimulation from '../../hooks/useSimulation';
import { getAllRoads } from '../../stores/roads';
import { useSimulationScenariosStore } from '../../stores/simulationScenarios';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

function Spinner() {
  return <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />;
}

export default function Simulation() {
  const {
    layers, selectedRoads, loading, loadError, tileKey, containerRef,
    selectedRoadObjects, setTileKey, handleDeselectRoad, handleStartSim,
    handleRemoveSim, handleReset, setParams, getParamsForRoad, TILES,
    bottlenecks, suggestions, roadCongestion,
  } = useSimulation();

  const simStore = useSimulationScenariosStore();
  const { scenario, configs, loading: simLoading, initializing } = simStore;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<{ vehicleCount: number; avgSpeed: number }>({ vehicleCount: 10, avgSpeed: 40 });

  // ✅ CORRECTION : Protéger contre configs undefined
  const safeConfigs = configs ?? [];
  const configuredRoadIds = new Set(safeConfigs.map((c) => c.routeId));
  const unselectedRoadObjects = selectedRoadObjects.filter((r) => !configuredRoadIds.has(r.id));

  useEffect(() => { simStore.init(); }, []);

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
        <button onClick={() => window.location.reload()} className="text-xs px-3 py-1.5 rounded border border-red-200 text-red-500 hover:bg-red-50 cursor-pointer">Réessayer</button>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="flex flex-col-reverse lg:grid lg:grid-cols-[1fr_320px] gap-3 h-full">
        {/* ── Map ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col shadow-sm relative h-64 lg:h-auto lg:flex-1">
          <div ref={containerRef} className="w-full h-full" />

          {layers.length > 0 && (
            <div className="absolute top-2 left-2 z-[1000] flex gap-1">
              {(Object.keys(TILES) as (keyof typeof TILES)[]).map((k) => (
                <button key={k} onClick={() => setTileKey(k)}
                  className={`text-xs px-2 py-1 rounded border cursor-pointer transition-colors ${tileKey === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/80 text-gray-600 border-gray-300 hover:bg-white'}`}>
                  {k === 'osm' ? 'Carte' : k === 'topo' ? 'Relief' : 'Satellite'}
                </button>
              ))}
            </div>
          )}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow text-xs text-gray-500 border border-gray-200 pointer-events-none">
            {selectedRoads.size === 0 && safeConfigs.length === 0
              ? 'Cliquez sur une route pour configurer une simulation'
              : `${safeConfigs.length} route${safeConfigs.length > 1 ? 's' : ''} configurée${safeConfigs.length > 1 ? 's' : ''}`}
          </div>
        </div>

        {/* ── Sidebar ─────────────────────────────────────────── */}
        <aside className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 overflow-y-auto flex flex-col gap-4 relative">
          {initializing && (
            <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center rounded-xl">
              <Spinner />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Simulation</p>
              <h2 className="text-lg font-bold text-gray-800">Trafic Fianarantsoa</h2>
            </div>
            {(scenario || safeConfigs.length > 0) && (
              <button onClick={handleReset} disabled={simLoading}
                className="text-xs px-2.5 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">Reset</button>
            )}
          </div>

          <hr className="border-gray-100" />

          {/* ── Scenario info ─────────────────────────────────── */}
          {scenario && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
              <p className="font-medium mb-1">{scenario.name}</p>
              <p>Densité: {scenario.vehicleDensity} · Période: {scenario.timeOfDay}</p>
              {scenario.description && <p className="mt-1 text-blue-600">{scenario.description}</p>}
            </div>
          )}

          {/* ── Empty state ──────────────────────────────────── */}
          {unselectedRoadObjects.length === 0 && safeConfigs.length === 0 && !scenario && !initializing && (
            <p className="text-xs text-gray-400 leading-relaxed">
              Cliquez sur une route dans la carte pour configurer une simulation.
            </p>
          )}

          {/* ── Selected roads (not yet saved, filter out duplicates) ─── */}
          {unselectedRoadObjects.length < selectedRoadObjects.length && unselectedRoadObjects.length === 0 && (
            <p className="text-xs text-amber-600 leading-relaxed">
              Toutes les routes sélectionnées ont déjà une configuration.
            </p>
          )}

          {unselectedRoadObjects.map((road) => {
            const p = getParamsForRoad(road.id);
            return (
              <div key={road.id} className="border border-amber-200 rounded-lg p-3 bg-amber-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{road.name}</p>
                    <p className="text-xs text-gray-400">{road.type}</p>
                  </div>
                  <button onClick={() => handleDeselectRoad(road.id)} disabled={simLoading}
                    className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 transition-colors cursor-pointer"
                    title="Désélectionner">&times;</button>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-20">Véhicules</span>
                    <input type="range" min={1} max={100} value={p.vehicleCount}
                      onChange={(e) => setParams((prev) => ({ ...prev, [road.id]: { ...p, vehicleCount: Number(e.target.value) } }))}
                      disabled={simLoading} className="flex-1 h-1.5 cursor-pointer disabled:opacity-40" />
                    <span className="text-xs font-medium text-gray-600 w-8 text-right">{p.vehicleCount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-20">Vitesse</span>
                    <input type="range" min={10} max={200} step={5} value={p.avgSpeed}
                      onChange={(e) => setParams((prev) => ({ ...prev, [road.id]: { ...p, avgSpeed: Number(e.target.value) } }))}
                      disabled={simLoading} className="flex-1 h-1.5 cursor-pointer disabled:opacity-40" />
                    <span className="text-xs font-medium text-gray-600 w-12 text-right">{p.avgSpeed} km/h</span>
                  </div>
                  <button onClick={() => handleStartSim(road.id)} disabled={simLoading}
                    className="w-full text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg py-1.5 font-medium cursor-pointer disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2">
                    {simLoading ? <Spinner /> : null}
                    Enregistrer la configuration
                  </button>
                </div>
              </div>
            );
          })}

          {/* ── Saved config cards ─────────────────────────────── */}
          {safeConfigs.map((cfg) => {
            const roadName = cfg.route?.name ?? getAllRoads().find((r) => r.id === cfg.routeId)?.name ?? cfg.routeId;
            const isEditing = editingId === cfg.id;
            return (
              <div key={cfg.id} className="border border-gray-200 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-800 truncate mb-2">{roadName}</p>

                {isEditing ? (
                  <div className="flex flex-col gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-20">Véhicules</span>
                      <input type="range" min={1} max={100} value={editVals.vehicleCount}
                        onChange={(e) => setEditVals((v) => ({ ...v, vehicleCount: Number(e.target.value) }))}
                        disabled={simLoading} className="flex-1 h-1.5 cursor-pointer disabled:opacity-40" />
                      <span className="text-xs font-medium text-gray-600 w-8 text-right">{editVals.vehicleCount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-20">Vitesse</span>
                      <input type="range" min={10} max={200} step={5} value={editVals.avgSpeed}
                        onChange={(e) => setEditVals((v) => ({ ...v, avgSpeed: Number(e.target.value) }))}
                        disabled={simLoading} className="flex-1 h-1.5 cursor-pointer disabled:opacity-40" />
                      <span className="text-xs font-medium text-gray-600 w-12 text-right">{editVals.avgSpeed} km/h</span>
                    </div>
                    <div className="flex gap-1.5 mt-1">
                      <button onClick={async () => {
                        await simStore.updateConfig(cfg.id, editVals);
                        setEditingId(null);
                      }} disabled={simLoading}
                        className="flex-1 text-xs bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg py-1.5 font-medium cursor-pointer disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2">
                        {simLoading ? <Spinner /> : null}
                        Valider
                      </button>
                      <button onClick={() => setEditingId(null)} disabled={simLoading}
                        className="flex-1 text-xs bg-gray-100 text-gray-500 rounded-lg py-1.5 hover:bg-gray-200 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-colors">
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-gray-600 space-y-0.5">
                      <p>{cfg.vehicleCount} véhicules</p>
                      <p>{cfg.avgSpeed ?? '-'} km/h</p>
                    </div>
                    {(() => {
                      const c = roadCongestion.get(cfg.routeId);
                      const colors = { fluid: 'text-green-600 bg-green-50 border-green-200', congested: 'text-orange-600 bg-orange-50 border-orange-200', blocked: 'text-red-600 bg-red-50 border-red-200' };
                      const labels = { fluid: 'Fluide', congested: 'Embouteillé', blocked: 'Bloqué' };
                      const st = c?.status ?? 'fluid';
                      const stopped = c ? `${c.stopped}/${c.total}` : '?';
                      return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${colors[st]}`}>{labels[st]} ({stopped})</span>;
                    })()}
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={() => handleRemoveSim(cfg.id)} disabled={simLoading}
                    className="flex-1 text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">Supprimer</button>
                  {!isEditing && (
                    <button onClick={() => { setEditVals({ vehicleCount: cfg.vehicleCount, avgSpeed: cfg.avgSpeed ?? 40 }); setEditingId(cfg.id); }}
                      disabled={simLoading}
                      className="flex-1 text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">Modifier</button>
                  )}
                </div>
              </div>
            );
          })}

          {/* ── Analyse ──────────────────────────────────────────── */}
          {(bottlenecks.length > 0 || suggestions.length > 0) && <hr className="border-gray-100" />}

          {bottlenecks.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400 mb-2">Embouteillages</p>
              <div className="space-y-2">
                {bottlenecks.slice(0, 3).map((b) => (
                  <div key={b.intersectionId} className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-red-700">Intersection {b.intersectionId.slice(0, 8)}</span>
                      <span className="text-red-500 font-bold">{Math.round(b.severity * 100)}%</span>
                    </div>
                    <p className="text-red-600">{b.waitingVehicles} véhicules · {Math.round(b.avgWaitTime)}s d'attente</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {suggestions.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-500 mb-2">Suggestions</p>
              <div className="space-y-2">
                {suggestions.slice(0, 3).map((s, i) => (
                  <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-amber-700">{s.type.replace(/_/g, ' ')}</span>
                      <span className="text-amber-500 text-[10px] font-medium">{s.cost}</span>
                    </div>
                    <p className="text-amber-600 mb-1">{s.description}</p>
                    <div className="flex items-center gap-2 text-amber-500">
                      <span>Priorité {s.priority}/10</span>
                      <span>·</span>
                      <span>Estimation : {s.estimatedImprovement}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Diagnostic congestion ───────────────────────────── */}
          {roadCongestion.size > 0 && (
            <div>
              <hr className="border-gray-100 mb-2" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Routes surveillées ({roadCongestion.size})</p>
              <div className="space-y-1 text-[10px] text-gray-500">
                {Array.from(roadCongestion.entries()).slice(0, 5).map(([rid, c]) => (
                  <div key={rid} className="flex justify-between">
                    <span className="truncate w-32">{rid.slice(0, 12)}…</span>
                    <span>{c.stopped}/{c.total} · <span className={c.status === 'blocked' ? 'text-red-500 font-bold' : c.status === 'congested' ? 'text-orange-500' : 'text-green-500'}>{c.status}</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}