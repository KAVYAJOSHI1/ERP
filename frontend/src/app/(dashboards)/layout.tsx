'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

// Allowed path prefixes for each role
const ROLE_ALLOWED_PATHS: Record<string, string[]> = {
  inventory_manager: ['/inventory', '/intelligence', '/'],
  warehouse_manager: ['/inventory', '/intelligence', '/'],
  procurement_specialist: ['/procurement', '/intelligence', '/'],
  procurement_manager: ['/procurement', '/intelligence', '/'],
  shop_floor_supervisor: ['/production', '/intelligence', '/'],
  production_manager: ['/production', '/intelligence', '/'],
  cfo: ['/finance', '/intelligence', '/'],
  finance_manager: ['/finance', '/intelligence', '/'],
};

export default function DashboardsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuthStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    if (!isAuthenticated || !user) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    const role = user.role;
    // Admins and viewers can access all paths
    if (role === 'admin' || role === 'viewer') return;

    const allowedPaths = ROLE_ALLOWED_PATHS[role];
    if (allowedPaths) {
      // Check if pathname starts with any of the allowed path prefixes
      const isAllowed = allowedPaths.some(p => {
        if (p === '/') return pathname === '/';
        return pathname.startsWith(p);
      });

      if (!isAllowed) {
        router.push('/unauthorized');
      }
    }
  }, [isMounted, isAuthenticated, user, pathname, router]);

  if (!isMounted || !isAuthenticated || !user) {
    return null;
  }

  return <>{children}</>;
}
