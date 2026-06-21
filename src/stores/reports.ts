import { create } from 'zustand';
import { fetchReports, type Report } from '../services/reportService';

interface ReportsState {
  reports: Report[];
  loading: boolean;
  error: string | null;
  loaded: boolean;

  load: () => Promise<void>;
  reset: () => void;
}

export const useReportsStore = create<ReportsState>((set, get) => ({
  reports: [],
  loading: false,
  error: null,
  loaded: false,

  load: async () => {
    if (get().loading) return;
    if (get().loaded) return;

    set({ loading: true, error: null });
    try {
      const reports = await fetchReports();
      set({ reports, loading: false, loaded: true });
    } catch (err: any) {
      console.error('Erreur chargement signalements:', err);
      set({
        loading: false,
        error: err?.message || 'Erreur lors du chargement des signalements',
      });
    }
  },

  reset: () => {
    set({ reports: [], loading: false, error: null, loaded: false });
  },
}));
