'use client';

import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  Pencil,
  Trash2,
  MapPin,
  UserCheck,
  RefreshCw,
  FileText,
  Download,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { Header } from '../../components/Header';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { DeleteConfirmModal } from '../../components/DeleteConfirmModal';
import { api } from '../../lib/api';
import { getNairobiDateInputValue } from '../../lib/dates';
import { Matter, Client, Contact, ContactType, MatterPriority, MatterStatus, ClientReport } from '../../types';

export default function MattersPage() {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [existingLocations, setExistingLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Quick contact inline creation
  const [isQuickContactOpen, setIsQuickContactOpen] = useState(false);
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [quickContact, setQuickContact] = useState({
    name: '',
    contact_type: 'advocate' as ContactType,
    firm_name: '',
    phone: '',
    email: '',
  });

  // Edit & Delete state
  const [editingMatter, setEditingMatter] = useState<Matter | null>(null);
  const [deletingMatter, setDeletingMatter] = useState<Matter | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteSummary, setDeleteSummary] = useState<{
    name: string;
    reference: string;
    hearings_count: number;
    tasks_count: number;
    case_updates_count: number;
    documents_count: number;
    message: string;
  } | null>(null);

  // Client Progress Report modal state
  const [clientReportMatter, setClientReportMatter] = useState<Matter | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportData, setReportData] = useState<{
    matter_id: number;
    matter_reference: string;
    has_sent_report: boolean;
    last_sent_at?: string | null;
    last_sent_at_display?: string | null;
    reports: ClientReport[];
  } | null>(null);
  const [reportMode, setReportMode] = useState<'since_last_sent' | 'full_history' | 'custom_range'>('full_history');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [markingSentId, setMarkingSentId] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    matter_reference: '',
    title: '',
    client: 0,
    location: '',
    matter_type: 'litigation',
    priority: 'normal' as MatterPriority,
    status: 'new' as MatterStatus,
    court: '',
    case_number: '',
    opposing_party: '',
    opposing_advocate: '',
    opposing_contact: 0,
    date_opened: '',
    date_closed: '',
    description: '',
    internal_notes: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (searchTerm) params.search = searchTerm;
      if (statusFilter !== 'all') params.status = statusFilter;

      const [mattersRes, clientsRes, contactsRes, locsRes] = await Promise.all([
        api.matters.list(params),
        api.clients.list({ status: 'active' }),
        api.contacts.list(),
        api.matters.locations(),
      ]);

      setMatters(Array.isArray(mattersRes) ? mattersRes : mattersRes.results || []);
      setClients(Array.isArray(clientsRes) ? clientsRes : clientsRes.results || []);
      setContacts(Array.isArray(contactsRes) ? contactsRes : contactsRes.results || []);
      if (Array.isArray(locsRes)) setExistingLocations(locsRes);
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

  const openCreateModal = async () => {
    setEditingMatter(null);
    const today = getNairobiDateInputValue();
    setFormData({
      matter_reference: '',
      title: '',
      client: 0,
      location: '',
      matter_type: 'litigation',
      priority: 'normal',
      status: 'new',
      court: '',
      case_number: '',
      opposing_party: '',
      opposing_advocate: '',
      opposing_contact: 0,
      date_opened: today,
      date_closed: '',
      description: '',
      internal_notes: '',
    });
    setIsModalOpen(true);
    try {
      const sug = await api.matters.suggestReference({ date_opened: today });
      if (sug?.suggested_reference) {
        setFormData((prev) => ({ ...prev, matter_reference: sug.suggested_reference }));
      }
    } catch {
      // fallback
    }
  };

  const handleRefreshSuggestedReference = async () => {
    try {
      const sug = await api.matters.suggestReference({
        location: formData.location,
        date_opened: formData.date_opened,
        matter_type: formData.matter_type,
      });
      if (sug?.suggested_reference) {
        setFormData((prev) => ({ ...prev, matter_reference: sug.suggested_reference }));
      }
    } catch {
      // ignore
    }
  };

  const openEditModal = (matter: Matter) => {
    setEditingMatter(matter);
    setFormData({
      matter_reference: matter.matter_reference,
      title: matter.title,
      client: matter.client,
      location: matter.location || '',
      matter_type: matter.matter_type,
      priority: matter.priority,
      status: matter.status,
      court: matter.court || '',
      case_number: matter.case_number || '',
      opposing_party: matter.opposing_party || '',
      opposing_advocate: matter.opposing_advocate || '',
      opposing_contact: matter.opposing_contact || 0,
      date_opened: matter.date_opened || '',
      date_closed: matter.date_closed || '',
      description: matter.description || '',
      internal_notes: matter.internal_notes || '',
    });
    setIsModalOpen(true);
  };

  const openDeleteModal = async (matter: Matter) => {
    setDeletingMatter(matter);
    setDeleteSummary(null);
    setIsDeleteOpen(true);
    try {
      const summary = await api.matters.deleteSummary(matter.id);
      setDeleteSummary(summary);
    } catch {
      setDeleteSummary({
        name: matter.title,
        reference: matter.matter_reference,
        hearings_count: 0,
        tasks_count: 0,
        case_updates_count: 0,
        documents_count: 0,
        message: `Are you sure you want to delete matter ${matter.matter_reference}?`,
      });
    }
  };

  const handleQuickCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickContact.name.trim()) {
      alert('Please enter a name for the contact.');
      return;
    }
    try {
      setQuickSubmitting(true);
      const created = await api.contacts.create(quickContact);
      setContacts((prev) => [created, ...prev]);
      setFormData((prev) => ({ ...prev, opposing_contact: created.id }));
      setIsQuickContactOpen(false);
      setQuickContact({ name: '', contact_type: 'advocate', firm_name: '', phone: '', email: '' });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create contact.');
    } finally {
      setQuickSubmitting(false);
    }
  };

  const handleSaveMatter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client) {
      alert('Please select a primary client for this matter.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        ...formData,
        opposing_contact: formData.opposing_contact ? formData.opposing_contact : null,
        date_closed: formData.date_closed || null,
      };

      if (editingMatter) {
        await api.matters.update(editingMatter.id, payload);
      } else {
        await api.matters.create(payload);
      }
      setIsModalOpen(false);
      setEditingMatter(null);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save legal matter');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMatter = async () => {
    if (!deletingMatter) return;
    await api.matters.delete(deletingMatter.id);
    setDeletingMatter(null);
    fetchData();
  };

  const handleChangeStatus = async (id: number, newStatus: string) => {
    try {
      await api.matters.changeStatus(id, newStatus);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error updating matter status');
    }
  };

  const openClientReportModal = async (m: Matter) => {
    setClientReportMatter(m);
    setReportStartDate('');
    setReportEndDate(getNairobiDateInputValue());
    setIsReportModalOpen(true);
    try {
      const data = await api.clientReports.list(m.id);
      setReportData(data);
      if (data.has_sent_report) {
        setReportMode('since_last_sent');
      } else {
        setReportMode('full_history');
      }
    } catch {
      setReportData(null);
      setReportMode('full_history');
    }
  };

  const handleGenerateReport = async () => {
    if (!clientReportMatter) return;
    try {
      setGeneratingReport(true);
      await api.clientReports.generate({
        matter_id: clientReportMatter.id,
        mode: reportMode,
        start_date: reportMode === 'custom_range' ? reportStartDate : undefined,
        end_date: reportMode === 'custom_range' ? reportEndDate : undefined,
      });
      const data = await api.clientReports.list(clientReportMatter.id);
      setReportData(data);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to generate client report');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleMarkReportSent = async (reportId: number) => {
    if (!clientReportMatter) return;
    try {
      setMarkingSentId(reportId);
      await api.clientReports.markSent(reportId);
      const data = await api.clientReports.list(clientReportMatter.id);
      setReportData(data);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to mark report as sent');
    } finally {
      setMarkingSentId(null);
    }
  };

  const handleDownloadReport = async (documentId: number, filename: string) => {
    try {
      const token = localStorage.getItem('siwolo_token');
      const url = `/api/v1/documents/${documentId}/download/`;
      const response = await fetch(url, {
        headers: token ? { Authorization: `Token ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error('Failed to retrieve document.');
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error downloading report');
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Matters & Legal Files"
        subtitle="Central case directory, court pleadings, briefs, dispute workspaces and active client files"
        breadcrumbs={[{ name: 'Dashboard', href: '/' }, { name: 'Matters' }]}
        actions={
          <button
            onClick={openCreateModal}
            className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-[#111111] hover:bg-black rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Open Legal Matter
          </button>
        }
      />

      <div className="px-6 py-6 space-y-4">
        {/* Search & Status Filters */}
        <div className="bg-white border border-[#E5E7EB] p-4 rounded flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <form onSubmit={handleSearch} className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by matter reference, title, case number, or client..."
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
        <div className="bg-white border border-[#E5E7EB] rounded overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#374151] font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3">Reference & Location</th>
                  <th className="px-5 py-3">Matter Title & Forum</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Opposing Counsel</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-gray-500">
                      Loading legal matters...
                    </td>
                  </tr>
                ) : matters.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-gray-500">
                      <Briefcase className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                      <p className="font-medium text-gray-700">No legal matter files found.</p>
                      <p className="text-[11px] text-gray-400 mt-1">Open a new matter file for an existing client.</p>
                    </td>
                  </tr>
                ) : (
                  matters.map((matter) => (
                    <tr key={matter.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-semibold text-black block">
                          {matter.matter_reference}
                        </span>
                        {matter.location && (
                          <span className="text-[11px] text-gray-500 inline-flex items-center mt-0.5">
                            <MapPin className="w-3 h-3 mr-0.5 text-gray-400" />
                            {matter.location}
                          </span>
                        )}
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
                      <td className="px-5 py-3.5">
                        {matter.opposing_contact_name ? (
                          <div className="flex items-center space-x-1 text-gray-800 font-medium">
                            <UserCheck className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span>{matter.opposing_contact_name}</span>
                          </div>
                        ) : matter.opposing_advocate ? (
                          <span className="text-gray-700">{matter.opposing_advocate}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                        {matter.opposing_party && (
                          <div className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[140px]">
                            vs {matter.opposing_party}
                          </div>
                        )}
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
                      <td className="px-5 py-3.5 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => openClientReportModal(matter)}
                          title="Generate or view Client Progress Reports"
                          className="px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors inline-flex items-center space-x-1"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Client Report</span>
                        </button>
                        <button
                          onClick={() => openEditModal(matter)}
                          title="Edit matter"
                          className="p-1.5 text-gray-400 hover:text-black rounded hover:bg-gray-100 transition-colors inline-flex items-center"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(matter)}
                          title="Delete matter"
                          className="p-1.5 text-gray-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors inline-flex items-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Open/Edit Legal Matter Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingMatter(null);
        }}
        title={editingMatter ? `Edit Matter: ${editingMatter.matter_reference}` : 'Open New Legal Matter'}
        description={
          editingMatter
            ? `Update case details, forum, or client instructions for ${editingMatter.title}.`
            : 'Initiate a legal engagement, litigation brief, or advisory file with an auto-generated unique matter reference.'
        }
        maxWidth="xl"
      >
        <form onSubmit={handleSaveMatter} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Matter Reference * (Auto-suggested or Custom)
              </label>
              <div className="flex space-x-1.5">
                <input
                  type="text"
                  required
                  placeholder="e.g. SP/Nairobi/CIV/14/2026 or legacy reference"
                  value={formData.matter_reference}
                  onChange={(e) => setFormData({ ...formData, matter_reference: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded font-mono focus:outline-none focus:border-black"
                />
                <button
                  type="button"
                  onClick={handleRefreshSuggestedReference}
                  title="Recompute suggested reference using location and date"
                  className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 border border-[#E5E7EB] rounded text-gray-700 text-xs font-medium inline-flex items-center flex-shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Suggest
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Location / Town
              </label>
              <input
                type="text"
                list="locations-list"
                placeholder="e.g. Nairobi, Kisumu"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
              <datalist id="locations-list">
                {existingLocations.map((loc) => (
                  <option key={loc} value={loc} />
                ))}
              </datalist>
            </div>
          </div>

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
              <option value={0}>— Select Associated Client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name} ({c.client_reference})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Matter Title / Subject *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Injunction Application or Conveyance of LR No..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Date Opened
              </label>
              <input
                type="date"
                value={formData.date_opened}
                onChange={(e) => setFormData({ ...formData, date_opened: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Date Closed (Optional)
              </label>
              <input
                type="date"
                value={formData.date_closed}
                onChange={(e) => setFormData({ ...formData, date_closed: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Matter Type
              </label>
              <select
                value={formData.matter_type}
                onChange={(e) => setFormData({ ...formData, matter_type: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              >
                <option value="litigation">Litigation & Disputes</option>
                <option value="commercial">Commercial & Corporate</option>
                <option value="conveyancing">Conveyancing & Land</option>
                <option value="family">Family & Probate</option>
                <option value="employment">Employment & Labor</option>
                <option value="arbitration">Arbitration & ADR</option>
                <option value="ip">Intellectual Property</option>
                <option value="general">General Advisory</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Priority Level
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

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Initial Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as MatterStatus })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              >
                <option value="new">New</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="awaiting_court">Awaiting Court</option>
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
                placeholder="e.g. ABC Company Ltd"
                value={formData.opposing_party}
                onChange={(e) => setFormData({ ...formData, opposing_party: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-gray-700">
                  Opposing Representative (Contact Directory)
                </label>
                <button
                  type="button"
                  onClick={() => setIsQuickContactOpen(true)}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center"
                >
                  <Plus className="w-3 h-3 mr-0.5" />
                  Add new contact
                </button>
              </div>
              <select
                value={formData.opposing_contact}
                onChange={(e) => setFormData({ ...formData, opposing_contact: Number(e.target.value) })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              >
                <option value={0}>— None / Unlinked Contact —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.firm_name ? `(${c.firm_name})` : `[${c.contact_type_display || c.contact_type}]`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Free-text Opposing Advocate (Alternate or External Details)
            </label>
            <input
              type="text"
              placeholder="e.g. Bowmans Kenya"
              value={formData.opposing_advocate}
              onChange={(e) => setFormData({ ...formData, opposing_advocate: e.target.value })}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
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
              onClick={() => {
                setIsModalOpen(false);
                setEditingMatter(null);
              }}
              className="px-4 py-2 border border-[#E5E7EB] rounded font-medium hover:bg-gray-50 text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[#111111] text-white font-medium rounded hover:bg-black disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Saving...' : editingMatter ? 'Save Changes' : 'Open Matter File'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Add Contact Modal */}
      <Modal
        isOpen={isQuickContactOpen}
        onClose={() => setIsQuickContactOpen(false)}
        title="Add New Contact"
        description="Quickly register opposing counsel or an external contact without leaving the matter form."
        maxWidth="md"
      >
        <form onSubmit={handleQuickCreateContact} className="space-y-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Contact Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. James Mwangi, Advocate"
              value={quickContact.name}
              onChange={(e) => setQuickContact({ ...quickContact, name: e.target.value })}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Type
              </label>
              <select
                value={quickContact.contact_type}
                onChange={(e) => setQuickContact({ ...quickContact, contact_type: e.target.value as ContactType })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              >
                <option value="advocate">Advocate</option>
                <option value="law_firm">Law Firm</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Firm Name
              </label>
              <input
                type="text"
                placeholder="Law Firm Name"
                value={quickContact.firm_name}
                onChange={(e) => setQuickContact({ ...quickContact, firm_name: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="text"
                placeholder="+254..."
                value={quickContact.phone}
                onChange={(e) => setQuickContact({ ...quickContact, phone: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                placeholder="counsel@..."
                value={quickContact.email}
                onChange={(e) => setQuickContact({ ...quickContact, email: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>
          </div>
          <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsQuickContactOpen(false)}
              className="px-3 py-1.5 border border-[#E5E7EB] rounded text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={quickSubmitting}
              className="px-3.5 py-1.5 bg-[#111111] text-white rounded font-medium hover:bg-black disabled:opacity-50"
            >
              {quickSubmitting ? 'Adding...' : 'Add & Select'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      {deletingMatter && (
        <DeleteConfirmModal
          isOpen={isDeleteOpen}
          onClose={() => {
            setIsDeleteOpen(false);
            setDeletingMatter(null);
            setDeleteSummary(null);
          }}
          onConfirm={handleDeleteMatter}
          title="Delete Legal Matter File"
          recordName={deletingMatter.title}
          recordReference={deletingMatter.matter_reference}
          requireReferenceMatch={true}
          message={
            deleteSummary ? (
              <p>{deleteSummary.message}</p>
            ) : (
              <p>Computing related hearings, tasks, and updates...</p>
            )
          }
        />
      )}

      {/* Client Progress Report Modal */}
      {clientReportMatter && (
        <Modal
          isOpen={isReportModalOpen}
          onClose={() => {
            setIsReportModalOpen(false);
            setClientReportMatter(null);
            setReportData(null);
          }}
          title={`Client Progress Report — ${clientReportMatter.matter_reference}`}
          description={`Generate and track formal progress reports for ${clientReportMatter.client_name || 'Client'}.`}
          maxWidth="2xl"
        >
          <div className="space-y-5 text-xs">
            {/* Report Mode Choices */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded space-y-3">
              <h4 className="font-semibold text-gray-900 text-xs">
                Select Reporting Period
              </h4>

              <div className="space-y-2">
                {/* 1. New since last sent */}
                <label
                  className={`flex items-start space-x-2.5 p-2 rounded border ${
                    !reportData?.has_sent_report
                      ? 'opacity-50 cursor-not-allowed bg-gray-100 border-gray-200'
                      : reportMode === 'since_last_sent'
                      ? 'bg-blue-50/50 border-blue-400 cursor-pointer'
                      : 'bg-white border-gray-200 cursor-pointer hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportMode"
                    value="since_last_sent"
                    disabled={!reportData?.has_sent_report}
                    checked={reportMode === 'since_last_sent'}
                    onChange={() => setReportMode('since_last_sent')}
                    className="mt-0.5 text-black focus:ring-black"
                  />
                  <div>
                    <span className="font-semibold text-gray-900 block">
                      New since last sent
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {reportData?.has_sent_report
                        ? `Covers updates since last report sent on ${reportData.last_sent_at_display}`
                        : 'Disabled: No report has been marked as sent yet for this matter.'}
                    </span>
                  </div>
                </label>

                {/* 2. Full history */}
                <label
                  className={`flex items-start space-x-2.5 p-2 rounded border cursor-pointer ${
                    reportMode === 'full_history'
                      ? 'bg-blue-50/50 border-blue-400'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportMode"
                    value="full_history"
                    checked={reportMode === 'full_history'}
                    onChange={() => setReportMode('full_history')}
                    className="mt-0.5 text-black focus:ring-black"
                  />
                  <div>
                    <span className="font-semibold text-gray-900 block">
                      Full history
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Includes all client-facing developments, directions and milestones from file opening to today.
                    </span>
                  </div>
                </label>

                {/* 3. Custom date range */}
                <label
                  className={`flex items-start space-x-2.5 p-2 rounded border cursor-pointer ${
                    reportMode === 'custom_range'
                      ? 'bg-blue-50/50 border-blue-400'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportMode"
                    value="custom_range"
                    checked={reportMode === 'custom_range'}
                    onChange={() => setReportMode('custom_range')}
                    className="mt-0.5 text-black focus:ring-black"
                  />
                  <div className="flex-1">
                    <span className="font-semibold text-gray-900 block">
                      Custom date range
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Filter client-facing updates between specific dates.
                    </span>

                    {reportMode === 'custom_range' && (
                      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-200">
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">
                            From Date
                          </label>
                          <input
                            type="date"
                            required
                            value={reportStartDate}
                            onChange={(e) => setReportStartDate(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-black"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">
                            To Date
                          </label>
                          <input
                            type="date"
                            required
                            value={reportEndDate}
                            onChange={(e) => setReportEndDate(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-black"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </label>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleGenerateReport}
                  disabled={
                    generatingReport ||
                    (reportMode === 'custom_range' && (!reportStartDate || !reportEndDate))
                  }
                  className="px-4 py-2 bg-[#111111] text-white text-xs font-semibold rounded hover:bg-black disabled:opacity-50 transition-colors inline-flex items-center"
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  {generatingReport ? 'Generating & Storing PDF...' : 'Generate Progress Report PDF'}
                </button>
              </div>
            </div>

            {/* Dispatch & Generation History */}
            <div>
              <h4 className="font-semibold text-gray-900 text-xs mb-2 flex items-center justify-between">
                <span>Previously Generated Reports for this Matter</span>
                <span className="text-[11px] text-gray-400 font-normal">
                  Saved automatically into Private Documents
                </span>
              </h4>

              <div className="border border-gray-200 rounded overflow-hidden">
                {!reportData?.reports || reportData.reports.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-xs">
                    No client progress reports generated for this matter yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-56">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F9FAFB] border-b border-gray-200 text-gray-600 font-semibold text-[11px]">
                        <tr>
                          <th className="px-3 py-2">Generated</th>
                          <th className="px-3 py-2">Period Covered</th>
                          <th className="px-3 py-2">Sent Status</th>
                          <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {reportData.reports.map((r) => (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 whitespace-nowrap text-gray-900 font-medium">
                              {r.generated_at_display}
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              {r.period_covered}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {r.sent_at ? (
                                <span className="inline-flex items-center text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 font-medium">
                                  <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" />
                                  Sent: {r.sent_at_display}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleMarkReportSent(r.id)}
                                  disabled={markingSentId === r.id}
                                  className="text-[11px] px-2 py-0.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded font-semibold transition-colors disabled:opacity-50"
                                >
                                  {markingSentId === r.id ? 'Marking...' : 'Mark as sent'}
                                </button>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleDownloadReport(r.document, r.document_filename)}
                                title="Download Report PDF"
                                className="p-1 text-gray-600 hover:text-black rounded hover:bg-gray-100 inline-flex items-center space-x-1"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span className="text-[11px]">Download</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsReportModalOpen(false);
                  setClientReportMatter(null);
                  setReportData(null);
                }}
                className="px-3 py-1.5 border border-[#E5E7EB] rounded font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
