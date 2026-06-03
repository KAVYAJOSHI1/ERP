'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { 
  ShoppingCart, 
  Users, 
  Plus, 
  FileText, 
  ExternalLink,
  ShieldCheck,
  Zap,
  TrendingUp
} from 'lucide-react';

interface Vendor {
  id: string;
  name: string;
  email: string;
  contact: string;
  performance_score: number;
  is_active: boolean;
}

interface PurchaseOrder {
  id: string;
  vendor_id: string;
  vendor?: Vendor;
  status: string; // draft, approved, auto_generated, sent, received, cancelled
  total_amount: number;
  currency: string;
  correlation_id: string;
  created_at: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
}

export default function ProcurementPage() {
  const queryClient = useQueryClient();
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [showCreatePO, setShowCreatePO] = useState(false);

  // Vendor Form state
  const [vName, setVName] = useState('');
  const [vEmail, setVEmail] = useState('');
  const [vPhone, setVPhone] = useState('');

  // PO Form state
  const [poVendor, setPoVendor] = useState('');
  const [poProduct, setPoProduct] = useState('');
  const [poQty, setPoQty] = useState(1);
  const [poPrice, setPoPrice] = useState(10.0);

  // Fetch Vendors
  const { data: vendors = [], isLoading: loadingVendors } = useQuery<Vendor[]>({
    queryKey: ['vendors'],
    queryFn: () => apiFetch('/procurement/vendors'),
  });

  // Fetch Purchase Orders
  const { data: purchaseOrders = [], isLoading: loadingPOs } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchaseOrders'],
    queryFn: () => apiFetch('/procurement/po'),
  });

  // Fetch Products (for PO drafting dropdown)
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => apiFetch('/inventory/products'),
  });

  // Mutations
  const addVendorMutation = useMutation({
    mutationFn: (newVendor: any) => apiFetch('/procurement/vendors', {
      method: 'POST',
      body: JSON.stringify(newVendor),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setShowAddVendor(false);
      setVName('');
      setVEmail('');
      setVPhone('');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to add vendor');
    }
  });

  const createPOMutation = useMutation({
    mutationFn: (newPO: any) => apiFetch('/procurement/po', {
      method: 'POST',
      body: JSON.stringify(newPO),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      setShowCreatePO(false);
      setPoQty(1);
      setPoPrice(10.0);
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to create purchase order');
    }
  });

  const handleAddVendorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addVendorMutation.mutate({
      name: vName,
      email: vEmail,
      phone: vPhone,
    });
  };

  const handleCreatePOSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!poVendor || !poProduct) {
      alert('Please select a vendor and product');
      return;
    }
    createPOMutation.mutate({
      vendor_id: poVendor,
      currency: 'USD',
      line_items: [
        {
          product_id: poProduct,
          quantity: Number(poQty),
          unit_price: Number(poPrice),
        }
      ]
    });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'draft':
        return 'text-slate-400 bg-slate-900 border-slate-800';
      case 'approved':
        return 'text-cyan-400 bg-cyan-950/20 border-cyan-800/30';
      case 'auto_generated':
        return 'text-indigo-400 bg-indigo-950/20 border-indigo-800/30';
      case 'sent':
        return 'text-amber-400 bg-amber-950/20 border-amber-900/30';
      case 'received':
        return 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30';
      case 'cancelled':
        return 'text-rose-400 bg-rose-950/20 border-rose-900/30';
      default:
        return 'text-slate-400 bg-slate-950/40 border-slate-850';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').toUpperCase();
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl font-black tracking-wider text-slate-100 uppercase">
              Procurement & Vendor Coordination
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
              Manage external suppliers, monitor automatic reorders, and audit purchase logs
            </p>
          </div>
          <div className="flex space-x-3">
            <button 
              onClick={() => setShowAddVendor(true)}
              className="flex items-center space-x-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4 text-cyan-400" />
              <span>ONBOARD VENDOR</span>
            </button>
            <button 
              onClick={() => {
                if (vendors.length > 0) setPoVendor(vendors[0].id);
                if (products.length > 0) setPoProduct(products[0].id);
                setShowCreatePO(true);
              }}
              className="flex items-center space-x-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 border border-cyan-500/20 px-4 py-2.5 text-xs font-bold text-slate-950 transition-all cursor-pointer"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>DRAFT PURCHASE ORDER</span>
            </button>
          </div>
        </div>

        {/* Add Vendor Form */}
        {showAddVendor && (
          <div className="glass-panel border border-slate-800 rounded-xl p-6 relative">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800/80 pb-2">
              Supplier Onboarding Pipeline
            </h2>
            <form onSubmit={handleAddVendorSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Vendor Name</label>
                <input 
                  type="text" 
                  value={vName} 
                  onChange={(e) => setVName(e.target.value)} 
                  required 
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200" 
                  placeholder="Apex Industrial Supply"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Email Address</label>
                <input 
                  type="email" 
                  value={vEmail} 
                  onChange={(e) => setVEmail(e.target.value)} 
                  required 
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200" 
                  placeholder="sales@apexindustrial.com"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Contact Number</label>
                <input 
                  type="text" 
                  value={vPhone} 
                  onChange={(e) => setVPhone(e.target.value)} 
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200" 
                  placeholder="+1-555-0199"
                />
              </div>
              <div className="md:col-span-3 flex justify-end space-x-3">
                <button 
                  type="button" 
                  onClick={() => setShowAddVendor(false)}
                  className="px-4 py-2.5 rounded-lg border border-slate-800 hover:bg-slate-900 text-xs font-bold text-slate-400 cursor-pointer"
                >
                  CANCEL
                </button>
                <button 
                  type="submit" 
                  disabled={addVendorMutation.isPending}
                  className="px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-slate-950 cursor-pointer disabled:opacity-50"
                >
                  {addVendorMutation.isPending ? 'ONBOARDING...' : 'REGISTER SUPPLIER'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Create PO Form */}
        {showCreatePO && (
          <div className="glass-panel border border-slate-800 rounded-xl p-6">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800/80 pb-2">
              Draft Procurement Transaction (PO)
            </h2>
            <form onSubmit={handleCreatePOSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Target Supplier</label>
                <select 
                  value={poVendor} 
                  onChange={(e) => setPoVendor(e.target.value)} 
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200"
                >
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.performance_score}% Perf.)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Select Catalog Item</label>
                <select 
                  value={poProduct} 
                  onChange={(e) => setPoProduct(e.target.value)} 
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Quantity Required</label>
                <input 
                  type="number" 
                  min="1"
                  value={poQty} 
                  onChange={(e) => setPoQty(Number(e.target.value))} 
                  required 
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200" 
                  placeholder="e.g. 100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Negotiated Unit Price (USD)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0.01"
                  value={poPrice} 
                  onChange={(e) => setPoPrice(Number(e.target.value))} 
                  required 
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200" 
                  placeholder="e.g. 12.50"
                />
              </div>
              <div className="md:col-span-2 flex justify-end space-x-3">
                <button 
                  type="button" 
                  onClick={() => setShowCreatePO(false)}
                  className="px-4 py-2.5 rounded-lg border border-slate-800 hover:bg-slate-900 text-xs font-bold text-slate-400 cursor-pointer"
                >
                  CANCEL
                </button>
                <button 
                  type="submit" 
                  disabled={createPOMutation.isPending}
                  className="px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-slate-950 cursor-pointer disabled:opacity-50"
                >
                  {createPOMutation.isPending ? 'CREATING...' : 'EMIT PURCHASE ORDER'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Data Cards & Tables */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Supplier Directory (Left 1 col) */}
          <div className="glass-panel border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-800/80">
              <Users className="h-5 w-5 text-cyan-400" />
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Supplier Directory</h2>
            </div>
            {loadingVendors ? (
              <div className="py-10 text-center text-xs font-bold tracking-wider text-slate-500 uppercase">Polling Supplier Registry...</div>
            ) : vendors.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">No active vendors registered. Onboard a vendor to proceed.</div>
            ) : (
              <div className="max-h-[480px] overflow-y-auto pr-1 space-y-2.5">
                {vendors.map(v => (
                  <div key={v.id} className="rounded-lg bg-slate-950/40 border border-slate-800/60 p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <h3 className="text-sm font-bold text-slate-200">{v.name}</h3>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        v.is_active 
                          ? 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30' 
                          : 'text-slate-500 bg-slate-900 border-slate-800'
                      }`}>
                        {v.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 space-y-0.5 font-medium">
                      <p>Email: {v.email}</p>
                      {v.contact && <p>Phone: {v.contact}</p>}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center">
                        <ShieldCheck className="h-3.5 w-3.5 mr-1 text-cyan-500" /> Quality Audit Score
                      </span>
                      <span className={`text-xs font-mono font-bold ${
                        v.performance_score >= 95 ? 'text-cyan-400' : 'text-amber-500'
                      }`}>{v.performance_score}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Purchase Orders Table (Right 2 cols) */}
          <div className="glass-panel border border-slate-800 rounded-xl p-5 lg:col-span-2 space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-800/80">
              <FileText className="h-5 w-5 text-cyan-400" />
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Purchase Order Logs</h2>
            </div>
            {loadingPOs ? (
              <div className="py-10 text-center text-xs font-bold tracking-wider text-slate-500 uppercase">Decrypting ledger logs...</div>
            ) : purchaseOrders.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">No purchase records found. Stock updates will trigger auto-orders.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-3">PO Reference ID</th>
                      <th className="pb-3">Vendor / Supplier</th>
                      <th className="pb-3 text-right">Ledger Amount</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Date Issued</th>
                      <th className="pb-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-sm text-slate-300">
                    {purchaseOrders.map(po => (
                      <tr key={po.id} className="hover:bg-slate-900/10 transition-colors">
                        <td className="py-3 font-mono font-semibold text-slate-200">
                          {po.id.substring(0, 8).toUpperCase()}...
                        </td>
                        <td className="py-3 text-slate-300 font-bold">
                          {po.vendor ? po.vendor.name : 'Unknown Vendor'}
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-cyan-400">
                          {po.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {po.currency}
                        </td>
                        <td className="py-3">
                          <span className={`text-[10px] font-bold px-2.5 py-0.75 rounded-full border ${getStatusBadgeClass(po.status)}`}>
                            {formatStatus(po.status)}
                          </span>
                        </td>
                        <td className="py-3 text-xs text-slate-400">
                          {new Date(po.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 text-center">
                          <Link 
                            href={`/procurement/${po.id}`}
                            className="inline-flex items-center space-x-1 text-xs font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-950/20 border border-cyan-900/20 px-2.5 py-1.5 rounded transition-all"
                          >
                            <span>DETAILS</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
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
