'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { 
  Package, 
  Warehouse, 
  Plus, 
  ArrowUpDown, 
  AlertTriangle,
  ClipboardList
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

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAdjustStock, setShowAdjustStock] = useState(false);

  // Form states
  const [newSKU, setNewSKU] = useState('');
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('pieces');
  const [newCategory, setNewCategory] = useState('Raw Materials');
  const [newDesc, setNewDesc] = useState('');

  const [adjustProd, setAdjustProd] = useState('');
  const [adjustWh, setAdjustWh] = useState('');
  const [adjustDelta, setAdjustDelta] = useState(0);
  const [adjustType, setAdjustType] = useState('adjustment');
  const [adjustRef, setAdjustRef] = useState('');

  // Fetch Products
  const { data: products = [], isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => apiFetch('/inventory/products'),
  });

  // Fetch Warehouses
  const { data: warehouses = [] } = useQuery<WarehouseData[]>({
    queryKey: ['warehouses'],
    queryFn: () => apiFetch('/inventory/warehouses'),
  });

  // Fetch Stock Levels
  const { data: stockLevels = [], isLoading: loadingStock } = useQuery<StockLevel[]>({
    queryKey: ['stockLevels'],
    queryFn: () => apiFetch('/inventory/stock'),
  });

  // Mutations
  const addProductMutation = useMutation({
    mutationFn: (newProduct: any) => apiFetch('/inventory/products', {
      method: 'POST',
      body: JSON.stringify(newProduct),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setShowAddProduct(false);
      // Reset form
      setNewSKU('');
      setNewName('');
      setNewDesc('');
    },
  });

  const adjustStockMutation = useMutation({
    mutationFn: (adjustment: any) => apiFetch('/inventory/stock/adjust', {
      method: 'POST',
      body: JSON.stringify(adjustment),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stockLevels'] });
      setShowAdjustStock(false);
      setAdjustDelta(0);
      setAdjustRef('');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to adjust stock. Check if quantity becomes negative.');
    }
  });

  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addProductMutation.mutate({
      sku: newSKU,
      name: newName,
      unit: newUnit,
      category: newCategory,
      description: newDesc,
    });
  };

  const handleAdjustStockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    adjustStockMutation.mutate({
      product_id: adjustProd,
      warehouse_id: adjustWh,
      delta: Number(adjustDelta),
      type: adjustType,
      reference_id: adjustRef,
    });
  };

  // Helper mapping helper
  const getProductName = (id: string) => {
    const product = products.find(p => p.id === id);
    return product ? `${product.name} (${product.sku})` : 'Unknown Product';
  };

  const getWarehouseName = (id: string) => {
    const wh = warehouses.find(w => w.id === id);
    return wh ? wh.name : 'Unknown Warehouse';
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl font-black tracking-wider text-slate-100 uppercase">
              Inventory & Material Ledger
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
              Track products, raw materials, and execute stock adjustments
            </p>
          </div>
          <div className="flex space-x-3">
            <button 
              onClick={() => setShowAddProduct(true)}
              className="flex items-center space-x-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4 text-cyan-400" />
              <span>CATALOG NEW PRODUCT</span>
            </button>
            <button 
              onClick={() => {
                if (products.length > 0 && warehouses.length > 0) {
                  setAdjustProd(products[0].id);
                  setAdjustWh(warehouses[0].id);
                }
                setShowAdjustStock(true);
              }}
              className="flex items-center space-x-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 border border-cyan-500/20 px-4 py-2.5 text-xs font-bold text-slate-950 transition-all cursor-pointer"
            >
              <ArrowUpDown className="h-4 w-4" />
              <span>EXECUTE ADJUSTMENT</span>
            </button>
          </div>
        </div>

        {/* Dynamic Forms (Modals or overlay panels) */}
        {showAddProduct && (
          <div className="glass-panel border border-slate-800 rounded-xl p-6 relative">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800/80 pb-2">
              Catalog Product Ingestion
            </h2>
            <form onSubmit={handleAddProductSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">SKU / Code</label>
                <input 
                  type="text" 
                  value={newSKU} 
                  onChange={(e) => setNewSKU(e.target.value)} 
                  required 
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200" 
                  placeholder="SKU-STEEL-TUBE-01"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Product Name</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  required 
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200" 
                  placeholder="Industrial Steel Tube 10m"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Measurement Unit</label>
                <select 
                  value={newUnit} 
                  onChange={(e) => setNewUnit(e.target.value)} 
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200"
                >
                  <option value="pieces">Pieces</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="liters">Liters (L)</option>
                  <option value="meters">Meters (m)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Category</label>
                <select 
                  value={newCategory} 
                  onChange={(e) => setNewCategory(e.target.value)} 
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200"
                >
                  <option value="Raw Materials">Raw Materials</option>
                  <option value="Work in Progress">Work In Progress (WIP)</option>
                  <option value="Finished Goods">Finished Goods</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Description</label>
                <textarea 
                  value={newDesc} 
                  onChange={(e) => setNewDesc(e.target.value)} 
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200 h-20"
                  placeholder="Additional specifications, grade, manufacturer details..."
                />
              </div>
              <div className="md:col-span-2 flex justify-end space-x-3">
                <button 
                  type="button" 
                  onClick={() => setShowAddProduct(false)}
                  className="px-4 py-2.5 rounded-lg border border-slate-800 hover:bg-slate-900 text-xs font-bold text-slate-400 cursor-pointer"
                >
                  CANCEL
                </button>
                <button 
                  type="submit" 
                  disabled={addProductMutation.isPending}
                  className="px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-slate-950 cursor-pointer disabled:opacity-50"
                >
                  {addProductMutation.isPending ? 'INGESTING...' : 'CONFIRM INGESTION'}
                </button>
              </div>
            </form>
          </div>
        )}

        {showAdjustStock && (
          <div className="glass-panel border border-slate-800 rounded-xl p-6">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800/80 pb-2">
              Execute Stock Ledger Adjustment
            </h2>
            <form onSubmit={handleAdjustStockSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Target Product</label>
                <select 
                  value={adjustProd} 
                  onChange={(e) => setAdjustProd(e.target.value)} 
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Target Warehouse</label>
                <select 
                  value={adjustWh} 
                  onChange={(e) => setAdjustWh(e.target.value)} 
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name} - {w.location}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Ledger Type</label>
                <select 
                  value={adjustType} 
                  onChange={(e) => setAdjustType(e.target.value)} 
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200"
                >
                  <option value="incoming">Incoming Material Reception (+)</option>
                  <option value="outgoing">Outgoing Shipment (-)</option>
                  <option value="adjustment">Cycle Count Variance (+/-)</option>
                  <option value="reservation">Temporary Production Reservation (-)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Quantity Delta</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={adjustDelta} 
                  onChange={(e) => setAdjustDelta(Number(e.target.value))} 
                  required 
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200" 
                  placeholder="e.g. 500 or -200"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Business Reference Code (e.g. PO, WO, Run ID)</label>
                <input 
                  type="text" 
                  value={adjustRef} 
                  onChange={(e) => setAdjustRef(e.target.value)} 
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200" 
                  placeholder="REF-PO-2026-0081"
                />
              </div>
              <div className="md:col-span-2 flex justify-end space-x-3">
                <button 
                  type="button" 
                  onClick={() => setShowAdjustStock(false)}
                  className="px-4 py-2.5 rounded-lg border border-slate-800 hover:bg-slate-900 text-xs font-bold text-slate-400 cursor-pointer"
                >
                  CANCEL
                </button>
                <button 
                  type="submit" 
                  disabled={adjustStockMutation.isPending}
                  className="px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-slate-950 cursor-pointer disabled:opacity-50"
                >
                  {adjustStockMutation.isPending ? 'PROCESSING...' : 'COMMIT TRANSACTION'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Data Tables */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Products List (Left 1 col) */}
          <div className="glass-panel border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-800/80">
              <Package className="h-5 w-5 text-cyan-400" />
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">SKU Catalog</h2>
            </div>
            {loadingProducts ? (
              <div className="py-10 text-center text-xs font-bold tracking-wider text-slate-500 uppercase">Fetching Catalog...</div>
            ) : products.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">No products cataloged yet.</div>
            ) : (
              <div className="max-h-[450px] overflow-y-auto pr-1 space-y-2">
                {products.map(product => (
                  <div key={product.id} className="rounded-lg bg-slate-950/40 border border-slate-800/60 p-3 hover:border-slate-700 transition-colors">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-cyan-400 font-mono">{product.sku}</span>
                      <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">{product.unit}</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-200 mt-1">{product.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">{product.description || 'No description provided.'}</p>
                    <span className="inline-block mt-2 text-[9px] font-semibold text-slate-500 uppercase tracking-widest">{product.category}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stock Levels (Right 2 cols) */}
          <div className="glass-panel border border-slate-800 rounded-xl p-5 lg:col-span-2 space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-800/80">
              <Warehouse className="h-5 w-5 text-cyan-400" />
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Physical Storage Allocations</h2>
            </div>
            {loadingStock ? (
              <div className="py-10 text-center text-xs font-bold tracking-wider text-slate-500 uppercase">Fetching Stock Levels...</div>
            ) : stockLevels.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">No active stock allocations. Run an adjustment to add inventory.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-3">Product SKU / Name</th>
                      <th className="pb-3">Warehouse</th>
                      <th className="pb-3 text-right">Physical Qty</th>
                      <th className="pb-3 text-right">Reorder Threshold</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-sm text-slate-300">
                    {stockLevels.map(level => {
                      const isLow = level.quantity <= level.reorder_point;
                      return (
                        <tr key={level.id} className="hover:bg-slate-900/10">
                          <td className="py-3 font-semibold text-slate-200">
                            {getProductName(level.product_id)}
                          </td>
                          <td className="py-3 text-slate-400">
                            {getWarehouseName(level.warehouse_id)}
                          </td>
                          <td className="py-3 text-right font-mono font-bold text-slate-200">
                            {level.quantity}
                          </td>
                          <td className="py-3 text-right font-mono text-slate-400">
                            {level.reorder_point}
                          </td>
                          <td className="py-3">
                            {isLow ? (
                              <span className="flex items-center space-x-1 text-xs font-bold text-amber-500 bg-amber-950/20 border border-amber-900/30 px-2 py-0.5 rounded w-max">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                <span>LOW STOCK</span>
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 px-2 py-0.5 rounded w-max">
                                OPTIMAL
                              </span>
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
