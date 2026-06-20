import { create } from 'zustand';
import type { SimulationConfig, VehiclePosition, SpeedMode } from '../simulation/types';

interface SimulationStore {
  configs: SimulationConfig[];
  positions: VehiclePosition[];
  setConfigs: (configs: SimulationConfig[]) => void;
  addConfig: (config: SimulationConfig) => void;
  removeConfig: (roadId: string) => void;
  updateConfig: (roadId: string, partial: Partial<SimulationConfig>) => void;
  setRunning: (roadId: string, running: boolean) => void;
  setPositions: (positions: VehiclePosition[]) => void;
  reset: () => void;
}

export const useSimulationStore = create<SimulationStore>((set) => ({
  configs: [],
  positions: [],

  setConfigs: (configs) => set({ configs }),

  addConfig: (config) =>
    set((state) => ({
      configs: [...state.configs.filter((c) => c.roadId !== config.roadId), config],
    })),

  removeConfig: (roadId) =>
    set((state) => ({
      configs: state.configs.filter((c) => c.roadId !== roadId),
    })),

  updateConfig: (roadId, partial) =>
    set((state) => ({
      configs: state.configs.map((c) => (c.roadId === roadId ? { ...c, ...partial } : c)),
    })),

  setRunning: (roadId, running) =>
    set((state) => ({
      configs: state.configs.map((c) => (c.roadId === roadId ? { ...c, running } : c)),
    })),

  setPositions: (positions) => set({ positions }),

  reset: () => set({ configs: [], positions: [] }),
}));
