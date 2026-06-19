'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { 
  Users, 
  UserPlus, 
  ShieldAlert, 
  Mail, 
  Key, 
  UserCheck, 
  ShieldCheck,
  UserCheck2
} from 'lucide-react';

interface UserRecord {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function UserDirectoryPage() {
  const queryClient = useQueryClient();
  const [showAddUser, setShowAddUser] = useState(false);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('viewer');

  // Fetch Users from the Go Auth service via Gateway
  const { data: users = [], isLoading } = useQuery<UserRecord[]>({
    queryKey: ['users'],
    queryFn: () => apiFetch('/auth/users'),
  });

  // Register User Mutation
  const registerMutation = useMutation({
    mutationFn: (newUser: any) => apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(newUser),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowAddUser(false);
      setEmail('');
      setPassword('');
      setRole('viewer');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to register new user. Check if email is already registered.');
    }
  });

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate({
      email,
      password,
      role
    });
  };

  const getRoleBadge = (roleName: string) => {
    switch (roleName) {
      case 'admin':
        return 'text-rose-400 bg-rose-950/20 border-rose-900/30';
      case 'warehouse_manager':
        return 'text-cyan-400 bg-cyan-950/20 border-cyan-800/30';
      case 'procurement_manager':
        return 'text-indigo-400 bg-indigo-950/20 border-indigo-800/30';
      case 'finance_manager':
        return 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30';
      case 'production_manager':
        return 'text-amber-400 bg-amber-950/20 border-amber-900/30';
      case 'viewer':
      default:
        return 'text-slate-400 bg-slate-900 border-slate-800';
    }
  };

  const formatRole = (roleName: string) => {
    return roleName.replace('_', ' ').toUpperCase();
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl font-black tracking-wider text-slate-100 uppercase">
              Identity & Access Management (IAM)
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
              Onboard new team members, manage security roles, and audit access credentials
            </p>
          </div>
          <div>
            <button 
              onClick={() => setShowAddUser(true)}
              className="flex items-center space-x-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 border border-cyan-500/20 px-4 py-2.5 text-xs font-bold text-slate-950 transition-all cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.2)]"
            >
              <UserPlus className="h-4 w-4" />
              <span>PROVISION NEW USER</span>
            </button>
          </div>
        </div>

        {/* Provision User Form */}
        {showAddUser && (
          <div className="glass-panel border border-slate-800 rounded-xl p-6">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800/80 pb-2">
              Provision Enterprise Account
            </h2>
            <form onSubmit={handleRegisterSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="relative">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Corporate Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 text-slate-500" />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@company.com"
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 pl-11 pr-4 py-2.5 text-sm text-slate-200" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Initial Password</label>
                <div className="relative">
                  <Key className="absolute left-3.5 top-3 h-4 text-slate-500" />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 pl-11 pr-4 py-2.5 text-sm text-slate-200" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Security Role (RBAC)</label>
                <select 
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200"
                >
                  <option value="admin">Administrator (Full Access)</option>
                  <option value="warehouse_manager">Warehouse Manager (Inventory Only)</option>
                  <option value="procurement_manager">Procurement Manager (Procurement Only)</option>
                  <option value="production_manager">Production Manager (Shop Floor Only)</option>
                  <option value="finance_manager">Finance Manager (Ledger & Invoices Only)</option>
                  <option value="viewer">Viewer (Read-Only Portal)</option>
                </select>
              </div>
              <div className="md:col-span-3 flex justify-end space-x-3">
                <button 
                  type="button" 
                  onClick={() => setShowAddUser(false)}
                  className="px-4 py-2.5 rounded-lg border border-slate-800 hover:bg-slate-900 text-xs font-bold text-slate-400 cursor-pointer"
                >
                  CANCEL
                </button>
                <button 
                  type="submit" 
                  disabled={registerMutation.isPending}
                  className="px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-slate-950 cursor-pointer disabled:opacity-50"
                >
                  {registerMutation.isPending ? 'PROVISIONING...' : 'CONFIRM PROVISIONING'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users List */}
        <div className="glass-panel border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-800/80">
            <Users className="h-5 w-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Enterprise Identity Directory</h2>
          </div>
          {isLoading ? (
            <div className="py-20 text-center text-xs font-bold tracking-wider text-slate-500 uppercase">Connecting to Identity Service...</div>
          ) : users.length === 0 ? (
            <div className="py-20 text-center text-xs text-slate-500">No registered users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3">Enterprise User ID</th>
                    <th className="pb-3">User Email Address</th>
                    <th className="pb-3">Assigned Security Role</th>
                    <th className="pb-3 text-center">Status</th>
                    <th className="pb-3 text-right">Provisioned Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm text-slate-300">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-slate-900/10 transition-colors">
                      <td className="py-4 font-mono font-semibold text-slate-400 text-xs">{user.id}</td>
                      <td className="py-4 text-slate-200 font-bold flex items-center gap-2">
                        <UserCheck2 className="h-4 w-4 text-cyan-500" />
                        <span>{user.email}</span>
                      </td>
                      <td className="py-4">
                        <span className={`text-[10px] font-bold px-2.5 py-0.75 rounded-full border ${getRoleBadge(user.role)}`}>
                          {formatRole(user.role)}
                        </span>
                      </td>
                      <td className="py-4 text-center">
                        {user.is_active ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded border text-emerald-400 bg-emerald-950/20 border-emerald-900/30">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded border text-slate-500 bg-slate-900 border-slate-800">
                            SUSPENDED
                          </span>
                        )}
                      </td>
                      <td className="py-4 text-right text-xs text-slate-400 font-mono">
                        {new Date(user.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
