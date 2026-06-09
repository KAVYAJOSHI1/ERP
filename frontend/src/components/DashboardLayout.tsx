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
  X
} from 'lucide-react';

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  roles: string[];
}

const sidebarItems: SidebarItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'warehouse_manager', 'procurement_manager', 'production_manager', 'finance_manager', 'viewer'] },
  { name: 'Inventory', href: '/inventory', icon: Warehouse, roles: ['admin', 'warehouse_manager', 'viewer'] },
  { name: 'Procurement', href: '/procurement', icon: ShoppingCart, roles: ['admin', 'procurement_manager', 'viewer'] },
  { name: 'Production', href: '/production', icon: Factory, roles: ['admin', 'production_manager', 'viewer'] },
  { name: 'Finance & Ledger', href: '/finance', icon: Coins, roles: ['admin', 'finance_manager', 'viewer'] },
  { name: 'AI Intelligence', href: '/intelligence', icon: BrainCircuit, roles: ['admin', 'warehouse_manager', 'procurement_manager', 'production_manager', 'finance_manager', 'viewer'] },
  { name: 'Audit Logs', href: '/audit', icon: FileCheck2, roles: ['admin', 'viewer'] },
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
      router.push('/login');
    }
  }, [isMounted, isAuthenticated, router]);

  if (!isMounted || !isAuthenticated || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#090d16] text-slate-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent shadow-[0_0_15px_rgba(6,182,212,0.4)]"></div>
          <span className="text-sm font-semibold tracking-wider text-cyan-400">LOADING ERP RUNTIME...</span>
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
    <div className="flex h-screen w-screen overflow-hidden bg-[#090d16]">
      <CriticalAlertBanner />
      {/* Mobile Top Bar */}
      <div className="flex h-16 w-full items-center justify-between border-b border-slate-800 bg-[#0f172a]/80 px-4 md:hidden fixed top-0 left-0 z-30 backdrop-blur-md">
        <div className="flex items-center space-x-2">
          <BrainCircuit className="h-6 w-6 text-cyan-400" />
          <span className="text-lg font-black tracking-wider text-slate-100 uppercase">Industrial <span className="text-cyan-400">ERP</span></span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Sidebar (Desktop & Mobile drawer) */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800 bg-[#0b0f19] transition-transform duration-300 md:translate-x-0 md:static
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand */}
        <div className="flex h-20 items-center justify-center border-b border-slate-800 bg-[#0f172a]/30 px-6">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-950/50 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
              <BrainCircuit className="h-5 w-5 text-cyan-400 animate-pulse" />
            </div>
            <span className="text-base font-extrabold tracking-widest text-slate-100 uppercase">
              APEX <span className="text-cyan-400">ERP</span>
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5">
          <div className="mb-2 px-3 text-[10px] font-bold tracking-widest text-slate-500 uppercase">Control Center</div>
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href}
                href={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={`
                  flex items-center space-x-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all duration-200 group
                  ${isActive 
                    ? 'bg-cyan-950/30 text-cyan-400 border border-cyan-800/30 shadow-[0_0_15px_rgba(6,182,212,0.05)]' 
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100 border border-transparent'}
                `}
              >
                <Icon className={`h-5 w-5 transition-colors ${isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-cyan-400'}`} />
                <span>{item.name}</span>
                {isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]"></span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile Info */}
        <div className="border-t border-slate-800 bg-[#0f172a]/20 p-4">
          <div className="flex items-center space-x-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800/50 border border-slate-700">
              <User className="h-4 w-4 text-slate-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-bold text-slate-200">{user.email}</p>
              <div className="flex items-center space-x-1 mt-0.5">
                <Shield className="h-3 w-3 text-cyan-400" />
                <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider">{user.role.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex w-full items-center justify-center space-x-2 rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs font-bold text-slate-400 hover:bg-red-950/20 hover:text-red-400 hover:border-red-900/30 transition-all duration-200 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>TERMINATE SESSION</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-screen pt-16 md:pt-0">
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
