import { create } from 'zustand';
import {
  fetchScenarios,
  createScenario,
  updateScenario,
  deleteScenario,
  type SimulationScenario,
} from '../services/simulationScenarioService';

interface SimulationScenariosState {
  scenarios: SimulationScenario[];
  loading: boolean;
  error: string | null;
  loaded: boolean;

  load: () => Promise<void>;
  add: (scenario: Omit<SimulationScenario, 'id' | 'createdAt'>) => Promise<void>;
  update: (id: string, scenario: Partial<SimulationScenario>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reset: () => void;
}

export const useSimulationScenariosStore = create<SimulationScenariosState>((set, get) => ({
  scenarios: [],
  loading: false,
  error: null,
  loaded: false,

  load: async () => {
    if (get().loading || get().loaded) return;
    set({ loading: true, error: null });
    try {
      const scenarios = await fetchScenarios();
      set({ scenarios, loading: false, loaded: true });
    } catch (err: any) {
      set({ loading: false, error: err?.message || 'Erreur de chargement' });
    }
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
    } catch (err: any) {
      set({ error: err?.message || 'Erreur de mise à jour' });
      throw err;
    }
  },

  remove: async (id) => {
    try {
      await deleteScenario(id);
      set({ scenarios: get().scenarios.filter((s) => s.id !== id) });
    } catch (err: any) {
      set({ error: err?.message || 'Erreur de suppression' });
      throw err;
    }
  },

  reset: () => {
    set({ scenarios: [], loading: false, error: null, loaded: false });
  },
}));