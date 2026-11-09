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
  X,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Header } from '../../components/Header';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { DeleteConfirmModal } from '../../components/DeleteConfirmModal';
import { api } from '../../lib/api';
import { CaseUpdate, Matter } from '../../types';

export default function CaseUpdatesPage() {
  const [updates, setUpdates] = useState<CaseUpdate[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [matterFilter, setMatterFilter] = useState<number | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit & Delete state
  const [editingUpdate, setEditingUpdate] = useState<CaseUpdate | null>(null);
  const [deletingUpdate, setDeletingUpdate] = useState<CaseUpdate | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Searchable matter dropdown state
  const [matterSearch, setMatterSearch] = useState('');
  const [matterDropdownOpen, setMatterDropdownOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    matter: 0,
    title: '',
    category: 'court_appearance',
    event_datetime: '',
    description: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {};
      if (searchTerm) params.search = searchTerm;
      if (matterFilter !== 'all') params.matter = matterFilter;
      if (categoryFilter !== 'all') params.category = categoryFilter;

      const [updatesRes, mattersRes] = await Promise.all([
        api.caseUpdates.list(params),
        api.matters.list(),
      ]);

      setUpdates(Array.isArray(updatesRes) ? updatesRes : (updatesRes as any).results || []);
      setMatters(Array.isArray(mattersRes) ? mattersRes : (mattersRes as any).results || []);
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
      title: '',
      category: 'court_appearance',
      event_datetime: '',
      description: '',
    });
    setMatterSearch('');
    setIsModalOpen(true);
  };

  const openEditModal = (u: CaseUpdate) => {
    setEditingUpdate(u);
    setFormData({
      matter: u.matter,
      title: u.title,
      category: u.category,
      event_datetime: u.event_datetime ? u.event_datetime.slice(0, 16) : '',
      description: u.description || '',
    });
    const foundMatter = matters.find((m) => m.id === u.matter);
    setMatterSearch(foundMatter ? `${foundMatter.matter_reference} — ${foundMatter.title}` : '');
    setIsModalOpen(true);
  };

  const openDeleteModal = (u: CaseUpdate) => {
    setDeletingUpdate(u);
    setIsDeleteOpen(true);
  };

  const handleSaveUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.matter) {
      alert('Please select a legal matter.');
      return;
    }

    try {
      setSubmitting(true);
      if (editingUpdate) {
        await api.caseUpdates.update(editingUpdate.id, formData);
      } else {
        await api.caseUpdates.create(formData);
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
    await api.caseUpdates.delete(deletingUpdate.id);
    setDeletingUpdate(null);
    fetchData();
  };

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Case Progress Updates"
        subtitle="Chronological narrative of proceedings, court appearances, filings and key milestones"
        breadcrumbs={[{ name: 'Dashboard', href: '/' }, { name: 'Case Updates' }]}
        actions={
          <button
            onClick={openCreateModal}
            className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-[#111111] hover:bg-black rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Record Update
          </button>
        }
      />

      <div className="px-6 py-6 space-y-4">
        {/* Search & Filter Bar */}
        <div className="bg-white border border-[#E5E7EB] p-4 rounded flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
          <form onSubmit={handleSearch} className="flex-1 w-full flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search updates by keyword, proceedings narrative, title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-[#111111] hover:bg-black rounded transition-colors shrink-0"
            >
              <Search className="w-3.5 h-3.5 mr-1.5" />
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex items-center space-x-1.5 text-xs text-gray-600 font-medium">
              <Filter className="w-3.5 h-3.5 text-gray-500" />
              <span>Matter:</span>
            </div>
            <select
              value={matterFilter}
              onChange={(e) => setMatterFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="px-2.5 py-1.5 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded text-[#111111] focus:outline-none max-w-[200px] truncate"
            >
              <option value="all">All Matters</option>
              {matters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.matter_reference} - {m.title}
                </option>
              ))}
            </select>

            <div className="flex items-center space-x-1.5 text-xs text-gray-600 font-medium ml-1">
              <span>Category:</span>
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded text-[#111111] focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="court_appearance">Court Appearance</option>
              <option value="filing">Court Filing</option>
              <option value="client_comm">Client Communication</option>
              <option value="doc_received">Document Received</option>
              <option value="doc_submitted">Document Submitted</option>
              <option value="negotiation">Negotiation / Settlement</option>
              <option value="internal_review">Internal Legal Review</option>
              <option value="general">General Update</option>
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
              <p className="text-[11px] text-gray-400 mt-1">Record a filing, court appearance or key development on any active matter.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-gray-200 ml-4 pl-6 space-y-8">
              {updates.map((item) => (
                <div key={item.id} className="relative group">
                  <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 bg-black border-2 border-white rounded-full" />
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-black">
                          {item.matter_reference}
                        </span>
                        <Badge variant="info" size="sm">
                          {item.category_display || item.category}
                        </Badge>
                        <span className="text-[11px] text-gray-400">
                          {new Date(item.event_datetime).toLocaleString('en-GB', {
                            timeZone: 'Africa/Nairobi',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
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

                    <p className="text-xs text-gray-700 mt-2 whitespace-pre-line leading-relaxed bg-[#F9FAFB] p-3 rounded border border-gray-100">
                      {item.description}
                    </p>

                    <div className="flex items-center text-[11px] text-gray-400 mt-2 space-x-1">
                      <UserIcon className="w-3 h-3" />
                      <span>Recorded by {item.author_name || 'Counsel'}</span>
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
        maxWidth="lg"
      >
        <form onSubmit={handleSaveUpdate} className="space-y-4 text-xs">
          <div className="relative">
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Select Legal Matter *
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5 z-10" />
              <input
                type="text"
                placeholder={
                  formData.matter
                    ? matters.find((m) => m.id === formData.matter)
                        ? `${matters.find((m) => m.id === formData.matter)!.matter_reference} - ${matters.find((m) => m.id === formData.matter)!.title}`
                        : 'Search matter by title or reference...'
                    : 'Search matter by title or reference...'
                }
                value={matterSearch}
                onChange={(e) => {
                  setMatterSearch(e.target.value);
                  setMatterDropdownOpen(true);
                }}
                onFocus={() => setMatterDropdownOpen(true)}
                className="w-full pl-9 pr-8 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
              {matterSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setMatterSearch('');
                    setFormData({ ...formData, matter: 0 });
                  }}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-black"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {matterDropdownOpen && (
              <div className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-[#E5E7EB] rounded shadow-lg">
                {matters
                  .filter((m) => {
                    const q = matterSearch.toLowerCase();
                    return (
                      !matterSearch ||
                      m.title.toLowerCase().includes(q) ||
                      m.matter_reference.toLowerCase().includes(q)
                    );
                  })
                  .map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, matter: m.id });
                        setMatterSearch(`${m.matter_reference} — ${m.title}`);
                        setMatterDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center justify-between ${
                        formData.matter === m.id ? 'bg-gray-100 font-semibold' : ''
                      }`}
                    >
                      <span className="truncate">{m.title}</span>
                      <span className="font-mono text-[11px] text-gray-500 ml-2 shrink-0">
                        {m.matter_reference}
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Event Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
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
              rows={5}
              placeholder="Detailed notes of what transpired, judicial directives, orders extracted..."
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
          }}
          onConfirm={handleDeleteUpdate}
          title="Delete Case Update"
          recordName={deletingUpdate.title}
          recordReference={deletingUpdate.matter_reference}
          message={`Are you sure you want to permanently delete case update "${deletingUpdate.title}"? This action cannot be undone.`}
        />
      )}
    </div>
  );
}
