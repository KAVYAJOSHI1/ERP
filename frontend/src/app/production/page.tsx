'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { 
  Factory, 
  Cpu, 
  Layers, 
  Play, 
  Pause, 
  CheckCircle2, 
  AlertOctagon, 
  Gauge, 
  Wrench,
  Clock,
  TrendingUp,
  Plus
} from 'lucide-react';

interface WorkCenter {
  id: string;
  name: string;
  capacity: number;
  status: 'active' | 'maintenance' | 'idle';
}

interface BOMComponent {
  id: string;
  bom_id: string;
  raw_material_id: string;
  quantity_required: number;
}

interface BOM {
  id: string;
  product_id: string;
  name: string;
  version: string;
  components?: BOMComponent[];
}

interface ProductionRun {
  id: string;
  bom_id: string;
  work_center_id: string;
  quantity: number;
  status: 'planned' | 'in_progress' | 'completed' | 'failed';
  correlation_id: string;
  started_at?: string;
  completed_at?: string;
  bom?: BOM;
  work_center?: WorkCenter;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  unit: string;
}

export default function ProductionPage() {
  const queryClient = useQueryClient();
  const [showNewRunForm, setShowNewRunForm] = useState(false);

  // Form states
  const [selectedBOM, setSelectedBOM] = useState('');
  const [selectedWC, setSelectedWC] = useState('');
  const [runQty, setRunQty] = useState(100);

  // Periodic polling for status changes
  const [nowTime, setNowTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. Fetch Work Centers
  const { data: workCenters = [] } = useQuery<WorkCenter[]>({
    queryKey: ['workCenters'],
    queryFn: () => apiFetch('/production/wc'),
  });

  // 2. Fetch BOMs
  const { data: boms = [] } = useQuery<BOM[]>({
    queryKey: ['boms'],
    queryFn: () => apiFetch('/production/bom'),
    onSuccess: (data: BOM[]) => {
      if (data.length > 0 && !selectedBOM) {
        setSelectedBOM(data[0].id);
      }
    }
  });

  // 3. Fetch Production Runs (poll every 4s to track live worker transitions)
  const { data: productionRuns = [] } = useQuery<ProductionRun[]>({
    queryKey: ['productionRuns'],
    queryFn: () => apiFetch('/production/runs'),
    refetchInterval: 4000
  });

  // 4. Fetch Inventory Product catalog to map name/SKU strings from UUIDs
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => apiFetch('/inventory/products'),
  });

  // Default selection fallbacks
  useEffect(() => {
    if (boms.length > 0 && !selectedBOM) setSelectedBOM(boms[0].id);
  }, [boms, selectedBOM]);

  useEffect(() => {
    if (workCenters.length > 0 && !selectedWC) setSelectedWC(workCenters[0].id);
  }, [workCenters, selectedWC]);

  // Dispatch Order Mutation
  const dispatchMutation = useMutation({
    mutationFn: (newRun: any) => apiFetch('/production/runs', {
      method: 'POST',
      body: JSON.stringify(newRun)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionRuns'] });
      queryClient.invalidateQueries({ queryKey: ['workCenters'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setShowNewRunForm(false);
      setRunQty(100);
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to dispatch work order. Make sure there is enough inventory for the raw material components!');
    }
  });

  const handleStartRun = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBOM || !selectedWC) return;
    dispatchMutation.mutate({
      bom_id: selectedBOM,
      work_center_id: selectedWC,
      quantity: Number(runQty)
    });
  };

  const getProductDisplay = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    return prod ? `${prod.name} (${prod.sku})` : productId;
  };

  const getProductDisplayShort = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    return prod ? prod.sku : productId;
  };

  // Compute live progress percentage based on elapsed time (runs complete in 30 seconds on the backend)
  const getProgressInfo = (run: ProductionRun) => {
    if (run.status === 'completed') return { percent: 100, label: 'completed' };
    if (run.status === 'failed') return { percent: 0, label: 'failed' };
    if (!run.started_at) return { percent: 0, label: 'planned' };

    const startTime = new Date(run.started_at).getTime();
    const elapsedMs = nowTime - startTime;
    const totalDurationMs = 30000; // 30s match in Go
    const percent = Math.min(99, Math.max(0, Math.floor((elapsedMs / totalDurationMs) * 100)));

    return { percent, label: 'in_progress' };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'completed':
        return 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30';
      case 'in_progress':
        return 'text-cyan-400 bg-cyan-950/20 border-cyan-800/30';
      case 'maintenance':
      case 'failed':
        return 'text-rose-400 bg-rose-950/20 border-rose-900/30';
      case 'idle':
      default:
        return 'text-slate-400 bg-slate-900 border-slate-800';
    }
  };

  // Calculate high-level stats from live runs
  const activeJobs = productionRuns.filter(r => r.status === 'in_progress');
  const activeLoadPercent = workCenters.length > 0 
    ? Math.round((workCenters.filter(w => w.status === 'active').length / workCenters.length) * 100) 
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl font-black tracking-wider text-slate-100 uppercase">
              Shop Floor & Production Execution
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
              Monitor work center utilization, configure Bills of Materials (BOM), and track run cycles
            </p>
          </div>
          <div>
            <button 
              onClick={() => setShowNewRunForm(true)}
              className="flex items-center space-x-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 border border-cyan-500/20 px-4 py-2.5 text-xs font-bold text-slate-950 transition-all cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.2)]"
            >
              <Plus className="h-4 w-4" />
              <span>LAUNCH PRODUCTION RUN</span>
            </button>
          </div>
        </div>

        {/* Launch New Run Form */}
        {showNewRunForm && (
          <div className="glass-panel border border-slate-800 rounded-xl p-6">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800/80 pb-2">
              Dispatch Production Execution Order
            </h2>
            <form onSubmit={handleStartRun} className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Select Recipe (BOM)</label>
                <select 
                  value={selectedBOM} 
                  onChange={(e) => setSelectedBOM(e.target.value)} 
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200"
                >
                  {boms.length === 0 && <option value="">No recipes configured</option>}
                  {boms.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Target Work Center</label>
                <select 
                  value={selectedWC} 
                  onChange={(e) => setSelectedWC(e.target.value)} 
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200"
                >
                  {workCenters.length === 0 && <option value="">No work centers configured</option>}
                  {workCenters.map(wc => (
                    <option key={wc.id} value={wc.id}>{wc.name} ({wc.status.toUpperCase()})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Production Batch Size</label>
                <input 
                  type="number" 
                  min="1"
                  max="1000"
                  value={runQty} 
                  onChange={(e) => setRunQty(Number(e.target.value))} 
                  required 
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200" 
                />
              </div>
              <div className="md:col-span-3 flex justify-end space-x-3">
                <button 
                  type="button" 
                  onClick={() => setShowNewRunForm(false)}
                  className="px-4 py-2.5 rounded-lg border border-slate-800 hover:bg-slate-900 text-xs font-bold text-slate-400 cursor-pointer"
                >
                  CANCEL
                </button>
                <button 
                  type="submit" 
                  disabled={dispatchMutation.isPending}
                  className="px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-slate-950 cursor-pointer disabled:opacity-50"
                >
                  {dispatchMutation.isPending ? 'DISPATCHING...' : 'DISPATCH WORK ORDER'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="glass-panel border border-slate-800 rounded-xl p-5 flex items-center space-x-4">
            <div className="p-3.5 rounded-lg bg-cyan-950/40 border border-cyan-800/30 text-cyan-400">
              <Gauge className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Overall Capacity</p>
              <h3 className="text-xl font-black text-slate-200 mt-0.5">
                {workCenters.reduce((sum, w) => sum + w.capacity, 0)} units/hr
              </h3>
            </div>
          </div>
          <div className="glass-panel border border-slate-800 rounded-xl p-5 flex items-center space-x-4">
            <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-800/30 text-emerald-400">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Work Centers Active</p>
              <h3 className="text-xl font-black text-slate-200 mt-0.5">{activeLoadPercent}% Optimal</h3>
            </div>
          </div>
          <div className="glass-panel border border-slate-800 rounded-xl p-5 flex items-center space-x-4">
            <div className="p-3.5 rounded-lg bg-indigo-950/40 border border-indigo-800/30 text-indigo-400">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Yield Success Rate</p>
              <h3 className="text-xl font-black text-slate-200 mt-0.5">99.84%</h3>
            </div>
          </div>
          <div className="glass-panel border border-slate-800 rounded-xl p-5 flex items-center space-x-4">
            <div className="p-3.5 rounded-lg bg-purple-950/40 border border-purple-800/30 text-purple-400">
              <Wrench className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Jobs</p>
              <h3 className="text-xl font-black text-slate-200 mt-0.5">{activeJobs.length} Running</h3>
            </div>
          </div>
        </div>

        {/* Work Centers & Bills of Materials */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Work Centers */}
          <div className="glass-panel border border-slate-800 rounded-xl p-5 lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center space-x-2">
                <Cpu className="h-5 w-5 text-cyan-400" />
                <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Work Center Storage & Nodes</h2>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {workCenters.map(wc => {
                const wcJobs = activeJobs.filter(j => j.work_center_id === wc.id);
                const isBusy = wcJobs.length > 0;
                return (
                  <div 
                    key={wc.id} 
                    className="rounded-lg bg-slate-950/40 border border-slate-800/60 p-4 space-y-3 relative group overflow-hidden"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-black text-slate-200">
                        {wc.name}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusBadge(isBusy ? 'in_progress' : wc.status)}`}>
                        {isBusy ? 'RUNNING' : wc.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 space-y-2">
                      <div className="flex justify-between">
                        <span>Assigned Max Capacity:</span>
                        <span className="font-mono text-slate-300 font-bold">{wc.capacity} units</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>Active Work Load:</span>
                          <span className="font-mono text-cyan-400 font-bold">{isBusy ? '90%' : '0%'}</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-cyan-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: isBusy ? '90%' : '0%' }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bills of Materials */}
          <div className="glass-panel border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-800/80">
              <Layers className="h-5 w-5 text-cyan-400" />
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Bills of Materials (BOM)</h2>
            </div>
            <div className="max-h-[380px] overflow-y-auto pr-1 space-y-4">
              {boms.map(bom => (
                <div key={bom.id} className="rounded-lg bg-slate-950/30 border border-slate-850 p-4 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black text-slate-200 uppercase">{bom.name}</h3>
                    <span className="text-[9px] font-bold text-cyan-400 bg-cyan-950/30 border border-cyan-900/30 px-1.5 py-0.5 rounded font-mono">v{bom.version}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Yield Output Product:</p>
                  <p className="text-xs text-cyan-500/80 font-mono mt-0.5">{getProductDisplay(bom.product_id)}</p>
                  {bom.components && bom.components.length > 0 && (
                    <div className="pt-2 border-t border-slate-900/80 space-y-1.5">
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Required Components</p>
                      {bom.components.map((comp, idx) => (
                        <div key={idx} className="flex justify-between text-xs font-mono">
                          <span className="text-slate-400">• {getProductDisplayShort(comp.raw_material_id)}</span>
                          <span className="text-slate-300 font-bold">{comp.quantity_required} units</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live Production Monitor */}
        <div className="glass-panel border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-800/80">
            <Factory className="h-5 w-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Live Job Tracking & Execution Logs</h2>
          </div>
          {productionRuns.length === 0 ? (
            <div className="py-20 text-center text-xs text-slate-500">No production runs dispatched yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3">Job ID</th>
                    <th className="pb-3">Product Recipe / BOM</th>
                    <th className="pb-3">Work Center</th>
                    <th className="pb-3 text-right">Job Batch</th>
                    <th className="pb-3">Progress / State</th>
                    <th className="pb-3">Dispatched At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm text-slate-300">
                  {productionRuns.map(run => {
                    const info = getProgressInfo(run);
                    return (
                      <tr key={run.id} className="hover:bg-slate-900/10 transition-colors">
                        <td className="py-4 font-mono font-semibold text-slate-400 text-xs">{run.id}</td>
                        <td className="py-4 font-bold text-slate-200">{run.bom ? run.bom.name : 'Unknown Recipe'}</td>
                        <td className="py-4 text-slate-400">{run.work_center ? run.work_center.name : 'Unknown WC'}</td>
                        <td className="py-4 text-right font-mono font-bold">{run.quantity}</td>
                        <td className="py-4 space-y-1.5 w-60">
                          <div className="flex justify-between items-center text-xs">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusBadge(info.label)}`}>
                              {info.label.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className="font-mono font-bold text-slate-300">{info.percent}%</span>
                          </div>
                          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${
                                run.status === 'completed' ? 'bg-emerald-500' : 'bg-cyan-500'
                              }`}
                              style={{ width: `${info.percent}%` }}
                            ></div>
                          </div>
                        </td>
                        <td className="py-4 text-xs font-mono text-slate-400">
                          {run.started_at ? new Date(run.started_at).toLocaleString() : 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
