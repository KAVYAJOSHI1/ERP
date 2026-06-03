'use client';

import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { 
  BrainCircuit, 
  TrendingUp, 
  AlertTriangle,
  Zap
} from 'lucide-react';

interface ForecastResult {
  product_id: string;
  product_name: string;
  current_stock: number;
  reorder_point: number;
  calculated_demand_rate: number;
  recommended_reorder_qty: number;
  action_required: boolean;
}

export default function IntelligenceDashboard() {
  const { data: forecasts = [], isLoading } = useQuery<ForecastResult[]>({
    queryKey: ['forecasts'],
    queryFn: () => apiFetch('/intelligence/forecast'),
  });

  const alerts = forecasts.filter(f => f.action_required);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl font-black tracking-wider text-slate-100 uppercase">
              Predictive Intelligence
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
              AI-driven demand forecasting and autonomous supply chain heuristics
            </p>
          </div>
        </div>

        {/* System Status Banner */}
        <div className="glass-panel border border-cyan-900/40 rounded-xl p-5 flex items-center justify-between bg-cyan-950/10">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-cyan-950/50 rounded-lg border border-cyan-500/20">
              <BrainCircuit className="h-6 w-6 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">Forecast Engine Online</h3>
              <p className="text-xs text-slate-400 mt-1">Aggregating historical depletion rates across {forecasts.length} catalog items.</p>
            </div>
          </div>
          {alerts.length > 0 && (
            <div className="flex items-center space-x-2 px-4 py-2 bg-rose-950/30 border border-rose-900/40 rounded-lg text-rose-400 text-xs font-bold uppercase tracking-wider">
              <AlertTriangle className="h-4 w-4" />
              <span>{alerts.length} Critical Actions Required</span>
            </div>
          )}
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 gap-6">
          <div className="glass-panel border border-slate-800 rounded-xl p-6">
            <div className="flex items-center space-x-2 pb-4 border-b border-slate-800/80">
              <TrendingUp className="h-5 w-5 text-indigo-400" />
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Moving Average Demand Curves</h2>
            </div>
            
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <th className="pb-3 pl-2">Product Metric</th>
                    <th className="pb-3 text-right">Current Stock</th>
                    <th className="pb-3 text-right">Burn Rate (Units/Day)</th>
                    <th className="pb-3 text-right">Optimal Reorder Qty</th>
                    <th className="pb-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-sm text-slate-300">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Running neural heuristics...</td>
                    </tr>
                  ) : forecasts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-xs font-bold text-slate-500 uppercase">Insufficient data for prediction.</td>
                    </tr>
                  ) : (
                    forecasts.map(f => (
                      <tr key={f.product_id} className="hover:bg-slate-900/20 transition-colors">
                        <td className="py-4 pl-2 font-semibold text-slate-200">
                          {f.product_name}
                          <div className="text-[10px] text-slate-500 font-mono mt-1">ID: {f.product_id.substring(0,8)}</div>
                        </td>
                        <td className="py-4 text-right font-mono font-bold">
                          <span className={f.current_stock <= f.reorder_point ? 'text-rose-400' : 'text-slate-300'}>
                            {f.current_stock.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-500 block">Min: {f.reorder_point}</span>
                        </td>
                        <td className="py-4 text-right font-mono text-indigo-400 font-bold">
                          {f.calculated_demand_rate.toFixed(2)}
                        </td>
                        <td className="py-4 text-right font-mono text-cyan-400 font-bold">
                          +{f.recommended_reorder_qty.toFixed(0)}
                        </td>
                        <td className="py-4 text-center">
                          {f.action_required ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-950/30 border border-rose-900/40 text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                              <Zap className="h-3 w-3" />
                              <span>Auto-Procure Triggered</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-950/20 border border-emerald-900/30 text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                              <span>Stable</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
