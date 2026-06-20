'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#f8f9fb] px-4">
      <div className="max-w-md w-full bg-white border border-[#e2e8f0] rounded-sm p-10 text-center space-y-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-sm bg-[#fef2f2] border border-[#fecaca]">
          <ShieldAlert className="h-6 w-6 text-[#b91c1c]" />
        </div>
        
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-[#1e293b]">
            403 — Access Denied
          </h1>
          <p className="text-xs text-[#64748b]">
            Insufficient permissions for this resource
          </p>
        </div>

        <p className="text-[13px] text-[#475569] leading-relaxed">
          Your account does not have the required role to access this workspace. Contact your system administrator to request the appropriate access level.
        </p>

        <div className="pt-4 border-t border-[#e2e8f0]">
          <Link 
            href="/"
            className="btn-secondary inline-flex"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
