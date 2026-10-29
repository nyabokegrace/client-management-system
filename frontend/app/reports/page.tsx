'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Briefcase,
  Users,
  CheckSquare,
  FileText,
} from 'lucide-react';
import { Header } from '../../components/Header';
import { api } from '../../lib/api';

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

  const handleExport = async (type: 'matters' | 'clients' | 'tasks') => {
    setDownloadingType(type);
    try {
      const url = api.reports.getExportUrl(type);
      const token = localStorage.getItem('siwolo_token');
      const res = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${type}_report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setDownloadingType(null);
    }
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
              disabled={downloadingType === 'matters'}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-800 bg-white border border-[#E5E7EB] hover:bg-gray-50 rounded transition-colors disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              {downloadingType === 'matters' ? 'Downloading...' : 'Export Matters PDF'}
            </button>
            <button
              onClick={() => handleExport('clients')}
              disabled={downloadingType === 'clients'}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-800 bg-white border border-[#E5E7EB] hover:bg-gray-50 rounded transition-colors disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              {downloadingType === 'clients' ? 'Downloading...' : 'Export Clients PDF'}
            </button>
          </div>
        }
      />

      <div className="px-6 py-6 space-y-6">
        {/* Quick PDF Export Banner */}
        <div className="bg-[#111111] text-white p-5 rounded flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-wide flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              Verified Database Export Center
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Download formatted PDF reports for partner meetings, auditing and firm administration.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleExport('matters')}
              disabled={downloadingType === 'matters'}
              className="px-3 py-1.5 text-xs bg-white text-black font-semibold rounded hover:bg-gray-200 transition-colors disabled:opacity-60"
            >
              {downloadingType === 'matters' ? 'Downloading...' : 'Matters (.pdf)'}
            </button>
            <button
              onClick={() => handleExport('clients')}
              disabled={downloadingType === 'clients'}
              className="px-3 py-1.5 text-xs bg-[#222222] text-gray-200 border border-[#333333] font-semibold rounded hover:bg-[#333333] transition-colors disabled:opacity-60"
            >
              {downloadingType === 'clients' ? 'Downloading...' : 'Clients (.pdf)'}
            </button>
            <button
              onClick={() => handleExport('tasks')}
              disabled={downloadingType === 'tasks'}
              className="px-3 py-1.5 text-xs bg-[#222222] text-gray-200 border border-[#333333] font-semibold rounded hover:bg-[#333333] transition-colors disabled:opacity-60"
            >
              {downloadingType === 'tasks' ? 'Downloading...' : 'Tasks (.pdf)'}
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
    </div>
  );
}
