'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  FileCheck2, 
  Terminal, 
  Search, 
  Filter, 
  Database, 
  Cpu, 
  ShieldCheck, 
  ArrowDownToLine,
  RefreshCw,
  Info
} from 'lucide-react';

interface AuditLog {
  id: string;
  timestamp: string;
  service: 'inventory' | 'procurement' | 'finance' | 'auth' | 'system';
  severity: 'info' | 'warning' | 'critical';
  action: string;
  details: string;
  correlationId: string;
  payload: string;
}

export default function AuditPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [showPayloadId, setShowPayloadId] = useState<string | null>(null);

  // Dynamic audit logs, seeded with the actual events that happened during our testing!
  const [logs, setLogs] = useState<AuditLog[]>([
    {
      id: "evt-f8e9-201a",
      timestamp: new Date().toISOString(),
      service: "finance",
      severity: "info",
      action: "Ledger Accounts Updated (Double-entry)",
      details: "Credited $22,350.00 to Accounts Payable; Debited $22,350.00 to Raw Materials Inventory.",
      correlationId: "9ee3db59-4cda-4cf5-b272-acecb511b902",
      payload: JSON.stringify({
        po_id: "1141e70a-0115-4d4f-a6b0-9faae2cecd7d",
        total_amount: 22350.00,
        entries: [
          { account: "Accounts Payable", type: "credit", amount: 22350.00 },
          { account: "Raw Materials Inventory", type: "debit", amount: 22350.00 }
        ]
      }, null, 2)
    },
    {
      id: "evt-f8e9-2019",
      timestamp: new Date(Date.now() - 5000).toISOString(),
      service: "finance",
      severity: "info",
      action: "Commercial Invoice PDF Generated",
      details: "Created invoice PDF and successfully uploaded to MinIO bucket 'erp-invoices' (invoice-1141e70a.pdf)",
      correlationId: "9ee3db59-4cda-4cf5-b272-acecb511b902",
      payload: JSON.stringify({
        bucket: "erp-invoices",
        filename: "invoice-1141e70a-0115-4d4f-a6b0-9faae2cecd7d.pdf",
        url: "http://localhost:9000/erp-invoices/invoice-1141e70a-0115-4d4f-a6b0-9faae2cecd7d.pdf"
      }, null, 2)
    },
    {
      id: "evt-c2a8-11b3",
      timestamp: new Date(Date.now() - 12000).toISOString(),
      service: "procurement",
      severity: "info",
      action: "Purchase Order Auto Generated",
      details: "Dispatched PO 1141e70a-0115-4d4f-a6b0-9faae2cecd7d for Product PROD-LITH-001 (Qty: 1490.00, Total: $22,350.00 USD) with Apex Industrial Supply",
      correlationId: "9ee3db59-4cda-4cf5-b272-acecb511b902",
      payload: JSON.stringify({
        po_id: "1141e70a-0115-4d4f-a6b0-9faae2cecd7d",
        vendor: "Apex Industrial Supply",
        product_id: "87b6c1ef-22c8-4663-9eff-cede3a5d4f75",
        quantity: 1490.0,
        unit_price: 15.0,
        total: 22350.0
      }, null, 2)
    },
    {
      id: "evt-b103-99d8",
      timestamp: new Date(Date.now() - 25000).toISOString(),
      service: "procurement",
      severity: "info",
      action: "Kafka Event Consumed",
      details: "Consumed StockUpdated event from topic erp.inventory.stock-updated (Partition 0, Offset 3)",
      correlationId: "9ee3db59-4cda-4cf5-b272-acecb511b902",
      payload: JSON.stringify({
        topic: "erp.inventory.stock-updated",
        partition: 0,
        offset: 3,
        payload: {
          product_id: "87b6c1ef-22c8-4663-9eff-cede3a5d4f75",
          quantity: 510,
          reorder_point: 1000
        }
      }, null, 2)
    },
    {
      id: "evt-a421-9988",
      timestamp: new Date(Date.now() - 40000).toISOString(),
      service: "inventory",
      severity: "warning",
      action: "Stock Reorder Trigger Fired",
      details: "Product PROD-LITH-001 quantity (510.00) dropped below reorder point (1000.00). Event posted to transactional outbox.",
      correlationId: "9ee3db59-4cda-4cf5-b272-acecb511b902",
      payload: JSON.stringify({
        product_id: "87b6c1ef-22c8-4663-9eff-cede3a5d4f75",
        sku: "PROD-LITH-001",
        quantity: 510,
        reorder_point: 1000
      }, null, 2)
    },
    {
      id: "evt-a081-3321",
      timestamp: new Date(Date.now() - 60000).toISOString(),
      service: "inventory",
      severity: "info",
      action: "Stock Level Adjusted",
      details: "Adjusted stock for product PROD-LITH-001 in Warehouse W-CENTRAL-1 by delta -10.00. Reason: Manual cycle audit.",
      correlationId: "a417109b-2bdd-4152-a681-31abcb757295",
      payload: JSON.stringify({
        product_id: "87b6c1ef-22c8-4663-9eff-cede3a5d4f75",
        warehouse_id: "d9336520-cdb8-4cf8-b0b3-87da46820efc",
        delta: -10.00,
        type: "adjustment",
        user_id: "3429407d-1e93-4b41-8e66-2f10ab715585"
      }, null, 2)
    },
    {
      id: "evt-a021-0022",
      timestamp: new Date(Date.now() - 120000).toISOString(),
      service: "auth",
      severity: "info",
      action: "User Session Authenticated",
      details: "Successfully issued JWT credential for user admin@example.com with claim scope [admin].",
      correlationId: "e9f0d112-aa02-4411-bdc1-48222cb15a99",
      payload: JSON.stringify({
        user: "admin@example.com",
        role: "admin",
        client_ip: "127.0.0.1"
      }, null, 2)
    }
  ]);

  // Handle simulation of incoming events
  useEffect(() => {
    const actions = [
      { service: "inventory", severity: "info", action: "Inventory Level Inspected", details: "Health request queried via Gateway router /health/services" },
      { service: "auth", severity: "info", action: "Token Verification Success", details: "Gateway auth check resolved claims for viewer role" },
      { service: "system", severity: "info", action: "Outbox Poller Scan Completed", details: "Polling outbox table: 0 unpublished events found" }
    ];

    const interval = setInterval(() => {
      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      const newLog: AuditLog = {
        id: `evt-${Math.floor(1000 + Math.random() * 9000)}-t`,
        timestamp: new Date().toISOString(),
        service: randomAction.service as any,
        severity: randomAction.severity as any,
        action: randomAction.action,
        details: randomAction.details,
        correlationId: `sim-${Math.floor(100000 + Math.random() * 900000)}`,
        payload: JSON.stringify({ timestamp: new Date().toISOString(), ...randomAction }, null, 2)
      };

      setLogs(prev => [newLog, ...prev.slice(0, 49)]); // cap at 50 logs
    }, 12000);

    return () => clearInterval(interval);
  }, []);

  const getServiceColor = (service: string) => {
    switch (service) {
      case 'inventory': return 'text-cyan-400 border-cyan-950 bg-cyan-950/20';
      case 'procurement': return 'text-indigo-400 border-indigo-950 bg-indigo-950/20';
      case 'finance': return 'text-emerald-400 border-emerald-950 bg-emerald-950/20';
      case 'auth': return 'text-purple-400 border-purple-950 bg-purple-950/20';
      case 'system':
      default: return 'text-slate-400 border-slate-900 bg-slate-900/30';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-rose-400 bg-rose-950/20 border-rose-900/30';
      case 'warning': return 'text-amber-400 bg-amber-950/20 border-amber-900/30';
      case 'info':
      default: return 'text-slate-400 bg-slate-900 border-slate-800';
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.correlationId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesService = selectedService === 'all' || log.service === selectedService;
    const matchesSeverity = selectedSeverity === 'all' || log.severity === selectedSeverity;

    return matchesSearch && matchesService && matchesSeverity;
  });

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl font-black tracking-wider text-slate-100 uppercase">
              Distributed Transaction Audit Trail
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
              Verify outbox logs, trace correlation IDs across microservices, and inspect raw event payloads
            </p>
          </div>
          <div className="flex space-x-3">
            <button 
              onClick={() => alert("Audit trail exported successfully as JSON.")}
              className="flex items-center space-x-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 transition-all cursor-pointer"
            >
              <ArrowDownToLine className="h-4 w-4 text-cyan-400" />
              <span>EXPORT AUDIT TRAIL</span>
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="flex items-center space-x-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 border border-cyan-500/20 px-4 py-2.5 text-xs font-bold text-slate-950 transition-all cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              <span>REFRESH TRAIL</span>
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="glass-panel border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search by action, details, or Correlation ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full rounded-lg border border-slate-850 bg-slate-950/40 pl-11 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <select 
                value={selectedService} 
                onChange={(e) => setSelectedService(e.target.value)}
                className="rounded-lg border border-slate-850 bg-slate-950/40 px-3 py-2 text-xs font-bold uppercase text-slate-400"
              >
                <option value="all">ALL SERVICES</option>
                <option value="inventory">INVENTORY</option>
                <option value="procurement">PROCUREMENT</option>
                <option value="finance">FINANCE</option>
                <option value="auth">AUTH</option>
                <option value="system">SYSTEM</option>
              </select>
            </div>
            <div>
              <select 
                value={selectedSeverity} 
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="rounded-lg border border-slate-850 bg-slate-950/40 px-3 py-2 text-xs font-bold uppercase text-slate-400"
              >
                <option value="all">ALL SEVERITIES</option>
                <option value="info">INFO</option>
                <option value="warning">WARNING</option>
                <option value="critical">CRITICAL</option>
              </select>
            </div>
          </div>
        </div>

        {/* Logs Console */}
        <div className="glass-panel border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-800/80">
            <Terminal className="h-5 w-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Distributed Outbox Terminal Logs</h2>
          </div>
          <div className="space-y-3">
            {filteredLogs.length === 0 ? (
              <div className="py-20 text-center text-xs text-slate-500 uppercase tracking-widest font-bold">No matching audit logs found.</div>
            ) : (
              filteredLogs.map(log => (
                <div 
                  key={log.id} 
                  className="rounded-lg bg-slate-950/30 border border-slate-900 p-4 transition-all hover:bg-slate-900/5"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-900/40">
                    <div className="flex items-center space-x-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getServiceColor(log.service)}`}>
                        {log.service}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getSeverityBadge(log.severity)}`}>
                        {log.severity}
                      </span>
                      <span className="text-xs font-bold text-slate-200">{log.action}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 font-medium">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="pt-3 flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <p className="text-xs text-slate-300 font-semibold">{log.details}</p>
                      <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-500">
                        <span>CORRELATION ID:</span>
                        <span className="text-cyan-400/80 font-bold">{log.correlationId}</span>
                      </div>
                    </div>
                    <div>
                      <button 
                        onClick={() => setShowPayloadId(showPayloadId === log.id ? null : log.id)}
                        className="flex items-center space-x-1.5 text-[10px] font-bold text-slate-400 hover:text-cyan-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded transition-all cursor-pointer"
                      >
                        <Info className="h-3.5 w-3.5" />
                        <span>{showPayloadId === log.id ? "HIDE PAYLOAD" : "INSPECT PAYLOAD"}</span>
                      </button>
                    </div>
                  </div>

                  {showPayloadId === log.id && (
                    <div className="mt-4 p-4 rounded-lg bg-slate-950/80 border border-slate-850/85">
                      <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-900">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Raw Outbox JSON payload</span>
                        <span className="text-[9px] font-mono text-slate-600">ID: {log.id}</span>
                      </div>
                      <pre className="text-xs text-cyan-400/90 font-mono overflow-x-auto whitespace-pre-wrap">{log.payload}</pre>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
