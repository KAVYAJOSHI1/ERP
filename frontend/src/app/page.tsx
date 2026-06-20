'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Package, 
  ShoppingCart,
  Factory,
  Coins,
  ArrowRight,
  Shield,
  Activity,
  Server
} from 'lucide-react';

// API Interfaces
interface Product { id: string; name: string; sku: string; category: string; }
interface PurchaseOrder { id: string; vendor_id: string; status: string; total_amount: number; created_at: string; }
interface WorkCenter { id: string; name: string; status: string; }
interface LedgerEntry { id: string; amount: number; type: 'debit' | 'credit'; description: string; created_at: string; }

export default function DashboardPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const userRole = user?.role || 'viewer';
  const [isRedirecting, setIsRedirecting] = useState(true);

  // Redirect users to their specific workspaces if they have dedicated roles
  useEffect(() => {
    if (userRole === 'warehouse_manager' || userRole === 'inventory_manager') {
      router.replace('/inventory');
    } else if (userRole === 'procurement_manager' || userRole === 'procurement_specialist') {
      router.replace('/procurement');
    } else if (userRole === 'production_manager' || userRole === 'shop_floor_supervisor') {
      router.replace('/production');
    } else if (userRole === 'finance_manager' || userRole === 'cfo') {
      router.replace('/finance');
    } else {
      setIsRedirecting(false);
    }
  }, [userRole, router]);

  // Fetch Consolidated Queries for Admins / Executive Viewers
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => apiFetch('/inventory/products'),
    enabled: !isRedirecting
  });

  const { data: purchaseOrders = [] } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchaseOrders'],
    queryFn: () => apiFetch('/procurement/po'),
    enabled: !isRedirecting
  });

  const { data: workCenters = [] } = useQuery<WorkCenter[]>({
    queryKey: ['workCenters'],
    queryFn: () => apiFetch('/production/wc'),
    enabled: !isRedirecting
  });

  const { data: ledgerEntries = [] } = useQuery<LedgerEntry[]>({
    queryKey: ['ledgerEntries'],
    queryFn: () => apiFetch('/finance/ledger'),
    enabled: !isRedirecting
  });

  if (isRedirecting) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#f8f9fb]">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1e3a5f] border-t-transparent"></div>
          <span className="text-[11px] font-semibold text-[#64748b]">Routing to Authorized Workspace...</span>
        </div>
      </div>
    );
  }

  const netBalance = ledgerEntries.reduce((sum, item) => {
    return item.type === 'credit' ? sum + item.amount : sum - item.amount;
  }, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-[#1e293b]">Executive Operations Hub</h1>
            <p className="text-[12px] text-[#64748b] mt-0.5">
              Consolidated enterprise overview and workspace access portal
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="live-indicator"></span>
            <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">System Live</span>
          </div>
        </div>

        {/* Consolidated Telemetry Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5 hover:border-[#cbd5e1] transition-colors">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-semibold text-[#64748b] uppercase">SKU Catalog</span>
              <Package className="h-4 w-4 text-[#94a3b8]" />
            </div>
            <div className="mt-4 flex justify-between items-baseline">
              <span className="text-2xl font-bold text-[#1e293b] font-mono">{products.length}</span>
              <Link href="/inventory" className="text-[10px] font-bold text-[#1e3a5f] uppercase tracking-wide hover:underline inline-flex items-center gap-0.5">
                Manage <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5 hover:border-[#cbd5e1] transition-colors">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-semibold text-[#64748b] uppercase">Purchase Orders</span>
              <ShoppingCart className="h-4 w-4 text-[#94a3b8]" />
            </div>
            <div className="mt-4 flex justify-between items-baseline">
              <span className="text-2xl font-bold text-[#1e293b] font-mono">{purchaseOrders.length}</span>
              <Link href="/procurement" className="text-[10px] font-bold text-[#1e3a5f] uppercase tracking-wide hover:underline inline-flex items-center gap-0.5">
                Review <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5 hover:border-[#cbd5e1] transition-colors">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-semibold text-[#64748b] uppercase">Active Work Centers</span>
              <Factory className="h-4 w-4 text-[#94a3b8]" />
            </div>
            <div className="mt-4 flex justify-between items-baseline">
              <span className="text-2xl font-bold text-[#1e293b] font-mono">
                {workCenters.filter(w => w.status === 'active').length}
              </span>
              <Link href="/production" className="text-[10px] font-bold text-[#1e3a5f] uppercase tracking-wide hover:underline inline-flex items-center gap-0.5">
                Monitor <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5 hover:border-[#cbd5e1] transition-colors">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-semibold text-[#64748b] uppercase">Net Cash Balance</span>
              <Coins className="h-4 w-4 text-[#94a3b8]" />
            </div>
            <div className="mt-4 flex justify-between items-baseline">
              <span className="text-2xl font-bold text-[#1e293b] font-mono">
                ${netBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <Link href="/finance" className="text-[10px] font-bold text-[#1e3a5f] uppercase tracking-wide hover:underline inline-flex items-center gap-0.5">
                Ledger <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Central Directory and System Health */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          
          {/* Service Status Monitoring */}
          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5 lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#f1f5f9]">
              <Server className="h-4 w-4 text-[#1e3a5f]" />
              <h2 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">System-wide Telemetry Status</h2>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-3.5 rounded-sm bg-[#f8fafc] border border-[#f1f5f9]">
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-[#16a34a]"></span>
                  <span className="text-xs font-semibold text-[#334155]">Kafka Event Broker Pipeline</span>
                </div>
                <span className="badge badge-success">Connected</span>
              </div>
              <div className="flex justify-between items-center p-3.5 rounded-sm bg-[#f8fafc] border border-[#f1f5f9]">
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-[#16a34a]"></span>
                  <span className="text-xs font-semibold text-[#334155]">Prometheus Metric Storage</span>
                </div>
                <span className="badge badge-success">Online</span>
              </div>
              <div className="flex justify-between items-center p-3.5 rounded-sm bg-[#f8fafc] border border-[#f1f5f9]">
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-[#16a34a]"></span>
                  <span className="text-xs font-semibold text-[#334155]">Jaeger Distributed Tracing</span>
                </div>
                <span className="badge badge-success">Online</span>
              </div>
            </div>
          </div>

          {/* User & Diagnostics Card */}
          <div className="bg-white border border-[#1e3a5f] rounded-sm p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#f1f5f9]">
              <Shield className="h-4 w-4 text-[#1e3a5f]" />
              <h2 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">Admin Diagnostics</h2>
            </div>
            <div className="space-y-3 text-xs text-[#475569]">
              <div className="flex justify-between">
                <span>Identity:</span>
                <span className="font-bold text-[#1e293b]">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span>Access Role:</span>
                <span className="font-bold text-[#1e3a5f] uppercase">{userRole}</span>
              </div>
              <div className="flex justify-between">
                <span>Domain Scope:</span>
                <span className="font-bold text-[#1e3a5f] uppercase">Global Tenant</span>
              </div>
              <div className="pt-4 border-t border-[#f1f5f9]">
                <Link href="/users" className="btn-secondary w-full text-center">
                  Manage Team RBAC Roles
                </Link>
              </div>
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
