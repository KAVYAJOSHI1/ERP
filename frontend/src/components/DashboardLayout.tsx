'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { useTelemetrySocket } from '@/hooks/useTelemetrySocket';
import CriticalAlertBanner from './CriticalAlertBanner';
import { 
  LayoutDashboard, 
  Warehouse, 
  ShoppingCart, 
  BrainCircuit, 
  Coins, 
  Factory, 
  FileCheck2, 
  LogOut,
  User,
  Shield,
  Menu,
  X,
  Users,
  Activity
} from 'lucide-react';

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  roles: string[];
}

const sidebarItems: SidebarItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'warehouse_manager', 'inventory_manager', 'procurement_manager', 'procurement_specialist', 'production_manager', 'shop_floor_supervisor', 'finance_manager', 'cfo', 'viewer'] },
  { name: 'Inventory', href: '/inventory', icon: Warehouse, roles: ['admin', 'warehouse_manager', 'inventory_manager', 'viewer'] },
  { name: 'Procurement', href: '/procurement', icon: ShoppingCart, roles: ['admin', 'procurement_manager', 'procurement_specialist', 'viewer'] },
  { name: 'Production', href: '/production', icon: Factory, roles: ['admin', 'production_manager', 'shop_floor_supervisor', 'viewer'] },
  { name: 'Finance & Ledger', href: '/finance', icon: Coins, roles: ['admin', 'finance_manager', 'cfo', 'viewer'] },
  { name: 'AI Intelligence', href: '/intelligence', icon: BrainCircuit, roles: ['admin', 'warehouse_manager', 'inventory_manager', 'procurement_manager', 'procurement_specialist', 'production_manager', 'shop_floor_supervisor', 'finance_manager', 'cfo', 'viewer'] },
  { name: 'Audit Logs', href: '/audit', icon: FileCheck2, roles: ['admin', 'viewer'] },
  { name: 'User Directory', href: '/users', icon: Users, roles: ['admin', 'viewer'] },
  { name: 'System Observability', href: '/observability', icon: Activity, roles: ['admin', 'viewer'] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, clearAuth } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useTelemetrySocket();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && !isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isMounted, isAuthenticated, router, pathname]);

  if (!isMounted || !isAuthenticated || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#f8f9fb]">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1e3a5f] border-t-transparent"></div>
          <span className="text-[11px] font-semibold tracking-wide text-[#64748b]">Loading...</span>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  const filteredItems = sidebarItems.filter(item => item.roles.includes(user.role));

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f8f9fb]">
      <CriticalAlertBanner />

      {/* Mobile Top Bar */}
      <div className="flex h-14 w-full items-center justify-between border-b border-[#e2e8f0] bg-white px-4 md:hidden fixed top-0 left-0 z-30">
        <span className="text-[13px] font-bold text-[#1e293b]">APEX ERP</span>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-1 text-[#64748b] hover:bg-[#f1f5f9] rounded-sm"
        >
          {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-[#e2e8f0] bg-white transition-transform duration-200 md:translate-x-0 md:static
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand */}
        <div className="flex h-14 items-center px-5 border-b border-[#e2e8f0]">
          <span className="text-[13px] font-bold tracking-wide text-[#1e293b]">
            APEX ERP
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          <div className="px-2 mb-3 text-[10px] font-semibold tracking-widest text-[#94a3b8] uppercase">Modules</div>
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href}
                href={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={`
                  flex items-center gap-2.5 rounded-sm px-2.5 py-[7px] text-[12px] font-medium transition-colors
                  ${isActive 
                    ? 'bg-[#eff6ff] text-[#1e3a5f] font-semibold' 
                    : 'text-[#475569] hover:bg-[#f8fafc] hover:text-[#1e293b]'}
                `}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-[#1e3a5f]' : 'text-[#94a3b8]'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="border-t border-[#e2e8f0] p-3">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-[#f1f5f9] border border-[#e2e8f0]">
              <User className="h-3.5 w-3.5 text-[#64748b]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-[11px] font-semibold text-[#1e293b]">{user.email}</p>
              <p className="text-[10px] text-[#94a3b8] uppercase tracking-wide">{user.role.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-1.5 rounded-sm border border-[#e2e8f0] bg-white hover:bg-[#fef2f2] hover:text-[#b91c1c] hover:border-[#fecaca] px-2.5 py-[6px] text-[11px] font-semibold text-[#64748b] transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-screen pt-14 md:pt-0">
        <main className="flex-1 overflow-y-auto p-5 md:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
