import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Route,
  Search,
  Clock,
  MapPin,
  ArrowLeft,
  Navigation,
  Car,
  Bus,
  Bike,
  ChevronLeft,
  Crosshair,
  MousePointer
} from 'lucide-react';
import { fianarantsoaRoutes, transportModes, type Route as RouteType } from '../../data/routesData';
import boundaryData from '../../data/fianarantsoa-boundary.json';

type TransportMode = (typeof transportModes)[number]['id'];
type TabKey = 'form' | 'results';
type RightPanel = 'list' | 'detail';
type SelectingPoint = 'A' | 'B' | null;

// ============================================================
// 🔑 Fusion des segments en anneaux fermés (correction de la limite)
// ============================================================
function mergeSegmentsIntoRings(segments: [number, number][][]): [number, number][][] {
  if (segments.length === 0) return [];
  const remaining: [number, number][][] = segments.map((s) => [...s]);
  const rings: [number, number][][] = [];

  const eq = (a: [number, number], b: [number, number]) =>
    Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;

  while (remaining.length > 0) {
    let ring: [number, number][] = [...remaining.shift()!];
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i];
        const ringEnd = ring[ring.length - 1];
        const segStart = seg[0];
        const segEnd = seg[seg.length - 1];
        const ringStart = ring[0];

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
    if (!eq(first, last)) ring.push(first);
    if (ring.length >= 4) rings.push(ring);
  }
  return rings;
}

// ============================================================
// 🔑 Extraction des segments depuis les données Overpass
// ============================================================
interface OverpassElement {
  type: string;
  geometry?: { lat: number; lon: number }[];
  members?: { type: string; geometry?: { lat: number; lon: number }[] }[];
}
interface OverpassResponse {
  elements: OverpassElement[];
}

function extractSegments(data: OverpassResponse): [number, number][][] {
  const segments: [number, number][][] = [];
  if (!data?.elements) return segments;

  data.elements.forEach((el) => {
    if (el.type === 'way' && el.geometry && el.geometry.length > 1) {
      segments.push(el.geometry.map((g) => [g.lat, g.lon] as [number, number]));
    }
    if (el.type === 'relation' && el.members) {
      el.members.forEach((member) => {
        if (member.type === 'way' && member.geometry && member.geometry.length > 1) {
          segments.push(member.geometry.map((g) => [g.lat, g.lon] as [number, number]));
        }
      });
    }
  });
  return segments;
}

// ============================================================
// 🔑 Construction d'un anneau "monde avec trous" pour le masque
// ============================================================
const WORLD_BOUNDS: [number, number][] = [
  [-90, -180],
  [-90, 180],
  [90, 180],
  [90, -180],
];

function buildMaskRings(rings: [number, number][][]) {
  if (rings.length === 0) return null;
  // L.polygon accepte un tableau de tableaux : le 1er est l'anneau extérieur,
  // les suivants sont des trous. Cela crée un masque correct.
  return [WORLD_BOUNDS, ...rings] as [number, number][][];
}

