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
  ShieldCheck
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
      setVName(''); setVEmail(''); setVPhone('');
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
      setPoQty(1); setPoPrice(10.0);
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to create purchase order');
    }
  });

  const handleAddVendorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addVendorMutation.mutate({ name: vName, email: vEmail, phone: vPhone });
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="badge badge-neutral">Draft</span>;
      case 'approved':
        return <span className="badge badge-info">Approved</span>;
      case 'auto_generated':
        return <span className="badge badge-info">Auto PO</span>;
      case 'sent':
        return <span className="badge badge-warning">Sent</span>;
      case 'received':
        return <span className="badge badge-success">Received</span>;
      case 'cancelled':
        return <span className="badge badge-danger">Cancelled</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-[#1e293b] flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-[#1e3a5f]" />
              Procurement & Vendor Coordination
            </h1>
            <p className="text-[12px] text-[#64748b] mt-0.5">
              Manage external suppliers, monitor automatic reorders, and audit purchase logs
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAddVendor(true)} className="btn-secondary">
              <Plus className="h-3.5 w-3.5" />
              <span>Onboard Vendor</span>
            </button>
            <button 
              onClick={() => {
                if (vendors.length > 0) setPoVendor(vendors[0].id);
                if (products.length > 0) setPoProduct(products[0].id);
                setShowCreatePO(true);
              }}
              className="btn-primary"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              <span>Draft Purchase Order</span>
            </button>
          </div>
        </div>

        {/* Add Vendor Form */}
        {showAddVendor && (
          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5">
            <div className="section-title">Supplier Onboarding Pipeline</div>
            <form onSubmit={handleAddVendorSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="field-label">Vendor Name</label>
                <input type="text" value={vName} onChange={(e) => setVName(e.target.value)} required placeholder="Apex Industrial Supply" />
              </div>
              <div>
                <label className="field-label">Email Address</label>
                <input type="email" value={vEmail} onChange={(e) => setVEmail(e.target.value)} required placeholder="sales@apexindustrial.com" />
              </div>
              <div>
                <label className="field-label">Contact Number</label>
                <input type="text" value={vPhone} onChange={(e) => setVPhone(e.target.value)} placeholder="+1-555-0199" />
              </div>
              <div className="md:col-span-3 flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddVendor(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={addVendorMutation.isPending} className="btn-primary">
                  {addVendorMutation.isPending ? 'Onboarding...' : 'Register Supplier'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Create PO Form */}
        {showCreatePO && (
          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5">
            <div className="section-title">Draft Procurement Transaction (PO)</div>
            <form onSubmit={handleCreatePOSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="field-label">Target Supplier</label>
                <select value={poVendor} onChange={(e) => setPoVendor(e.target.value)}>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.performance_score}% Perf.)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Select Catalog Item</label>
                <select value={poProduct} onChange={(e) => setPoProduct(e.target.value)}>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Quantity Required</label>
                <input type="number" min="1" value={poQty} onChange={(e) => setPoQty(Number(e.target.value))} required placeholder="e.g. 100" />
              </div>
              <div>
                <label className="field-label">Negotiated Unit Price (USD)</label>
                <input type="number" step="0.01" min="0.01" value={poPrice} onChange={(e) => setPoPrice(Number(e.target.value))} required placeholder="e.g. 12.50" />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreatePO(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={createPOMutation.isPending} className="btn-primary">
                  {createPOMutation.isPending ? 'Creating...' : 'Emit Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Data Panels */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Supplier Directory */}
          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#f1f5f9]">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#1e3a5f]" />
                <h2 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">Supplier Directory</h2>
              </div>
            </div>
            {loadingVendors ? (
              <div className="py-8 text-center text-[12px] text-[#94a3b8]">Polling Suppliers...</div>
            ) : vendors.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-[#94a3b8]">No active vendors registered.</div>
            ) : (
              <div className="max-h-[480px] overflow-y-auto space-y-2">
                {vendors.map(v => (
                  <div key={v.id} className="p-3 bg-[#f8fafc] border border-[#f1f5f9] rounded-sm">
                    <div className="flex justify-between items-start">
                      <h3 className="text-[13px] font-semibold text-[#1e293b]">{v.name}</h3>
                      {v.is_active ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge badge-neutral">Inactive</span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#64748b] mt-1 space-y-0.5">
                      <p>Email: {v.email}</p>
                      {v.contact && <p>Phone: {v.contact}</p>}
                    </div>
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#f1f5f9]">
                      <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider flex items-center">
                        <ShieldCheck className="h-3.5 w-3.5 mr-1 text-[#1e3a5f]" /> Audit Score
                      </span>
                      <span className="text-[12px] font-mono font-bold text-[#1e3a5f]">{v.performance_score}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Purchase Orders */}
          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5 lg:col-span-2">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#f1f5f9]">
              <FileText className="h-4 w-4 text-[#1e3a5f]" />
              <h2 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">Purchase Order Logs</h2>
            </div>
            {loadingPOs ? (
              <div className="py-8 text-center text-[12px] text-[#94a3b8]">Decrypting ledger logs...</div>
            ) : purchaseOrders.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-[#94a3b8]">No purchase records found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>PO Reference</th>
                      <th>Supplier</th>
                      <th className="text-right">Ledger Amount</th>
                      <th>Status</th>
                      <th>Issued Date</th>
                      <th className="text-center">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseOrders.map(po => (
                      <tr key={po.id}>
                        <td className="font-mono font-bold text-[#1e293b]">{po.id.substring(0, 8).toUpperCase()}...</td>
                        <td className="font-semibold text-[#334155]">{po.vendor ? po.vendor.name : 'Unknown'}</td>
                        <td className="text-right font-mono font-bold text-[#1e3a5f]">
                          {po.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {po.currency}
                        </td>
                        <td>{getStatusBadge(po.status)}</td>
                        <td className="text-[12px] text-[#64748b]">{new Date(po.created_at).toLocaleDateString()}</td>
                        <td className="text-center">
                          <Link 
                            href={`/procurement/${po.id}`}
                            className="btn-secondary !py-1 !px-2.5 !text-[10px]"
                          >
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
