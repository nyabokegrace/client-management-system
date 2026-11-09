'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Clock,
  Filter,
  Search,
  User as UserIcon,
  ChevronDown,
  ChevronUp,
  X,
  Pencil,
  Trash2,
  Calendar,
  CheckSquare,
  AlertTriangle,
  Lock,
  Share2,
} from 'lucide-react';
import { Header } from '../../components/Header';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { DeleteConfirmModal } from '../../components/DeleteConfirmModal';
import { api } from '../../lib/api';
import { getNairobiDatetimeInputValue, formatNairobiDateTime } from '../../lib/dates';
import { CaseUpdate, Hearing, Matter, TaskPriority } from '../../types';

interface OrderItem {
  id?: number;
  description: string;
  due_date: string;
  priority: TaskPriority;
  status?: string;
}

export default function CaseUpdatesPage() {
  const [updates, setUpdates] = useState<CaseUpdate[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [matterFilter, setMatterFilter] = useState<number | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit & Delete state
  const [editingUpdate, setEditingUpdate] = useState<CaseUpdate | null>(null);
  const [deletingUpdate, setDeletingUpdate] = useState<CaseUpdate | null>(null);
  const [deleteSummaryData, setDeleteSummaryData] = useState<{
    name: string;
    reference: string;
    message: string;
    generated_hearings?: Array<{ id: number; hearing_type: string; hearing_date: string }>;
    generated_tasks?: Array<{ id: number; title: string; due_date: string; status: string }>;
    has_completed_tasks?: boolean;
  } | null>(null);
  const [removeLinkedRecords, setRemoveLinkedRecords] = useState(true);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Searchable matter dropdown state
  const [matterSearch, setMatterSearch] = useState('');
  const [matterDropdownOpen, setMatterDropdownOpen] = useState(false);

  // Structured Next Steps collapsible
  const [isDirectionsExpanded, setIsDirectionsExpanded] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    matter: 0,
    hearing: 0 as number | null,
    title: '',
    category: 'court_appearance',
    event_datetime: '',
    description: '',
    share_with_client: true,
    next_court_date: {
      hearing_date: '',
      hearing_type: 'mention',
      court: '',
    },
    orders: [] as OrderItem[],
    update_linked_records: true,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {};
      if (searchTerm) params.search = searchTerm;
      if (matterFilter !== 'all') params.matter = matterFilter;
      if (categoryFilter !== 'all') params.category = categoryFilter;

      const [updatesRes, mattersRes, hearingsRes] = await Promise.all([
        api.caseUpdates.list(params),
        api.matters.list(),
        api.hearings.list(),
      ]);

      setUpdates(Array.isArray(updatesRes) ? updatesRes : (updatesRes as any).results || []);
      setMatters(Array.isArray(mattersRes) ? mattersRes : (mattersRes as any).results || []);
      setHearings(Array.isArray(hearingsRes) ? hearingsRes : (hearingsRes as any).results || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [matterFilter, categoryFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const openCreateModal = () => {
    setEditingUpdate(null);
    setFormData({
      matter: 0,
      hearing: null,
      title: '',
      category: 'court_appearance',
      event_datetime: getNairobiDatetimeInputValue(),
      description: '',
      share_with_client: true,
      next_court_date: {
        hearing_date: '',
        hearing_type: 'mention',
        court: '',
      },
      orders: [],
      update_linked_records: true,
    });
    setMatterSearch('');
    setIsDirectionsExpanded(true);
    setIsModalOpen(true);
  };

  const openEditModal = (u: CaseUpdate) => {
    setEditingUpdate(u);
    const genH = u.generated_hearings?.[0];
    const genTasks: OrderItem[] =
      u.generated_tasks?.map((t) => ({
        id: t.id,
        description: t.description || t.title,
        due_date: getNairobiDatetimeInputValue(t.due_date),
        priority: (t.priority as TaskPriority) || 'high',
        status: t.status,
      })) || [];

    setFormData({
      matter: u.matter,
      hearing: u.hearing || null,
      title: u.title,
      category: u.category,
      event_datetime: getNairobiDatetimeInputValue(u.event_datetime),
      description: u.description || '',
      share_with_client: u.share_with_client,
      next_court_date: {
        hearing_date: genH ? getNairobiDatetimeInputValue(genH.hearing_date) : '',
        hearing_type: genH?.hearing_type || 'mention',
        court: genH?.court || '',
      },
      orders: genTasks,
      update_linked_records: true,
    });

    const foundMatter = matters.find((m) => m.id === u.matter);
    setMatterSearch(foundMatter ? `${foundMatter.matter_reference} — ${foundMatter.title}` : '');
    setIsDirectionsExpanded(Boolean(u.hearing || genH || genTasks.length || u.category === 'court_appearance'));
    setIsModalOpen(true);
  };

  const openDeleteModal = async (u: CaseUpdate) => {
    setDeletingUpdate(u);
    setRemoveLinkedRecords(true);
    try {
      const summary = await api.caseUpdates.deleteSummary(u.id);
      setDeleteSummaryData(summary);
    } catch {
      setDeleteSummaryData(null);
    }
    setIsDeleteOpen(true);
  };

  const handleCategoryChange = (cat: string) => {
    setFormData((prev) => ({
      ...prev,
      category: cat,
      share_with_client: cat === 'internal_review' ? false : prev.share_with_client,
    }));
    if (cat === 'court_appearance') {
      setIsDirectionsExpanded(true);
    }
  };

  const handleMatterSelect = (m: Matter) => {
    setFormData((prev) => ({
      ...prev,
      matter: m.id,
      hearing: null,
      next_court_date: {
        ...prev.next_court_date,
        court: prev.next_court_date.court || m.court || '',
      },
    }));
    setMatterSearch(`${m.matter_reference} — ${m.title}`);
    setMatterDropdownOpen(false);
  };

  const handleAddOrder = () => {
    setFormData((prev) => ({
      ...prev,
      orders: [
        ...prev.orders,
        {
          description: '',
          due_date: '',
          priority: 'high',
        },
      ],
    }));
  };

  const handleRemoveOrder = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      orders: prev.orders.filter((_, i) => i !== idx),
    }));
  };

  const handleOrderChange = (idx: number, field: keyof OrderItem, val: string) => {
    setFormData((prev) => {
      const updated = [...prev.orders];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...prev, orders: updated };
    });
  };

  const handleSaveUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.matter) {
      alert('Please select a legal matter.');
      return;
    }

    try {
      setSubmitting(true);

      const payload: any = {
        matter: formData.matter,
        hearing: formData.hearing && formData.hearing > 0 ? formData.hearing : null,
        title: formData.title,
        category: formData.category,
        event_datetime: formData.event_datetime,
        description: formData.description,
        share_with_client: formData.category === 'internal_review' ? false : formData.share_with_client,
      };

      if (formData.next_court_date.hearing_date) {
        payload.next_court_date = {
          hearing_date: formData.next_court_date.hearing_date,
          hearing_type: formData.next_court_date.hearing_type || 'mention',
          court: formData.next_court_date.court || undefined,
        };
      } else if (editingUpdate) {
        payload.next_court_date = null;
      }

      const validOrders = formData.orders
        .filter((o) => o.description.trim().length > 0)
        .map((o) => ({
          id: o.id,
          description: o.description.trim(),
          due_date: o.due_date || undefined,
          priority: o.priority,
        }));

      if (validOrders.length > 0 || (editingUpdate && formData.orders.length === 0)) {
        payload.orders = validOrders;
      }

      if (editingUpdate) {
        payload.update_linked_records = formData.update_linked_records;
        await api.caseUpdates.update(editingUpdate.id, payload);
      } else {
        await api.caseUpdates.create(payload);
      }

      setIsModalOpen(false);
      setEditingUpdate(null);
      setMatterSearch('');
      setMatterDropdownOpen(false);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save case update');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUpdate = async () => {
    if (!deletingUpdate) return;
    try {
      await api.caseUpdates.delete(deletingUpdate.id, removeLinkedRecords);
      setIsDeleteOpen(false);
      setDeletingUpdate(null);
      setDeleteSummaryData(null);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete case update');
    }
  };

  // Scheduled hearings for the currently chosen matter
  const scheduledHearingsForMatter = hearings.filter(
    (h) => h.matter === formData.matter && (h.status === 'scheduled' || h.id === formData.hearing)
  );

  const hasCompletedTask = editingUpdate?.generated_tasks?.some((t) => t.status === 'completed');

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Case Updates & Proceedings"
        subtitle="Chronological record of court appearances, filings, instructions and client developments"
        breadcrumbs={[{ name: 'Dashboard', href: '/' }, { name: 'Case Updates' }]}
        actions={
          <button
            onClick={openCreateModal}
            className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-[#111111] hover:bg-black rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Record Case Update
          </button>
        }
      />

      <div className="px-6 py-6 space-y-6">
        {/* Filter & Search Bar */}
        <div className="bg-white border border-[#E5E7EB] p-4 rounded shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <form onSubmit={handleSearch} className="flex-1 relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search update narratives, case titles, references..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 border border-[#E5E7EB] rounded text-xs focus:outline-none focus:border-black"
            />
          </form>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <div className="flex items-center space-x-1.5">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border border-[#E5E7EB] rounded text-xs px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-black"
              >
                <option value="all">All Categories</option>
                <option value="court_appearance">Court Appearance</option>
                <option value="filing">Court Filing</option>
                <option value="client_comm">Client Communication</option>
                <option value="doc_received">Document Received</option>
                <option value="doc_submitted">Document Submitted</option>
                <option value="negotiation">Negotiation / Settlement</option>
                <option value="internal_review">Internal Legal Strategy</option>
                <option value="general">General Milestone</option>
              </select>
            </div>

            <select
              value={matterFilter}
              onChange={(e) => setMatterFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="border border-[#E5E7EB] rounded text-xs px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-black max-w-[200px] truncate"
            >
              <option value="all">All Matters</option>
              {matters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.matter_reference} — {m.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Timeline View */}
        <div className="bg-white border border-[#E5E7EB] rounded p-6 shadow-sm">
          {loading ? (
            <div className="py-12 text-center text-xs text-gray-500">
              Loading chronological case updates...
            </div>
          ) : updates.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <Clock className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-xs font-medium text-gray-700">No case progress recorded yet.</p>
              <p className="text-[11px] text-gray-400 mt-1">
                Record a filing, court appearance or key development on any active matter.
              </p>
            </div>
          ) : (
            <div className="relative border-l-2 border-gray-200 ml-4 pl-6 space-y-8">
              {updates.map((item) => (
                <div key={item.id} className="relative group">
                  <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 bg-black border-2 border-white rounded-full" />
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-mono text-xs font-bold text-black">
                          {item.matter_reference}
                        </span>
                        <Badge variant="info" size="sm">
                          {item.category_display || item.category}
                        </Badge>
                        {item.share_with_client ? (
                          <span className="inline-flex items-center text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-medium">
                            <Share2 className="w-2.5 h-2.5 mr-1" />
                            Client Shared
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 font-medium">
                            <Lock className="w-2.5 h-2.5 mr-1" />
                            Internal Only
                          </span>
                        )}
                        <span className="text-[11px] text-gray-400">
                          {formatNairobiDateTime(item.event_datetime)}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditModal(item)}
                          title="Edit update"
                          className="p-1 text-gray-400 hover:text-black rounded hover:bg-gray-100 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(item)}
                          title="Delete update"
                          className="p-1 text-gray-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-sm font-semibold text-gray-900 mt-1">
                      {item.title}
                    </h3>

                    {/* Hearing completion note if linked */}
                    {item.hearing_details && (
                      <div className="text-[11px] text-gray-600 mt-1 flex items-center space-x-1.5">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span>
                          Conducted:{' '}
                          <span className="font-medium text-gray-900">
                            {item.hearing_details.hearing_type_display} on{' '}
                            {formatNairobiDateTime(item.hearing_details.hearing_date)}
                          </span>
                        </span>
                      </div>
                    )}

                    <p className="text-xs text-gray-700 mt-2 whitespace-pre-line leading-relaxed bg-[#F9FAFB] p-3 rounded border border-gray-100">
                      {item.description}
                    </p>

                    {/* Next court date or tasks generated badge strip */}
                    {(item.generated_hearings?.length || item.generated_tasks?.length) ? (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                        {item.generated_hearings?.map((gh) => (
                          <div
                            key={gh.id}
                            className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-900 text-[11px]"
                          >
                            <Calendar className="w-3 h-3 mr-1 text-blue-600" />
                            Next Hearing:{' '}
                            <span className="font-semibold ml-1">
                              {gh.hearing_type_display} ({formatNairobiDateTime(gh.hearing_date)})
                            </span>
                          </div>
                        ))}
                        {item.generated_tasks && item.generated_tasks.length > 0 && (
                          <div className="inline-flex items-center px-2 py-0.5 rounded bg-purple-50 border border-purple-200 text-purple-900 text-[11px]">
                            <CheckSquare className="w-3 h-3 mr-1 text-purple-600" />
                            <span>
                              {item.generated_tasks.length} Action Task
                              {item.generated_tasks.length > 1 ? 's' : ''} Created
                            </span>
                          </div>
                        )}
                      </div>
                    ) : null}

                    <div className="flex items-center text-[11px] text-gray-400 mt-2 space-x-1">
                      <UserIcon className="w-3 h-3" />
                      <span>Recorded by {item.author_name || 'Siwolo P.O'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Record/Edit Update Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingUpdate(null);
          setMatterSearch('');
          setMatterDropdownOpen(false);
        }}
        title={editingUpdate ? 'Edit Case Progress Update' : 'Record Case Progress Update'}
        description={
          editingUpdate
            ? `Update case narrative and proceedings note for ${editingUpdate.matter_reference}.`
            : "Add a progress update to a matter's chronological record."
        }
        maxWidth="xl"
      >
        <form onSubmit={handleSaveUpdate} className="space-y-4 text-xs">
          {/* Warning banner if modifying already completed task */}
          {hasCompletedTask && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded flex items-start space-x-2 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-xs">Warning: Completed Action Tasks</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  One or more action tasks linked to this update have already been marked completed. Modifying their orders below will update the completed tasks.
                </p>
              </div>
            </div>
          )}

          {/* Matter Selection */}
          <div className="relative">
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Matter Reference & Title *
            </label>
            <div className="relative">
              <input
                type="text"
                required
                readOnly={!!editingUpdate}
                placeholder="Type to search matter reference or title..."
                value={matterSearch}
                onChange={(e) => {
                  setMatterSearch(e.target.value);
                  setMatterDropdownOpen(true);
                }}
                onFocus={() => {
                  if (!editingUpdate) setMatterDropdownOpen(true);
                }}
                className={`w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black pr-8 ${
                  editingUpdate ? 'bg-gray-100 cursor-not-allowed text-gray-600' : ''
                }`}
              />
              {!editingUpdate && (
                <button
                  type="button"
                  onClick={() => setMatterDropdownOpen(!matterDropdownOpen)}
                  className="absolute right-2 top-2 text-gray-400 hover:text-black"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {matterDropdownOpen && !editingUpdate && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-[#E5E7EB] rounded shadow-lg max-h-48 overflow-y-auto">
                {matters
                  .filter(
                    (m) =>
                      m.matter_reference.toLowerCase().includes(matterSearch.toLowerCase()) ||
                      m.title.toLowerCase().includes(matterSearch.toLowerCase())
                  )
                  .map((m) => (
                    <div
                      key={m.id}
                      onClick={() => handleMatterSelect(m)}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-0"
                    >
                      <span className="font-mono font-semibold text-black">{m.matter_reference}</span>
                      <span className="text-gray-500 ml-2">— {m.title}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* "Which hearing was this?" Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Which hearing was this? (Optional)
            </label>
            <select
              value={formData.hearing || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  hearing: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black bg-white"
            >
              <option value="">None / Not linked to a scheduled hearing</option>
              {scheduledHearingsForMatter.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.hearing_type_display || h.hearing_type} on {formatNairobiDateTime(h.hearing_date)}
                  {h.court ? ` (${h.court})` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">
              Selecting a scheduled hearing marks it Completed and writes this update description as its outcome.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Event Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black bg-white"
              >
                <option value="court_appearance">Court Appearance / Hearing</option>
                <option value="filing">Pleading Filed / Registry</option>
                <option value="client_comm">Client Communication</option>
                <option value="doc_received">Document / Evidence Received</option>
                <option value="doc_submitted">Document / Letter Sent</option>
                <option value="negotiation">Negotiation / ADR Meeting</option>
                <option value="internal_review">Internal Legal Strategy</option>
                <option value="general">General Milestone</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Date & Time of Event *
              </label>
              <input
                type="datetime-local"
                required
                value={formData.event_datetime}
                onChange={(e) => setFormData({ ...formData, event_datetime: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Headline Summary *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Appearance before Hon. Justice Mwangi; orders on submissions"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Proceedings Narrative / Record of Directions *
            </label>
            <textarea
              required
              rows={4}
              placeholder="Detailed notes of what transpired, judicial directives, orders extracted..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </div>

          {/* Share with Client Checkbox */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded">
            <label className="flex items-start space-x-2 cursor-pointer font-medium text-gray-800">
              <input
                type="checkbox"
                disabled={formData.category === 'internal_review'}
                checked={formData.category !== 'internal_review' && formData.share_with_client}
                onChange={(e) => setFormData({ ...formData, share_with_client: e.target.checked })}
                className="mt-0.5 rounded border-gray-300 text-black focus:ring-black"
              />
              <div>
                <span>Share with client in progress reports</span>
                <p className="text-[11px] text-gray-500 font-normal mt-0.5">
                  {formData.category === 'internal_review'
                    ? 'Internal Legal Strategy notes are strictly confidential and automatically excluded from client progress reports.'
                    : 'Included when generating formal PDF client progress reports.'}
                </p>
              </div>
            </label>
          </div>

          {/* Collapsible Section: Next Court Date & Orders */}
          <div className="border border-[#E5E7EB] rounded overflow-hidden">
            <button
              type="button"
              onClick={() => setIsDirectionsExpanded(!isDirectionsExpanded)}
              className="w-full px-4 py-2.5 bg-[#F9FAFB] hover:bg-gray-100 flex items-center justify-between text-left transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Calendar className="w-3.5 h-3.5 text-gray-700" />
                <span className="font-semibold text-gray-900 text-xs">
                  Next Court Date & Orders / Actions Required (Optional)
                </span>
                {formData.orders.length > 0 && (
                  <Badge variant="info" size="sm">
                    {formData.orders.length} order{formData.orders.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              {isDirectionsExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>

            {isDirectionsExpanded && (
              <div className="p-4 space-y-4 bg-white border-t border-[#E5E7EB]">
                {/* Next Court Date */}
                <div>
                  <h4 className="text-[11px] font-bold text-gray-800 uppercase tracking-wider mb-2">
                    Next Court Date
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.next_court_date.hearing_date}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            next_court_date: {
                              ...formData.next_court_date,
                              hearing_date: e.target.value,
                            },
                          })
                        }
                        className="w-full px-2.5 py-1.5 border border-[#E5E7EB] rounded text-xs focus:outline-none focus:border-black"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Hearing Type
                      </label>
                      <select
                        value={formData.next_court_date.hearing_type}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            next_court_date: {
                              ...formData.next_court_date,
                              hearing_type: e.target.value,
                            },
                          })
                        }
                        className="w-full px-2.5 py-1.5 border border-[#E5E7EB] rounded text-xs focus:outline-none focus:border-black bg-white"
                      >
                        <option value="mention">Mention</option>
                        <option value="application">Hearing of Application</option>
                        <option value="trial">Main Trial / Substantive Hearing</option>
                        <option value="ruling">Ruling</option>
                        <option value="judgment">Judgment</option>
                        <option value="pre_trial">Pre-Trial Conference</option>
                        <option value="mediation">Court Annexed Mediation</option>
                        <option value="taxation">Taxation of Costs</option>
                        <option value="other">Other Proceeding</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Court / Tribunal
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Milimani High Court"
                        value={formData.next_court_date.court}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            next_court_date: {
                              ...formData.next_court_date,
                              court: e.target.value,
                            },
                          })
                        }
                        className="w-full px-2.5 py-1.5 border border-[#E5E7EB] rounded text-xs focus:outline-none focus:border-black"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    When provided, automatically schedules this hearing and displays it on Upcoming Hearings.
                  </p>
                </div>

                {/* Orders / Action Items */}
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[11px] font-bold text-gray-800 uppercase tracking-wider">
                      Orders / Actions Required
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddOrder}
                      className="inline-flex items-center text-xs font-semibold text-black hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Order / Action Item
                    </button>
                  </div>

                  {formData.orders.length === 0 ? (
                    <div className="text-center py-4 text-gray-400 text-[11px] bg-gray-50 rounded border border-dashed border-gray-200">
                      No court orders or follow-up action deadlines added yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {formData.orders.map((order, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded"
                        >
                          <div className="flex-1 w-full">
                            <input
                              type="text"
                              placeholder="Order / directive description (e.g. File replying affidavit)"
                              value={order.description}
                              onChange={(e) => handleOrderChange(idx, 'description', e.target.value)}
                              className="w-full px-2.5 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-black"
                            />
                          </div>

                          <div className="w-full sm:w-48">
                            <input
                              type="datetime-local"
                              value={order.due_date}
                              onChange={(e) => handleOrderChange(idx, 'due_date', e.target.value)}
                              className="w-full px-2.5 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-black"
                            />
                          </div>

                          <div className="w-full sm:w-28">
                            <select
                              value={order.priority}
                              onChange={(e) => handleOrderChange(idx, 'priority', e.target.value as TaskPriority)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-black bg-white"
                            >
                              <option value="normal">Normal</option>
                              <option value="high">High</option>
                              <option value="urgent">Urgent</option>
                            </select>
                          </div>

                          {order.status === 'completed' && (
                            <Badge variant="success" size="sm">
                              Completed
                            </Badge>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveOrder(idx)}
                            className="p-1 text-gray-400 hover:text-rose-600 transition-colors"
                            title="Remove order row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">
                    Each order row creates a high-priority action task linked to this matter on the dashboard.
                  </p>
                </div>

                {/* Offer to sync linked records during Edit */}
                {editingUpdate && (
                  <div className="pt-2">
                    <label className="flex items-center space-x-2 cursor-pointer font-medium text-gray-800 text-xs">
                      <input
                        type="checkbox"
                        checked={formData.update_linked_records}
                        onChange={(e) =>
                          setFormData({ ...formData, update_linked_records: e.target.checked })
                        }
                        className="rounded border-gray-300 text-black focus:ring-black"
                      />
                      <span>Sync and update linked scheduled hearing & action tasks</span>
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setEditingUpdate(null);
                setMatterSearch('');
                setMatterDropdownOpen(false);
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
              {submitting ? 'Saving...' : editingUpdate ? 'Save Changes' : 'Record Update'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      {deletingUpdate && (
        <DeleteConfirmModal
          isOpen={isDeleteOpen}
          onClose={() => {
            setIsDeleteOpen(false);
            setDeletingUpdate(null);
            setDeleteSummaryData(null);
          }}
          onConfirm={handleDeleteUpdate}
          title="Delete Case Update"
          recordName={deletingUpdate.title}
          recordReference={deletingUpdate.matter_reference}
          message={
            <div className="space-y-3">
              <p className="text-gray-700 text-xs">
                {deleteSummaryData?.message ||
                  `Are you sure you want to permanently delete case update "${deletingUpdate.title}"? This action cannot be undone.`}
              </p>

              {(deleteSummaryData?.generated_hearings?.length ||
                deleteSummaryData?.generated_tasks?.length) ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs space-y-2">
                  <label className="flex items-start space-x-2 cursor-pointer font-medium text-amber-950">
                    <input
                      type="checkbox"
                      checked={removeLinkedRecords}
                      onChange={(e) => setRemoveLinkedRecords(e.target.checked)}
                      className="mt-0.5 rounded border-amber-300 text-black focus:ring-black"
                    />
                    <span>Also permanently delete generated scheduled hearing and action tasks</span>
                  </label>
                  <p className="text-[11px] text-amber-800 pl-5">
                    If unchecked, the scheduled hearing and tasks will remain active on the matter.
                  </p>
                </div>
              ) : null}
            </div>
          }
        />
      )}
    </div>
  );
}
