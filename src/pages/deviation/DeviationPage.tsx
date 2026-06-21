import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  Route,
  Search,
  Clock,
  MapPin,
  ArrowLeft,
  Navigation,
  Crosshair,
  MousePointer
} from 'lucide-react';
import { transportModes } from '../../data/routesData';
import boundaryData from '../../data/fianarantsoa-boundary.json';
import { useRoadsStore } from '../../stores/roads';
import type { GeoJSONCollection } from '../../interface/Map';

type TransportMode = (typeof transportModes)[number]['id'];
type TabKey = 'form' | 'results';
type SelectingPoint = 'A' | 'B' | null;

interface Itinerary {
  id: string;
  name: string;
  polyline: [number, number][];
  distance: number;
  duration: number;
  color: string;
  weight: number;
  summary?: string;
}

interface ORSFeature {
  type: string;
  properties: {
    transfers?: number;
    fare?: number;
    segments: {
      distance: number;
      duration: number;
      steps: { instruction: string; distance: number; duration: number }[];
    }[];
    extras?: Record<string, unknown>;
    summary?: { distance: number; duration: number };
    way_points?: number[];
  };
  geometry: {
    coordinates: number[][];
    type: string;
  };
}

interface ORSResponse {
  type: string;
  features: ORSFeature[];
  metadata?: { provider?: string };
}

// ============================================================
// 🔑 Limite administrative — extraction, assemblage, masque
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

const WORLD_BOUNDS: [number, number][] = [
  [-90, -180],
  [-90, 180],
  [90, 180],
  [90, -180]
];

function drawBoundary(bLayer: L.LayerGroup, data: OverpassResponse) {
  if (!bLayer) return;
  bLayer.clearLayers();

  const segments = extractSegments(data);
  if (segments.length === 0) return;

  const rings = mergeSegmentsIntoRings(segments);
  if (rings.length === 0) return;

  // Dessiner la limite elle-même (contour détaillé avec tous les points)
  rings.forEach((ring) => {
    L.polygon(ring, {
      color: '#1e40af',
      weight: 2.5,
      fillColor: '#1e3a5f',
      fillOpacity: 0.06,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(bLayer);
  });

  // Masque extérieur : polygone « monde » troué par la limite
  // Leaflet supporte les trous : premier anneau = extérieur, suivants = trous
  if (rings.length > 0) {
    const maskCoords: [number, number][][] = [WORLD_BOUNDS, ...rings];
    L.polygon(maskCoords, {
      color: 'transparent',
      fillColor: '#0f172a',
      fillOpacity: 0.4,
      interactive: false
    }).addTo(bLayer);
  }
}

// ============================================================
// 🔑 Routes du backend — styles par type
// ============================================================
interface DisplayRoute {
  id: string;
  name: string;
  type: string;
  polyline: [number, number][];
  color: string;
  weight: number;
}

function getRouteColor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('nationale') || t.includes('rn') || t === 'primary') return '#dc2626';
  if (t.includes('secondaire') || t === 'secondary') return '#f59e0b';
  if (t.includes('tertiaire') || t === 'tertiary') return '#10b981';
  if (t.includes('urbain') || t.includes('residentiel') || t === 'residential') return '#6366f1';
  return '#6b7280';
}

function getRouteWeight(type: string): number {
  const t = type.toLowerCase();
  if (t.includes('nationale') || t.includes('rn') || t === 'primary') return 4;
  if (t.includes('secondaire') || t === 'secondary') return 3;
  if (t.includes('tertiaire') || t === 'tertiary') return 2.5;
  return 2;
}

function geoJSONToDisplayRoutes(geoJSON: GeoJSONCollection | null): DisplayRoute[] {
  if (!geoJSON || !geoJSON.features) return [];
  return geoJSON.features
    .map((feature: any) => {
      if (!feature.geometry || feature.geometry.type !== 'LineString') return null;
      const coords = feature.geometry.coordinates as number[][];
      if (coords.length < 2) return null;
      const polyline: [number, number][] = coords.map((c) => [c[1], c[0]] as [number, number]);
      const type = feature.properties?.type || 'primary';
      return {
        id: feature.properties?.id || feature.properties?.osmId || '',
        name: feature.properties?.name || 'Route',
        type,
        polyline,
        color: getRouteColor(type),
        weight: getRouteWeight(type)
      };
    })
    .filter((r): r is DisplayRoute => r !== null);
}

