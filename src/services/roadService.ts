import axiosInstance from '../api/axios';
import type { GeoJSONFeature, GeoJSONCollection } from '../interface/Map';

// ── Types API ────────────────────────────────────────────────────────────────
export interface ApiRoute {
  id: string;
  name: string;
  type: string;
  distance: number;
  duration: number;
  createdAt: string;
  coordinatesUrl: string;
}

export interface Road {
  id: string;
  name: string;
  type: string;
  distance?: number;
  duration?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
// Détermine si une paire [a, b] représente [lat, lon] (plage lat: -90..90, lon: -180..180)
// Madagascar : lat ≈ -25..-12, lon ≈ 43..50 → si |a| > 90 c'est forcément [lon, lat]
function isLatLon(coord: number[]): boolean {
  const [a, b] = coord;
  // Fianarantsoa : lat ≈ -21, lon ≈ 47
  // Si a est dans la plage des longitudes (> 40) et b dans celle des latitudes (< 0)
  if (Math.abs(a) > 90 && Math.abs(b) <= 90) return false; // [lon, lat]
  if (Math.abs(b) > 90 && Math.abs(a) <= 90) return true;  // [lat, lon]
  // Heuristique : Madagascar lat négative, lon positive > 40
  if (a < 0 && b > 40) return true;  // [lat, lon]
  if (b < 0 && a > 40) return false; // [lon, lat]
  return false; // par défaut on considère [lon, lat] (GeoJSON standard)
}

function toLonLat(coord: number[]): [number, number] {
  if (isLatLon(coord)) return [coord[1], coord[0]];
  return [coord[0], coord[1]];
}

// Normalise les coordonnées reçues de l'API en format GeoJSON [lon, lat]
function normalizeCoordinates(raw: any): number[][] {
  if (!Array.isArray(raw)) return [];

  // Cas 1 : tableau de nombres → un seul point (inhabituel)
  if (raw.length > 0 && typeof raw[0] === 'number') {
    return [toLonLat(raw)];
  }

  // Cas 2 : tableau de tableaux
  if (raw.type === 'LineString' && Array.isArray(raw.coordinates)) {
    return (raw.coordinates as number[][]).map(toLonLat);
  }
  if (raw.type === 'MultiLineString' && Array.isArray(raw.coordinates)) {
    // On prend la première ligne (cas le plus courant pour une route)
    return (raw.coordinates[0] as number[][]).map(toLonLat);
  }
  if (raw.type === 'Feature' && raw.geometry) {
    return normalizeCoordinates(raw.geometry);
  }
  if (raw.type === 'FeatureCollection' && Array.isArray(raw.features)) {
    // Concatène toutes les lignes
    const all: number[][] = [];
    for (const f of raw.features) {
      all.push(...normalizeCoordinates(f));
    }
    return all;
  }

  // Tableau de coordonnées
  return (raw as number[][]).map(toLonLat);
}

// ── API calls ────────────────────────────────────────────────────────────────
export async function fetchRoutes(): Promise<ApiRoute[]> {
  const res = await axiosInstance.get<ApiRoute[]>('/routes');
  console.log("1-fetchRoutes", res.data);
  
  return res.data;
}

export async function fetchRouteCoordinates(routeId: string): Promise<number[][]> {
  const res = await axiosInstance.get(`/routes/${routeId}/coordinates`);
  console.log("2-fetchRouteCoordinates", routeId, res.data);
  
  return normalizeCoordinates(res.data);
}

// ── Constructeurs GeoJSON / Road[] ───────────────────────────────────────────
export function apiRoutesToRoads(apiRoutes: ApiRoute[]): Road[] {
  return apiRoutes.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    distance: r.distance,
    duration: r.duration,
  }));
}

export async function buildRoadsGeoJSON(apiRoutes: ApiRoute[]): Promise<GeoJSONCollection> {
  const features: GeoJSONFeature[] = [];

  // Récupère les coordonnées de toutes les routes en parallèle (avec limite)
  const CONCURRENCY = 5;
  for (let i = 0; i < apiRoutes.length; i += CONCURRENCY) {
    const chunk = apiRoutes.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((r) => fetchRouteCoordinates(r.id))
    );

    chunk.forEach((r, idx) => {
      const result = results[idx];
      if (result.status !== 'fulfilled') {
        console.warn(`Coordonnées indisponibles pour la route ${r.name} (${r.id})`);
        return;
      }
      const coords = result.value;
      if (!coords || coords.length < 2) return;

      features.push({
        type: 'Feature',
        properties: {
          id: r.id,
          osmId: r.id,
          name: r.name,
          type: mapRoadType(r.type),
        },
        geometry: {
          type: 'LineString',
          coordinates: coords,
        },
      } as unknown as GeoJSONFeature);
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  } as unknown as GeoJSONCollection;
}

// Mappe le type API vers les types utilisés par le style des routes
function mapRoadType(apiType: string): string {
  const t = (apiType || '').toLowerCase();
  if (t.includes('nationale') || t.includes('primary') || t === 'rn') return 'primary';
  if (t.includes('secondaire') || t.includes('secondary')) return 'secondary';
  if (t.includes('tertiaire') || t.includes('tertiary')) return 'tertiary';
  if (t.includes('urbain') || t.includes('résidentiel') || t.includes('residential')) return 'residential';
  return 'primary';
}