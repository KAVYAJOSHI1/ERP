import { create } from 'zustand';

/**
 * Operation status feed.
 *
 * ERP mutations (stock adjust, production run, purchase order, …) push the
 * *backend* outcome here — success or a real backend failure — instead of using
 * window.alert(). When the backend automatically escalates a failure to
 * IncidentAI, the incident id / number / correlation id ride along so the UI can
 * show "IncidentAI Incident Created — <number>" and link back to it.
 */

export interface IncidentInfo {
  id?: string;
  number?: string;
  status?: string; // OPEN | IN_PROGRESS | RESOLVED | ROLLED_BACK
  correlation_id?: string;
  transaction_id?: string;
  route?: string;
  escalated?: boolean;
}

export interface OpStatus {
  id: string;
  kind: 'error' | 'success';
  title: string;
  detail?: string;
  correlationId?: string;
  transactionId?: string;
  incident?: IncidentInfo;
  ts: number;
}

interface OpStatusState {
  items: OpStatus[];
  lastCorrelationId: string | null;
  push: (s: Omit<OpStatus, 'id' | 'ts'>) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

const genId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useOpStatusStore = create<OpStatusState>((set) => ({
  items: [],
  lastCorrelationId: null,

  push: (s) =>
    set((state) => {
      const entry: OpStatus = { ...s, id: genId(), ts: Date.now() };
      const corr = s.correlationId || s.incident?.correlation_id || state.lastCorrelationId;
      return {
        items: [entry, ...state.items].slice(0, 4),
        lastCorrelationId: corr ?? null,
      };
    }),

  dismiss: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

  clear: () => set({ items: [] }),
}));
