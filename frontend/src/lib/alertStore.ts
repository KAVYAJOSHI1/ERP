import { create } from 'zustand';

export interface CriticalAlert {
  id: string;
  type: string;
  pallet_id: string;
  sensor_id: string;
  location: string;
  temperature_c: number;
  detected_at: string;
  receivedAt: number;
}

interface AlertState {
  alerts: CriticalAlert[];
  addAlert: (alert: Omit<CriticalAlert, 'id' | 'receivedAt'>) => void;
  dismissAlert: (id: string) => void;
  clearAll: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  alerts: [],

  addAlert: (alert) =>
    set((state) => ({
      alerts: [
        { ...alert, id: crypto.randomUUID(), receivedAt: Date.now() },
        ...state.alerts,
      ].slice(0, 50),
    })),

  dismissAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== id),
    })),

  clearAll: () => set({ alerts: [] }),
}));
