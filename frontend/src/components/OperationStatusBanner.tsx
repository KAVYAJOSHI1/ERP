'use client';

import React from 'react';
import { AlertOctagon, CheckCircle2, X, ExternalLink, ShieldAlert, Loader2 } from 'lucide-react';
import { useOpStatusStore, IncidentInfo } from '@/lib/opStatusStore';
import { incidentUrl, incidentStatusPresentation } from '@/lib/incidentai';
import { useIncidentStatus } from '@/lib/useIncidentStatus';

function IncidentRow({ incident }: { incident: IncidentInfo }) {
  // Live, DB-backed status — a resolution/rollback in IncidentAI (pushed back
  // through the ERP callback) shows here without a page refresh.
  const live = useIncidentStatus(
    { correlationId: incident.correlation_id, incidentId: incident.id },
    5000,
  );

  const escalated = incident.escalated ?? Boolean(incident.id);
  const incidentId = live?.incident_id || incident.id;
  const incidentNumber = live?.incident_number || incident.number || incidentId;
  const status = (live?.incident_status || incident.status || 'OPEN').toUpperCase();
  const pres = incidentStatusPresentation(status);

  return (
    <div className="mt-2 rounded-xs border border-[#e2e8f0] bg-white/70 px-2.5 py-2 text-[11px]">
      {escalated ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5 font-semibold text-[#1e293b]">
            <ShieldAlert className="h-3.5 w-3.5 text-[#ef4444]" />
            IncidentAI Incident Created
          </span>
          <span className="font-mono font-bold text-[#1e3a5f]">{incidentNumber}</span>
          <span
            className="inline-flex items-center gap-1 rounded-xs border px-1.5 py-0.5 font-bold"
            style={{ color: pres.text, background: pres.bg, borderColor: pres.border }}
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: pres.dot }} />
            {pres.label}
          </span>
          <a
            href={incidentUrl(incidentId, incident.number)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-[#1e3a5f] hover:underline"
          >
            Open in IncidentAI <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : (
        <span className="flex items-center gap-1.5 text-[#64748b]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          IncidentAI escalation pending — the failure is persisted and will retry.
        </span>
      )}
      {incident.correlation_id && (
        <div className="mt-1 font-mono text-[10px] text-[#64748b]">
          Correlation ID: <span className="text-[#334155]">{incident.correlation_id}</span>
          {incident.transaction_id && (
            <>
              {'  ·  '}Transaction: <span className="text-[#334155]">{incident.transaction_id}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function OperationStatusBanner() {
  const { items, dismiss } = useOpStatusStore();
  if (items.length === 0) return null;

  return (
    <div className="mb-5 space-y-2">
      {items.map((item) => {
        const isError = item.kind === 'error';
        return (
          <div
            key={item.id}
            className={`rounded-sm border p-3.5 ${
              isError ? 'border-[#fecaca] bg-[#fef2f2]' : 'border-[#a7f3d0] bg-[#ecfdf5]'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                {isError ? (
                  <AlertOctagon className="h-4 w-4 flex-shrink-0 text-[#dc2626] mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-[#059669] mt-0.5" />
                )}
                <div className="min-w-0">
                  <p
                    className={`text-[11px] font-bold uppercase tracking-wider ${
                      isError ? 'text-[#991b1b]' : 'text-[#065f46]'
                    }`}
                  >
                    {isError ? 'Operation Failed' : 'Operation Completed'}
                  </p>
                  <p className="text-[13px] font-semibold text-[#1e293b] mt-0.5">{item.title}</p>
                  {item.detail && (
                    <p className="text-[12px] text-[#475569] mt-0.5 break-words">{item.detail}</p>
                  )}
                  {item.incident && <IncidentRow incident={item.incident} />}
                  {!item.incident && item.correlationId && (
                    <p className="mt-1 font-mono text-[10px] text-[#64748b]">
                      Correlation ID: <span className="text-[#334155]">{item.correlationId}</span>
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => dismiss(item.id)}
                className="flex-shrink-0 rounded-xs p-1 text-[#64748b] hover:bg-black/5 hover:text-[#1e293b]"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
