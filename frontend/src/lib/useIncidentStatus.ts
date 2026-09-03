'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';

export interface IncidentLinkRecord {
  incident_id?: string;
  incident_number?: string;
  incident_status?: string; // OPEN | IN_PROGRESS | RESOLVED | ROLLED_BACK
  incident_ai_status?: string;
  correlation_id?: string;
  transaction_id?: string;
  error_message?: string;
  route?: string;
}

/**
 * Polls the ERP backend for the current, DB-backed status of an incident link.
 * The source of truth is always `GET /production/incident-links` — never React
 * state. Used by the failure banner so a resolution in IncidentAI (pushed back
 * through the ERP callback) becomes visible without a page refresh.
 *
 * Graceful: transient errors / 404 keep the last known value.
 */
export function useIncidentStatus(
  key: { correlationId?: string | null; incidentId?: string | null } | null,
  intervalMs = 5000,
): IncidentLinkRecord | null {
  const [record, setRecord] = useState<IncidentLinkRecord | null>(null);
  const stopped = useRef(false);

  const correlationId = key?.correlationId || undefined;
  const incidentId = key?.incidentId || undefined;

  useEffect(() => {
    if (!correlationId && !incidentId) return;
    stopped.current = false;

    const qs = new URLSearchParams();
    if (correlationId) qs.set('correlation_id', correlationId);
    else if (incidentId) qs.set('incident_id', incidentId);

    const tick = async () => {
      try {
        const data = await apiFetch(`/production/incident-links?${qs.toString()}`);
        if (!stopped.current && data) setRecord(data as IncidentLinkRecord);
      } catch {
        /* keep last known value */
      }
    };

    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      stopped.current = true;
      clearInterval(id);
    };
  }, [correlationId, incidentId, intervalMs]);

  return record;
}
