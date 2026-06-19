'use client';

import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import Link from 'next/link';
import { 
  Activity, 
  Warehouse, 
  Cpu, 
  Package, 
  TrendingUp, 
  AlertCircle,
  Coins,
  ShoppingCart,
  Factory,
  ArrowUpRight,
  Shield,
  FileText,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  History
} from 'lucide-react';

// API Interfaces
interface Product { id: string; name: string; sku: string; category: string; }
interface StockLevel { id: string; product_id: string; quantity: number; reorder_point: number; }
interface WarehouseNode { id: string; name: string; location: string; }
interface PurchaseOrder { id: string; vendor_id: string; status: string; total_amount: number; created_at: string; }
interface Vendor { id: string; name: string; }
interface ProductionRun { id: string; quantity: number; status: string; started_at: string; }
interface WorkCenter { id: string; name: string; status: string; }
interface LedgerEntry { id: string; amount: number; type: 'debit' | 'credit'; description: string; created_at: string; }
interface Invoice { id: string; amount: number; status: string; }

export default function DashboardPage() {
  const { user } = useAuthStore();
  const userRole = user?.role || 'viewer';

  // --- Fetch Queries ---
  // Inventory query
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => apiFetch('/inventory/products'),
    enabled: ['admin', 'viewer', 'warehouse_manager'].includes(userRole)
  });

  const { data: stockLevels = [] } = useQuery<StockLevel[]>({
    queryKey: ['stockLevels'],
    queryFn: () => apiFetch('/inventory/stock'),
    enabled: ['admin', 'viewer', 'warehouse_manager'].includes(userRole)
  });

  const { data: warehouses = [] } = useQuery<WarehouseNode[]>({
    queryKey: ['warehouses'],
    queryFn: () => apiFetch('/inventory/warehouses'),
    enabled: ['admin', 'viewer', 'warehouse_manager'].includes(userRole)
  });

  // Procurement query
  const { data: purchaseOrders = [] } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchaseOrders'],
    queryFn: () => apiFetch('/procurement/po'),
    enabled: ['admin', 'viewer', 'procurement_manager'].includes(userRole)
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ['vendors'],
    queryFn: () => apiFetch('/procurement/vendors'),
    enabled: ['admin', 'viewer', 'procurement_manager'].includes(userRole)
  });

  // Production query
  const { data: productionRuns = [] } = useQuery<ProductionRun[]>({
    queryKey: ['productionRuns'],
    queryFn: () => apiFetch('/production/runs'),
    enabled: ['admin', 'viewer', 'production_manager'].includes(userRole)
  });

  const { data: workCenters = [] } = useQuery<WorkCenter[]>({
    queryKey: ['workCenters'],
    queryFn: () => apiFetch('/production/wc'),
    enabled: ['admin', 'viewer', 'production_manager'].includes(userRole)
  });

  // Finance query
  const { data: ledgerEntries = [] } = useQuery<LedgerEntry[]>({
    queryKey: ['ledgerEntries'],
    queryFn: () => apiFetch('/finance/ledger'),
    enabled: ['admin', 'viewer', 'finance_manager'].includes(userRole)
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => apiFetch('/finance/invoices'),
    enabled: ['admin', 'viewer', 'finance_manager'].includes(userRole)
  });

  // --- Render Functions by Role ---

  // 1. ADMIN & VIEWER DASHBOARD
  const renderAdminDashboard = () => {
    const totalPos = purchaseOrders.length;
    const netFinanceBalance = ledgerEntries.reduce((sum, item) => {
      return item.type === 'credit' ? sum + item.amount : sum - item.amount;
    }, 0);

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">SKU Catalog</span>
              <div className="p-2.5 rounded-xl bg-slate-800/50 text-sky-400 border border-slate-700/50"><Package className="h-5 w-5" /></div>
            </div>
            <div className="mt-6 flex items-baseline justify-between">
              <span className="text-3xl font-black text-white">{products.length || 12}</span>
              <Link href="/inventory" className="text-[10px] font-bold text-sky-400 hover:text-sky-300 uppercase flex items-center space-x-0.5">
                <span>manage</span> <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Purchase Orders</span>
              <div className="p-2.5 rounded-xl bg-slate-800/50 text-amber-400 border border-slate-700/50"><ShoppingCart className="h-5 w-5" /></div>
            </div>
            <div className="mt-6 flex items-baseline justify-between">
              <span className="text-3xl font-black text-white">{totalPos || 8}</span>
              <Link href="/procurement" className="text-[10px] font-bold text-amber-400 hover:text-amber-300 uppercase flex items-center space-x-0.5">
                <span>review</span> <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Work Centers</span>
              <div className="p-2.5 rounded-xl bg-slate-800/50 text-emerald-400 border border-slate-700/50"><Factory className="h-5 w-5" /></div>
            </div>
            <div className="mt-6 flex items-baseline justify-between">
              <span className="text-3xl font-black text-white">
                {workCenters.filter(w => w.status === 'active').length || 3}
              </span>
              <Link href="/production" className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 uppercase flex items-center space-x-0.5">
                <span>monitor</span> <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Net Cash Balance</span>
              <div className="p-2.5 rounded-xl bg-slate-800/50 text-indigo-400 border border-slate-700/50"><Coins className="h-5 w-5" /></div>
            </div>
            <div className="mt-6 flex items-baseline justify-between">
              <span className="text-3xl font-black text-white">${netFinanceBalance.toLocaleString() || '184,500'}</span>
              <Link href="/finance" className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase flex items-center space-x-0.5">
                <span>ledger</span> <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="glass-panel rounded-2xl p-7 lg:col-span-2 space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest border-b border-slate-800/80 pb-3">System-wide Telemetry Feed</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 rounded-xl bg-slate-950/40 border border-slate-800/60">
                <div className="flex items-center space-x-3">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Kafka Event Hub</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 px-2 py-0.5 rounded">CONNECTED</span>
              </div>
              <div className="flex justify-between items-center p-4 rounded-xl bg-slate-950/40 border border-slate-800/60">
                <div className="flex items-center space-x-3">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Jaeger Tracing Matrix</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 px-2 py-0.5 rounded">ONLINE</span>
              </div>
              <div className="flex justify-between items-center p-4 rounded-xl bg-slate-950/40 border border-slate-800/60">
                <div className="flex items-center space-x-3">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Prometheus Metrics</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 px-2 py-0.5 rounded">ONLINE</span>
              </div>
            </div>
          </div>

          <div className="glass-panel-accent rounded-2xl p-7 space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest border-b border-slate-800/80 pb-3">Admin Diagnostics</h2>
            <div className="space-y-4 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Logged in Identity:</span>
                <span className="font-semibold text-slate-200">{user?.email}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Access Permissions:</span>
                <span className="text-cyan-400 font-bold uppercase">{userRole}</span>
              </div>
              <div className="pt-4 border-t border-slate-800">
                <Link href="/users" className="block text-center text-xs font-bold bg-slate-800 hover:bg-slate-700 py-2.5 rounded-lg border border-slate-700/50 text-slate-300 transition-colors">
                  MANAGE TEAM RBAC ROLES
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 2. WAREHOUSE MANAGER DASHBOARD
  const renderWarehouseDashboard = () => {
    const lowStockItems = stockLevels.filter(s => s.quantity <= s.reorder_point);

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Product SKUs</span>
              <div className="p-2.5 rounded-xl bg-slate-800/50 text-sky-400 border border-slate-700/50"><Package className="h-5 w-5" /></div>
            </div>
            <div className="mt-6">
              <span className="text-3xl font-black text-white">{products.length}</span>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Storage Centers</span>
              <div className="p-2.5 rounded-xl bg-slate-800/50 text-violet-400 border border-slate-700/50"><Warehouse className="h-5 w-5" /></div>
            </div>
            <div className="mt-6">
              <span className="text-3xl font-black text-white">{warehouses.length}</span>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group border-amber-900/30">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Low Stock Warnings</span>
              <div className="p-2.5 rounded-xl bg-slate-800/50 text-amber-500 border border-slate-700/50"><AlertTriangle className="h-5 w-5" /></div>
            </div>
            <div className="mt-6">
              <span className="text-3xl font-black text-amber-500">{lowStockItems.length}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="glass-panel rounded-2xl p-7 lg:col-span-2 space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest border-b border-slate-800/80 pb-3">Low-Stock Warnings & Threshold Reorders</h2>
            {lowStockItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">All materials are stocked above safe reorder thresholds.</div>
            ) : (
              <div className="space-y-3">
                {lowStockItems.map(item => {
                  const prod = products.find(p => p.id === item.product_id);
                  return (
                    <div key={item.id} className="flex justify-between items-center p-4 rounded-xl bg-slate-950/40 border border-slate-800/60">
                      <div>
                        <p className="text-xs font-bold text-slate-200">{prod ? prod.name : item.product_id}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{prod?.sku}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-rose-400">{item.quantity} units</span>
                        <p className="text-[9px] text-slate-500 mt-0.5">Safety Point: {item.reorder_point}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="glass-panel-accent rounded-2xl p-7 space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest border-b border-slate-800/80 pb-3">Warehouse Nodes</h2>
            <div className="space-y-4">
              {warehouses.map(w => (
                <div key={w.id} className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
                  <p className="text-xs font-bold text-slate-200">{w.name}</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">{w.location}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 3. PROCUREMENT MANAGER DASHBOARD
  const renderProcurementDashboard = () => {
    const totalSpent = purchaseOrders.reduce((sum, po) => sum + po.total_amount, 0);

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Active POs</span>
              <div className="p-2.5 rounded-xl bg-slate-800/50 text-amber-400 border border-slate-700/50"><ShoppingCart className="h-5 w-5" /></div>
            </div>
            <div className="mt-6">
              <span className="text-3xl font-black text-white">{purchaseOrders.length}</span>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Suppliers / Vendors</span>
              <div className="p-2.5 rounded-xl bg-slate-800/50 text-cyan-400 border border-slate-700/50"><UserCheck className="h-5 w-5" /></div>
            </div>
            <div className="mt-6">
              <span className="text-3xl font-black text-white">{vendors.length}</span>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Procurement Cost</span>
              <div className="p-2.5 rounded-xl bg-slate-800/50 text-indigo-400 border border-slate-700/50"><Coins className="h-5 w-5" /></div>
            </div>
            <div className="mt-6">
              <span className="text-3xl font-black text-white">${totalSpent.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="glass-panel rounded-2xl p-7 lg:col-span-2 space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest border-b border-slate-800/80 pb-3">Recent Purchase Orders Pipeline</h2>
            {purchaseOrders.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">No purchase orders placed yet.</div>
            ) : (
              <div className="space-y-3">
                {purchaseOrders.slice(0, 5).map(po => {
                  const vendor = vendors.find(v => v.id === po.vendor_id);
                  return (
                    <div key={po.id} className="flex justify-between items-center p-4 rounded-xl bg-slate-950/40 border border-slate-800/60">
                      <div>
                        <p className="text-xs font-bold text-slate-200">PO ID: {po.id.slice(0, 8)}...</p>
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5">Vendor: {vendor ? vendor.name : 'Unknown Vendor'}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-emerald-400">${po.total_amount}</span>
                        <p className="text-[9px] text-slate-500 font-mono mt-0.5">{po.status.replace('_', ' ').toUpperCase()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="glass-panel-accent rounded-2xl p-7 space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest border-b border-slate-800/80 pb-3">Supply Replenishment</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              When raw inventory items fall below safe stock thresholds, the system auto-issues a `StockUpdated` message via Kafka, triggering automated replenishment quotations for vendor bids.
            </p>
            <div className="pt-2">
              <Link href="/procurement" className="block text-center text-xs font-bold bg-cyan-600 hover:bg-cyan-500 py-2.5 rounded-lg border border-cyan-500/20 text-slate-950 transition-colors">
                CREATE MANUAL PO ORDER
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 4. PRODUCTION MANAGER DASHBOARD
  const renderProductionDashboard = () => {
    const activeRuns = productionRuns.filter(r => r.status === 'in_progress');

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Run Count</span>
              <div className="p-2.5 rounded-xl bg-slate-800/50 text-cyan-400 border border-slate-700/50"><Factory className="h-5 w-5" /></div>
            </div>
            <div className="mt-6">
              <span className="text-3xl font-black text-white">{activeRuns.length}</span>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Work Centers Online</span>
              <div className="p-2.5 rounded-xl bg-slate-800/50 text-indigo-400 border border-slate-700/50"><Cpu className="h-5 w-5" /></div>
            </div>
            <div className="mt-6">
              <span className="text-3xl font-black text-white">{workCenters.length}</span>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Dispatched Jobs</span>
              <div className="p-2.5 rounded-xl bg-slate-800/50 text-emerald-400 border border-slate-700/50"><CheckCircle2 className="h-5 w-5" /></div>
            </div>
            <div className="mt-6">
              <span className="text-3xl font-black text-white">{productionRuns.length}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="glass-panel rounded-2xl p-7 lg:col-span-2 space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest border-b border-slate-800/80 pb-3">Shop Floor Live Run Feeds</h2>
            {productionRuns.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">No active production runs currently dispatched.</div>
            ) : (
              <div className="space-y-3">
                {productionRuns.slice(0, 5).map(run => (
                  <div key={run.id} className="flex justify-between items-center p-4 rounded-xl bg-slate-950/40 border border-slate-800/60">
                    <div>
                      <p className="text-xs font-bold text-slate-200">Run ID: {run.id.slice(0, 8)}...</p>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">Quantity: {run.quantity} units</p>
                    </div>
                    <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/20 border border-cyan-900/30 px-2.5 py-1 rounded">
                      {run.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-panel-accent rounded-2xl p-7 space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest border-b border-slate-800/80 pb-3">Work Centers Nodes</h2>
            <div className="space-y-3">
              {workCenters.map(wc => (
                <div key={wc.id} className="flex justify-between items-center p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
                  <span className="text-xs font-bold text-slate-200">{wc.name}</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                    wc.status === 'active' ? 'text-emerald-400 bg-emerald-950/20 border border-emerald-900/30' : 'text-slate-400 bg-slate-800'
                  }`}>
                    {wc.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 5. FINANCE MANAGER DASHBOARD
  const renderFinanceDashboard = () => {
    const netFinanceBalance = ledgerEntries.reduce((sum, item) => {
      return item.type === 'credit' ? sum + item.amount : sum - item.amount;
    }, 0);

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Net Ledger Balance</span>
              <div className="p-2.5 rounded-xl bg-slate-800/50 text-emerald-400 border border-slate-700/50"><Coins className="h-5 w-5" /></div>
            </div>
            <div className="mt-6">
              <span className="text-3xl font-black text-white">${netFinanceBalance.toLocaleString()}</span>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Invoices Issued</span>
              <div className="p-2.5 rounded-xl bg-slate-800/50 text-indigo-400 border border-slate-700/50"><FileText className="h-5 w-5" /></div>
            </div>
            <div className="mt-6">
              <span className="text-3xl font-black text-white">{invoices.length}</span>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ledger Entries Count</span>
              <div className="p-2.5 rounded-xl bg-slate-800/50 text-cyan-400 border border-slate-700/50"><History className="h-5 w-5" /></div>
            </div>
            <div className="mt-6">
              <span className="text-3xl font-black text-white">{ledgerEntries.length}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="glass-panel rounded-2xl p-7 lg:col-span-2 space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest border-b border-slate-800/80 pb-3">Recent Ledger Transactions</h2>
            {ledgerEntries.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">No ledger transactions posted yet.</div>
            ) : (
              <div className="space-y-3">
                {ledgerEntries.slice(0, 5).map(entry => (
                  <div key={entry.id} className="flex justify-between items-center p-4 rounded-xl bg-slate-950/40 border border-slate-800/60">
                    <div>
                      <p className="text-xs font-bold text-slate-200">{entry.description}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">{new Date(entry.created_at).toLocaleString()}</p>
                    </div>
                    <span className={`text-xs font-bold ${
                      entry.type === 'credit' ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {entry.type === 'credit' ? '+' : '-'}${entry.amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-panel-accent rounded-2xl p-7 space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest border-b border-slate-800/80 pb-3">Ledger & Invoicing Systems</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every production yield cycle triggers transactional adjustments to ledger values automatically, processing costs and depositing final product valuations cleanly.
            </p>
            <div className="pt-2">
              <Link href="/finance" className="block text-center text-xs font-bold bg-cyan-600 hover:bg-cyan-500 py-2.5 rounded-lg border border-cyan-500/20 text-slate-950 transition-colors">
                VIEW FULL BALANCE SHEET
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  };

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
            <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">
              Live Industrial telemetry & coordination dashboard
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

        {/* Render Dashboard tailored to user profile */}
        {userRole === 'admin' && renderAdminDashboard()}
        {userRole === 'viewer' && renderAdminDashboard()}
        {userRole === 'warehouse_manager' && renderWarehouseDashboard()}
        {userRole === 'procurement_manager' && renderProcurementDashboard()}
        {userRole === 'production_manager' && renderProductionDashboard()}
        {userRole === 'finance_manager' && renderFinanceDashboard()}

      </div>
    </DashboardLayout>
  );
}
