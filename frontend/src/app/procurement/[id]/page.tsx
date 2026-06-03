'use client';

import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  FileText, 
  ShieldCheck, 
  Trash2, 
  CheckCircle, 
  Calendar, 
  TrendingUp, 
  Activity 
} from 'lucide-react';

interface Vendor {
  id: string;
  name: string;
  email: string;
  contact: string;
  performance_score: number;
}

interface POLineItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
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
  line_items?: POLineItem[];
}

interface Product {
  id: string;
  sku: string;
  name: string;
}

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  // Fetch PO Details
  const { data: po, isLoading: loadingPO, error } = useQuery<PurchaseOrder>({
    queryKey: ['purchaseOrder', id],
    queryFn: () => apiFetch(`/procurement/po/${id}`),
  });

  // Fetch Products (for name resolution)
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => apiFetch('/inventory/products'),
  });

  // Mutation to update status
  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => apiFetch(`/procurement/po/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', id] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to update order status');
    }
  });

  const getProductName = (prodId: string) => {
    const prod = products.find(p => p.id === prodId);
    return prod ? `${prod.name} (${prod.sku})` : prodId;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'text-slate-400 border-slate-800 bg-slate-950/40';
      case 'approved':
        return 'text-cyan-400 border-cyan-800/30 bg-cyan-950/20';
      case 'auto_generated':
        return 'text-indigo-400 border-indigo-800/30 bg-indigo-950/20';
      case 'sent':
        return 'text-amber-400 border-amber-900/30 bg-amber-950/20';
      case 'received':
        return 'text-emerald-400 border-emerald-900/30 bg-emerald-950/20';
      case 'cancelled':
        return 'text-rose-400 border-rose-900/30 bg-rose-950/20';
      default:
        return 'text-slate-300 border-slate-800 bg-slate-900';
    }
  };

  if (loadingPO) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center text-slate-400">
          <div className="flex flex-col items-center space-y-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">DECRYPTING PURCHASE LEDGER...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !po) {
    return (
      <DashboardLayout>
        <div className="glass-panel border border-red-950/40 rounded-xl p-8 text-center space-y-4">
          <h2 className="text-lg font-bold text-red-400 uppercase tracking-wider">Failed to Load Purchase Order</h2>
          <p className="text-xs text-slate-400">The requested record does not exist or you lack authorization keys.</p>
          <button 
            onClick={() => router.push('/procurement')}
            className="inline-flex items-center space-x-2 rounded-lg bg-slate-900 border border-slate-850 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>RETURN TO DIRECTORY</span>
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const isAuto = po.status === 'auto_generated' || (po.correlation_id && po.correlation_id !== 'manual-po-no-trace');

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between">
          <Link 
            href="/procurement" 
            className="inline-flex items-center space-x-2 text-xs font-bold text-slate-400 hover:text-cyan-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>RETURN TO PROCUREMENT DIRECTORY</span>
          </Link>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${getStatusColor(po.status)}`}>
            {po.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        {/* E2E Trace Alert for automated workflows */}
        {isAuto && (
          <div className="rounded-xl border border-indigo-950 bg-indigo-950/10 p-4 flex items-start space-x-3.5 shadow-[0_0_20px_rgba(79,70,229,0.03)]">
            <Activity className="h-5 w-5 text-indigo-400 mt-0.5 animate-pulse" />
            <div>
              <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider">Automated Replenishment Flow Active</h3>
              <p className="text-xs text-slate-400 mt-1">
                This purchase record was initiated autonomously by the Inventory service following a low-stock threshold breach.
              </p>
              <div className="mt-2.5 flex items-center space-x-1.5 font-mono text-[10px] text-indigo-400/80">
                <span className="font-bold">TRACE CORRELATION ID:</span>
                <span className="bg-indigo-950/40 border border-indigo-900/30 px-2 py-0.5 rounded">{po.correlation_id}</span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel: PO details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Items Card */}
            <div className="glass-panel border border-slate-800 rounded-xl p-6 space-y-5">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-800">
                <FileText className="h-5 w-5 text-cyan-400" />
                <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Material Procurement List</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <th className="pb-3">Catalog Item Details</th>
                      <th className="pb-3 text-right">Order Quantity</th>
                      <th className="pb-3 text-right">Unit Rate (USD)</th>
                      <th className="pb-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 text-sm text-slate-300">
                    {po.line_items?.map(item => (
                      <tr key={item.id}>
                        <td className="py-3.5 font-semibold text-slate-200">
                          {getProductName(item.product_id)}
                        </td>
                        <td className="py-3.5 text-right font-mono font-bold text-slate-300">
                          {item.quantity.toLocaleString()}
                        </td>
                        <td className="py-3.5 text-right font-mono text-slate-400">
                          ${item.unit_price.toFixed(2)}
                        </td>
                        <td className="py-3.5 text-right font-mono font-bold text-cyan-400">
                          ${(item.quantity * item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Summary */}
              <div className="flex justify-between items-center pt-5 border-t border-slate-800/85">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Aggregate Purchase Amount</span>
                <span className="text-xl font-mono font-black text-cyan-400">
                  ${po.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {po.currency}
                </span>
              </div>
            </div>
          </div>

          {/* Right panel: Supplier info & Actions */}
          <div className="space-y-6">
            {/* Vendor Card */}
            <div className="glass-panel border border-slate-800 rounded-xl p-5 space-y-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 pb-2">Supplier Coordinates</h2>
              {po.vendor ? (
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Vendor Name</span>
                    <span className="text-sm font-bold text-slate-200 mt-0.5 block">{po.vendor.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Communications</span>
                    <span className="text-xs font-medium text-slate-400 mt-0.5 block">{po.vendor.email}</span>
                    {po.vendor.contact && (
                      <span className="text-xs text-slate-400 mt-0.5 block">{po.vendor.contact}</span>
                    )}
                  </div>
                  <div className="pt-2 border-t border-slate-900 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Compliance score</span>
                    <span className="text-xs font-mono font-bold text-cyan-400">{po.vendor.performance_score}%</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500">No supplier meta attached.</div>
              )}
            </div>

            {/* Meta Logs Card */}
            <div className="glass-panel border border-slate-800 rounded-xl p-5 space-y-3.5">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 pb-2">Transaction Meta</h2>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Record ID</span>
                <span className="font-mono text-slate-300 text-[11px]">{po.id}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Issued Date</span>
                <span className="text-slate-300 font-semibold">{new Date(po.created_at).toLocaleString()}</span>
              </div>
            </div>

            {/* Actions Card */}
            {po.status !== 'received' && po.status !== 'cancelled' && (
              <div className="glass-panel border border-slate-800 rounded-xl p-5 space-y-3.5">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 pb-2">Coordination Actions</h2>
                
                {po.status === 'auto_generated' || po.status === 'draft' ? (
                  <button 
                    onClick={() => updateStatusMutation.mutate('approved')}
                    disabled={updateStatusMutation.isPending}
                    className="flex w-full items-center justify-center space-x-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 px-4 py-2.5 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>APPROVE & SEND ORDER</span>
                  </button>
                ) : po.status === 'approved' || po.status === 'sent' ? (
                  <button 
                    onClick={() => updateStatusMutation.mutate('received')}
                    disabled={updateStatusMutation.isPending}
                    className="flex w-full items-center justify-center space-x-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-4 py-2.5 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>MARK AS SHIPPED & RECEIVED</span>
                  </button>
                ) : null}

                <button 
                  onClick={() => updateStatusMutation.mutate('cancelled')}
                  disabled={updateStatusMutation.isPending}
                  className="flex w-full items-center justify-center space-x-2 rounded-lg bg-slate-900 border border-slate-800 text-red-400 hover:bg-red-950/20 hover:border-red-900/30 px-4 py-2.5 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>CANCEL TRANSACTION</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
