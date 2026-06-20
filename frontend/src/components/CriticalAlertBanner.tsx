'use client';

import React from 'react';
import { AlertTriangle, X, Thermometer } from 'lucide-react';
import { useAlertStore, CriticalAlert } from '@/lib/alertStore';

export default function CriticalAlertBanner() {
  const { alerts, dismissAlert, clearAll } = useAlertStore();

  if (alerts.length === 0) return null;

  const latest: CriticalAlert = alerts[0];
  const extra = alerts.length - 1;

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="alert-banner-critical flex items-center justify-between gap-4 px-4 py-2.5">

        {/* Icon + message */}
        <div className="flex items-center gap-3 min-w-0">
          <AlertTriangle className="h-4 w-4 text-[#dc2626] flex-shrink-0" />
          <div className="flex items-center gap-2 min-w-0 text-[13px]">
            <span className="font-bold text-[#991b1b] flex-shrink-0">
              THERMAL SPIKE
            </span>
            <span className="text-[#475569] font-medium truncate">
              {latest.pallet_id}
            </span>
            <span className="flex items-center gap-1 flex-shrink-0 text-[#b91c1c] font-bold font-mono">
              <Thermometer className="h-3.5 w-3.5" />
              {latest.temperature_c.toFixed(1)}°C
            </span>
            <span className="text-[#64748b] text-xs truncate hidden sm:inline">
              — {latest.location}
            </span>
          </div>
        </div>

        {/* Right side: count badge + dismiss */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {extra > 0 && (
            <button
              onClick={clearAll}
              className="badge badge-danger cursor-pointer hover:bg-red-100"
            >
              +{extra} more
            </button>
          )}
          <button
            onClick={() => dismissAlert(latest.id)}
            className="p-1 rounded-sm text-[#64748b] hover:text-[#1e293b] hover:bg-red-100 transition-colors"
            aria-label="Dismiss alert"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
