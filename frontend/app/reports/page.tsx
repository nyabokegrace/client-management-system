'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Briefcase,
  Users,
  CheckSquare,
  FileText,
  CheckCircle2,
  Eye,
  ExternalLink,
  X,
} from 'lucide-react';
import { Header } from '../../components/Header';
import { api } from '../../lib/api';

type ReportType = 'matters' | 'clients' | 'tasks';

export default function ReportsPage() {
  const [data, setData] = useState<{
    matters_by_status: { status: string; count: number }[];
    matters_by_type: { matter_type: string; count: number }[];
    clients_by_type: { client_type: string; count: number }[];
    advocate_workload: {
      advocate_id: number;
      advocate_name: string;
      active_matters: number;
      pending_tasks: number;
      upcoming_hearings: number;
    }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingType, setDownloadingType] = useState<string | null>(null);
  const [viewingType, setViewingType] = useState<string | null>(null);
  const [previewPdf, setPreviewPdf] = useState<{
    type: ReportType;
    title: string;
    url: string;
  } | null>(null);
  const [exportSuccess, setExportSuccess] = useState('');

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.reports.analytics();
      setData(res);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // Cleanup preview blob URL when closed
  useEffect(() => {
    return () => {
      if (previewPdf?.url) {
        URL.revokeObjectURL(previewPdf.url);
      }
    };
  }, [previewPdf]);

  // Auto-dismiss export success message
  useEffect(() => {
    if (exportSuccess) {
      const t = setTimeout(() => setExportSuccess(''), 4000);
      return () => clearTimeout(t);
    }
  }, [exportSuccess]);

  const fetchReportBlob = async (type: ReportType, mode: 'download' | 'view'): Promise<Blob> => {
    const baseUrl = api.reports.getExportUrl(type);
    const url = mode === 'view' ? `${baseUrl}&mode=view` : baseUrl;
    const token = localStorage.getItem('siwolo_token');
    if (!token) {
      alert('You are not logged in. Please log in again.');
      throw new Error('No token');
    }
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Token ${token}`,
      },
      credentials: 'same-origin',
    });
    if (res.status === 401) {
      alert('Session expired. Please log in again.');
      throw new Error('Unauthorized');
    }
    if (res.status === 403) {
      alert('You do not have permission to export reports.');
      throw new Error('Forbidden');
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('Report request failed:', res.status, errText);
      throw new Error(`Export failed (${res.status})`);
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('pdf')) {
      const text = await res.text();
      console.error('Unexpected response:', text);
      throw new Error('Invalid file type');
    }
    return res.blob();
  };

  const handleExport = async (type: ReportType) => {
    setDownloadingType(type);
    try {
      const blob = await fetchReportBlob(type, 'download');
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${type}_report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setExportSuccess(`${type.charAt(0).toUpperCase() + type.slice(1)} PDF report downloaded successfully.`);
    } catch (err) {
      console.error('Export error:', err);
      if (err instanceof Error && !['No token', 'Unauthorized', 'Forbidden'].includes(err.message)) {
        alert('Failed to download report. Check browser console for details.');
      }
    } finally {
      setDownloadingType(null);
    }
  };

  const handleViewReport = async (type: ReportType) => {
    setViewingType(type);
    try {
      const blob = await fetchReportBlob(type, 'view');
      if (previewPdf?.url) {
        URL.revokeObjectURL(previewPdf.url);
      }
      const objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const label = type.charAt(0).toUpperCase() + type.slice(1);
      setPreviewPdf({
        type,
        title: `${label} Report (${type}_report.pdf)`,
        url: objectUrl,
      });
    } catch (err) {
      console.error('View report error:', err);
      if (err instanceof Error && !['No token', 'Unauthorized', 'Forbidden'].includes(err.message)) {
        alert('Failed to load report preview. Check browser console for details.');
      }
    } finally {
      setViewingType(null);
    }
  };

  const closePreview = () => {
    if (previewPdf?.url) {
      URL.revokeObjectURL(previewPdf.url);
    }
    setPreviewPdf(null);
  };

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Reports & Analytics"
        subtitle="Operational metrics, advocate caseloads, matters distribution and formatted PDF exports"
        breadcrumbs={[{ name: 'Dashboard', href: '/' }, { name: 'Reports' }]}
        actions={
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleExport('matters')}
              disabled={!!downloadingType || !!viewingType}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-800 bg-white border border-[#E5E7EB] hover:bg-gray-50 rounded transition-colors disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              {downloadingType === 'matters' ? 'Downloading...' : 'Export Matters PDF'}
            </button>
            <button
              onClick={() => handleExport('clients')}
              disabled={!!downloadingType || !!viewingType}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-800 bg-white border border-[#E5E7EB] hover:bg-gray-50 rounded transition-colors disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              {downloadingType === 'clients' ? 'Downloading...' : 'Export Clients PDF'}
            </button>
            <button
              onClick={() => handleExport('tasks')}
              disabled={!!downloadingType || !!viewingType}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-800 bg-white border border-[#E5E7EB] hover:bg-gray-50 rounded transition-colors disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              {downloadingType === 'tasks' ? 'Downloading...' : 'Export Tasks PDF'}
            </button>
          </div>
        }
      />

      {/* Export Success Banner */}
      {exportSuccess && (
        <div className="mx-6 mt-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-xs font-medium px-4 py-3 rounded">
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          {exportSuccess}
        </div>
      )}

      <div className="px-6 py-6 space-y-6">
        {/* Quick PDF Export & In-Platform Viewer Banner */}
        <div className="bg-[#111111] text-white p-5 rounded flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-wide flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              Verified Database Export Center
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Preview formatted PDF reports directly in the platform or download them for partner meetings and auditing.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleViewReport('matters')}
              disabled={!!viewingType || !!downloadingType}
              className="inline-flex items-center px-3 py-1.5 text-xs bg-white text-black font-semibold rounded hover:bg-gray-200 transition-colors disabled:opacity-60"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              {viewingType === 'matters' ? 'Loading...' : 'Matters (.pdf)'}
            </button>
            <button
              onClick={() => handleViewReport('clients')}
              disabled={!!viewingType || !!downloadingType}
              className="inline-flex items-center px-3 py-1.5 text-xs bg-[#222222] text-gray-200 border border-[#333333] font-semibold rounded hover:bg-[#333333] transition-colors disabled:opacity-60"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              {viewingType === 'clients' ? 'Loading...' : 'Clients (.pdf)'}
            </button>
            <button
              onClick={() => handleViewReport('tasks')}
              disabled={!!viewingType || !!downloadingType}
              className="inline-flex items-center px-3 py-1.5 text-xs bg-[#222222] text-gray-200 border border-[#333333] font-semibold rounded hover:bg-[#333333] transition-colors disabled:opacity-60"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              {viewingType === 'tasks' ? 'Loading...' : 'Tasks (.pdf)'}
            </button>
          </div>
        </div>

        {/* Advocate Caseload Table */}
        <div className="bg-white border border-[#E5E7EB] rounded overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5E7EB] bg-[#F9FAFB]">
            <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
              Advocate Workload Distribution
            </h3>
            <p className="text-[11px] text-[#6B7280] mt-0.5">
              Live matter counts, pending tasks and upcoming court appearances by assigned counsel.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#374151] font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3">Advocate Name</th>
                  <th className="px-5 py-3">Active Matters</th>
                  <th className="px-5 py-3">Pending Tasks</th>
                  <th className="px-5 py-3">Upcoming Hearings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-gray-500">
                      Loading workload metrics...
                    </td>
                  </tr>
                ) : !data?.advocate_workload || data.advocate_workload.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-gray-500">
                      No advocate assignments found.
                    </td>
                  </tr>
                ) : (
                  data.advocate_workload.map((adv) => (
                    <tr key={adv.advocate_id} className="hover:bg-gray-50">
                      <td className="px-5 py-3.5 font-semibold text-gray-900">
                        {adv.advocate_name}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-gray-800">
                        {adv.active_matters}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {adv.pending_tasks}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {adv.upcoming_hearings}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2 Grids: Matters by Status & Matters by Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-[#E5E7EB] rounded p-5">
            <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wider mb-4">
              Matters by Status
            </h3>
            <div className="space-y-3">
              {!data?.matters_by_status || data.matters_by_status.length === 0 ? (
                <p className="text-xs text-gray-500">No matter data available.</p>
              ) : (
                data.matters_by_status.map((item) => (
                  <div key={item.status} className="flex items-center justify-between text-xs">
                    <span className="capitalize text-gray-700 font-medium">
                      {item.status.replace('_', ' ')}
                    </span>
                    <span className="font-bold text-black bg-gray-100 px-2 py-0.5 rounded">
                      {item.count}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded p-5">
            <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wider mb-4">
              Matters by Practice Area
            </h3>
            <div className="space-y-3">
              {!data?.matters_by_type || data.matters_by_type.length === 0 ? (
                <p className="text-xs text-gray-500">No practice area data available.</p>
              ) : (
                data.matters_by_type.map((item) => (
                  <div key={item.matter_type} className="flex items-center justify-between text-xs">
                    <span className="capitalize text-gray-700 font-medium">
                      {item.matter_type.replace('_', ' ')}
                    </span>
                    <span className="font-bold text-black bg-gray-100 px-2 py-0.5 rounded">
                      {item.count}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* In-Platform PDF Viewer Modal */}
      {previewPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white border border-[#E5E7EB] rounded shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E5E7EB] bg-[#F9FAFB]">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-[#111111]" />
                <h3 className="text-sm font-semibold text-[#111111]">
                  {previewPdf.title}
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <a
                  href={previewPdf.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-[#E5E7EB] hover:bg-gray-50 rounded transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Open in New Tab
                </a>
                <button
                  onClick={() => handleExport(previewPdf.type)}
                  disabled={!!downloadingType}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-[#111111] hover:bg-black rounded transition-colors disabled:opacity-60"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download PDF
                </button>
                <button
                  onClick={closePreview}
                  className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-200 rounded transition-colors"
                  aria-label="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100">
              <iframe
                src={previewPdf.url}
                title={previewPdf.title}
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
