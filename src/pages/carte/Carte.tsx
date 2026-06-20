/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Maximize2, Minimize2 } from 'lucide-react';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

interface City {
  label: string;
  lat: number;
  lng: number;
  zoom?: number;
}
interface MarkerInfo {
  id: number;
  lat: number;
  lng: number;
  label: string;
}
type TileKey = 'osm' | 'topo' | 'satellite';

const CITIES: City[] = [
  { label: 'Antananarivo, Madagascar', lat: -18.9137, lng: 47.5361, zoom: 11 },
  { label: 'Paris, France', lat: 48.8566, lng: 2.3522, zoom: 12 },
  { label: 'Londres, Royaume-Uni', lat: 51.5074, lng: -0.1278, zoom: 12 },
  { label: 'New York, USA', lat: 40.7128, lng: -74.006, zoom: 12 },
  { label: 'Tokyo, Japon', lat: 35.6895, lng: 139.6917, zoom: 12 },
  { label: 'Sydney, Australie', lat: -33.8688, lng: 151.2093, zoom: 12 },
  { label: 'Moscou, Russie', lat: 55.7558, lng: 37.6173, zoom: 11 },
  { label: 'Nairobi, Kenya', lat: -1.2921, lng: 36.8219, zoom: 12 },
  { label: 'Le Caire, Egypte', lat: 30.0444, lng: 31.2357, zoom: 12 },
  { label: 'Mexico, Mexique', lat: 19.4326, lng: -99.1332, zoom: 11 },
  { label: 'Rio de Janeiro, Bresil', lat: -22.9068, lng: -43.1729, zoom: 12 },
  { label: 'Singapour', lat: 1.3521, lng: 103.8198, zoom: 12 },
  { label: 'Dubai, Emirats', lat: 25.2048, lng: 55.2708, zoom: 12 },
  { label: 'Mumbai, Inde', lat: 19.076, lng: 72.8777, zoom: 12 }
];

const TILES: Record<TileKey, { url: string; attribution: string; label: string }> = {
  osm: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: 'OpenStreetMap', label: 'OSM' },
  topo: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: 'OpenTopoMap', label: 'Topo' },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri',
    label: 'Satellite'
  }
};

let markerIdCounter = 0;

function createPulseIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: '<div class="pulse-marker"></div>',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
}

