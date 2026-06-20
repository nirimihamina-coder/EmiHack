import { useEffect, useState, useCallback } from 'react';
import MapView from '../../components/MapView';
import { fetchAdminBoundaries } from '../../services/geoService';
import { getRoadsGeoJSON, getAllRoads } from '../../data/roads';
import type { MapLayerConfig } from '../../interface/Map';

export default function Simulation() {
  const [layers, setLayers] = useState<MapLayerConfig[]>([]);
  const [selectedRoads, setSelectedRoads] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const boundaryData = await fetchAdminBoundaries();
        if (cancelled) return;
        const roadData = getRoadsGeoJSON();

        setLayers([
          {
            id: 'boundaries',
            name: 'Limites',
            data: boundaryData,
            visible: true,
            style: { color: '#2563eb', weight: 2, fillColor: '#3b82f6', fillOpacity: 0.06 },
            interactive: false,
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
        setLoading(false);
      } catch {
        setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const handleFeatureClick = useCallback((featureId: string, _layerId: string) => {
    setSelectedRoads((prev) => {
      const next = new Set(prev);
      if (next.has(featureId)) next.delete(featureId);
      else next.add(featureId);
      return next;
    });
  }, []);

  const selectedRoadObjects = getAllRoads().filter((r) => selectedRoads.has(r.id));

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        Chargement de la simulation...
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="flex flex-col-reverse lg:grid lg:grid-cols-[1fr_300px] gap-3 h-full">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col shadow-sm">
          <MapView
            center={[-21.45, 47.085]}
            zoom={13}
            layers={layers}
            selectedFeatureIds={selectedRoads}
            onFeatureClick={handleFeatureClick}
            className="h-64 lg:h-auto lg:flex-1"
          >
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow text-xs text-gray-500 border border-gray-200">
              Cliquez sur une route pour la sélectionner
            </div>
          </MapView>
        </div>

        <aside className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 overflow-y-auto flex flex-col gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Simulation</p>
            <h2 className="text-lg font-bold text-gray-800">Trafic Fianarantsoa</h2>
            <p className="text-xs text-gray-500">Sélectionnez des routes pour simuler</p>
          </div>

          <hr className="border-gray-100" />

          {selectedRoadObjects.length === 0 ? (
            <div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Aucune route sélectionnée. Cliquez sur une route dans la carte pour l'ajouter à la simulation.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                Routes sélectionnées ({selectedRoadObjects.length})
              </p>
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                {selectedRoadObjects.map((road) => (
                  <div
                    key={road.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{road.name}</p>
                      <p className="text-xs text-gray-400">
                        {road.type} &middot; {road.lanes ?? 1} voie{(road.lanes ?? 1) > 1 ? 's' : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedRoads((prev) => { const n = new Set(prev); n.delete(road.id); return n; })}
                      className="text-gray-400 hover:text-red-500 text-sm cursor-pointer shrink-0"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <hr className="border-gray-100" />

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Paramètres</p>
            <p className="text-xs text-gray-400 italic">
              Configuration des véhicules à venir dans la prochaine phase.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
