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

  const statusColor: Record<string, string> = {
    UP:      'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    DOWN:    'text-rose-400 bg-rose-500/10 border-rose-500/20',
    LOADING: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
    UNKNOWN: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    DEGRADED:'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  };

  const overallBadgeColor =
    overall === 'UP'      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
    overall === 'DEGRADED'? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                            'bg-rose-500/10 border-rose-500/20 text-rose-400';

  return (
    <DashboardLayout>
      <div className="space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl font-black tracking-wider text-slate-100 uppercase">
              Observability & Telemetry
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
              System health, metrics, and distributed tracing control center
            </p>
          </div>
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border text-xs font-bold tracking-wider ${overallBadgeColor}`}>
            {overall === 'UP' && (
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
            {overall === 'DEGRADED' && <span className="h-2 w-2 mr-2 rounded-full bg-yellow-400 inline-block"></span>}
            {(overall === 'DOWN' || overall === 'UNKNOWN') && <span className="h-2 w-2 mr-2 rounded-full bg-rose-500 inline-block"></span>}
            {overall === 'LOADING' && <span className="h-2 w-2 mr-2 rounded-full bg-slate-400 inline-block animate-pulse"></span>}
            {overall === 'UP' ? 'ALL SYSTEMS NOMINAL' :
             overall === 'DEGRADED' ? 'SYSTEM DEGRADED' :
             overall === 'LOADING' ? 'CHECKING...' : 'SYSTEM DOWN'}
          </div>
        </div>

        {/* Live Service Health Grid */}
        <div className="glass-panel border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Live Service Health</h2>
            <div className="flex items-center gap-3">
              {lastChecked && <span className="text-xs text-slate-500">Updated: {lastChecked}</span>}
              <button
                onClick={fetchHealth}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {services.map((svc) => (
              <div
                key={svc.name}
                className={`rounded-lg border px-3 py-2.5 flex flex-col items-center gap-1 transition-colors ${statusColor[svc.status]}`}
              >
                <span className="text-xs font-bold uppercase tracking-wider">
                  {SERVICE_LABELS[svc.name] || svc.name}
                </span>
                <span className="text-xs font-semibold">
                  {svc.status === 'LOADING' ? '...' : svc.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tool Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Grafana */}
          <div
            className="glass-panel border border-slate-800 rounded-xl p-6 group hover:border-orange-500/50 transition-colors cursor-pointer"
            onClick={() => window.open('http://localhost:3000', '_blank')}
          >
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20">
                <BarChart2 className="h-6 w-6" />
              </div>
              <ArrowRight className="h-5 w-5 text-slate-600 group-hover:text-orange-400 transition-colors group-hover:translate-x-1 duration-300" />
            </div>
            <div className="mt-6">
              <h3 className="text-lg font-bold text-slate-200">Grafana Dashboards</h3>
              <p className="text-sm text-slate-400 mt-2">
                HTTP request rates, P95/P99 latency histograms, business KPIs, Go runtime metrics, and Loki log aggregation.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {['System Overview', 'Business KPIs', 'Health'].map((d) => (
                  <span key={d} className="text-xs px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium">
                    {d}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
              <span>Port: 3000</span>
              <span className="text-orange-500/70">Metrics & Logs</span>
            </div>
          </div>

          {/* Kafka UI */}
          <div
            className="glass-panel border border-slate-800 rounded-xl p-6 group hover:border-cyan-500/50 transition-colors cursor-pointer"
            onClick={() => window.open('http://localhost:9021', '_blank')}
          >
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                <Database className="h-6 w-6" />
              </div>
              <ArrowRight className="h-5 w-5 text-slate-600 group-hover:text-cyan-400 transition-colors group-hover:translate-x-1 duration-300" />
            </div>
            <div className="mt-6">
              <h3 className="text-lg font-bold text-slate-200">Kafka Control Center</h3>
              <p className="text-sm text-slate-400 mt-2">
                Inspect event streams, topic partitions, consumer group lags, and outbox relay messages in real-time.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
              <span>Port: 9021</span>
              <span className="text-cyan-500/70">Event Broker</span>
            </div>
          </div>

          {/* Prometheus Alerts */}
          <div
            className="glass-panel border border-slate-800 rounded-xl p-6 group hover:border-rose-500/50 transition-colors cursor-pointer"
            onClick={() => window.open('http://localhost:9090/alerts', '_blank')}
          >
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <ArrowRight className="h-5 w-5 text-slate-600 group-hover:text-rose-400 transition-colors group-hover:translate-x-1 duration-300" />
            </div>
            <div className="mt-6">
              <h3 className="text-lg font-bold text-slate-200">Prometheus Alerts</h3>
              <p className="text-sm text-slate-400 mt-2">
                Active alerting rules for service downtime, latency spikes, high error rates, login anomalies, and stock reorder backlogs.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {['ServiceDown', 'HighErrorRate', 'HighP95Latency', 'LoginAnomaly', 'StockBacklog'].map((r) => (
                  <span key={r} className="text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
                    {r}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
              <span>Port: 9090</span>
              <span className="text-rose-500/70">Alertmanager</span>
            </div>
          </div>

          {/* Jaeger Distributed Tracing */}
          <div
            className="glass-panel border border-slate-800 rounded-xl p-6 group hover:border-indigo-500/50 transition-colors cursor-pointer"
            onClick={() => window.open('http://localhost:16686', '_blank')}
          >
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                <Activity className="h-6 w-6" />
              </div>
              <ArrowRight className="h-5 w-5 text-slate-600 group-hover:text-indigo-400 transition-colors group-hover:translate-x-1 duration-300" />
            </div>
            <div className="mt-6">
              <h3 className="text-lg font-bold text-slate-200">Distributed Tracing</h3>
              <p className="text-sm text-slate-400 mt-2">
                Visualize end-to-end request lifecycles with Jaeger. Traces are correlated across the gateway and all microservices via the X-Correlation-ID header. Supports OTLP ingestion.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {['Jaeger UI', 'OTLP Ready', 'Correlation IDs'].map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
              <span>Port: 16686</span>
              <span className="text-indigo-500/70">Jaeger APM</span>
            </div>
          </div>

        </div>

        {/* Prometheus Explorer */}
        <div
          className="glass-panel border border-slate-800 rounded-xl p-6 group hover:border-slate-600 transition-colors cursor-pointer"
          onClick={() => window.open('http://localhost:9090', '_blank')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-slate-700/50 text-slate-300 border border-slate-700">
                <ServerCrash className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-200">Prometheus Metrics Explorer</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Query raw metrics with PromQL — business KPIs, HTTP histograms, Go runtime, and custom ERP counters
                  (<code className="text-xs bg-slate-800 px-1 rounded">erp_auth_*</code>,{' '}
                  <code className="text-xs bg-slate-800 px-1 rounded">erp_inventory_*</code>,{' '}
                  <code className="text-xs bg-slate-800 px-1 rounded">erp_procurement_*</code>,{' '}
                  <code className="text-xs bg-slate-800 px-1 rounded">erp_finance_*</code>,{' '}
                  <code className="text-xs bg-slate-800 px-1 rounded">erp_intelligence_*</code>).
                </p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-slate-600 group-hover:text-slate-300 transition-colors group-hover:translate-x-1 duration-300 flex-shrink-0 ml-4" />
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
            <span>Port: 9090</span>
            <span className="text-slate-400/70">PromQL Explorer</span>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
