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
  Trash2, 
  CheckCircle, 
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="badge badge-neutral">Draft</span>;
      case 'approved':
        return <span className="badge badge-info">Approved</span>;
      case 'auto_generated':
        return <span className="badge badge-info">Auto Generated</span>;
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

  if (loadingPO) {
    return (
      <DashboardLayout>
        <div className="flex h-[50vh] items-center justify-center bg-[#f8f9fb]">
          <div className="flex flex-col items-center space-y-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1e3a5f] border-t-transparent"></div>
            <span className="text-[11px] font-semibold text-[#64748b]">Decrypting Purchase Ledger...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !po) {
    return (
      <DashboardLayout>
        <div className="bg-white border border-[#b91c1c] rounded-sm p-6 text-center space-y-4 max-w-md mx-auto">
          <h2 className="text-lg font-bold text-[#b91c1c] uppercase">Failed to Load Purchase Order</h2>
          <p className="text-[13px] text-[#64748b]">The requested record does not exist or you lack authorization keys.</p>
          <button 
            onClick={() => router.push('/procurement')}
            className="btn-secondary inline-flex"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Directory</span>
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const isAuto = po.status === 'auto_generated' || (po.correlation_id && po.correlation_id !== 'manual-po-no-trace');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Breadcrumb & Navigation */}
        <div className="flex justify-between items-center pb-2 border-b border-[#e2e8f0]">
          <Link 
            href="/procurement" 
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748b] hover:text-[#1e3a5f]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Directory</span>
          </Link>
          {getStatusBadge(po.status)}
        </div>

        {/* E2E Trace Alert for automated workflows */}
        {isAuto && (
          <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-sm p-4 flex gap-3.5">
            <Activity className="h-5 w-5 text-[#1e3a5f] flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-bold uppercase text-[#1e3a5f]">Automated Replenishment Flow Active</h3>
              <p className="text-[12px] text-[#475569] mt-1">
                This purchase record was initiated autonomously by the Inventory service following a low-stock threshold breach.
              </p>
              <div className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-[#64748b]">
                <span className="font-bold">TRACE ID:</span>
                <span className="bg-white border border-[#e2e8f0] px-2 py-0.5 rounded-sm">{po.correlation_id}</span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left panel: PO details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-[#e2e8f0] rounded-sm p-5">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#f1f5f9]">
                <FileText className="h-4 w-4 text-[#1e3a5f]" />
                <h2 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">Material Procurement List</h2>
              </div>
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>Catalog Item Details</th>
                      <th className="text-right">Order Quantity</th>
                      <th className="text-right">Unit Rate (USD)</th>
                      <th className="text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.line_items?.map(item => (
                      <tr key={item.id}>
                        <td className="font-semibold text-[#1e293b]">
                          {getProductName(item.product_id)}
                        </td>
                        <td className="text-right font-mono font-bold text-[#334155]">
                          {item.quantity.toLocaleString()}
                        </td>
                        <td className="text-right font-mono text-[#64748b]">
                          ${item.unit_price.toFixed(2)}
                        </td>
                        <td className="text-right font-mono font-bold text-[#1e3a5f]">
                          ${(item.quantity * item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Summary */}
              <div className="flex justify-between items-center pt-4 mt-4 border-t border-[#f1f5f9]">
                <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-widest">Aggregate Purchase Amount</span>
                <span className="text-lg font-mono font-bold text-[#1e3a5f]">
                  ${po.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {po.currency}
                </span>
              </div>
            </div>
          </div>

          {/* Right panel: Supplier info & Actions */}
          <div className="space-y-5">
            {/* Vendor Card */}
            <div className="bg-white border border-[#e2e8f0] rounded-sm p-5">
              <h2 className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider border-b border-[#f1f5f9] pb-2 mb-3">Supplier Coordinates</h2>
              {po.vendor ? (
                <div className="space-y-3 text-[13px] text-[#334155]">
                  <div>
                    <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-widest block font-sans">Vendor Name</span>
                    <span className="font-bold text-[#1e293b] mt-0.5 block">{po.vendor.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-widest block font-sans">Communications</span>
                    <span className="text-xs text-[#64748b] mt-0.5 block">{po.vendor.email}</span>
                    {po.vendor.contact && (
                      <span className="text-xs text-[#64748b] mt-0.5 block">{po.vendor.contact}</span>
                    )}
                  </div>
                  <div className="pt-2.5 mt-2.5 border-t border-[#f1f5f9] flex justify-between items-center">
                    <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-widest">Quality score</span>
                    <span className="text-[12px] font-mono font-bold text-[#1e3a5f]">{po.vendor.performance_score}%</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[#94a3b8]">No supplier metadata attached.</div>
              )}
            </div>

            {/* Meta Logs Card */}
            <div className="bg-white border border-[#e2e8f0] rounded-sm p-5 space-y-3">
              <h2 className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider border-b border-[#f1f5f9] pb-2 mb-1">Transaction Meta</h2>
              <div className="flex items-center justify-between text-xs text-[#475569]">
                <span>Record ID</span>
                <span className="font-mono text-[#334155]">{po.id.substring(0,8).toUpperCase()}...</span>
              </div>
              <div className="flex items-center justify-between text-xs text-[#475569]">
                <span>Issued Date</span>
                <span className="text-[#334155] font-semibold">{new Date(po.created_at).toLocaleString()}</span>
              </div>
            </div>

            {/* Actions Card */}
            {po.status !== 'received' && po.status !== 'cancelled' && (
              <div className="bg-white border border-[#e2e8f0] rounded-sm p-5 space-y-3">
                <h2 className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider border-b border-[#f1f5f9] pb-2">Coordination Actions</h2>
                
                {po.status === 'auto_generated' || po.status === 'draft' ? (
                  <button 
                    onClick={() => updateStatusMutation.mutate('approved')}
                    disabled={updateStatusMutation.isPending}
                    className="btn-primary w-full"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Approve & Send Order</span>
                  </button>
                ) : po.status === 'approved' || po.status === 'sent' ? (
                  <button 
                    onClick={() => updateStatusMutation.mutate('received')}
                    disabled={updateStatusMutation.isPending}
                    className="btn-primary w-full"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Mark as Received</span>
                  </button>
                ) : null}

                <button 
                  onClick={() => updateStatusMutation.mutate('cancelled')}
                  disabled={updateStatusMutation.isPending}
                  className="btn-destructive w-full"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Cancel Transaction</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
