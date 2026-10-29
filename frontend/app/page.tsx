'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Users,
  Calendar,
  AlertTriangle,
  Clock,
  ArrowRight,
  Plus,
  Shield,
  FileText,
  CheckCircle,
} from 'lucide-react';
import { Header } from '../components/Header';
import { Badge } from '../components/Badge';
import { api } from '../lib/api';
import { DashboardSummary } from '../types';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const summary = await api.reports.dashboard();
      setData(summary);
    } catch (err: unknown) {
      // If unauthorized or local backend not started, keep graceful empty structure
      setError(err instanceof Error ? err.message : 'Unable to connect to CMS backend API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Dashboard"
        subtitle="Workload, hearings, matters and active matters overview for Siwolo P.O Law Advocates"
        actions={
          <div className="flex items-center space-x-2">
            <Link
              href="/clients"
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-[#111111] hover:bg-black rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              New Client
            </Link>
            <Link
              href="/matters"
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-[#E5E7EB] hover:bg-gray-50 rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              New Matter
            </Link>
          </div>
        }
      />

      <div className="px-6 py-6 space-y-6">
        {error && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-start justify-between">
            <div>
              <p className="font-semibold">Notice: Live Backend Connection</p>
              <p className="mt-0.5">{error}. Ensure the Django backend service is running on port 8000.</p>
            </div>
            <button
              onClick={fetchDashboard}
              className="px-2.5 py-1 text-xs bg-amber-200 hover:bg-amber-300 text-amber-900 rounded font-medium ml-4 flex-shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* 4 KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E5E7EB] p-5 rounded">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Active Matters
              </span>
              <div className="p-2 bg-gray-100 rounded text-black">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-[#111111]">
                {loading ? '—' : data?.kpis.active_matters ?? 0}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[#6B7280]">Live client files under active handling</p>
          </div>

          <div className="bg-white border border-[#E5E7EB] p-5 rounded">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Registered Clients
              </span>
              <div className="p-2 bg-gray-100 rounded text-black">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-[#111111]">
                {loading ? '—' : data?.kpis.registered_clients ?? 0}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[#6B7280]">Total individual & corporate accounts</p>
          </div>

          <div className="bg-white border border-[#E5E7EB] p-5 rounded">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Upcoming Hearings
              </span>
              <div className="p-2 bg-gray-100 rounded text-black">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-[#111111]">
                {loading ? '—' : data?.kpis.upcoming_hearings ?? 0}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[#6B7280]">Court dates and mentions pending</p>
          </div>

          <div className="bg-white border border-[#E5E7EB] p-5 rounded">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Overdue Tasks
              </span>
              <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-700">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-rose-700">
                {loading ? '—' : data?.kpis.overdue_tasks ?? 0}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[#6B7280]">Tasks requiring immediate action</p>
          </div>
        </div>

        {/* Dashboard 2-column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Hearings */}
          <div className="bg-white border border-[#E5E7EB] rounded overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F9FAFB]">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-gray-700" />
                <h2 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
                  Upcoming Court Hearings
                </h2>
              </div>
              <Link
                href="/hearings"
                className="text-xs text-black font-semibold hover:underline flex items-center"
              >
                View all
                <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </div>
            <div className="divide-y divide-[#E5E7EB]">
              {!data?.upcoming_hearings || data.upcoming_hearings.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#6B7280]">
                  No upcoming court hearings scheduled.
                </div>
              ) : (
                data.upcoming_hearings.map((hearing) => (
                  <div key={hearing.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-xs text-[#111111]">
                            {hearing.matter_reference}
                          </span>
                          <Badge variant="info" size="sm">
                            {hearing.hearing_type_display || hearing.hearing_type}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-1">
                          {hearing.matter_title}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {hearing.court || 'Court not specified'} • {hearing.location_details || 'Courtroom'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold text-[#111111]">
                          {new Date(hearing.hearing_date).toLocaleDateString()}
                        </span>
                        <p className="text-[10px] text-gray-500">
                          {new Date(hearing.hearing_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tasks Requiring Attention */}
          <div className="bg-white border border-[#E5E7EB] rounded overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F9FAFB]">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-gray-700" />
                <h2 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
                  Tasks Requiring Attention
                </h2>
              </div>
              <Link
                href="/tasks"
                className="text-xs text-black font-semibold hover:underline flex items-center"
              >
                View all
                <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </div>
            <div className="divide-y divide-[#E5E7EB]">
              {!data?.tasks_requiring_attention || data.tasks_requiring_attention.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#6B7280]">
                  No pending tasks requiring attention.
                </div>
              ) : (
                data.tasks_requiring_attention.map((task) => (
                  <div key={task.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-xs text-[#111111]">{task.title}</span>
                          {task.is_overdue && (
                            <Badge variant="danger" size="sm">Overdue</Badge>
                          )}
                          <Badge variant={task.priority === 'urgent' ? 'danger' : 'default'} size="sm">
                            {task.priority}
                          </Badge>
                        </div>
                        {task.matter_reference && (
                          <p className="text-[11px] text-gray-500 mt-1">
                            Matter: {task.matter_reference}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-[11px] text-[#6B7280]">
                        {task.due_date ? `Due: ${new Date(task.due_date).toLocaleDateString()}` : 'No due date'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recently Updated Legal Matters */}
          <div className="bg-white border border-[#E5E7EB] rounded overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F9FAFB]">
              <div className="flex items-center space-x-2">
                <Briefcase className="w-4 h-4 text-gray-700" />
                <h2 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
                  Recently Updated Matters
                </h2>
              </div>
              <Link
                href="/matters"
                className="text-xs text-black font-semibold hover:underline flex items-center"
              >
                View all
                <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </div>
            <div className="divide-y divide-[#E5E7EB]">
              {!data?.recently_updated_matters || data.recently_updated_matters.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#6B7280]">
                  No matter records found.
                </div>
              ) : (
                data.recently_updated_matters.map((matter) => (
                  <div key={matter.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-xs text-[#111111]">
                            {matter.matter_reference}
                          </span>
                          <Badge variant="default" size="sm">
                            {matter.status_display || matter.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-800 font-medium mt-1">
                          {matter.title}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Client: {matter.client_name || 'N/A'} • Assigned: {matter.assigned_advocate_name || 'Unassigned'}
                        </p>
                      </div>
                      <span className="text-[11px] text-gray-400">
                        {new Date(matter.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Audit & Activity Trail */}
          <div className="bg-white border border-[#E5E7EB] rounded overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F9FAFB]">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-gray-700" />
                <h2 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
                  Recent Audit Trail
                </h2>
              </div>
              <Link
                href="/settings"
                className="text-xs text-black font-semibold hover:underline flex items-center"
              >
                View logs
                <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </div>
            <div className="divide-y divide-[#E5E7EB]">
              {!data?.recent_activity || data.recent_activity.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#6B7280]">
                  No audit trail recorded yet.
                </div>
              ) : (
                data.recent_activity.map((log) => (
                  <div key={log.id} className="p-3.5 text-xs flex items-center justify-between hover:bg-gray-50">
                    <div className="min-w-0 pr-4">
                      <span className="font-medium text-[#111111]">{log.actor_name || 'System'}: </span>
                      <span className="text-gray-600">{log.action_display || log.action} on {log.module_display || log.module}</span>
                      <p className="text-[11px] text-gray-400 truncate">{log.target_repr}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
