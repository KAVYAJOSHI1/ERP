'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Activity,
  Database,
  BarChart2,
  ServerCrash,
  ArrowRight,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';

interface ServiceHealth {
  name: string;
  status: 'UP' | 'DOWN' | 'LOADING';
}

interface AggregateHealth {
  gateway: string;
  overall: string;
  services: { name: string; status: string }[];
  timestamp: string;
}

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:5000';

const SERVICE_LABELS: Record<string, string> = {
  'auth-service':         'Auth',
  'inventory-service':    'Inventory',
  'procurement-service':  'Procurement',
  'finance-service':      'Finance',
  'intelligence-service': 'Intelligence',
};

export default function ObservabilityDashboard() {
  const [services, setServices] = useState<ServiceHealth[]>([
    { name: 'auth-service',         status: 'LOADING' },
    { name: 'inventory-service',    status: 'LOADING' },
    { name: 'procurement-service',  status: 'LOADING' },
    { name: 'finance-service',      status: 'LOADING' },
    { name: 'intelligence-service', status: 'LOADING' },
  ]);
  const [overall, setOverall] = useState<string>('LOADING');
  const [lastChecked, setLastChecked] = useState<string>('');

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${GATEWAY_URL}/health/services`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch');
      const data: AggregateHealth = await res.json();
      setOverall(data.overall);
      setServices(
        data.services.map((s) => ({
          name: s.name,
          status: s.status as 'UP' | 'DOWN',
        }))
      );
      setLastChecked(new Date(data.timestamp).toLocaleTimeString());
    } catch {
      setOverall('UNKNOWN');
      setServices((prev) => prev.map((s) => ({ ...s, status: 'DOWN' as const })));
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'UP':
        return <span className="badge badge-success">Online</span>;
      case 'DOWN':
        return <span className="badge badge-danger">Offline</span>;
      case 'LOADING':
      default:
        return <span className="badge badge-neutral">Checking</span>;
    }
  };

  const getOverallBadge = (status: string) => {
    switch (status) {
      case 'UP':
        return <span className="badge badge-success !text-[11px] font-bold">ALL SYSTEMS NOMINAL</span>;
      case 'DEGRADED':
        return <span className="badge badge-warning !text-[11px] font-bold">SYSTEM DEGRADED</span>;
      case 'LOADING':
        return <span className="badge badge-neutral !text-[11px] font-bold animate-pulse">CHECKING SYSTEMS...</span>;
      default:
        return <span className="badge badge-danger !text-[11px] font-bold">SYSTEM OFFLINE</span>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#e2e8f0]">
          <div>
            <h1 className="text-lg font-bold text-[#1e293b] flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#1e3a5f]" />
              Observability & Telemetry
            </h1>
            <p className="text-[12px] text-[#64748b] mt-0.5">
              System health, metrics, and distributed tracing control center
            </p>
          </div>
          <div>
            {getOverallBadge(overall)}
          </div>
        </div>

        {/* Live Service Health Grid */}
        <div className="bg-white border border-[#e2e8f0] rounded-sm p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
            <h2 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">Live Service Health</h2>
            <div className="flex items-center gap-3">
              {lastChecked && <span className="text-xs text-[#94a3b8]">Updated: {lastChecked}</span>}
              <button
                onClick={fetchHealth}
                className="btn-secondary !py-1 !px-2.5 !text-[11px]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {services.map((svc) => (
              <div
                key={svc.name}
                className="p-3 bg-[#f8fafc] border border-[#f1f5f9] rounded-sm flex flex-col items-center gap-1.5"
              >
                <span className="text-xs font-bold text-[#334155] uppercase tracking-wider">
                  {SERVICE_LABELS[svc.name] || svc.name}
                </span>
                {getStatusBadge(svc.status)}
              </div>
            ))}
          </div>
        </div>

        {/* Tool Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Grafana */}
          <div
            className="bg-white border border-[#e2e8f0] rounded-sm p-6 group hover:border-[#1e3a5f] transition-all cursor-pointer flex flex-col justify-between"
            onClick={() => window.open('http://localhost:3000', '_blank')}
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="p-2.5 rounded-sm bg-[#fff7ed] text-[#ea580c] border border-[#ffedd5]">
                  <BarChart2 className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-[#94a3b8] group-hover:text-[#1e3a5f] transition-colors group-hover:translate-x-1" />
              </div>
              <div className="mt-4">
                <h3 className="text-base font-bold text-[#1e293b]">Grafana Dashboards</h3>
                <p className="text-[12px] text-[#64748b] mt-1.5 leading-relaxed">
                  HTTP request rates, P95/P99 latency histograms, business KPIs, Go runtime metrics, and Loki log aggregation.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {['System Overview', 'Business KPIs', 'Health'].map((d) => (
                    <span key={d} className="text-[10px] px-2 py-0.5 rounded-sm bg-[#fff7ed] text-[#ea580c] border border-[#ffedd5] font-bold uppercase font-mono">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 pt-3 border-t border-[#f1f5f9] flex items-center justify-between text-[11px] font-semibold text-[#94a3b8] uppercase font-mono">
              <span>Port: 3000</span>
              <span className="text-[#ea580c]">Metrics & Logs</span>
            </div>
          </div>

          {/* Kafka UI */}
          <div
            className="bg-white border border-[#e2e8f0] rounded-sm p-6 group hover:border-[#1e3a5f] transition-all cursor-pointer flex flex-col justify-between"
            onClick={() => window.open('http://localhost:9021', '_blank')}
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="p-2.5 rounded-sm bg-[#ecfeff] text-[#0891b2] border border-[#cffafe]">
                  <Database className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-[#94a3b8] group-hover:text-[#1e3a5f] transition-colors group-hover:translate-x-1" />
              </div>
              <div className="mt-4">
                <h3 className="text-base font-bold text-[#1e293b]">Kafka Control Center</h3>
                <p className="text-[12px] text-[#64748b] mt-1.5 leading-relaxed">
                  Inspect event streams, topic partitions, consumer group lags, and outbox relay messages in real-time.
                </p>
              </div>
            </div>
            <div className="mt-6 pt-3 border-t border-[#f1f5f9] flex items-center justify-between text-[11px] font-semibold text-[#94a3b8] uppercase font-mono">
              <span>Port: 9021</span>
              <span className="text-[#0891b2]">Event Broker</span>
            </div>
          </div>

          {/* Prometheus Alerts */}
          <div
            className="bg-white border border-[#e2e8f0] rounded-sm p-6 group hover:border-[#1e3a5f] transition-all cursor-pointer flex flex-col justify-between"
            onClick={() => window.open('http://localhost:9090/alerts', '_blank')}
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="p-2.5 rounded-sm bg-[#fef2f2] text-[#e11d48] border border-[#fee2e2]">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-[#94a3b8] group-hover:text-[#1e3a5f] transition-colors group-hover:translate-x-1" />
              </div>
              <div className="mt-4">
                <h3 className="text-base font-bold text-[#1e293b]">Prometheus Alerts</h3>
                <p className="text-[12px] text-[#64748b] mt-1.5 leading-relaxed">
                  Active alerting rules for service downtime, latency spikes, high error rates, login anomalies, and stock reorder backlogs.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {['ServiceDown', 'HighErrorRate', 'HighP95Latency', 'LoginAnomaly', 'StockBacklog'].map((r) => (
                    <span key={r} className="text-[10px] px-2 py-0.5 rounded-sm bg-[#fef2f2] text-[#e11d48] border border-[#fee2e2] font-bold uppercase font-mono">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 pt-3 border-t border-[#f1f5f9] flex items-center justify-between text-[11px] font-semibold text-[#94a3b8] uppercase font-mono">
              <span>Port: 9090</span>
              <span className="text-[#e11d48]">Alertmanager</span>
            </div>
          </div>

          {/* Jaeger Distributed Tracing */}
          <div
            className="bg-white border border-[#e2e8f0] rounded-sm p-6 group hover:border-[#1e3a5f] transition-all cursor-pointer flex flex-col justify-between"
            onClick={() => window.open('http://localhost:16686', '_blank')}
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="p-2.5 rounded-sm bg-[#e0e7ff] text-[#4f46e5] border border-[#e0e7ff]">
                  <Activity className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-[#94a3b8] group-hover:text-[#1e3a5f] transition-colors group-hover:translate-x-1" />
              </div>
              <div className="mt-4">
                <h3 className="text-base font-bold text-[#1e293b]">Distributed Tracing</h3>
                <p className="text-[12px] text-[#64748b] mt-1.5 leading-relaxed">
                  Visualize end-to-end request lifecycles with Jaeger. Traces are correlated across the gateway and all microservices via the X-Correlation-ID header. Supports OTLP ingestion.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {['Jaeger UI', 'OTLP Ready', 'Correlation IDs'].map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-sm bg-[#e0e7ff] text-[#4f46e5] border border-[#c7d2fe] font-bold uppercase font-mono">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 pt-3 border-t border-[#f1f5f9] flex items-center justify-between text-[11px] font-semibold text-[#94a3b8] uppercase font-mono">
              <span>Port: 16686</span>
              <span className="text-[#4f46e5]">Jaeger APM</span>
            </div>
          </div>

        </div>

        {/* Prometheus Explorer */}
        <div
          className="bg-white border border-[#e2e8f0] rounded-sm p-5 group hover:border-[#1e3a5f] transition-all cursor-pointer"
          onClick={() => window.open('http://localhost:9090', '_blank')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-sm bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1]">
                <ServerCrash className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1e293b]">Prometheus Metrics Explorer</h3>
                <p className="text-[12px] text-[#64748b] mt-1">
                  Query raw metrics with PromQL — business KPIs, HTTP histograms, Go runtime, and custom ERP counters
                  (<code className="text-xs bg-[#f1f5f9] px-1 py-0.5 rounded font-mono">erp_auth_*</code>,{' '}
                  <code className="text-xs bg-[#f1f5f9] px-1 py-0.5 rounded font-mono">erp_inventory_*</code>,{' '}
                  <code className="text-xs bg-[#f1f5f9] px-1 py-0.5 rounded font-mono">erp_procurement_*</code>,{' '}
                  <code className="text-xs bg-[#f1f5f9] px-1 py-0.5 rounded font-mono">erp_finance_*</code>,{' '}
                  <code className="text-xs bg-[#f1f5f9] px-1 py-0.5 rounded font-mono">erp_intelligence_*</code>).
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-[#94a3b8] group-hover:text-[#1e3a5f] transition-colors group-hover:translate-x-1 flex-shrink-0" />
          </div>
          <div className="mt-4 pt-3 border-t border-[#f1f5f9] flex items-center justify-between text-[11px] font-semibold text-[#94a3b8] uppercase font-mono">
            <span>Port: 9090</span>
            <span>PromQL Explorer</span>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
