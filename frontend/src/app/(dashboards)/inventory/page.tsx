'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAlertStore } from '@/lib/alertStore';
import { 
  Package, 
  Warehouse, 
  Plus, 
  AlertTriangle,
  ClipboardList,
  ShieldAlert,
  Thermometer,
  Boxes
} from 'lucide-react';

interface Product {
  id: string;
  sku: string;
  name: string;
  unit: string;
  category: string;
  description: string;
}

interface StockLevel {
  id: string;
  product_id: string;
  warehouse_id: string;
  quantity: number;
  reserved_qty: number;
  reorder_point: number;
}

interface WarehouseData {
  id: string;
  name: string;
  location: string;
}

const INITIAL_PALLETS = [
  { id: 'PAL-LITH-001', name: 'Lithium Cell Pallet Alpha', temp: 21.4, status: 'NOMINAL' },
  { id: 'PAL-LITH-002', name: 'Lithium Cell Pallet Beta', temp: 22.1, status: 'NOMINAL' },
  { id: 'PAL-LITH-003', name: 'Lithium Cell Pallet Gamma', temp: 20.8, status: 'NOMINAL' },
  { id: 'PAL-LITH-004', name: 'Lithium Cell Pallet Delta', temp: 23.5, status: 'NOMINAL' },
  { id: 'PAL-LITH-042', name: 'Lithium Cell Pallet Epsilon', temp: 21.9, status: 'NOMINAL' },
  { id: 'PAL-LITH-050', name: 'Lithium Cell Pallet Zeta', temp: 22.4, status: 'NOMINAL' },
  { id: 'PAL-LITH-077', name: 'Lithium Cell Pallet Eta', temp: 21.1, status: 'NOMINAL' },
  { id: 'PAL-LITH-099', name: 'Lithium Cell Pallet Theta', temp: 22.8, status: 'NOMINAL' },
];

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const criticalAlerts = useAlertStore((s) => s.alerts);
  const [activeTab, setActiveTab] = useState<'ALL' | 'CELLS' | 'CHASSIS' | 'MOTORS'>('ALL');
  
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showCycleCount, setShowCycleCount] = useState(false);
  const [showQuarantine, setShowQuarantine] = useState(false);

  const [newSKU, setNewSKU] = useState('');
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('pieces');
  const [newCategory, setNewCategory] = useState('Raw Materials');
  const [newDesc, setNewDesc] = useState('');

  const [cycleProduct, setCycleProduct] = useState('');
  const [cycleWarehouse, setCycleWarehouse] = useState('');
  const [cyclePhysicalCount, setCyclePhysicalCount] = useState<number | ''>('');

  const [quarantineProduct, setQuarantineProduct] = useState('');
  const [quarantineWarehouse, setQuarantineWarehouse] = useState('');
  const [quarantineQty, setQuarantineQty] = useState<number | ''>('');
  const [quarantineReason, setQuarantineReason] = useState('Damaged packaging / moisture breach');

  const [pallets, setPallets] = useState(INITIAL_PALLETS);

  useEffect(() => {
    if (criticalAlerts.length > 0) {
      setPallets(prev => prev.map(p => {
        const matchingAlert = criticalAlerts.find(a => a.pallet_id === p.id);
        if (matchingAlert) {
          return { ...p, temp: matchingAlert.temperature_c, status: 'CRITICAL' };
        }
        return p;
      }));
    }
  }, [criticalAlerts]);

  useEffect(() => {
    const timer = setInterval(() => {
      setPallets(prev => prev.map(p => {
        if (p.status === 'CRITICAL') return p;
        const noise = (Math.random() - 0.5) * 0.4;
        return { ...p, temp: parseFloat((p.temp + noise).toFixed(1)) };
      }));
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const { data: products = [], isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => apiFetch('/inventory/products'),
  });

  const { data: warehouses = [] } = useQuery<WarehouseData[]>({
    queryKey: ['warehouses'],
    queryFn: () => apiFetch('/inventory/warehouses'),
  });

  const { data: stockLevels = [], isLoading: loadingStock } = useQuery<StockLevel[]>({
    queryKey: ['stockLevels'],
    queryFn: () => apiFetch('/inventory/stock'),
  });

  const addProductMutation = useMutation({
    mutationFn: (newProduct: any) => apiFetch('/inventory/products', {
      method: 'POST',
      body: JSON.stringify(newProduct),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setShowAddProduct(false);
      setNewSKU(''); setNewName(''); setNewDesc('');
    },
  });

  const adjustStockMutation = useMutation({
    mutationFn: (adjustment: any) => apiFetch('/inventory/stock/adjust', {
      method: 'POST',
      body: JSON.stringify(adjustment),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stockLevels'] });
      setShowCycleCount(false); setShowQuarantine(false);
      setCyclePhysicalCount(''); setQuarantineQty('');
    },
    onError: (err: any) => {
      alert(err.message || 'Transaction failed.');
    }
  });

  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addProductMutation.mutate({ sku: newSKU, name: newName, unit: newUnit, category: newCategory, description: newDesc });
  };

  const handleCycleCountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cyclePhysicalCount === '') return;
    const currentStock = stockLevels.find(s => s.product_id === cycleProduct && s.warehouse_id === cycleWarehouse);
    const currentQty = currentStock ? currentStock.quantity : 0;
    const delta = Number(cyclePhysicalCount) - currentQty;
    adjustStockMutation.mutate({ product_id: cycleProduct, warehouse_id: cycleWarehouse, delta, type: 'adjustment', reference_id: `CYCLE-COUNT-${Date.now()}` });
  };

  const handleQuarantineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quarantineQty === '') return;
    adjustStockMutation.mutate({ product_id: quarantineProduct, warehouse_id: quarantineWarehouse, delta: -Number(quarantineQty), type: 'reservation', reference_id: `QUARANTINE-${quarantineReason.replace(/\s+/g, '-').slice(0, 15).toUpperCase()}-${Date.now()}` });
  };

  const getProductName = (id: string) => {
    const product = products.find(p => p.id === id);
    return product ? `${product.name} (${product.sku})` : 'Unknown';
  };

  const getWarehouseName = (id: string) => {
    const wh = warehouses.find(w => w.id === id);
    return wh ? wh.name : 'Unknown';
  };

  const filteredProducts = products.filter(product => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'CELLS') return product.name.toLowerCase().includes('cell') || product.sku.toLowerCase().includes('cell');
    if (activeTab === 'CHASSIS') return product.name.toLowerCase().includes('chassis') || product.sku.toLowerCase().includes('frame');
    if (activeTab === 'MOTORS') return product.name.toLowerCase().includes('motor') || product.sku.toLowerCase().includes('power');
    return true;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-[#1e293b] flex items-center gap-2">
              <Boxes className="h-5 w-5 text-[#1e3a5f]" />
              Warehouse Logistics Console
            </h1>
            <p className="text-[12px] text-[#64748b] mt-0.5">
              Material control, IoT temperature feeds, and physical ledger reconciliation
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowAddProduct(true)} className="btn-secondary">
              <Plus className="h-3.5 w-3.5" />
              <span>Catalog SKU</span>
            </button>
            <button onClick={() => { if (products.length > 0 && warehouses.length > 0) { setCycleProduct(products[0].id); setCycleWarehouse(warehouses[0].id); } setShowCycleCount(true); }} className="btn-secondary">
              <ClipboardList className="h-3.5 w-3.5" />
              <span>Cycle Count</span>
            </button>
            <button onClick={() => { if (products.length > 0 && warehouses.length > 0) { setQuarantineProduct(products[0].id); setQuarantineWarehouse(warehouses[0].id); } setShowQuarantine(true); }} className="btn-destructive">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Quarantine Stock</span>
            </button>
          </div>
        </div>

        {/* Add Product Form */}
        {showAddProduct && (
          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5">
            <div className="section-title flex items-center gap-2">
              <Plus className="h-3.5 w-3.5 text-[#1e3a5f]" />
              SKU Catalog Ingestion
            </div>
            <form onSubmit={handleAddProductSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="field-label">SKU Code</label>
                <input type="text" value={newSKU} onChange={(e) => setNewSKU(e.target.value)} required placeholder="SKU-BATT-LITH-2170" />
              </div>
              <div>
                <label className="field-label">Product Name</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="21700 Lithium-Ion Battery Cell" />
              </div>
              <div>
                <label className="field-label">Unit</label>
                <select value={newUnit} onChange={(e) => setNewUnit(e.target.value)}>
                  <option value="pieces">Pieces (pcs)</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="meters">Meters (m)</option>
                </select>
              </div>
              <div>
                <label className="field-label">Category</label>
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                  <option value="Raw Materials">Raw Materials</option>
                  <option value="Work in Progress">Work In Progress</option>
                  <option value="Finished Goods">Finished Goods</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="field-label">Description</label>
                <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="h-16" placeholder="Component specifications..." />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddProduct(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={addProductMutation.isPending} className="btn-primary">
                  {addProductMutation.isPending ? 'Saving...' : 'Confirm SKU'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Cycle Count Form */}
        {showCycleCount && (
          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5">
            <div className="section-title flex items-center gap-2">
              <ClipboardList className="h-3.5 w-3.5 text-[#1e3a5f]" />
              Physical Count Reconciliation
            </div>
            <form onSubmit={handleCycleCountSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="field-label">Product</label>
                <select value={cycleProduct} onChange={(e) => setCycleProduct(e.target.value)}>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Warehouse</label>
                <select value={cycleWarehouse} onChange={(e) => setCycleWarehouse(e.target.value)}>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Physical Count</label>
                <input type="number" value={cyclePhysicalCount} onChange={(e) => setCyclePhysicalCount(e.target.value === '' ? '' : Number(e.target.value))} required placeholder="Actual units on shelf" />
              </div>
              <div className="md:col-span-3 flex justify-end gap-2">
                <button type="button" onClick={() => setShowCycleCount(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={adjustStockMutation.isPending} className="btn-primary">
                  {adjustStockMutation.isPending ? 'Adjusting...' : 'Commit Reconciliation'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Quarantine Form */}
        {showQuarantine && (
          <div className="bg-white border border-[#fecaca] rounded-sm p-5">
            <div className="section-title flex items-center gap-2 !text-[#b91c1c] !border-[#fecaca]">
              <ShieldAlert className="h-3.5 w-3.5" />
              Quarantine Damaged Materials
            </div>
            <form onSubmit={handleQuarantineSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="field-label">Product</label>
                <select value={quarantineProduct} onChange={(e) => setQuarantineProduct(e.target.value)}>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Warehouse</label>
                <select value={quarantineWarehouse} onChange={(e) => setQuarantineWarehouse(e.target.value)}>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Qty to Quarantine</label>
                <input type="number" value={quarantineQty} onChange={(e) => setQuarantineQty(e.target.value === '' ? '' : Number(e.target.value))} required placeholder="e.g. 50" />
              </div>
              <div className="md:col-span-3">
                <label className="field-label">Reason</label>
                <input type="text" value={quarantineReason} onChange={(e) => setQuarantineReason(e.target.value)} required />
              </div>
              <div className="md:col-span-3 flex justify-end gap-2">
                <button type="button" onClick={() => setShowQuarantine(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={adjustStockMutation.isPending} className="btn-destructive">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>{adjustStockMutation.isPending ? 'Locking...' : 'Quarantine Lock'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* IoT Telemetry Panel */}
        <div className="bg-white border border-[#e2e8f0] rounded-sm p-5">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#f1f5f9]">
            <div className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-[#1e3a5f]" />
              <h2 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">Battery Pallet Telemetry</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="live-indicator"></span>
              <span className="text-[10px] font-semibold text-[#64748b]">Live Sensors</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {pallets.map((pallet) => {
              const isSpike = pallet.status === 'CRITICAL';
              return (
                <div 
                  key={pallet.id} 
                  className={`p-3 rounded-sm border ${
                    isSpike 
                      ? 'bg-[#fef2f2] border-[#fecaca]' 
                      : 'bg-[#f8fafc] border-[#e2e8f0]'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-mono font-semibold text-[#64748b]">{pallet.id}</span>
                    {isSpike && <AlertTriangle className="h-3.5 w-3.5 text-[#dc2626]" />}
                  </div>
                  <h3 className="text-[11px] font-semibold text-[#334155] mt-1.5 truncate">{pallet.name}</h3>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-[9px] text-[#94a3b8] font-semibold uppercase">Temp</p>
                      <p className={`text-lg font-bold font-mono ${isSpike ? 'text-[#dc2626]' : 'text-[#1e293b]'}`}>
                        {pallet.temp}°C
                      </p>
                    </div>
                    {isSpike ? (
                      <span className="badge badge-danger">Spike</span>
                    ) : (
                      <span className="badge badge-success">OK</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Data Grid */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          
          {/* SKU Matrix */}
          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#f1f5f9]">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-[#1e3a5f]" />
                <h2 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">SKU Catalog</h2>
              </div>
              <span className="badge badge-neutral">{filteredProducts.length} items</span>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {['ALL', 'CELLS', 'CHASSIS', 'MOTORS'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-sm cursor-pointer border transition-colors ${
                    activeTab === tab 
                      ? 'bg-[#eff6ff] text-[#1e3a5f] border-[#bfdbfe]' 
                      : 'bg-white border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {loadingProducts ? (
              <div className="py-8 text-center text-[12px] text-[#94a3b8]">Loading catalog...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-[#94a3b8]">No matching SKUs.</div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto space-y-1.5">
                {filteredProducts.map(product => (
                  <div key={product.id} className="p-3 rounded-sm bg-[#f8fafc] border border-[#f1f5f9] hover:border-[#e2e8f0] transition-colors">
                    <div className="flex justify-between items-start">
                      <span className="text-[11px] font-mono font-bold text-[#1e3a5f]">{product.sku}</span>
                      <span className="badge badge-neutral">{product.unit}</span>
                    </div>
                    <h3 className="text-[13px] font-semibold text-[#1e293b] mt-1">{product.name}</h3>
                    <p className="text-[11px] text-[#64748b] mt-0.5 line-clamp-1">{product.description || 'No description.'}</p>
                    <span className="text-[9px] font-semibold text-[#94a3b8] uppercase tracking-wider mt-1 inline-block">{product.category}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stock Levels */}
          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5 lg:col-span-2">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#f1f5f9]">
              <Warehouse className="h-4 w-4 text-[#1e3a5f]" />
              <h2 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">Stock Allocations</h2>
            </div>
            
            {loadingStock ? (
              <div className="py-8 text-center text-[12px] text-[#94a3b8]">Loading stock levels...</div>
            ) : stockLevels.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-[#94a3b8]">No active stock allocations.</div>
            ) : (
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Warehouse</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Reorder Pt</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockLevels.map(level => {
                      const isLow = level.quantity <= level.reorder_point;
                      return (
                        <tr key={level.id}>
                          <td className="font-medium text-[#1e293b]">{getProductName(level.product_id)}</td>
                          <td>{getWarehouseName(level.warehouse_id)}</td>
                          <td className="text-right font-mono font-bold text-[#1e293b]">{level.quantity}</td>
                          <td className="text-right font-mono text-[#64748b]">{level.reorder_point}</td>
                          <td>
                            {isLow ? (
                              <span className="badge badge-warning"><AlertTriangle className="h-3 w-3" /> Low</span>
                            ) : (
                              <span className="badge badge-success">OK</span>
                            )}
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

      </div>
    </DashboardLayout>
  );
}
