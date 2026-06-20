'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Key, 
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
      setEmail(''); setPassword(''); setRole('viewer');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to register new user. Check if email is already registered.');
    }
  });

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate({ email, password, role });
  };

  const getRoleBadge = (roleName: string) => {
    switch (roleName) {
      case 'admin':
        return <span className="badge badge-danger">Admin</span>;
      case 'warehouse_manager':
      case 'inventory_manager':
        return <span className="badge badge-info">Inventory</span>;
      case 'procurement_manager':
      case 'procurement_specialist':
        return <span className="badge badge-info">Procurement</span>;
      case 'finance_manager':
      case 'cfo':
        return <span className="badge badge-success">Finance</span>;
      case 'production_manager':
      case 'shop_floor_supervisor':
        return <span className="badge badge-warning">Production</span>;
      case 'viewer':
      default:
        return <span className="badge badge-neutral">Viewer</span>;
    }
  };

  const formatRole = (roleName: string) => {
    return roleName.replace(/_/g, ' ').toUpperCase();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-[#1e293b] flex items-center gap-2">
              <Users className="h-5 w-5 text-[#1e3a5f]" />
              Identity & Access Management (IAM)
            </h1>
            <p className="text-[12px] text-[#64748b] mt-0.5">
              Onboard new team members, manage security roles, and audit access credentials
            </p>
          </div>
          <div>
            <button onClick={() => setShowAddUser(true)} className="btn-primary">
              <UserPlus className="h-3.5 w-3.5" />
              <span>Provision User</span>
            </button>
          </div>
        </div>

        {/* Provision User Form */}
        {showAddUser && (
          <div className="bg-white border border-[#e2e8f0] rounded-sm p-5">
            <div className="section-title">Provision Enterprise Account</div>
            <form onSubmit={handleRegisterSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="field-label">Corporate Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[#94a3b8]" />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@company.com"
                    className="pl-9"
                  />
                </div>
              </div>
              <div>
                <label className="field-label">Initial Password</label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 h-4 w-4 text-[#94a3b8]" />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="pl-9"
                  />
                </div>
              </div>
              <div>
                <label className="field-label">Security Role (RBAC)</label>
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="admin">Administrator (Full Access)</option>
                  <option value="inventory_manager">Inventory Manager</option>
                  <option value="warehouse_manager">Warehouse Manager (Legacy)</option>
                  <option value="procurement_specialist">Procurement Specialist</option>
                  <option value="procurement_manager">Procurement Manager (Legacy)</option>
                  <option value="shop_floor_supervisor">Shop Floor Supervisor</option>
                  <option value="production_manager">Production Manager (Legacy)</option>
                  <option value="cfo">CFO</option>
                  <option value="finance_manager">Finance Manager (Legacy)</option>
                  <option value="viewer">Viewer (Read-Only)</option>
                </select>
              </div>
              <div className="md:col-span-3 flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddUser(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={registerMutation.isPending} className="btn-primary">
                  {registerMutation.isPending ? 'Provisioning...' : 'Confirm Account'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users List */}
        <div className="bg-white border border-[#e2e8f0] rounded-sm p-5">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#f1f5f9]">
            <Users className="h-4 w-4 text-[#1e3a5f]" />
            <h2 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">Enterprise Identity Directory</h2>
          </div>
          
          {isLoading ? (
            <div className="py-8 text-center text-[12px] text-[#94a3b8]">Connecting to Identity Service...</div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-[#94a3b8]">No registered users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Enterprise User ID</th>
                    <th>User Email Address</th>
                    <th>Assigned Security Role</th>
                    <th className="text-center">Status</th>
                    <th className="text-right">Provisioned Date</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td className="font-mono text-[11px] text-[#64748b]">{user.id}</td>
                      <td className="font-bold text-[#1e293b]">
                        <div className="flex items-center gap-2">
                          <UserCheck2 className="h-3.5 w-3.5 text-[#1e3a5f]" />
                          <span>{user.email}</span>
                        </div>
                      </td>
                      <td>{getRoleBadge(user.role)}</td>
                      <td className="text-center">
                        {user.is_active ? (
                          <span className="badge badge-success">Active</span>
                        ) : (
                          <span className="badge badge-neutral">Suspended</span>
                        )}
                      </td>
                      <td className="text-right text-[12px] text-[#64748b] font-mono">
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
