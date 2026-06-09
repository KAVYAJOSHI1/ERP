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
      <div className="flex items-center justify-between gap-4 bg-red-950/95 border-b-2 border-red-500 px-4 py-3 shadow-[0_0_30px_rgba(239,68,68,0.4)] backdrop-blur-sm">

        {/* Icon + message */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 border border-red-500/50">
            <AlertTriangle className="h-4 w-4 text-red-400 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-black text-red-400 uppercase tracking-widest flex-shrink-0">
              THERMAL SPIKE
            </span>
            <span className="text-slate-300 text-xs font-semibold truncate">
              {latest.pallet_id}
            </span>
            <span className="flex items-center gap-1 flex-shrink-0 text-red-300 font-bold text-sm">
              <Thermometer className="h-3.5 w-3.5" />
              {latest.temperature_c.toFixed(1)}°C
            </span>
            <span className="text-slate-400 text-xs truncate hidden sm:inline">
              — {latest.location}
            </span>
          </div>
        </div>

        {/* Right side: count badge + dismiss */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {extra > 0 && (
            <button
              onClick={clearAll}
              className="text-[10px] font-bold text-red-300 bg-red-900/50 border border-red-700/50 rounded-full px-2.5 py-0.5 hover:bg-red-800/60 transition-colors"
            >
              +{extra} more
            </button>
          )}
          <button
            onClick={() => dismissAlert(latest.id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-red-900/50 transition-colors"
            aria-label="Dismiss alert"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