export default function DeviationPage() {
  const [tab, setTab] = useState<TabKey>('form');
  const [pointA, setPointA] = useState('');
  const [pointB, setPointB] = useState('');
  const [transport, setTransport] = useState<TransportMode>('voiture');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<RouteType[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteType | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [rightPanel, setRightPanel] = useState<RightPanel>('list');
  const [selectingPoint, setSelectingPoint] = useState<SelectingPoint>(null);
  const [locating, setLocating] = useState(false);

  const mapElRef = useRef<HTMLDivElement>(null);
  const formMapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const formMapRef = useRef<L.Map | null>(null);
  const routesLayerRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const boundaryLayerRef = useRef<L.LayerGroup | null>(null);
  const formBoundaryLayerRef = useRef<L.LayerGroup | null>(null);
  const formMarkersRef = useRef<L.LayerGroup | null>(null);

  const selectingPointRef = useRef<SelectingPoint>(null);
  const markerARef = useRef<L.Marker | null>(null);
  const markerBRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    selectingPointRef.current = selectingPoint;
  }, [selectingPoint]);

  const canSearch = pointA.trim().length > 0 && pointB.trim().length > 0;

  const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'fr' } }
      );
      const data = await res.json();
      if (data.display_name) {
        const addr = data.address;
        const parts = [addr.road, addr.suburb, addr.neighbourhood, addr.city].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : data.display_name;
      }
      return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    } catch {
      return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    }
  };

  const setPointWithGeocode = async (point: 'A' | 'B', lat: number, lon: number) => {
    const coordStr = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    const setter = point === 'A' ? setPointA : setPointB;
    setter(coordStr);
    const address = await reverseGeocode(lat, lon);
    setter(address);
  };

  const placeMarkerOnFormMap = (point: 'A' | 'B', lat: number, lng: number) => {
    if (!formMapRef.current || !formMarkersRef.current) return;

    if (point === 'A' && markerARef.current) {
      formMapRef.current.removeLayer(markerARef.current);
      markerARef.current = null;
    }
    if (point === 'B' && markerBRef.current) {
      formMapRef.current.removeLayer(markerBRef.current);
      markerBRef.current = null;
    }

    const color = point === 'A' ? '#22c55e' : '#ef4444';
    const icon = L.divIcon({
      className: '',
      html: `<div style="background:${color};color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${point}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const marker = L.marker([lat, lng], { icon }).addTo(formMarkersRef.current);

    if (point === 'A') markerARef.current = marker;
    else markerBRef.current = marker;
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        await setPointWithGeocode('A', latitude, longitude);
        placeMarkerOnFormMap('A', latitude, longitude);
        if (formMapRef.current) {
          formMapRef.current.setView([latitude, longitude], 16);
        }
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        let msg = "Impossible d'obtenir votre position.";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "Accès à la localisation refusé. Veuillez autoriser l'accès dans les paramètres du navigateur.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Position indisponible.';
        } else if (error.code === error.TIMEOUT) {
          msg = "Délai d'attente dépassé.";
        }
        alert(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSearch = () => {
    if (!canSearch) return;
    setSearching(true);
    setResults([]);
    setSelectedRouteId(null);
    setSelectedRoute(null);
    setRightPanel('list');

    setTimeout(() => {
      const filteredRoutes = fianarantsoaRoutes.routes.filter((r) => {
        if (transport === 'velo') return r.transport === 'Vélo' || r.transport === 'Moto';
        if (transport === 'bus') return r.transport === 'Bus' || r.transport === 'Voiture';
        if (transport === 'moto') return r.transport !== 'Bus';
        return true;
      });
      setResults(filteredRoutes);
      setTab('results');
      setShowMap(true);
      setSearching(false);

      setTimeout(() => {
        drawRoutes(filteredRoutes);
        drawBoundary(boundaryData as OverpassResponse);
      }, 100);
    }, 1500);
  };

  // ============================================================
  // 🔑 Dessin CORRECT de la limite (avec fusion en anneaux)
  // ============================================================
  const drawBoundary = (data: OverpassResponse) => {
    const bLayer = boundaryLayerRef.current;
    if (!bLayer) return;
    bLayer.clearLayers();

    const segments = extractSegments(data);
    if (segments.length === 0) return;

    const rings = mergeSegmentsIntoRings(segments);
    if (rings.length === 0) return;

    // 1) Dessiner chaque anneau (contour net)
    rings.forEach((ring) => {
      L.polygon(ring, {
        color: '#2563eb',
        weight: 2.5,
        fillColor: '#3b82f6',
        fillOpacity: 0.05,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(bLayer);
    });

    // 2) Masque : monde avec tous les anneaux comme trous
    const maskRings = buildMaskRings(rings);
    if (maskRings) {
      const maskPolygon = L.polygon(maskRings, {
        color: 'transparent',
        fillColor: '#000000',
        fillOpacity: 0.35,
        interactive: false,
        fillRule: 'evenodd'
      }).addTo(bLayer);
      maskPolygon.bringToBack();
    }
  };

  // ============================================================
  // 🔑 Dessin CORRECT de la limite sur la carte du formulaire
  // ============================================================
  const drawFormBoundary = (data: OverpassResponse) => {
    const bLayer = formBoundaryLayerRef.current;
    if (!bLayer) return;
    bLayer.clearLayers();

    const segments = extractSegments(data);
    if (segments.length === 0) return;

    const rings = mergeSegmentsIntoRings(segments);
    if (rings.length === 0) return;

    // 1) Contour net
    rings.forEach((ring) => {
      L.polygon(ring, {
        color: '#2563eb',
        weight: 2.5,
        fillColor: '#3b82f6',
        fillOpacity: 0.05,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(bLayer);
    });

    // 2) Masque extérieur
    const maskRings = buildMaskRings(rings);
    if (maskRings) {
      const maskPolygon = L.polygon(maskRings, {
        color: 'transparent',
        fillColor: '#000000',
        fillOpacity: 0.35,
        interactive: false,
        fillRule: 'evenodd'
      }).addTo(bLayer);
      maskPolygon.bringToBack();
    }
  };

  const initFormMap = () => {
    if (!formMapElRef.current || formMapRef.current) return;
    const map = L.map(formMapElRef.current, { zoomControl: true }).setView([-21.45249, 47.085447], 14);
    formMapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    }).addTo(map);
    formMarkersRef.current = L.layerGroup().addTo(map);
    formBoundaryLayerRef.current = L.layerGroup().addTo(map);

    drawFormBoundary(boundaryData as OverpassResponse);

    map.on('click', async (e: L.LeafletMouseEvent) => {
      const currentSelecting = selectingPointRef.current;
      if (!currentSelecting) return;

      const { lat, lng } = e.latlng;

      placeMarkerOnFormMap(currentSelecting, lat, lng);
      await setPointWithGeocode(currentSelecting, lat, lng);
      setSelectingPoint(null);
    });

    return () => {
      map.remove();
      formMapRef.current = null;
      formMarkersRef.current = null;
      formBoundaryLayerRef.current = null;
      markerARef.current = null;
      markerBRef.current = null;
    };
  };

  const initMap = () => {
    if (!mapElRef.current || mapRef.current) return;
    const map = L.map(mapElRef.current, { zoomControl: true }).setView([-21.45249, 47.085447], 14);
    mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'OpenStreetMap',
      maxZoom: 19
    }).addTo(map);
    routesLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    boundaryLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  };

  useEffect(() => {
    if (tab !== 'form') return;
    const cleanup = initFormMap();
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [tab]);

  useEffect(() => {
    if (!showMap) return;
    const cleanup = initMap();
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [showMap]);

  useEffect(() => {
    if (formMapRef.current) {
      setTimeout(() => formMapRef.current?.invalidateSize(), 100);
    }
  }, [selectingPoint]);

  const createNumberedIcon = (num: number, color: string) => {
    return L.divIcon({
      className: '',
      html: `<div style="background:${color};color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${num}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  };

  const drawRoutes = (routes: RouteType[]) => {
    const rLayer = routesLayerRef.current;
    const mLayer = markersLayerRef.current;
    if (!rLayer || !mLayer || !mapRef.current) return;

    rLayer.clearLayers();
    mLayer.clearLayers();

    const allCoords: [number, number][] = [];
    const { A, B } = fianarantsoaRoutes.points;

    routes.forEach((route) => {
      const polyline = L.polyline(route.polyline as [number, number][], {
        color: route.color,
        weight: route.type === 'main' ? 5 : 4,
        opacity: route.type === 'main' ? 0.6 : 0.9,
        dashArray: route.blocked ? '10, 6' : undefined
      }).addTo(rLayer);

      polyline.bindPopup(`<strong>${route.name}</strong><br/>${route.distance} km &bull; ${route.duration} min`);

      polyline.on('click', () => {
        setSelectedRouteId(route.id);
      });

      allCoords.push(...(route.polyline as [number, number][]));
    });

    L.marker([A.lat, A.lng], { icon: createNumberedIcon(1, '#22c55e') })
      .addTo(mLayer)
      .bindPopup(`<strong>Départ:</strong> ${A.name}`);

    L.marker([B.lat, B.lng], { icon: createNumberedIcon(2, '#ef4444') })
      .addTo(mLayer)
      .bindPopup(`<strong>Arrivée:</strong> ${B.name}`);

    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords).pad(0.15);
      mapRef.current.fitBounds(bounds);
    }
  };

  const getTransportIcon = (mode?: string) => {
    switch (mode) {
      case 'Bus':
        return <Bus size={14} />;
      case 'Vélo':
        return <Bike size={14} />;
      default:
        return <Car size={14} />;
    }
  };

  const focusRoute = (route: RouteType) => {
    setSelectedRouteId(route.id);
    if (mapRef.current) {
      const bounds = L.latLngBounds(route.polyline as [number, number][]).pad(0.15);
      mapRef.current.fitBounds(bounds);
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Planificateur de déviations - Fianarantsoa</h1>
          <p className="text-sm text-gray-500 mt-1">Trouvez des itinéraires alternatifs en cas de route bloquée</p>
        </div>
        <div className="flex gap-2">
          {tab === 'results' && (
            <button
              onClick={() => {
                setTab('form');
                setResults([]);
                setShowMap(false);
                setSelectedRoute(null);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft size={16} />
              Nouvelle recherche
            </button>
          )}
        </div>
      </div>

      {tab === 'form' && (
        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_420px] gap-4 flex-1 min-h-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm flex flex-col min-h-[400px] lg:min-h-0 relative">
            <div ref={formMapElRef} className="flex-1 z-10" />

            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
              {selectingPoint ? (
                <div
                  className={`px-4 py-2 rounded-full shadow-lg text-xs font-semibold flex items-center gap-2 pointer-events-auto ${
                    selectingPoint === 'A' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                  }`}
                >
                  <MousePointer size={14} />
                  Cliquez sur la carte pour placer le point {selectingPoint}
                  <button onClick={() => setSelectingPoint(null)} className="ml-1 hover:bg-white/20 rounded-full p-0.5">
                    ✕
                  </button>
                </div>
              ) : (
                <div className="px-4 py-2 rounded-full bg-white/95 backdrop-blur shadow-lg text-xs font-medium text-gray-600 flex items-center gap-2">
                  <MapPin size={14} className="text-indigo-500" />
                  Cliquez sur « Choisir sur la carte » pour sélectionner un point
                </div>
              )}
            </div>

            {selectingPoint && (
              <style>{`
                .leaflet-container { cursor: crosshair !important; }
              `}</style>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col">
            <div className="flex flex-col gap-4 mb-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                  <MapPin size={14} className="text-green-500" />
                  Point de départ (A)
                </label>
                <div className="flex flex-col gap-2">
                  <input
                    value={pointA}
                    onChange={(e) => setPointA(e.target.value)}
                    placeholder="Ex: Centre-ville, Fianarantsoa"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectingPoint(selectingPoint === 'A' ? null : 'A')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                        selectingPoint === 'A'
                          ? 'bg-green-500 text-white border-green-500'
                          : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                      }`}
                    >
                      <MousePointer size={13} />
                      Choisir sur la carte
                    </button>
                    <button
                      onClick={handleUseMyLocation}
                      disabled={locating}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                    >
                      {locating ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                          Localisation...
                        </>
                      ) : (
                        <>
                          <Crosshair size={13} />
                          Ma position
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                  <MapPin size={14} className="text-red-500" />
                  Point d'arrivée (B)
                </label>
                <div className="flex flex-col gap-2">
                  <input
                    value={pointB}
                    onChange={(e) => setPointB(e.target.value)}
                    placeholder="Ex: Aéroport, Fianarantsoa"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                  <button
                    onClick={() => setSelectingPoint(selectingPoint === 'B' ? null : 'B')}
                    className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                      selectingPoint === 'B'
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                    }`}
                  >
                    <MousePointer size={13} />
                    Choisir sur la carte
                  </button>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                <Navigation size={14} />
                Mode de transport
              </label>
              <div className="flex gap-2 flex-wrap">
                {transportModes.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setTransport(mode.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                      transport === mode.id
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span>{mode.icon}</span>
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-auto">
              <button
                onClick={handleSearch}
                disabled={!canSearch || searching}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {searching ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Recherche en cours...
                  </>
                ) : (
                  <>
                    <Search size={18} />
                    Rechercher les déviations
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'results' && (
        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_380px] gap-4 flex-1 min-h-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm flex flex-col min-h-[600px] lg:min-h-0">
            {showMap && <div ref={mapElRef} className="flex-1 z-10" />}
            {!showMap && (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                Chargement de la carte...
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
            {rightPanel === 'detail' && selectedRoute ? (
              <>
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                  <button
                    onClick={() => setRightPanel('list')}
                    className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: selectedRoute.color }}
                    />
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{selectedRoute.name}</h3>
                  </div>
                </div>

                <div className="flex items-center gap-4 px-4 py-2.5 border-b border-gray-100 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Navigation size={12} /> {selectedRoute.distance} km
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {selectedRoute.duration} min
                  </span>
                  {selectedRoute.transport && (
                    <span className="flex items-center gap-1">
                      {getTransportIcon(selectedRoute.transport)} {selectedRoute.transport}
                    </span>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Instructions</p>
                  <div className="relative">
                    <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-200" />
                    <div className="flex flex-col gap-3">
                      {selectedRoute.steps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-3 relative">
                          <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold shrink-0 z-10">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700">{step.instruction}</p>
                            {step.distance > 0 && <p className="text-xs text-gray-400 mt-0.5">{step.distance} km</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Itinéraires ({results.length})
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                  {searching && (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
                      <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      <p className="text-sm">Calcul en cours...</p>
                    </div>
                  )}

                  {!searching && results.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
                      <Route size={32} className="opacity-30" />
                      <p className="text-sm">Aucun itinéraire</p>
                    </div>
                  )}

                  {!searching &&
                    results.map((route) => {
                      const isSelected = selectedRouteId === route.id;
                      return (
                        <div
                          key={route.id}
                          onClick={() => focusRoute(route)}
                          className={`rounded-lg border p-3 cursor-pointer transition-all duration-200 hover:shadow-sm ${
                            isSelected
                              ? 'ring-2 ring-indigo-400 border-indigo-300'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div
                              className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
                              style={{ backgroundColor: route.color }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                <h4 className="text-xs font-semibold text-gray-900">{route.name}</h4>
                                {route.blocked && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-600">
                                    BLOQUÉ
                                  </span>
                                )}
                                {route.recommended && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-600">
                                    Recommandé
                                  </span>
                                )}
                                {route.fastest && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-600">
                                    Rapide
                                  </span>
                                )}
                                {route.shortest && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-100 text-purple-600">
                                    Court
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-2">
                                <span className="flex items-center gap-1">
                                  <Navigation size={11} /> {route.distance} km
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock size={11} /> {route.duration} min
                                </span>
                                {route.transport && (
                                  <span className="flex items-center gap-1">{getTransportIcon(route.transport)}</span>
                                )}
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRoute(route);
                                  setRightPanel('detail');
                                }}
                                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                              >
                                Voir les détails →
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
