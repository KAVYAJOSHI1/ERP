'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { 
  AlertTriangle, 
  Upload, 
  CheckCircle2, 
  Loader2, 
  X, 
  ShieldAlert, 
  FileText, 
  Layers,
  Image as ImageIcon
} from 'lucide-react';

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReportIssueModal({ isOpen, onClose }: ReportIssueModalProps) {
  const pathname = usePathname();
  const { user, token } = useAuthStore();

  const [description, setDescription] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    ticketId?: string;
    ticketNumber?: string;
    error?: string;
  } | null>(null);

  if (!isOpen) return null;

  // Determine current ERP module from path
  const getModuleFromPath = (path: string): string => {
    if (path.startsWith('/finance')) return 'Finance';
    if (path.startsWith('/inventory')) return 'Inventory';
    if (path.startsWith('/procurement')) return 'Procurement';
    if (path.startsWith('/production')) return 'Production';
    if (path.startsWith('/intelligence')) return 'Intelligence';
    if (path.startsWith('/audit')) return 'Audit';
    if (path.startsWith('/users')) return 'User Directory';
    if (path.startsWith('/observability')) return 'Observability';
    return 'General Systems';
  };

  // Determine record ID if present in URL
  const getRecordIdFromPath = (path: string): string | null => {
    const parts = path.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      if (last && last !== 'finance' && last !== 'inventory' && last !== 'procurement' && last !== 'production') {
        return last;
      }
    }
    return null;
  };

  const currentModule = getModuleFromPath(pathname);
  const currentRecordId = getRecordIdFromPath(pathname);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setScreenshotFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description && !screenshotBase64) return;

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const payload = {
        text: description,
        imageBase64: screenshotBase64 ? screenshotBase64.split(',')[1] || screenshotBase64 : undefined,
        fileName: screenshotFile?.name || (screenshotBase64 ? 'screenshot.png' : undefined),
        reporter: user?.email || 'ERP Operator',
        erp_context: {
          erp: 'Smart Manufacturing ERP',
          module: currentModule,
          route: pathname,
          record_id: currentRecordId,
          user_id: user?.id,
          user_role: user?.role,
          timestamp: new Date().toISOString()
        }
      };

      // Call IncidentAI ingestion API (direct or via gateway proxy)
      const res = await fetch('http://localhost:4000/api/incidents/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setSubmitResult({
        success: true,
        ticketId: data.ticket?.id || data.ticket?.ticket_number,
        ticketNumber: data.ticket?.ticket_number || data.ticket?.id
      });
      setDescription('');
      setScreenshotFile(null);
      setScreenshotBase64(null);
    } catch (err: any) {
      setSubmitResult({
        success: false,
        error: err.message || 'Failed to connect to IncidentAI Ingestion API'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-md border border-[#e2e8f0] bg-white shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-[#1e293b] px-5 py-3.5 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-xs bg-[#ef4444] text-white">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-[13px] font-bold tracking-wide">IncidentAI — Report Issue</h3>
              <p className="text-[10px] text-[#94a3b8]">Context-Aware Incident Capture</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="rounded-xs p-1 text-[#94a3b8] hover:bg-[#334155] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Automatically Captured ERP Context Card */}
          <div className="rounded-xs border border-[#e2e8f0] bg-[#f8fafc] p-3 text-[11px] space-y-1.5">
            <div className="flex items-center justify-between text-[#64748b] font-semibold text-[10px] uppercase tracking-wider">
              <span>Automatically Captured ERP Context</span>
              <span className="flex items-center gap-1 text-[#059669] font-bold">
                <CheckCircle2 className="h-3 w-3" /> Auto-Attached
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 text-[#334155]">
              <div>
                <span className="text-[#94a3b8] block text-[10px]">ERP System:</span>
                <span className="font-semibold">Smart Manufacturing ERP</span>
              </div>
              <div>
                <span className="text-[#94a3b8] block text-[10px]">Module:</span>
                <span className="font-semibold text-[#1e3a5f]">{currentModule}</span>
              </div>
              <div>
                <span className="text-[#94a3b8] block text-[10px]">Current Route:</span>
                <span className="font-mono text-[10px] truncate block">{pathname}</span>
              </div>
              <div>
                <span className="text-[#94a3b8] block text-[10px]">Record ID:</span>
                <span className="font-mono text-[10px] font-semibold text-[#6366f1]">{currentRecordId || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[#94a3b8] block text-[10px]">Authenticated User:</span>
                <span className="truncate block font-medium">{user?.email}</span>
              </div>
              <div>
                <span className="text-[#94a3b8] block text-[10px]">ERP Role:</span>
                <span className="uppercase text-[10px] font-semibold text-[#475569]">{user?.role}</span>
              </div>
            </div>
          </div>

          {/* Submission Result Alerts */}
          {submitResult?.success && (
            <div className="rounded-xs border border-[#a7f3d0] bg-[#ecfdf5] p-3 text-[12px] text-[#065f46] space-y-1">
              <div className="flex items-center gap-2 font-bold text-[13px]">
                <CheckCircle2 className="h-4 w-4 text-[#059669]" />
                Incident Created Successfully!
              </div>
              <p>Ticket Number: <span className="font-mono font-bold">{submitResult.ticketNumber}</span></p>
              <p className="text-[11px] text-[#047857]">IncidentAI is now processing OCR, RAG retrieval, and developer routing.</p>
            </div>
          )}

          {submitResult?.error && (
            <div className="rounded-xs border border-[#fecaca] bg-[#fef2f2] p-3 text-[12px] text-[#991b1b] space-y-1">
              <div className="flex items-center gap-2 font-bold text-[13px]">
                <AlertTriangle className="h-4 w-4 text-[#dc2626]" />
                Submission Failed
              </div>
              <p className="text-[11px]">{submitResult.error}</p>
            </div>
          )}

          {/* Form inputs */}
          <form onSubmit={handleSubmit} className="space-y-3 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-[#1e293b] mb-1">
                Description of What Went Wrong <span className="text-[#dc2626]">*</span>
              </label>
              <textarea
                rows={3}
                required={!screenshotBase64}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain the validation error or unexpected behavior..."
                className="w-full rounded-xs border border-[#cbd5e1] p-2.5 text-[12px] text-[#0f172a] focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f] outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#1e293b] mb-1">
                Upload Error Screenshot (Optional)
              </label>
              <div className="flex items-center gap-3 border border-dashed border-[#cbd5e1] rounded-xs p-3 bg-[#f8fafc]">
                <Upload className="h-5 w-5 text-[#64748b]" />
                <div className="flex-1 min-w-0">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="block w-full text-[11px] text-[#64748b] file:mr-2 file:py-1 file:px-2 file:rounded-xs file:border-0 file:text-[10px] file:font-semibold file:bg-[#1e3a5f] file:text-white cursor-pointer"
                  />
                  {screenshotFile && (
                    <p className="text-[10px] text-[#059669] font-medium mt-1 truncate">
                      Selected: {screenshotFile.name} ({(screenshotFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e2e8f0]">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xs border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] px-3 py-1.5 text-[11px] font-semibold text-[#475569]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || (!description && !screenshotBase64)}
                className="flex items-center gap-1.5 rounded-xs bg-[#1e3a5f] hover:bg-[#0f172a] disabled:opacity-50 px-4 py-1.5 text-[11px] font-semibold text-white transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Submitting to IncidentAI...</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>Submit Incident Report</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
