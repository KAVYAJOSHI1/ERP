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
  Plus,
  Clock,
  Gauge,
  Wrench,
  TrendingUp
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
        return <span className="badge badge-success">OK</span>;
      case 'in_progress':
        return <span className="badge badge-info">Running</span>;
      case 'maintenance':
      case 'failed':
        return <span className="badge badge-danger">Alert</span>;
      case 'idle':
      default:
        return <span className="badge badge-neutral">Idle</span>;
    }
  };

  // Calculate high-level stats from live runs
  const activeJobs = productionRuns.filter(r => r.status === 'in_progress');
  const activeLoadPercent = workCenters.length > 0 
    ? Math.round((workCenters.filter(w => w.status === 'active').length / workCenters.length) * 100) 
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-[#1e293b] flex items-center gap-2">
              <Factory className="h-5 w-5 text-[#1e3a5f]" />
              Shop Floor & Production Execution
            </h1>
            <p className="text-[12px] text-[#64748b] mt-0.5">
              Monitor work center utilization, configure Bills of Materials (BOM), and track run cycles
            </p>
          </div>
          <div>
            <button onClick={() => setShowNewRunForm(true)} className="btn-primary">
              <Plus className="h-3.5 w-3.5" />
              <span>Launch Production Run</span>
            </button>
          </div>
        </div>

        {/* Launch New Run Form */}
        {showNewRunForm && (
          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5">
            <div className="section-title">Dispatch Production Execution Order</div>
            <form onSubmit={handleStartRun} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="field-label">Select Recipe (BOM)</label>
                <select value={selectedBOM} onChange={(e) => setSelectedBOM(e.target.value)}>
                  {boms.length === 0 && <option value="">No recipes configured</option>}
                  {boms.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Target Work Center</label>
                <select value={selectedWC} onChange={(e) => setSelectedWC(e.target.value)}>
                  {workCenters.length === 0 && <option value="">No work centers configured</option>}
                  {workCenters.map(wc => (
                    <option key={wc.id} value={wc.id}>{wc.name} ({wc.status.toUpperCase()})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Production Batch Size</label>
                <input type="number" min="1" max="1000" value={runQty} onChange={(e) => setRunQty(Number(e.target.value))} required />
              </div>
              <div className="md:col-span-3 flex justify-end gap-2">
                <button type="button" onClick={() => setShowNewRunForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={dispatchMutation.isPending} className="btn-primary">
                  {dispatchMutation.isPending ? 'Dispatching...' : 'Dispatch Work Order'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5">
            <p className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">Overall Capacity</p>
            <h3 className="text-xl font-bold text-[#1e293b] mt-1 font-mono">
              {workCenters.reduce((sum, w) => sum + w.capacity, 0)} units/hr
            </h3>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5">
            <p className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">Work Centers Active</p>
            <h3 className="text-xl font-bold text-[#1e293b] mt-1 font-mono">{activeLoadPercent}% Optimal</h3>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5">
            <p className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">Yield Success Rate</p>
            <h3 className="text-xl font-bold text-[#1e293b] mt-1 font-mono">99.84%</h3>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5">
            <p className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">Active Jobs</p>
            <h3 className="text-xl font-bold text-[#1e293b] mt-1 font-mono">{activeJobs.length} Running</h3>
          </div>
        </div>

        {/* Work Centers & Bills of Materials */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Work Centers */}
          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5 lg:col-span-2">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#f1f5f9]">
              <Cpu className="h-4 w-4 text-[#1e3a5f]" />
              <h2 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">Work Center Storage & Nodes</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {workCenters.map(wc => {
                const wcJobs = activeJobs.filter(j => j.work_center_id === wc.id);
                const isBusy = wcJobs.length > 0;
                return (
                  <div key={wc.id} className="p-4 bg-[#f8fafc] border border-[#f1f5f9] rounded-sm">
                    <div className="flex justify-between items-start">
                      <span className="text-[13px] font-bold text-[#1e293b]">{wc.name}</span>
                      {getStatusBadge(isBusy ? 'in_progress' : wc.status)}
                    </div>
                    <div className="text-[12px] text-[#64748b] space-y-2 mt-3">
                      <div className="flex justify-between">
                        <span>Assigned Capacity:</span>
                        <span className="font-mono text-[#334155] font-bold">{wc.capacity} units</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>Active Work Load:</span>
                          <span className="font-mono text-[#1e3a5f] font-bold">{isBusy ? '90%' : '0%'}</span>
                        </div>
                        <div className="w-full bg-[#e2e8f0] rounded-sm h-1.5 overflow-hidden">
                          <div 
                            className="bg-[#1e3a5f] h-full rounded-sm transition-all duration-500" 
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
          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#f1f5f9]">
              <Layers className="h-4 w-4 text-[#1e3a5f]" />
              <h2 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">Bills of Materials (BOM)</h2>
            </div>
            <div className="max-h-[380px] overflow-y-auto space-y-3 pr-1">
              {boms.map(bom => (
                <div key={bom.id} className="p-3.5 bg-[#f8fafc] border border-[#f1f5f9] rounded-sm">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[12px] font-bold text-[#1e293b] uppercase">{bom.name}</h3>
                    <span className="badge badge-neutral font-mono">v{bom.version}</span>
                  </div>
                  <p className="text-[10px] text-[#94a3b8] font-bold uppercase tracking-wider mt-2">Yield Output Product:</p>
                  <p className="text-[12px] text-[#1e3a5f] font-mono mt-0.5">{getProductDisplay(bom.product_id)}</p>
                  {bom.components && bom.components.length > 0 && (
                    <div className="pt-2 mt-2 border-t border-[#f1f5f9] space-y-1.5">
                      <p className="text-[9px] font-bold text-[#64748b] uppercase tracking-widest">Required Components</p>
                      {bom.components.map((comp, idx) => (
                        <div key={idx} className="flex justify-between text-[11px] font-mono">
                          <span className="text-[#64748b]">• {getProductDisplayShort(comp.raw_material_id)}</span>
                          <span className="text-[#334155] font-bold">{comp.quantity_required} units</span>
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
        <div className="bg-white border border-[#e2e8f0] rounded-sm p-5">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#f1f5f9]">
            <Factory className="h-4 w-4 text-[#1e3a5f]" />
            <h2 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">Live Job Tracking & Execution Logs</h2>
          </div>
          {productionRuns.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-[#94a3b8]">No production runs dispatched yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Product Recipe / BOM</th>
                    <th>Work Center</th>
                    <th className="text-right">Job Batch</th>
                    <th>Progress / State</th>
                    <th>Dispatched At</th>
                  </tr>
                </thead>
                <tbody>
                  {productionRuns.map(run => {
                    const info = getProgressInfo(run);
                    return (
                      <tr key={run.id}>
                        <td className="font-mono text-[11px] text-[#64748b]">{run.id.substring(0, 8).toUpperCase()}...</td>
                        <td className="font-bold text-[#1e293b]">{run.bom ? run.bom.name : 'Unknown Recipe'}</td>
                        <td>{run.work_center ? run.work_center.name : 'Unknown WC'}</td>
                        <td className="text-right font-mono font-bold text-[#1e293b]">{run.quantity}</td>
                        <td className="w-56">
                          <div className="flex justify-between items-center text-[11px] mb-1">
                            {getStatusBadge(info.label)}
                            <span className="font-mono font-bold text-[#334155]">{info.percent}%</span>
                          </div>
                          <div className="w-full bg-[#e2e8f0] rounded-sm h-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-sm transition-all duration-300 ${
                                run.status === 'completed' ? 'bg-[#166534]' : 'bg-[#1e3a5f]'
                              }`}
                              style={{ width: `${info.percent}%` }}
                            ></div>
                          </div>
                        </td>
                        <td className="text-[11px] font-mono text-[#64748b]">
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