export default function CartePage() {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const layerGroup = useRef<L.LayerGroup | null>(null);
  const pulseRef = useRef<L.Marker | null>(null);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [markers, setMarkers] = useState<MarkerInfo[]>([]);
  const [centerInfo, setCenterInfo] = useState('--');
  const [zoomInfo, setZoomInfo] = useState('--');
  const [lastClick, setLastClick] = useState('--');
  const [selectedCity, setSelectedCity] = useState('');
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');
  const [tileKey, setTileKey] = useState<TileKey>('osm');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const animatePulse = useCallback((lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;
    if (pulseRef.current) map.removeLayer(pulseRef.current);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseRef.current = L.marker([lat, lng], { icon: createPulseIcon(), interactive: false, zIndexOffset: -1 }).addTo(
      map
    );
    pulseTimer.current = setTimeout(() => {
      if (pulseRef.current) map.removeLayer(pulseRef.current);
    }, 1300);
  }, []);

  const addMarker = useCallback(
    (lat: number, lng: number, label: string) => {
      const map = mapRef.current;
      const group = layerGroup.current;
      if (!map || !group) return;
      const id = ++markerIdCounter;
      const m = L.circleMarker([lat, lng], {
        radius: 8,
        fillColor: '#185FA5',
        color: '#fff',
        weight: 2,
        fillOpacity: 0.9
      })
        .addTo(group)
        .bindPopup('<strong>' + label + '</strong>');
      (m as any)._markerId = id;
      setMarkers((prev) => [...prev, { id, lat, lng, label }]);
      animatePulse(lat, lng);
    },
    [animatePulse]
  );

  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;
    const map = L.map(mapElRef.current, { zoomControl: true }).setView([-18.9137, 47.5361], 6);
    mapRef.current = map;
    layerGroup.current = L.layerGroup().addTo(map);
    tileRef.current = L.tileLayer(TILES.osm.url, { attribution: TILES.osm.attribution, maxZoom: 19 }).addTo(map);

    const updateInfo = () => {
      const c = map.getCenter();
      setCenterInfo(c.lat.toFixed(4) + ', ' + c.lng.toFixed(4));
      setZoomInfo(String(map.getZoom()));
    };
    map.on('moveend zoomend', updateInfo);
    updateInfo();

    map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = parseFloat(e.latlng.lat.toFixed(5));
      const lng = parseFloat(e.latlng.lng.toFixed(5));
      setLastClick(lat + ', ' + lng);
      addMarker(lat, lng, lat + ', ' + lng);
    });

    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      map.remove();
      mapRef.current = null;
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, [addMarker]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileRef.current) return;
    map.removeLayer(tileRef.current);
    tileRef.current = L.tileLayer(TILES[tileKey].url, { attribution: TILES[tileKey].attribution, maxZoom: 19 }).addTo(
      map
    );
  }, [tileKey]);

  const flyToCity = (value: string) => {
    setSelectedCity(value);
    if (!value || !mapRef.current) return;
    const city = CITIES.find((c) => c.lat + ',' + c.lng === value);
    if (!city) return;
    mapRef.current.flyTo([city.lat, city.lng], city.zoom ?? 11, { animate: true, duration: 2.0, easeLinearity: 0.25 });
    setTimeout(() => animatePulse(city.lat, city.lng), 2100);
  };

  const flyToCoords = () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      alert('Coordonnees invalides.');
      return;
    }
    mapRef.current?.flyTo([lat, lng], 13, { animate: true, duration: 1.8, easeLinearity: 0.3 });
    setTimeout(() => addMarker(lat, lng, lat.toFixed(4) + ', ' + lng.toFixed(4)), 1900);
  };

  const clearMarkers = () => {
    layerGroup.current?.clearLayers();
    setMarkers([]);
  };

  const removeMarker = (id: number) => {
    layerGroup.current?.eachLayer((layer: any) => {
      if (layer._markerId === id) layerGroup.current?.removeLayer(layer);
    });
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  };

  const fitMarkers = () => {
    if (markers.length === 0 || !mapRef.current) return;
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])).pad(0.2);
    mapRef.current.flyToBounds(bounds, { animate: true, duration: 1.5 });
  };

  const locateMe = () => {
    const map = mapRef.current;
    if (!map) return;
    map.locate({ setView: true, maxZoom: 14 });
    map.once('locationfound', (e: L.LocationEvent) => addMarker(e.latlng.lat, e.latlng.lng, 'Ma position'));
    map.once('locationerror', () => alert('Impossible de detecter votre position.'));
  };

  const toggleFullscreen = () => {
    const el = mapElRef.current?.parentElement;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  return (
    <div className="h-full">
      <div className="flex flex-col-reverse lg:grid lg:grid-cols-[1fr_260px] gap-3 h-full">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
            <span className="text-sm font-semibold text-gray-800 tracking-tight">Carte interactive</span>
            <div className="flex items-center gap-1.5">
              {(['osm', 'topo', 'satellite'] as TileKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setTileKey(k)}
                  className={
                    'text-xs px-2.5 py-1 rounded-md border cursor-pointer transition-colors ' +
                    (tileKey === k
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50')
                  }
                >
                  {TILES[k].label}
                </button>
              ))}
              <button
                onClick={toggleFullscreen}
                className="text-sm w-6.5 h-6.5 flex items-center justify-center border border-gray-200 rounded-md hover:bg-gray-50 text-gray-500 cursor-pointer"
              >
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
            </div>
          </div>
          <div ref={mapElRef} className="h-64 lg:h-auto lg:flex-1 z-10" />
        </div>

        <aside className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 overflow-y-auto flex flex-col gap-4 lg:max-h-full">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Ville</p>
            <select
              value={selectedCity}
              onChange={(e) => flyToCity(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
            >
              <option value="">-- Choisir une ville --</option>
              {CITIES.map((c) => (
                <option key={c.label} value={c.lat + ',' + c.lng}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <hr className="border-gray-100" />

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Coordonnees</p>
            <div className="flex gap-1.5 mb-2">
              <input
                type="number"
                placeholder="Latitude"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && flyToCoords()}
                min={-90}
                max={90}
                step="any"
                className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <input
                type="number"
                placeholder="Longitude"
                value={lngInput}
                onChange={(e) => setLngInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && flyToCoords()}
                min={-180}
                max={180}
                step="any"
                className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <button
              onClick={flyToCoords}
              className="w-full text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-2 font-medium transition-colors cursor-pointer"
            >
              Aller
            </button>
          </div>

          <hr className="border-gray-100" />

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
              Marqueurs ({markers.length})
            </p>
            {markers.length === 0 ? (
              <p className="text-xs text-gray-400 leading-relaxed">Cliquez sur la carte pour poser un marqueur.</p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto mb-2">
                {markers.map((m) => (
                  <div key={m.id} className="flex items-center gap-1">
                    <button
                      onClick={() => mapRef.current?.flyTo([m.lat, m.lng], 14, { animate: true, duration: 1.2 })}
                      className="flex-1 text-left text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors truncate cursor-pointer"
                    >
                      {m.label.length > 20 ? m.label.slice(0, 18) + '...' : m.label}
                    </button>
                    <button
                      onClick={() => removeMarker(m.id)}
                      className="text-gray-300 hover:text-gray-500 text-base w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
            {markers.length > 0 && (
              <button
                onClick={clearMarkers}
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 text-gray-500 transition-colors cursor-pointer"
              >
                Effacer tout
              </button>
            )}
          </div>

          <hr className="border-gray-100" />

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Informations</p>
            <div className="flex flex-col gap-1">
              {[
                ['Centre', centerInfo],
                ['Zoom', zoomInfo],
                ['Clic', lastClick]
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-baseline">
                  <span className="text-xs text-gray-400">{label}</span>
                  <span className="text-xs font-medium text-gray-700 tabular-nums">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <hr className="border-gray-100" />

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Actions rapides</p>
            <div className="flex gap-1.5 mb-1.5">
              <button
                onClick={() => mapRef.current?.zoomIn()}
                className="flex-1 text-xs border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
              >
                + Zoom
              </button>
              <button
                onClick={() => mapRef.current?.zoomOut()}
                className="flex-1 text-xs border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
              >
                - Zoom
              </button>
            </div>
            <button
              onClick={locateMe}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer mb-1.5"
            >
              Ma position
            </button>
            <button
              onClick={fitMarkers}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
            >
              Centrer sur marqueurs
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
