/**
 * IncidentAI integration constants used by the ERP frontend.
 * Overridable so the demo can run either app on a non-default host/port.
 */
export const INCIDENTAI_APP_URL =
  process.env.NEXT_PUBLIC_INCIDENTAI_URL || 'http://localhost:3000';

export const INCIDENTAI_INGEST_URL =
  process.env.NEXT_PUBLIC_INCIDENTAI_INGEST_URL || 'http://localhost:4000/api/incidents/ingest';

/**
 * Link into the IncidentAI console for a specific incident.
 *
 * IncidentAI (src/App.jsx) is a single-page app that has no client-side router
 * and does not read any URL parameter — it auto-selects the newest ticket
 * (`tickets[0]`, its queue is ordered `created_at DESC`). An auto-escalated ERP
 * failure IS the newest ticket at the moment the operator clicks through, so the
 * console opens on exactly that incident.
 *
 * We still put the incident id AND ticket number on the query string:
 *  - the URL is deterministic and self-documenting, and
 *  - it is forward-compatible: the day IncidentAI adds `?incident=` handling the
 *    link starts deep-selecting with no change here.
 * We never link to a bare homepage when we hold an incident id.
 */
export function incidentUrl(incidentId?: string | null, ticketNumber?: string | null): string {
  const base = INCIDENTAI_APP_URL.replace(/\/+$/, '');
  if (!incidentId && !ticketNumber) return `${base}/`;
  const qs = new URLSearchParams();
  if (incidentId) qs.set('incident', incidentId);
  if (ticketNumber) qs.set('ticket', ticketNumber);
  return `${base}/?${qs.toString()}`;
}

/** The four ERP-side incident states (mirrors backend/pkg/incident). */
export type ErpIncidentStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'ROLLED_BACK' | string;

interface StatusPresentation {
  label: string;
  dot: string;
  text: string;
  bg: string;
  border: string;
}

const STATUS_PRESENTATION: Record<string, StatusPresentation> = {
  OPEN:        { label: 'OPEN',        dot: '#dc2626', text: '#991b1b', bg: '#fef2f2', border: '#fecaca' },
  IN_PROGRESS: { label: 'IN PROGRESS', dot: '#d97706', text: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  RESOLVED:    { label: 'RESOLVED',    dot: '#16a34a', text: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
  ROLLED_BACK: { label: 'ROLLED BACK', dot: '#7c3aed', text: '#5b21b6', bg: '#f5f3ff', border: '#ddd6fe' },
};

const STATUS_FALLBACK: StatusPresentation = {
  label: 'PENDING', dot: '#94a3b8', text: '#475569', bg: '#f8fafc', border: '#e2e8f0',
};

/** Centralized display styling for an ERP incident status. */
export function incidentStatusPresentation(status?: string | null): StatusPresentation {
  if (!status) return STATUS_FALLBACK;
  return STATUS_PRESENTATION[status.toUpperCase().replace(/\s+/g, '_')] || STATUS_FALLBACK;
}
