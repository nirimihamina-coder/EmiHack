import { create } from 'zustand';
import {
  fetchScenarios,
  createScenario,
  updateScenario,
  deleteScenario,
  type SimulationScenario,
} from '../services/simulationScenarioService';

export interface SimulationConfigItem {
  id: string;
  routeId: string;
  vehicleCount: number;
  avgSpeed: number;
  route?: {
    id?: string;
    name?: string;
    coordinates?: number[][];
  };
}

interface SimulationScenariosState {
  scenarios: SimulationScenario[];
  scenario: SimulationScenario | null;
  configs: SimulationConfigItem[];
  loading: boolean;
  initializing: boolean;
  error: string | null;
  loaded: boolean;

  load: () => Promise<void>;
  init: () => Promise<void>;
  add: (scenario: Omit<SimulationScenario, 'id' | 'createdAt'>) => Promise<void>;
  update: (id: string, scenario: Partial<SimulationScenario>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  addConfig: (routeId: string, vehicleCount: number, avgSpeed: number) => void;
  removeConfig: (configId: string) => void;
  updateConfig: (configId: string, updates: Partial<SimulationConfigItem>) => void;
  setScenario: (scenario: SimulationScenario | null) => void;
  reset: () => void;
}

export const useSimulationScenariosStore = create<SimulationScenariosState>((set, get) => ({
  scenarios: [],
  scenario: null,
  configs: [],
  loading: false,
  initializing: false,
  error: null,
  loaded: false,

  load: async () => {
    if (get().loading || get().loaded) return;
    set({ loading: true, error: null });
    try {
      const scenarios = await fetchScenarios();
      set({ scenarios, loading: false, loaded: true, initializing: false });
      if (scenarios.length > 0) {
        set({ scenario: scenarios[0] });
      }
    } catch (err: any) {
      set({ loading: false, initializing: false, error: err?.message || 'Erreur de chargement' });
    }
  },

  init: async () => {
    if (get().loaded) return;
    set({ initializing: true });
    await get().load();
  },

  add: async (scenario) => {
    try {
      const created = await createScenario(scenario);
      set({ scenarios: [...get().scenarios, created] });
    } catch (err: any) {
      set({ error: err?.message || 'Erreur de création' });
      throw err;
    }
  },

  update: async (id, updates) => {
    try {
      const updated = await updateScenario(id, updates);
      set({ scenarios: get().scenarios.map((s) => (s.id === id ? updated : s)) });
      if (get().scenario?.id === id) {
        set({ scenario: updated });
      }
    } catch (err: any) {
      set({ error: err?.message || 'Erreur de mise à jour' });
      throw err;
    }
  },

  remove: async (id) => {
    try {
      await deleteScenario(id);
      const remaining = get().scenarios.filter((s) => s.id !== id);
      set({
        scenarios: remaining,
        scenario: get().scenario?.id === id ? null : get().scenario,
      });
    } catch (err: any) {
      set({ error: err?.message || 'Erreur de suppression' });
      throw err;
    }
  },

  addConfig: (routeId, vehicleCount, avgSpeed) => {
    set((state) => ({
      configs: [
        ...state.configs.filter((cfg) => cfg.routeId !== routeId),
        {
          id: `${routeId}-${Date.now()}`,
          routeId,
          vehicleCount,
          avgSpeed,
        },
      ],
    }));
  },

  removeConfig: (configId) => {
    set((state) => ({
      configs: state.configs.filter((cfg) => cfg.id !== configId),
    }));
  },

  updateConfig: (configId, updates) => {
    set((state) => ({
      configs: state.configs.map((cfg) => (cfg.id === configId ? { ...cfg, ...updates } : cfg)),
    }));
  },

  setScenario: (scenario) => {
    set({ scenario });
  },

  reset: () => {
    set({
      scenarios: [],
      scenario: null,
      configs: [],
      loading: false,
      initializing: false,
      error: null,
      loaded: false,
    });
  },
}));