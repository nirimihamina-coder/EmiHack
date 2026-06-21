import axiosInstance from '../api/axios';

const CACHE_PREFIX = 'fk_';
const FETCH_TIMEOUT = 25000;

export const mapService = {
  getOverpassServers: () => {
    const urls = import.meta.env.VITE_OVERPASS_API_URLS;
    return urls.split(',').map((u: string) => u.trim());
  },

  getNominatimUrl: () => {
    return import.meta.env.VITE_NOMINATIM_API_URL;
  },

  overpassQuery: async (query: string): Promise<any> => {
    const cacheKey = CACHE_PREFIX + btoa(query.slice(0, 200));
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);

    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const servers = mapService.getOverpassServers();

    let lastError: any;
    for (let i = 0; i < servers.length; i++) {
      if (i > 0) await delay(1000 * i);
      try {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT);
        const res = await fetch(servers[i], {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ data: query }),
          signal: ac.signal,
        });
        clearTimeout(timer);
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        }
        const json = await res.json();
        sessionStorage.setItem(cacheKey, JSON.stringify(json));
        return json;
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  },

  fetchFianarantsoaBbox: async (): Promise<string> => {
    const url = `${mapService.getNominatimUrl()}?q=Fianarantsoa,Madagascar&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
    if (!res.ok) throw new Error('Impossible de contacter Nominatim');
    const data = await res.json();
    if (!data || data.length === 0) throw new Error('Fianarantsoa introuvable');
    const bb = data[0].boundingbox;
    return `${bb[0]},${bb[2]},${bb[1]},${bb[3]}`;
  },

  fetchIntersections: async (): Promise<any[]> => {
    const res = await axiosInstance.get('/intersections');
    const data = res.data;
    return Array.isArray(data) ? data : (data.data || data.results || []);
  },

  fetchRoutes: async (): Promise<any[]> => {
    const res = await axiosInstance.get('/routes/all');
    return res.data;
  },

  createIntersection: async (data: { name: string; lat: number; lon: number; type: string }) => {
    const res = await axiosInstance.post('/intersections', data);
    return res.data;
  },

  linkRouteIntersection: async (data: { intersectionId: string | number; routeId1: string; routeId2: string; priorityRouteId: string; positionOnRoute1: number; positionOnRoute2: number }) => {
    const res = await axiosInstance.post('/route-intersections', data);
    return res.data;
  },

  createReport: async (data: any) => {
    const res = await axiosInstance.post('/reports', data);
    return res.data;
  },

  // Fetch the commune boundary polygon for Fianarantsoa (admin_level=8)
  fetchCommuneBoundary: async (): Promise<any> => {
    const query = `[out:json][timeout:25];
      relation["name:fr"="Fianarantsoa"]["boundary"="administrative"]["admin_level"="8"];
      out geom;`;
    const data = await mapService.overpassQuery(query);
    if (data.elements?.length) return data;
    // fallback: try name tag
    const fallback = `[out:json][timeout:25];
      relation["name"="Fianarantsoa"]["boundary"="administrative"]["admin_level"="8"];
      out geom;`;
    return mapService.overpassQuery(fallback);
  },
};
