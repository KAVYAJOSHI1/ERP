'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { apiFetch } from '@/lib/api';
import { AlertTriangle, ShieldCheck, Mail, Key, Lock, ArrowRight, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fb]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1e3a5f] border-t-transparent"></div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '';

  const { setAuth, isAuthenticated } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && isAuthenticated) {
      router.push(redirect || '/');
    }
  }, [isMounted, isAuthenticated, router, redirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ email, password }),
      });

      setAuth(data.user, data.access_token, data.refresh_token);
      router.push(redirect || '/');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (selectedEmail: string, redirectTarget: string) => {
    setError(null);
    setLoading(true);

    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ email: selectedEmail, password: 'admin123' }),
      });

      setAuth(data.user, data.access_token, data.refresh_token);
      router.push(redirectTarget);
    } catch (err: any) {
      setError(err.message || 'Authentication failed for profile.');
    } finally {
      setLoading(false);
    }
  };

  const getBrandingForPath = (path: string) => {
    const p = path.toLowerCase();
    if (p.includes('/inventory')) {
      return {
        title: 'Inventory Control sign-in',
        subtitle: 'Secure log-in required for SKU levels, stock quarantine, and telemetry',
        color: '#1e3a5f'
      };
    }
    if (p.includes('/procurement')) {
      return {
        title: 'Procurement Hub sign-in',
        subtitle: 'Secure log-in required for PO dispatch and vendor scores',
        color: '#1e3a5f'
      };
    }
    if (p.includes('/production')) {
      return {
        title: 'Shop Floor Production sign-in',
        subtitle: 'Secure log-in required for BOM and execution logs',
        color: '#1e3a5f'
      };
    }
    if (p.includes('/finance')) {
      return {
        title: 'Corporate Ledger & Finance sign-in',
        subtitle: 'Secure log-in required for ledger entries and double-entry journals',
        color: '#1e3a5f'
      };
    }
    if (p.includes('/audit')) {
      return {
        title: 'Distributed Transaction Audit sign-in',
        subtitle: 'Secure log-in required to inspect outbox logs and trace payloads',
        color: '#1e3a5f'
      };
    }
    if (p.includes('/observability')) {
      return {
        title: 'Observability & Telemetry sign-in',
        subtitle: 'Secure log-in required for Prometheus metrics and Jaeger logs',
        color: '#1e3a5f'
      };
    }
    if (p.includes('/users')) {
      return {
        title: 'Identity & Access Management sign-in',
        subtitle: 'Secure log-in required to onboard users and provision credentials',
        color: '#1e3a5f'
      };
    }
    if (p.includes('/intelligence')) {
      return {
        title: 'Predictive Intelligence sign-in',
        subtitle: 'Secure log-in required for neural heuristics and demand forecasting',
        color: '#1e3a5f'
      };
    }
    return {
      title: 'APEX ERP Workspace sign-in',
      subtitle: 'Smart Manufacturing & Supply Chain Intelligence Platform',
      color: '#1e3a5f'
    };
  };

  const branding = getBrandingForPath(redirect);

  const quickProfiles = [
    {
      label: 'Inventory Manager',
      email: 'inventory@erp.com',
      target: '/inventory',
      badge: 'Inventory Console'
    },
    {
      label: 'Procurement Specialist',
      email: 'procurement@erp.com',
      target: '/procurement',
      badge: 'Procurement Hub'
    },
    {
      label: 'Shop Floor Supervisor',
      email: 'production@erp.com',
      target: '/production',
      badge: 'Production Line'
    },
    {
      label: 'CFO / Ledger Admin',
      email: 'finance@erp.com',
      target: '/finance',
      badge: 'Finance Ledger'
    },
    {
      label: 'Executive Viewer',
      email: 'viewer@erp.com',
      target: '/',
      badge: 'Read-Only Hub'
    },
    {
      label: 'System Administrator',
      email: 'admin@erp.com',
      target: '/',
      badge: 'Global IAM/Audit'
    }
  ];

  if (!isMounted) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f9fb] px-4 py-8 sm:py-12">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-stretch">
        
        {/* Left Column: Form Card */}
        <div className="bg-white rounded-md border border-[#e2e8f0] p-6 sm:p-8 flex flex-col justify-between shadow-sm">
          <div>
            <div className="mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-[#1e293b] tracking-tight flex items-center gap-2">
                <span className="h-3 w-3 bg-[#1e3a5f] rounded-full inline-block"></span>
                APEX ERP
              </h1>
              <p className="mt-1 text-[11px] text-[#64748b] uppercase tracking-wider font-semibold">
                Enterprise Workspace Environment
              </p>
            </div>

            <div className="mb-6 flex items-start gap-3 bg-[#f8fafc] border border-[#e2e8f0] p-4 rounded-md">
              <Lock className="h-5 w-5 text-[#1e3a5f] mt-0.5 flex-shrink-0" />
              <div>
                <h2 className="text-[12px] font-bold text-[#1e293b] uppercase tracking-wider">{branding.title}</h2>
                <p className="text-[11px] text-[#64748b] mt-0.5 leading-relaxed">{branding.subtitle}</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="flex items-start gap-2.5 rounded-md border border-[#fecaca] bg-[#fef2f2] p-3 text.12px text-[#991b1b]">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p className="font-medium text-[12px] leading-tight flex-1">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="email-address" className="field-label">
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748b] pointer-events-none z-10" />
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="inventory@erp.com"
                    style={{ paddingLeft: '2.5rem', paddingRight: '1rem' }}
                    className="w-full py-2.5 text-[13px] bg-white border border-[#d1d5db] rounded-md focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f] outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="field-label">
                  Password
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748b] pointer-events-none z-10" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password (e.g. admin123)"
                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                    className="w-full py-2.5 text-[13px] bg-white border border-[#d1d5db] rounded-md focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f] outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#1e3a5f] p-1 rounded transition-colors z-10"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-2.5 text-[12px] font-bold tracking-wider rounded-md shadow-sm transition-all"
                >
                  {loading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mx-auto"></div>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="mt-8 border-t border-[#f1f5f9] pt-4 text-center">
            <span className="text-[10px] text-[#94a3b8]">
              Authorized access only. All transaction activity is fully audited.
            </span>
          </div>
        </div>

        {/* Right Column: Quick Profile Switcher */}
        <div className="bg-white rounded-md border border-[#e2e8f0] p-6 sm:p-8 flex flex-col justify-between shadow-sm">
          <div>
            <div className="mb-4 flex items-center justify-between border-b border-[#f1f5f9] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#1e3a5f]" />
                <h2 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">Quick Sign-In Switcher</h2>
              </div>
              <span className="text-[10px] text-[#1e3a5f] bg-[#eff6ff] px-2 py-0.5 rounded font-mono font-semibold">DEMO MODE</span>
            </div>
            
            <p className="text-[12px] text-[#64748b] mb-4 leading-relaxed">
              Select an enterprise department profile below to instantly log in and redirect to the corresponding workspace page.
            </p>

            <div className="space-y-2.5">
              {quickProfiles.map((p) => (
                <button
                  key={p.email}
                  type="button"
                  onClick={() => handleQuickLogin(p.email, p.target)}
                  className="w-full text-left p-3 bg-[#f8fafc] border border-[#e2e8f0] hover:border-[#cbd5e1] hover:bg-[#f1f5f9] transition-all rounded-md flex items-center justify-between group cursor-pointer"
                >
                  <div className="min-w-0 pr-2">
                    <span className="text-[13px] font-bold text-[#1e293b] block truncate">{p.label}</span>
                    <span className="text-[10px] text-[#64748b] font-mono block mt-0.5 truncate">{p.email}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="badge badge-neutral text-[9px] uppercase font-bold hidden sm:inline-block">{p.badge}</span>
                    <ArrowRight className="h-4 w-4 text-[#94a3b8] group-hover:text-[#1e3a5f] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-[#f1f5f9] pt-4 text-center">
            <span className="text-[10px] text-[#94a3b8] block">
              Target page redirection: <code className="bg-[#f1f5f9] px-1.5 py-0.5 rounded font-mono font-bold text-[#1e3a5f]">{redirect || '/'}</code>
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}

