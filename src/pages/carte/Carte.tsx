import { useEffect, useState } from 'react';
import MapView from '../../components/MapView';
import { fetchAdminBoundaries } from '../../services/geoService';
import { getRoadsGeoJSON } from '../../data/roads';
import type { MapLayerConfig } from '../../interface/Map';

export default function CartePage() {
  const [layers, setLayers] = useState<MapLayerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const boundaryData = await fetchAdminBoundaries();
        if (cancelled) return;
        const roadData = getRoadsGeoJSON();

        setLayers([
          {
            id: 'boundaries',
            name: 'Limites administratives',
            data: boundaryData,
            visible: true,
            style: { color: '#2563eb', weight: 2, fillColor: '#3b82f6', fillOpacity: 0.08 },
          },
          {
            id: 'roads',
            name: 'Réseau routier',
            data: roadData,
            visible: true,
            interactive: true,
          },
        ]);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError("Impossible de charger les limites administratives");
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        Chargement de la carte...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-sm mb-2">{error}</p>
          <p className="text-gray-400 text-xs">Vérifiez votre connexion et réessayez.</p>
        </div>
      </div>
    );
  }

  const roadCount = layers.find((l) => l.id === 'roads')?.data.features.length ?? 0;

  return (
    <div className="h-full">
      <div className="flex flex-col-reverse lg:grid lg:grid-cols-[1fr_260px] gap-3 h-full">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col shadow-sm">
          <MapView
            center={[-21.45, 47.085]}
            zoom={13}
            layers={layers}
            className="h-64 lg:h-auto lg:flex-1"
          />
        </div>

        <aside className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 overflow-y-auto flex flex-col gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Ville</p>
            <h2 className="text-lg font-bold text-gray-800">Fianarantsoa</h2>
            <p className="text-xs text-gray-500">Haute Matsiatra, Madagascar</p>
          </div>

          <hr className="border-gray-100" />

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Couches</p>
            <div className="flex flex-col gap-2">
              {layers.map((layer) => (
                <div key={layer.id} className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-3 h-3 rounded-full" style={{
                    backgroundColor: layer.style?.color ?? '#6b7280',
                  }} />
                  <span>{layer.name}</span>
                </div>
              ))}
            </div>
          </div>

          <hr className="border-gray-100" />

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Informations</p>
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Routes</span>
                <span className="font-medium text-gray-700">{roadCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Latitude</span>
                <span className="font-medium text-gray-700">-21.45</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Longitude</span>
                <span className="font-medium text-gray-700">47.085</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Zoom</span>
                <span className="font-medium text-gray-700">13</span>
              </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Légende routes</p>
            <div className="flex flex-col gap-1.5 text-xs">
              {[
                { color: '#ea580c', label: 'Route nationale (RN7)' },
                { color: '#ca8a04', label: 'Route secondaire' },
                { color: '#6b7280', label: 'Route tertiaire' },
                { color: '#9ca3af', label: 'Rue résidentielle' },
                { color: '#2563eb', label: 'Limite administrative' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-4 h-0.5 rounded" style={{ backgroundColor: color }} />
                  <span className="text-gray-500">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