function drawAllRoutes(layerGroup: L.LayerGroup, routes: DisplayRoute[]) {
  layerGroup.clearLayers();
  routes.forEach((route) => {
    L.polyline(route.polyline, {
      color: route.color,
      weight: route.weight,
      opacity: 0.55,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(layerGroup);
  });
}

// ============================================================
// 🔑 Appel à l'API OpenRouteService
// ============================================================
const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY as string || '';

async function fetchORSItineraries(
  pointA: [number, number],
  pointB: [number, number],
  profile: string
): Promise<{ routes: Itinerary[]; error?: string }> {
  if (!ORS_API_KEY) {
    return { routes: [], error: 'Clé API OpenRouteService manquante. Définissez VITE_ORS_API_KEY dans .env' };
  }

  const profileMap: Record<string, string> = {
    voiture: 'driving-car',
    bus: 'driving-hgv',
    moto: 'driving-car',
    velo: 'cycling-regular'
  };
  const orsProfile = profileMap[profile] || 'driving-car';

  // OpenRouteService prend [lon, lat]
  const body = {
    coordinates: [
      [pointA[1], pointA[0]],
      [pointB[1], pointB[0]]
    ],
    alternative_routes: {
      share_factor: 0.6,
      target_count: 3
    },
    format: 'geojson'
  };

  try {
    const res = await fetch(`https://api.openrouteservice.org/v2/directions/${orsProfile}/geojson`, {
      method: 'POST',
      headers: {
        'Authorization': ORS_API_KEY,
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json, application/geo+json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const text = await res.text();
      return { routes: [], error: `ORS API error ${res.status}: ${text}` };
    }

    const data: ORSResponse = await res.json();
    if (!data.features || data.features.length === 0) {
      return { routes: [], error: 'Aucun itinéraire trouvé' };
    }

    const colors = ['#2563eb', '#e67e22', '#8e44ad', '#27ae60', '#dc2626'];
    const routes: Itinerary[] = data.features.map((feature, idx) => {
      const coords = feature.geometry.coordinates;
      const polyline: [number, number][] = coords.map((c) => [c[1], c[0]] as [number, number]);

      const segments = feature.properties.segments || [];
      const totalDistance = segments.reduce((sum, s) => sum + s.distance, 0);
      const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);

      const labels = ['Itinéraire principal', 'Variante 1', 'Variante 2', 'Variante 3', 'Variante 4'];

      return {
        id: `ors-${idx}`,
        name: labels[idx] || `Variante ${idx}`,
        polyline,
        distance: totalDistance || feature.properties.summary?.distance || 0,
        duration: totalDuration || feature.properties.summary?.duration || 0,
        color: colors[idx % colors.length],
        weight: idx === 0 ? 6 : 4
      };
    });

    return { routes };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur réseau';
    return { routes: [], error: msg };
  }
}

// ============================================================
// 🔑 Dessin des itinéraires ORS sur la carte
// ============================================================
function drawItineraries(layerGroup: L.LayerGroup, routes: Itinerary[], selectedId: string | null) {
  layerGroup.clearLayers();

  routes.forEach((route) => {
    const isSelected = route.id === selectedId;
    L.polyline(route.polyline, {
      color: route.color,
      weight: isSelected ? route.weight + 2 : route.weight,
      opacity: isSelected ? 1 : 0.7,
      lineCap: 'round',
      lineJoin: 'round',
      dashArray: isSelected ? undefined : '8, 6'
    })
      .addTo(layerGroup)
      .bindPopup(
        `<strong>${route.name}</strong><br/>` +
          `${(route.distance / 1000).toFixed(1)} km • ${Math.round(route.duration / 60)} min`
      );
  });
}

// ============================================================
// 🔑 Composant principal
// ============================================================
export default function DeviationPage() {
  const [tab, setTab] = useState<TabKey>('form');
  const [pointA, setPointA] = useState('');
  const [pointB, setPointB] = useState('');
  const [pointACoord, setPointACoord] = useState<[number, number] | null>(null);
  const [pointBCoord, setPointBCoord] = useState<[number, number] | null>(null);
  const [transport, setTransport] = useState<TransportMode>('voiture');
  const [searching, setSearching] = useState(false);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [selectedItineraryId, setSelectedItineraryId] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [selectingPoint, setSelectingPoint] = useState<SelectingPoint>(null);
  const [locating, setLocating] = useState(false);
  const [orsError, setOrsError] = useState<string | null>(null);

  const mapElRef = useRef<HTMLDivElement>(null);
  const formMapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const formMapRef = useRef<L.Map | null>(null);
  const itinerariesLayerRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const boundaryLayerRef = useRef<L.LayerGroup | null>(null);
  const allRoutesLayerRef = useRef<L.LayerGroup | null>(null);
  const formBoundaryLayerRef = useRef<L.LayerGroup | null>(null);
  const formRoutesLayerRef = useRef<L.LayerGroup | null>(null);
  const formMarkersRef = useRef<L.LayerGroup | null>(null);
  const markerARef = useRef<L.Marker | null>(null);
  const markerBRef = useRef<L.Marker | null>(null);
  const selectingPointRef = useRef<SelectingPoint>(null);
  const { geoJSON, loading: storeLoading, load: loadRoutes } = useRoadsStore();

  useEffect(() => {
    selectingPointRef.current = selectingPoint;
  }, [selectingPoint]);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  // Désactiver le bouton si ORS_API_KEY est absent
  const canSearch = pointA.trim().length > 0 && pointB.trim().length > 0 && !!ORS_API_KEY;

  // ============================================================
  // Reverse geocoding Nominatim
  // ============================================================
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
    const setter = point === 'A' ? setPointA : setPointB;
    const coordSetter = point === 'A' ? setPointACoord : setPointBCoord;
    setter(`${lat.toFixed(6)}, ${lon.toFixed(6)}`);
    coordSetter([lat, lon]);
    const address = await reverseGeocode(lat, lon);
    setter(address);
  };

  // ============================================================
  // Marqueurs sur la carte du formulaire
  // ============================================================
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

  // ============================================================
  // Géolocalisation
  // ============================================================
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
          msg = "Accès à la localisation refusé.";
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

  // ============================================================
  // Recherche via OpenRouteService
  // ============================================================
  const handleSearch = async () => {
    if (!canSearch || !pointACoord || !pointBCoord) return;
    setSearching(true);
    setOrsError(null);
    setItineraries([]);
    setSelectedItineraryId(null);

    const { routes, error } = await fetchORSItineraries(pointACoord, pointBCoord, transport);

    if (error) {
      setOrsError(error);
      setSearching(false);
      return;
    }

    setItineraries(routes);
    if (routes.length > 0) {
      setSelectedItineraryId(routes[0].id);
    }
    setTab('results');
    setShowMap(true);
    setSearching(false);
  };

  // ============================================================
  // Initialisation de la carte du formulaire
  // ============================================================
  const initFormMap = useCallback(() => {
    if (!formMapElRef.current || formMapRef.current) return;

    const map = L.map(formMapElRef.current, { zoomControl: true }).setView([-21.45249, 47.085447], 14);
    formMapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    }).addTo(map);

    formMarkersRef.current = L.layerGroup().addTo(map);
    formBoundaryLayerRef.current = L.layerGroup().addTo(map);
    formRoutesLayerRef.current = L.layerGroup().addTo(map);

    drawBoundary(formBoundaryLayerRef.current, boundaryData as OverpassResponse);
    if (geoJSON) {
      drawAllRoutes(formRoutesLayerRef.current, geoJSONToDisplayRoutes(geoJSON));
    }

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
      formRoutesLayerRef.current = null;
      markerARef.current = null;
      markerBRef.current = null;
    };
  }, [geoJSON]);

  // ============================================================
  // Initialisation de la carte des résultats
  // ============================================================
  const initMap = useCallback(() => {
    if (!mapElRef.current || mapRef.current) return;

    const map = L.map(mapElRef.current, { zoomControl: true }).setView([-21.45249, 47.085447], 14);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'OpenStreetMap',
      maxZoom: 19
    }).addTo(map);

    boundaryLayerRef.current = L.layerGroup().addTo(map);
    allRoutesLayerRef.current = L.layerGroup().addTo(map);
    itinerariesLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    drawBoundary(boundaryLayerRef.current, boundaryData as OverpassResponse);
    if (geoJSON) {
      drawAllRoutes(allRoutesLayerRef.current, geoJSONToDisplayRoutes(geoJSON));
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [geoJSON]);

  useEffect(() => {
    if (tab !== 'form') return;
    const cleanup = initFormMap();
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [tab, initFormMap]);

  useEffect(() => {
    if (!showMap) return;
    const cleanup = initMap();
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [showMap, initMap]);

  useEffect(() => {
    if (formMapRef.current) {
      setTimeout(() => formMapRef.current?.invalidateSize(), 100);
    }
  }, [selectingPoint]);

  // Dessiner les itinéraires et marqueurs sur la carte des résultats
  useEffect(() => {
    if (!showMap || !mapRef.current || !itinerariesLayerRef.current || !markersLayerRef.current) return;

    drawItineraries(itinerariesLayerRef.current, itineraries, selectedItineraryId);

    markersLayerRef.current.clearLayers();

    if (pointACoord) {
      const iconA = L.divIcon({
        className: '',
        html: `<div style="background:#22c55e;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">A</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      L.marker(pointACoord, { icon: iconA })
        .addTo(markersLayerRef.current)
        .bindPopup(`<strong>Départ:</strong> ${pointA}`);
    }

    if (pointBCoord) {
      const iconB = L.divIcon({
        className: '',
        html: `<div style="background:#ef4444;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">B</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      L.marker(pointBCoord, { icon: iconB })
        .addTo(markersLayerRef.current)
        .bindPopup(`<strong>Arrivée:</strong> ${pointB}`);
    }

    // Centrer sur tous les itinéraires
    const allCoords: [number, number][] = [];
    itineraries.forEach((r) => allCoords.push(...r.polyline));
    if (pointACoord) allCoords.push(pointACoord);
    if (pointBCoord) allCoords.push(pointBCoord);

    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords).pad(0.15);
      mapRef.current.fitBounds(bounds);
    }
  }, [showMap, itineraries, selectedItineraryId, pointACoord, pointBCoord, pointA, pointB]);

  // ============================================================
  // Rendu
  // ============================================================
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
                setItineraries([]);
                setShowMap(false);
                setOrsError(null);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft size={16} />
              Nouvelle recherche
            </button>
          )}
        </div>
      </div>

      {!ORS_API_KEY && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
          Clé API OpenRouteService manquante. Ajoutez <code className="bg-amber-100 px-1 rounded">VITE_ORS_API_KEY</code> dans le fichier <code className="bg-amber-100 px-1 rounded">.env</code>.
        </div>
      )}

      {storeLoading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-blue-700">Chargement du réseau routier...</span>
        </div>
      )}

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
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                Itinéraires ({itineraries.length})
              </p>
            </div>

            {orsError && (
              <div className="mx-3 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                {orsError}
              </div>
            )}

            {searching && (
              <div className="flex-1 flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm">Calcul en cours...</p>
              </div>
            )}

            {!searching && itineraries.length === 0 && !orsError && (
              <div className="flex-1 flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
                <Route size={32} className="opacity-30" />
                <p className="text-sm">Aucun itinéraire trouvé</p>
              </div>
            )}

            {!searching && itineraries.length > 0 && (
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                {itineraries.map((route) => {
                  const isSelected = selectedItineraryId === route.id;
                  return (
                    <div
                      key={route.id}
                      onClick={() => {
                        setSelectedItineraryId(route.id);
                        if (mapRef.current) {
                          const bounds = L.latLngBounds(route.polyline).pad(0.15);
                          mapRef.current.fitBounds(bounds);
                        }
                      }}
                      className={`rounded-lg border p-3 cursor-pointer transition-all duration-200 hover:shadow-sm ${
                        isSelected ? 'ring-2 ring-indigo-400 border-indigo-300' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
                          style={{ backgroundColor: route.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-semibold text-gray-900">{route.name}</h4>
                          <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1 mb-1.5">
                            <span className="flex items-center gap-1">
                              <Navigation size={11} /> {(route.distance / 1000).toFixed(1)} km
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={11} /> {Math.round(route.duration / 60)} min
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
