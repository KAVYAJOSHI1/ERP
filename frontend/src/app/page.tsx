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
      <div className="space-y-10 relative z-10">
        
        {/* Glow effect for background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-sky-500/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>

        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between space-y-6 md:space-y-0">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
              Operations Control
            </h1>
            <p className="text-sm font-medium text-slate-400 mt-2 tracking-wide">
              Real-time industrial telemetry & coordination matrix
            </p>
          </div>
          <div className="flex items-center space-x-3 rounded-full border border-emerald-500/30 bg-emerald-950/20 px-5 py-2.5 shadow-[0_0_15px_rgba(16,185,129,0.15)] live-indicator">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
            </span>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
              SYSTEM LIVE
            </span>
          </div>
        </div>

        {/* Telemetry Cards Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          
          {/* Card 1 */}
          <div className="glass-panel rounded-2xl p-6 group cursor-default relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-sky-300 transition-colors">Stock SKU Catalog</span>
              <div className="p-2.5 rounded-xl bg-slate-800/50 text-slate-300 group-hover:text-white group-hover:bg-sky-500/20 border border-transparent group-hover:border-sky-500/30 transition-all shadow-lg group-hover:shadow-sky-500/20">
                <Package className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-6 flex items-baseline justify-between relative z-10">
              <span className="text-3xl font-black text-white tracking-tight drop-shadow-sm">1,248</span>
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1 bg-emerald-950/30 px-2 py-1 rounded-md border border-emerald-900/50">
                <TrendingUp className="h-3 w-3 mr-0.5" /> +12% MoM
              </span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="glass-panel rounded-2xl p-6 group cursor-default relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-violet-300 transition-colors">Storage Centers</span>
              <div className="p-2.5 rounded-xl bg-slate-800/50 text-slate-300 group-hover:text-white group-hover:bg-violet-500/20 border border-transparent group-hover:border-violet-500/30 transition-all shadow-lg group-hover:shadow-violet-500/20">
                <Warehouse className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-6 flex items-baseline justify-between relative z-10">
              <span className="text-3xl font-black text-white tracking-tight drop-shadow-sm">4</span>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-800/50 px-2 py-1 rounded-md border border-slate-700/50">
                Detroit, Chicago...
              </span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="glass-panel rounded-2xl p-6 group cursor-default relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-emerald-300 transition-colors">Gateway Telemetry</span>
              <div className="p-2.5 rounded-xl bg-slate-800/50 text-slate-300 group-hover:text-white group-hover:bg-emerald-500/20 border border-transparent group-hover:border-emerald-500/30 transition-all shadow-lg group-hover:shadow-emerald-500/20">
                <Cpu className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-6 flex items-baseline justify-between relative z-10">
              <span className="text-3xl font-black text-white tracking-tight drop-shadow-sm">2.4 ms</span>
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-950/30 px-2 py-1 rounded-md border border-emerald-900/50">
                99.99% UPTime
              </span>
            </div>
          </div>

          {/* Card 4 */}
          <div className="glass-panel rounded-2xl p-6 group cursor-default relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-amber-300 transition-colors">Procurement Pipeline</span>
              <div className="p-2.5 rounded-xl bg-slate-800/50 text-slate-300 group-hover:text-white group-hover:bg-amber-500/20 border border-transparent group-hover:border-amber-500/30 transition-all shadow-lg group-hover:shadow-amber-500/20">
                <Activity className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-6 flex items-baseline justify-between relative z-10">
              <span className="text-3xl font-black text-white tracking-tight drop-shadow-sm">18 POs</span>
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1 bg-amber-950/30 px-2 py-1 rounded-md border border-amber-900/50">
                <AlertCircle className="h-3 w-3 mr-0.5" /> 3 Pending
              </span>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          
          {/* Main system feed */}
          <div className="glass-panel rounded-2xl p-7 lg:col-span-2 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-bl from-violet-500/5 to-transparent rounded-full blur-[80px] -z-10"></div>
            <h2 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400 uppercase tracking-widest border-b border-slate-800/80 pb-4 mb-6">
              Production Line Status
            </h2>
            <div className="space-y-4 flex-grow">
              
              <div className="group flex items-center justify-between rounded-xl bg-slate-900/40 hover:bg-slate-800/60 p-5 border border-slate-800/60 hover:border-emerald-500/30 transition-all">
                <div className="flex items-center space-x-4">
                  <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">Detroit Work Center A</p>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">Currently manufacturing: <span className="text-slate-400">SKU-ROBOTIC-ARM</span></p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/40 border border-emerald-900/50 px-3 py-1.5 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.1)]">ACTIVE</span>
              </div>
              
              <div className="group flex items-center justify-between rounded-xl bg-slate-900/40 hover:bg-slate-800/60 p-5 border border-slate-800/60 hover:border-amber-500/30 transition-all">
                <div className="flex items-center space-x-4">
                  <div className="relative flex h-3 w-3">
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 shadow-[0_0_8px_#f59e0b]"></span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">Detroit Work Center B</p>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">Scheduled maintenance routine: <span className="text-slate-400">CNC Calibration</span></p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest bg-amber-950/40 border border-amber-900/50 px-3 py-1.5 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.1)]">MAINTENANCE</span>
              </div>

              <div className="group flex items-center justify-between rounded-xl bg-slate-900/40 hover:bg-slate-800/60 p-5 border border-slate-800/60 hover:border-slate-500/50 transition-all">
                <div className="flex items-center space-x-4">
                  <div className="h-3 w-3 rounded-full bg-slate-600 shadow-[0_0_8px_rgba(71,85,105,0.6)]"></div>
                  <div>
                    <p className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">Chicago Warehouse Sorting</p>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">Awaiting materials ingestion from <span className="text-slate-400">Apex Supply</span></p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-800/50 border border-slate-700/50 px-3 py-1.5 rounded-full">AWAITING MATERIALS</span>
              </div>
            </div>
          </div>

          {/* System details */}
          <div className="glass-panel-accent rounded-2xl p-7 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-gradient-to-br from-sky-500/10 to-transparent rounded-full blur-[60px] -z-10"></div>
            <h2 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400 uppercase tracking-widest border-b border-slate-800/80 pb-4 mb-6">
              Operator Context
            </h2>
            <div className="space-y-6">
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/50">
                <span className="flex items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mr-2"></span> Identity
                </span>
                <span className="block text-sm font-semibold text-slate-200">{user?.email || 'N/A'}</span>
              </div>
              
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/50">
                <span className="flex items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mr-2"></span> Access Level
                </span>
                <span className="inline-flex font-bold text-sky-400 uppercase border border-sky-800/40 bg-sky-950/30 px-3 py-1 rounded-full text-[10px] tracking-widest shadow-[0_0_10px_rgba(14,165,233,0.15)]">
                  {user?.role ? user.role.replace('_', ' ') : 'UNAUTHORIZED'}
                </span>
              </div>
              
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/50">
                <span className="flex items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mr-2"></span> Session Fingerprint
                </span>
                <span className="block font-mono text-[10px] text-slate-400 break-all bg-slate-950 p-3 border border-slate-800 rounded-lg select-all shadow-inner">
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
