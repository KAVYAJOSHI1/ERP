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
      <div className="space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-[#1e293b] flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-[#1e3a5f]" />
              Corporate Finance & Ledger
            </h1>
            <p className="text-[12px] text-[#64748b] mt-0.5">
              Double-entry bookkeeping, trial balance, and automated invoicing
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5 hover:border-[#cbd5e1] transition-colors">
            <p className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">Liquid Assets</p>
            <div className="mt-2 flex items-baseline">
              <span className="text-2xl font-bold text-[#166534] font-mono">
                ${cashAccount?.balance.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-[#166534] uppercase">
              <ArrowUpRight className="h-4 w-4" />
              <span>Cash & Equivalents</span>
            </div>
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5 hover:border-[#cbd5e1] transition-colors">
            <p className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">Current Liabilities</p>
            <div className="mt-2 flex items-baseline">
              <span className="text-2xl font-bold text-[#b91c1c] font-mono">
                ${apAccount?.balance.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-[#b91c1c] uppercase">
              <ArrowDownRight className="h-4 w-4" />
              <span>Accounts Payable</span>
            </div>
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5 hover:border-[#cbd5e1] transition-colors">
            <p className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">Double-Entry Journals</p>
            <div className="mt-2 flex items-baseline">
              <span className="text-2xl font-bold text-[#1e3a5f] font-mono">
                {ledger.length}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-[#64748b] uppercase">
              <span>Latest Transactions Logged</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* General Ledger */}
          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#f1f5f9]">
              <BookOpen className="h-4 w-4 text-[#1e3a5f]" />
              <h2 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">General Ledger</h2>
            </div>
            <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1">
              {loadingLedger ? (
                <div className="py-8 text-center text-[12px] text-[#94a3b8]">Syncing journals...</div>
              ) : ledger.length === 0 ? (
                <div className="py-8 text-center text-[12px] text-[#94a3b8]">No journal entries found.</div>
              ) : (
                ledger.map(entry => (
                  <div key={entry.id} className="p-3 bg-[#f8fafc] border border-[#f1f5f9] rounded-sm">
                    <div className="flex justify-between items-start">
                      <span className="text-[12px] font-bold text-[#1e293b]">{entry.account?.name || entry.account_id}</span>
                      <span className="text-[10px] font-mono text-[#94a3b8]">{new Date(entry.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-[12px] text-[#64748b] mt-1">{entry.description}</p>
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#f1f5f9] font-mono text-[12px] font-bold">
                      {entry.debit > 0 ? (
                        <span className="text-[#166534]">DR ${entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      ) : (
                        <span className="text-[#b91c1c]">CR ${entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      )}
                      <span className="text-[9px] text-[#94a3b8] px-2 py-0.5 bg-white border border-[#e2e8f0] rounded-sm font-semibold">
                        REF: {entry.reference_id?.substring(0,8).toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Invoices Vault */}
          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#f1f5f9]">
              <FileText className="h-4 w-4 text-[#1e3a5f]" />
              <h2 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">Invoices Vault</h2>
            </div>
            
            {loadingInvoices ? (
              <div className="py-8 text-center text-[12px] text-[#94a3b8]">Decrypting vault...</div>
            ) : invoices.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-[#94a3b8]">No invoices generated.</div>
            ) : (
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>PO Reference</th>
                      <th>Issued At</th>
                      <th className="text-right">Amount</th>
                      <th className="text-center">Document</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id}>
                        <td className="font-mono font-bold text-[#1e293b]">
                          {inv.po_id.substring(0, 8).toUpperCase()}...
                        </td>
                        <td className="text-[12px] text-[#64748b]">
                          {new Date(inv.issued_at).toLocaleDateString()}
                        </td>
                        <td className="text-right font-mono font-bold text-[#1e3a5f]">
                          ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="text-center">
                          {inv.pdf_url && (
                            <a 
                              href={inv.pdf_url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="btn-secondary !py-1 !px-2.5 !text-[10px]"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
