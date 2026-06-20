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
      <div className="space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-[#1e293b] flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-[#1e3a5f]" />
              Predictive Intelligence
            </h1>
            <p className="text-[12px] text-[#64748b] mt-0.5">
              AI-driven demand forecasting and autonomous supply chain heuristics
            </p>
          </div>
        </div>

        {/* System Status Banner */}
        <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-sm p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-sm border border-[#bfdbfe] text-[#1e3a5f]">
              <BrainCircuit className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#1e3a5f] uppercase tracking-wider">Forecast Engine Online</h3>
              <p className="text-[12px] text-[#475569] mt-0.5">Aggregating historical depletion rates across {forecasts.length} catalog items.</p>
            </div>
          </div>
          {alerts.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-[#fef2f2] border border-[#fecaca] rounded-sm text-[#b91c1c] text-xs font-bold uppercase tracking-wider">
              <AlertTriangle className="h-4 w-4" />
              <span>{alerts.length} Critical Actions</span>
            </div>
          )}
        </div>

        {/* Analytics Grid */}
        <div className="bg-white border border-[#e2e8f0] rounded-sm p-5">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#f1f5f9]">
            <TrendingUp className="h-4 w-4 text-[#1e3a5f]" />
            <h2 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">Moving Average Demand Curves</h2>
          </div>
          
          {isLoading ? (
            <div className="py-8 text-center text-[12px] text-[#94a3b8]">Running neural heuristics...</div>
          ) : forecasts.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-[#94a3b8]">Insufficient data for prediction.</div>
          ) : (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Product Metric</th>
                    <th className="text-right">Current Stock</th>
                    <th className="text-right">Burn Rate (Units/Day)</th>
                    <th className="text-right">Optimal Reorder Qty</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {forecasts.map(f => (
                    <tr key={f.product_id}>
                      <td className="font-semibold text-[#1e293b]">
                        {f.product_name}
                        <div className="text-[10px] text-[#64748b] font-mono mt-0.5">ID: {f.product_id.substring(0,8).toUpperCase()}</div>
                      </td>
                      <td className="text-right font-mono font-bold">
                        <span className={f.current_stock <= f.reorder_point ? 'text-[#b91c1c]' : 'text-[#334155]'}>
                          {f.current_stock.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-[#94a3b8] block font-normal">Min: {f.reorder_point}</span>
                      </td>
                      <td className="text-right font-mono text-[#1e3a5f] font-bold">
                        {f.calculated_demand_rate.toFixed(2)}
                      </td>
                      <td className="text-right font-mono text-[#1e3a5f] font-bold">
                        +{f.recommended_reorder_qty.toFixed(0)}
                      </td>
                      <td className="text-center">
                        {f.action_required ? (
                          <span className="badge badge-danger">
                            <Zap className="h-3 w-3 mr-1" />
                            Auto-Procure Triggered
                          </span>
                        ) : (
                          <span className="badge badge-success">
                            Stable
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
