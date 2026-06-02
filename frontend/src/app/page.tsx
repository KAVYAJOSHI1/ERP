'use client';

import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Activity, 
  Warehouse, 
  Cpu, 
  Package, 
  TrendingUp, 
  AlertCircle 
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';

export default function DashboardPage() {
  const { user } = useAuthStore();

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div>
            <h1 className="text-2xl font-black tracking-wider text-slate-100 uppercase">
              Operations Control Panel
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
              Real-time industrial telemetry & coordination
            </p>
          </div>
          <div className="flex items-center space-x-3 rounded-lg border border-slate-800 bg-[#0f172a]/30 px-4 py-2.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
              SYSTEM LIVE
            </span>
          </div>
        </div>

        {/* Telemetry Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1 */}
          <div className="glass-panel rounded-xl p-5 border border-slate-800 hover:border-cyan-500/30 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Stock SKU Catalog</span>
              <div className="p-2 rounded-lg bg-slate-800/40 text-slate-400 group-hover:text-cyan-400 group-hover:bg-cyan-950/20 transition-colors">
                <Package className="h-5 w-5" />
              </div>
            </div>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-2xl font-extrabold text-slate-200">1,248</span>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1">
                  <TrendingUp className="h-3 w-3 mr-0.5" /> +12% MoM
                </span>
              </div>
          </div>

          {/* Card 2 */}
          <div className="glass-panel rounded-xl p-5 border border-slate-800 hover:border-cyan-500/30 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Storage Centers</span>
              <div className="p-2 rounded-lg bg-slate-800/40 text-slate-400 group-hover:text-cyan-400 group-hover:bg-cyan-950/20 transition-colors">
                <Warehouse className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-slate-200">4</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Detroit, Chicago...
              </span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="glass-panel rounded-xl p-5 border border-slate-800 hover:border-cyan-500/30 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gateway Telemetry</span>
              <div className="p-2 rounded-lg bg-slate-800/40 text-slate-400 group-hover:text-cyan-400 group-hover:bg-cyan-950/20 transition-colors">
                <Cpu className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-slate-200">2.4 ms</span>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                99.99% UPTime
              </span>
            </div>
          </div>

          {/* Card 4 */}
          <div className="glass-panel rounded-xl p-5 border border-slate-800 hover:border-cyan-500/30 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Procurement Pipeline</span>
              <div className="p-2 rounded-lg bg-slate-800/40 text-slate-400 group-hover:text-cyan-400 group-hover:bg-cyan-950/20 transition-colors">
                <Activity className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-slate-200">18 POs</span>
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider flex items-center space-x-1">
                <AlertCircle className="h-3 w-3 mr-0.5" /> 3 Pending
              </span>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main system feed */}
          <div className="glass-panel rounded-xl border border-slate-800 p-6 lg:col-span-2 space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800/60 pb-3">
              Production Line Status
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-slate-950/50 p-4 border border-slate-800/60">
                <div className="flex items-center space-x-3">
                  <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                  <div>
                    <p className="text-sm font-bold text-slate-300">Detroit Work Center A</p>
                    <p className="text-xs text-slate-500">Currently manufacturing: SKU-ROBOTIC-ARM</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-400 uppercase bg-emerald-950/20 border border-emerald-900/30 px-2.5 py-1 rounded">ACTIVE</span>
              </div>
              
              <div className="flex items-center justify-between rounded-lg bg-slate-950/50 p-4 border border-slate-800/60">
                <div className="flex items-center space-x-3">
                  <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                  <div>
                    <p className="text-sm font-bold text-slate-300">Detroit Work Center B</p>
                    <p className="text-xs text-slate-500">Scheduled maintenance routine: CNC Calibration</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-400 uppercase bg-amber-950/20 border border-amber-900/30 px-2.5 py-1 rounded">MAINTENANCE</span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-950/50 p-4 border border-slate-800/60">
                <div className="flex items-center space-x-3">
                  <div className="h-2 w-2 rounded-full bg-slate-500"></div>
                  <div>
                    <p className="text-sm font-bold text-slate-300">Chicago Warehouse Sorting</p>
                    <p className="text-xs text-slate-500">Awaiting materials ingestion from Apex Supply</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase bg-slate-900/40 border border-slate-800 px-2.5 py-1 rounded">AWAITING MATERIALS</span>
              </div>
            </div>
          </div>

          {/* System details */}
          <div className="glass-panel rounded-xl border border-slate-800 p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800/60 pb-3">
              Operator Context
            </h2>
            <div className="space-y-4.5 text-sm">
              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Identity Details</span>
                <span className="block mt-1 font-bold text-slate-300">{user?.email}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Security Access Level</span>
                <span className="inline-block mt-1 font-bold text-cyan-400 uppercase border border-cyan-800/30 bg-cyan-950/20 px-2.5 py-0.5 rounded text-xs tracking-wider">
                  {user?.role.replace('_', ' ')}
                </span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Session Key (JTI)</span>
                <span className="block mt-1 font-mono text-xs text-slate-400 break-all bg-slate-950/50 p-2.5 border border-slate-900 rounded select-all">
                  SHA256::e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
