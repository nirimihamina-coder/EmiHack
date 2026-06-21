import { create } from 'zustand';
import {
  fetchRoutes,
  buildRoadsGeoJSON,
  apiRoutesToRoads,
  type ApiRoute,
  type Road,
} from '../services/roadService';
import type { GeoJSONCollection } from '../interface/Map';

interface RoadsState {
  apiRoutes: ApiRoute[];
  roads: Road[];
  geoJSON: GeoJSONCollection | null;
  loading: boolean;
  error: string | null;
  loaded: boolean;

  load: () => Promise<void>;
  reset: () => void;
}

export const useRoadsStore = create<RoadsState>((set, get) => ({
  apiRoutes: [],
  roads: [],
  geoJSON: null,
  loading: false,
  error: null,
  loaded: false,

  load: async () => {
    if (get().loading) return;
    if (get().loaded) return; // déjà chargé

    set({ loading: true, error: null });
    try {
      const apiRoutes = await fetchRoutes();
      const roads = apiRoutesToRoads(apiRoutes);
      const geoJSON = await buildRoadsGeoJSON(apiRoutes);

      set({
        apiRoutes,
        roads,
        geoJSON,
        loading: false,
        loaded: true,
      });
    } catch (err: any) {
      console.error('Erreur chargement routes:', err);
      set({
        loading: false,
        error: err?.message || 'Erreur lors du chargement des routes',
      });
    }
  },

  reset: () => {
    set({
      apiRoutes: [],
      roads: [],
      geoJSON: null,
      loading: false,
      error: null,
      loaded: false,
    });
  },
}));

// Helpers compatibles avec l'ancien code
export function getAllRoads(): Road[] {
  return useRoadsStore.getState().roads;
}

export function getRoadsGeoJSON(): GeoJSONCollection {
  const geo = useRoadsStore.getState().geoJSON;
  if (!geo) {
    return { type: 'FeatureCollection', features: [] } as unknown as GeoJSONCollection;
  }
  return geo;
}