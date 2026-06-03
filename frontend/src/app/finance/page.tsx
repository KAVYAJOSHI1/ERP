'use client';

import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { 
  FileText, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Activity, 
  BookOpen,
  Download
} from 'lucide-react';

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
}

interface LedgerEntry {
  id: string;
  account_id: string;
  account?: Account;
  debit: number;
  credit: number;
  description: string;
  reference_id: string;
  correlation_id: string;
  created_at: string;
}

interface Invoice {
  id: string;
  po_id: string;
  amount: number;
  status: string;
  pdf_url: string;
  issued_at: string;
}

export default function FinanceDashboard() {
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => apiFetch('/finance/accounts'),
  });

  const { data: ledger = [], isLoading: loadingLedger } = useQuery<LedgerEntry[]>({
    queryKey: ['ledger'],
    queryFn: () => apiFetch('/finance/ledger'),
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => apiFetch('/finance/invoices'),
  });

  const cashAccount = accounts.find(a => a.name === 'Cash & Cash Equivalents');
  const apAccount = accounts.find(a => a.name === 'Accounts Payable');

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl font-black tracking-wider text-slate-100 uppercase">
              Corporate Finance & Ledger
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
              Double-entry bookkeeping, trial balance, and automated invoicing
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="glass-panel border border-slate-800 rounded-xl p-6 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Wallet className="h-24 w-24 text-emerald-500" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Liquid Assets</p>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-3xl font-black text-emerald-400 font-mono">
                ${cashAccount?.balance.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
              </span>
            </div>
            <div className="mt-3 flex items-center space-x-1.5 text-xs font-bold text-emerald-500">
              <ArrowUpRight className="h-4 w-4" />
              <span>CASH & EQUIVALENTS</span>
            </div>
          </div>

          <div className="glass-panel border border-slate-800 rounded-xl p-6 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Activity className="h-24 w-24 text-rose-500" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Current Liabilities</p>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-3xl font-black text-rose-400 font-mono">
                ${apAccount?.balance.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
              </span>
            </div>
            <div className="mt-3 flex items-center space-x-1.5 text-xs font-bold text-rose-500">
              <ArrowDownRight className="h-4 w-4" />
              <span>ACCOUNTS PAYABLE</span>
            </div>
          </div>

          <div className="glass-panel border border-slate-800 rounded-xl p-6 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <BookOpen className="h-24 w-24 text-indigo-500" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Double-Entry Journals</p>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-3xl font-black text-indigo-400 font-mono">
                {ledger.length}
              </span>
            </div>
            <div className="mt-3 flex items-center space-x-1.5 text-xs font-bold text-indigo-500">
              <span>LATEST TRANSACTIONS LOGGED</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* General Ledger */}
          <div className="glass-panel border border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-800/80">
              <BookOpen className="h-5 w-5 text-cyan-400" />
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">General Ledger</h2>
            </div>
            <div className="max-h-[500px] overflow-y-auto pr-2 space-y-3">
              {loadingLedger ? (
                <div className="py-10 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Syncing journals...</div>
              ) : ledger.length === 0 ? (
                <div className="py-10 text-center text-xs font-bold text-slate-500 uppercase">No entries yet.</div>
              ) : (
                ledger.map(entry => (
                  <div key={entry.id} className="rounded-lg bg-slate-950/40 border border-slate-800/50 p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-slate-300">{entry.account?.name || entry.account_id}</span>
                      <span className="text-[10px] font-mono text-slate-500">{new Date(entry.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-slate-400">{entry.description}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 font-mono text-xs font-bold">
                      {entry.debit > 0 ? (
                        <span className="text-emerald-400">DR ${entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      ) : (
                        <span className="text-rose-400">CR ${entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      )}
                      <span className="text-[9px] text-slate-500 px-2 py-0.5 bg-slate-900 rounded">REF: {entry.reference_id?.substring(0,8)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Invoices Vault */}
          <div className="glass-panel border border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-800/80">
              <FileText className="h-5 w-5 text-cyan-400" />
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Invoices Vault</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3">PO Reference</th>
                    <th className="pb-3">Issued At</th>
                    <th className="pb-3 text-right">Amount</th>
                    <th className="pb-3 text-center">Document</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm text-slate-300">
                  {loadingInvoices ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Decrypting vault...</td>
                    </tr>
                  ) : invoices.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-xs font-bold text-slate-500 uppercase">No invoices generated.</td>
                    </tr>
                  ) : (
                    invoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-900/10 transition-colors">
                        <td className="py-3 font-mono font-semibold text-slate-200">
                          {inv.po_id.substring(0, 8).toUpperCase()}...
                        </td>
                        <td className="py-3 text-xs text-slate-400">
                          {new Date(inv.issued_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-cyan-400">
                          ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 text-center">
                          {inv.pdf_url && (
                            <a 
                              href={inv.pdf_url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="inline-flex items-center space-x-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-950/30 border border-indigo-900/30 px-2 py-1 rounded transition-all"
                            >
                              <Download className="h-3 w-3" />
                              <span>PDF</span>
                            </a>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
