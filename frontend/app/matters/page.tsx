'use client';

import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  Building,
  User as UserIcon,
  ChevronDown,
  Scale,
  Calendar,
} from 'lucide-react';
import { Header } from '../../components/Header';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { api } from '../../lib/api';
import { Matter, Client, User, MatterStatus, MatterPriority } from '../../types';

export default function MattersPage() {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [advocates, setAdvocates] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    client: 0,
    matter_type: 'litigation',
    priority: 'normal' as MatterPriority,
    status: 'new' as MatterStatus,
    assigned_advocate: null as number | null,
    court: '',
    case_number: '',
    opposing_party: '',
    opposing_advocate: '',
    description: '',
    internal_notes: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (searchTerm) params.search = searchTerm;
      if (statusFilter !== 'all') params.status = statusFilter;

      const [mattersRes, clientsRes, usersRes] = await Promise.all([
        api.matters.list(params),
        api.clients.list({ status: 'active' }),
        api.users.list({ role: 'advocate' }),
      ]);

      setMatters(Array.isArray(mattersRes) ? mattersRes : mattersRes.results || []);
      setClients(Array.isArray(clientsRes) ? clientsRes : clientsRes.results || []);
      setAdvocates(Array.isArray(usersRes) ? usersRes : usersRes.results || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const handleCreateMatter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client) {
      alert('Please select a primary client for this matter.');
      return;
    }

    try {
      setSubmitting(true);
      await api.matters.create({
        ...formData,
        assigned_advocate: formData.assigned_advocate || undefined,
      });
      setIsModalOpen(false);
      setFormData({
        title: '',
        client: 0,
        matter_type: 'litigation',
        priority: 'normal',
        status: 'new',
        assigned_advocate: null,
        court: '',
        case_number: '',
        opposing_party: '',
        opposing_advocate: '',
        description: '',
        internal_notes: '',
      });
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create legal matter');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeStatus = async (id: number, newStatus: string) => {
    try {
      await api.matters.changeStatus(id, newStatus);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error updating matter status');
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Matters & Legal Files"
        subtitle="Central case directory, court pleadings, briefs, assignments and dispute workspaces"
        breadcrumbs={[{ name: 'Dashboard', href: '/' }, { name: 'Matters' }]}
        actions={
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-[#111111] hover:bg-black rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Open Legal Matter
          </button>
        }
      />

      <div className="px-6 py-6 space-y-4">
        {/* Search and Filters */}
        <div className="bg-white border border-[#E5E7EB] p-4 rounded flex flex-col sm:flex-row items-center justify-between gap-3">
          <form onSubmit={handleSearch} className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by matter reference (SWL-...), title, case number, or client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </form>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <div className="flex items-center space-x-1.5 text-xs text-[#6B7280]">
              <Filter className="w-3.5 h-3.5" />
              <span>Status:</span>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded text-[#111111] focus:outline-none"
            >
              <option value="all">All Matters</option>
              <option value="new">New</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="awaiting_court">Awaiting Court</option>
              <option value="concluded">Concluded</option>
            </select>
          </div>
        </div>

        {/* Matters Table */}
        <div className="bg-white border border-[#E5E7EB] rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#374151] font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3">Matter Title & Forum</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Assigned Advocate</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                      Loading legal matters...
                    </td>
                  </tr>
                ) : matters.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                      <Briefcase className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                      <p className="font-medium text-gray-700">No legal matter files found.</p>
                      <p className="text-[11px] text-gray-400 mt-1">Open a new matter file for an existing client.</p>
                    </td>
                  </tr>
                ) : (
                  matters.map((matter) => (
                    <tr key={matter.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-medium text-black">
                        {matter.matter_reference}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-gray-900">{matter.title}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {matter.court || 'Internal Engagement'} {matter.case_number ? `• ${matter.case_number}` : ''}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-gray-800">
                        {matter.client_name}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">
                        {matter.matter_type_display || matter.matter_type}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={
                            matter.priority === 'urgent'
                              ? 'danger'
                              : matter.priority === 'high'
                              ? 'warning'
                              : 'default'
                          }
                          size="sm"
                        >
                          {matter.priority_display || matter.priority}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {matter.assigned_advocate_name || 'Unassigned'}
                      </td>
                      <td className="px-5 py-3.5">
                        <select
                          value={matter.status}
                          onChange={(e) => handleChangeStatus(matter.id, e.target.value)}
                          className="text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded px-2 py-1 font-medium focus:outline-none focus:border-black cursor-pointer"
                        >
                          <option value="new">New</option>
                          <option value="active">Active</option>
                          <option value="pending">Pending</option>
                          <option value="awaiting_client">Awaiting Client</option>
                          <option value="awaiting_court">Awaiting Court</option>
                          <option value="concluded">Concluded</option>
                          <option value="archived">Archived</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Open Legal Matter Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Open New Legal Matter"
        description="Initiate a legal engagement, litigation brief, or advisory file with an auto-generated unique matter reference."
        maxWidth="xl"
      >
        <form onSubmit={handleCreateMatter} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Primary Client *
            </label>
            <select
              required
              value={formData.client}
              onChange={(e) => setFormData({ ...formData, client: Number(e.target.value) })}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            >
              <option value={0}>— Select Client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.client_reference} - {c.display_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Matter Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Siwolo v. National Bank of Kenya or Conveyance of LR No. 209/..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Matter Type
              </label>
              <select
                value={formData.matter_type}
                onChange={(e) => setFormData({ ...formData, matter_type: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              >
                <option value="litigation">Civil / Criminal Litigation</option>
                <option value="commercial">Commercial & Corporate Law</option>
                <option value="conveyancing">Conveyancing & Real Estate</option>
                <option value="family">Family & Succession Law</option>
                <option value="employment">Labor & Employment</option>
                <option value="arbitration">Arbitration & ADR</option>
                <option value="ip">Intellectual Property</option>
                <option value="general">General Advisory & Practice</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as MatterPriority })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Court / Tribunal Forum
              </label>
              <input
                type="text"
                placeholder="e.g. High Court at Milimani (Commercial)"
                value={formData.court}
                onChange={(e) => setFormData({ ...formData, court: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Official Case Number
              </label>
              <input
                type="text"
                placeholder="e.g. HCCC/E123/2026"
                value={formData.case_number}
                onChange={(e) => setFormData({ ...formData, case_number: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Opposing Party
              </label>
              <input
                type="text"
                value={formData.opposing_party}
                onChange={(e) => setFormData({ ...formData, opposing_party: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Assigned Advocate
              </label>
              <select
                value={formData.assigned_advocate || ''}
                onChange={(e) => setFormData({ ...formData, assigned_advocate: e.target.value ? Number(e.target.value) : null })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              >
                <option value="">— Select Lead Advocate —</option>
                {advocates.map((adv) => (
                  <option key={adv.id} value={adv.id}>
                    {adv.full_name} ({adv.username})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Matter Description / Instructions
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </div>

          <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-[#E5E7EB] rounded font-medium hover:bg-gray-50 text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[#111111] text-white font-medium rounded hover:bg-black disabled:opacity-50"
            >
              {submitting ? 'Creating Matter...' : 'Open Matter File'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
