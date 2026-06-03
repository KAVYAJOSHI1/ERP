'use client';

import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Activity, 
  Database,
  BarChart2,
  ServerCrash,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

export default function ObservabilityDashboard() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl font-black tracking-wider text-slate-100 uppercase">
              Observability & Telemetry
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
              System health, metrics, and distributed tracing control center
            </p>
          </div>
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-wider">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            ALL SYSTEMS NOMINAL
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Grafana Card */}
          <div className="glass-panel border border-slate-800 rounded-xl p-6 group hover:border-orange-500/50 transition-colors cursor-pointer" onClick={() => window.open('http://localhost:3000', '_blank')}>
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20">
                <BarChart2 className="h-6 w-6" />
              </div>
              <ArrowRight className="h-5 w-5 text-slate-600 group-hover:text-orange-400 transition-colors group-hover:translate-x-1 duration-300" />
            </div>
            <div className="mt-6">
              <h3 className="text-lg font-bold text-slate-200">Grafana Dashboards</h3>
              <p className="text-sm text-slate-400 mt-2">
                Real-time visualization of Prometheus metrics, API latency histograms, and Loki aggregated logs.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
              <span>Port: 3000</span>
              <span className="text-orange-500/70">Metrics & Logs</span>
            </div>
          </div>

          {/* Kafka UI Card */}
          <div className="glass-panel border border-slate-800 rounded-xl p-6 group hover:border-cyan-500/50 transition-colors cursor-pointer" onClick={() => window.open('http://localhost:9021', '_blank')}>
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

          {/* Alerting Card */}
          <div className="glass-panel border border-slate-800 rounded-xl p-6 group hover:border-rose-500/50 transition-colors cursor-pointer" onClick={() => window.open('http://localhost:9090/alerts', '_blank')}>
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <ArrowRight className="h-5 w-5 text-slate-600 group-hover:text-rose-400 transition-colors group-hover:translate-x-1 duration-300" />
            </div>
            <div className="mt-6">
              <h3 className="text-lg font-bold text-slate-200">Prometheus Alerts</h3>
              <p className="text-sm text-slate-400 mt-2">
                Manage alerting rules for latency spikes, high error rates, or outbox relay worker failures.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
              <span>Port: 9090</span>
              <span className="text-rose-500/70">Alertmanager</span>
            </div>
          </div>

          {/* Service Mesh Card */}
          <div className="glass-panel border border-slate-800 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center backdrop-blur-[2px] z-10 rounded-xl">
              <div className="px-4 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 uppercase tracking-widest">
                Coming Soon
              </div>
            </div>
            <div className="opacity-40">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                  <Activity className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-6">
                <h3 className="text-lg font-bold text-slate-200">Distributed Tracing</h3>
                <p className="text-sm text-slate-400 mt-2">
                  Visualize end-to-end request lifecycles with Jaeger OpenTelemetry traces.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
                <span>Port: 16686</span>
                <span className="text-indigo-500/70">Jaeger APM</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
