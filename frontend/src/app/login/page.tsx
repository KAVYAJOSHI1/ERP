'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { apiFetch } from '@/lib/api';
import { BrainCircuit, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, isAuthenticated } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && isAuthenticated) {
      router.push('/');
    }
  }, [isMounted, isAuthenticated, router]);

  if (!isMounted) return null;

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

      // Save to Zustand
      setAuth(data.user, data.access_token, data.refresh_token);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#090d16] px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Abstract Glowing Background Orbs */}
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-cyan-950/20 blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-slate-900/40 blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md space-y-8 z-10">
        <div className="flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-950/40 border border-cyan-500/40 shadow-[0_0_25px_rgba(6,182,212,0.2)]">
            <BrainCircuit className="h-9 w-9 text-cyan-400 animate-pulse" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-black tracking-wider text-slate-100 uppercase">
            APEX <span className="text-cyan-400">ERP</span> SYSTEMS
          </h2>
          <p className="mt-2 text-center text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Smart Manufacturing & Supply Chain Intelligence
          </p>
        </div>

        <div className="glass-panel rounded-2xl border border-slate-800 p-8 shadow-2xl">
          <div className="mb-6 flex items-center space-x-2 border-b border-slate-800/80 pb-4">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest">Operator Authentication</h3>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-center space-x-3 rounded-lg border border-red-900/30 bg-red-950/15 p-4 text-sm text-red-400">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email-address" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                User Email
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all duration-200"
                placeholder="operator@apex.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Security Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all duration-200"
                placeholder="••••••••"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-lg bg-cyan-600 hover:bg-cyan-500 border border-cyan-500/20 px-4 py-3 text-sm font-bold text-slate-950 tracking-wider uppercase transition-all duration-300 shadow-[0_0_15px_rgba(6,182,212,0.1)] hover:shadow-[0_0_20px_rgba(6,182,212,0.35)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-950 border-t-transparent"></div>
                ) : (
                  'VALIDATE & LOGIN'
                )}
              </button>
            </div>
          </form>
          
          <div className="mt-6 border-t border-slate-800/80 pt-4 text-center">
            <span className="text-[10px] text-slate-600 font-semibold tracking-wider uppercase">
              Authorized access only. System activity is logged.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
