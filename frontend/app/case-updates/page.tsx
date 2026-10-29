'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  User as UserIcon,
} from 'lucide-react';
import { Header } from '../../components/Header';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { api } from '../../lib/api';
import { CaseUpdate, Matter } from '../../types';

export default function CaseUpdatesPage() {
  const [updates, setUpdates] = useState<CaseUpdate[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [matterFilter, setMatterFilter] = useState<number | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    matter: 0,
    title: '',
    category: 'court_appearance',
    description: '',
    event_datetime: new Date().toISOString().slice(0, 16),
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {};
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (matterFilter !== 'all') params.matter = matterFilter;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const [updatesRes, mattersRes] = await Promise.all([
        api.caseUpdates.list(params),
        api.matters.list(),
      ]);

      setUpdates(Array.isArray(updatesRes) ? updatesRes : updatesRes.results || []);
      setMatters(Array.isArray(mattersRes) ? mattersRes : mattersRes.results || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [categoryFilter, matterFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const handleRecordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.matter) {
      alert('Please select a legal matter.');
      return;
    }

    try {
      setSubmitting(true);
      await api.caseUpdates.create({
        ...formData,
        event_datetime: new Date(formData.event_datetime).toISOString(),
      });
      setIsModalOpen(false);
      setFormData({
        matter: 0,
        title: '',
        category: 'court_appearance',
        description: '',
        event_datetime: new Date().toISOString().slice(0, 16),
      });
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error recording case update');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Case Progress & Updates"
        subtitle="Chronological audit records, court appearances, filings, instructions and client communications"
        breadcrumbs={[{ name: 'Dashboard', href: '/' }, { name: 'Case Progress' }]}
        actions={
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-[#111111] hover:bg-black rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Record Case Update
          </button>
        }
      />

      <div className="px-6 py-6 space-y-4">
        {/* Filters */}
        <div className="bg-white border border-[#E5E7EB] p-4 rounded flex flex-col md:flex-row items-center justify-between gap-3">
          <form onSubmit={handleSearch} className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search updates by keyword, reference, title or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
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
        <div className="bg-white border border-[#E5E7EB] rounded p-6">
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
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-black">
                        {item.matter_reference}
                      </span>
                      <Badge variant="info" size="sm">
                        {item.category_display || item.category}
                      </Badge>
                      <span className="text-[11px] text-gray-400">
                        {new Date(item.event_datetime).toLocaleString([], {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
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

      {/* Record Update Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Case Progress Update"
        description="Add an immutable progress update to a matter's chronological record."
        maxWidth="lg"
      >
        <form onSubmit={handleRecordUpdate} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Select Legal Matter *
            </label>
            <select
              required
              value={formData.matter}
              onChange={(e) => setFormData({ ...formData, matter: Number(e.target.value) })}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            >
              <option value={0}>— Select Matter —</option>
              {matters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.matter_reference} - {m.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Update Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ruling delivered on preliminary objection"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              >
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
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Date & Time of Event
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
              Detailed Description of Development *
            </label>
            <textarea
              rows={4}
              required
              placeholder="Full narrative of court proceedings, orders made, letters dispatched or settlement discussions..."
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
              {submitting ? 'Recording...' : 'Record Update'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
