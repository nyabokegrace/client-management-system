'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  Clock,
  MapPin,
  CheckCircle2,
  FileCheck,
  Building,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Header } from '../../components/Header';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { DeleteConfirmModal } from '../../components/DeleteConfirmModal';
import { api } from '../../lib/api';
import { Hearing, Matter } from '../../types';

export default function HearingsPage() {
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'all'>('upcoming');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [outcomeModalOpen, setOutcomeModalOpen] = useState(false);
  const [selectedHearing, setSelectedHearing] = useState<Hearing | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit & Delete state
  const [editingHearing, setEditingHearing] = useState<Hearing | null>(null);
  const [deletingHearing, setDeletingHearing] = useState<Hearing | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    matter: 0,
    hearing_type: 'mention',
    hearing_date: '',
    court: '',
    court_case_number: '',
    location_details: '',
    notes: '',
  });

  const [outcomeData, setOutcomeData] = useState({
    outcome_summary: '',
    next_hearing_date: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [hearingsRes, mattersRes] = await Promise.all([
        activeTab === 'upcoming' ? api.hearings.upcoming() : api.hearings.list(),
        api.matters.list(),
      ]);

      setHearings(Array.isArray(hearingsRes) ? hearingsRes : (hearingsRes as any).results || []);
      setMatters(Array.isArray(mattersRes) ? mattersRes : (mattersRes as any).results || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const openCreateModal = () => {
    setEditingHearing(null);
    setFormData({
      matter: 0,
      hearing_type: 'mention',
      hearing_date: '',
      court: '',
      court_case_number: '',
      location_details: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (h: Hearing) => {
    setEditingHearing(h);
    setFormData({
      matter: h.matter,
      hearing_type: h.hearing_type,
      hearing_date: h.hearing_date ? h.hearing_date.slice(0, 16) : '',
      court: h.court || '',
      court_case_number: h.court_case_number || '',
      location_details: h.location_details || '',
      notes: h.notes || '',
    });
    setIsModalOpen(true);
  };

  const openDeleteModal = (h: Hearing) => {
    setDeletingHearing(h);
    setIsDeleteOpen(true);
  };

  const handleSaveHearing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.matter) {
      alert('Please select an active legal matter.');
      return;
    }

    try {
      setSubmitting(true);
      if (editingHearing) {
        await api.hearings.update(editingHearing.id, formData);
      } else {
        await api.hearings.create(formData);
      }
      setIsModalOpen(false);
      setEditingHearing(null);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save court hearing');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHearing = async () => {
    if (!deletingHearing) return;
    await api.hearings.delete(deletingHearing.id);
    setDeletingHearing(null);
    fetchData();
  };

  const handleRecordOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHearing) return;

    try {
      setSubmitting(true);
      await api.hearings.recordOutcome(selectedHearing.id, {
        outcome_summary: outcomeData.outcome_summary,
        next_hearing_date: outcomeData.next_hearing_date || undefined,
      });
      setOutcomeModalOpen(false);
      setSelectedHearing(null);
      setOutcomeData({ outcome_summary: '', next_hearing_date: '' });
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error recording hearing outcome');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Hearings & Court Diary"
        subtitle="Mentions, trials, rulings and judicial conference schedules"
        breadcrumbs={[{ name: 'Dashboard', href: '/' }, { name: 'Hearings' }]}
        actions={
          <button
            onClick={openCreateModal}
            className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-[#111111] hover:bg-black rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Schedule Hearing
          </button>
        }
      />

      <div className="px-6 py-6 space-y-4">
        {/* Navigation Tabs */}
        <div className="border-b border-[#E5E7EB] flex space-x-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`pb-3 font-semibold transition-colors border-b-2 ${
              activeTab === 'upcoming'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-black'
            }`}
          >
            Upcoming Diary Schedule
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-3 font-semibold transition-colors border-b-2 ${
              activeTab === 'all'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-black'
            }`}
          >
            All Historical Hearings
          </button>
        </div>

        {/* Hearings Table */}
        <div className="bg-white border border-[#E5E7EB] rounded overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#374151] font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3">Date & Time</th>
                  <th className="px-5 py-3">Matter Reference & Title</th>
                  <th className="px-5 py-3">Hearing Purpose</th>
                  <th className="px-5 py-3">Court / Chamber</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                      Loading court hearings...
                    </td>
                  </tr>
                ) : hearings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-gray-500">
                      <Calendar className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                      <p className="font-medium text-gray-700">No scheduled hearings found.</p>
                      <p className="text-[11px] text-gray-400 mt-1">Schedule a new court appearance to track court dates.</p>
                    </td>
                  </tr>
                ) : (
                  hearings.map((h) => (
                    <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="font-bold text-gray-900">
                          {new Date(h.hearing_date).toLocaleDateString('en-GB', {
                            timeZone: 'Africa/Nairobi',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[11px] text-gray-500 flex items-center">
                          <Clock className="w-3 h-3 mr-1 text-gray-400" />
                          {new Date(h.hearing_date).toLocaleTimeString('en-GB', {
                            timeZone: 'Africa/Nairobi',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-mono text-[11px] font-semibold text-black">
                          {h.matter_reference}
                        </div>
                        <div className="font-medium text-gray-800 line-clamp-1">
                          {h.matter_title}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          Client: {h.client_name || 'N/A'}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant="default" size="sm">
                          {h.hearing_type_display || h.hearing_type}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 space-y-0.5">
                        <div className="font-medium text-gray-800">{h.court || 'Court Forum'}</div>
                        <div className="text-[11px] text-gray-500 flex items-center">
                          <MapPin className="w-3 h-3 mr-1 text-gray-400" />
                          {h.location_details || 'Courtroom'}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={
                            h.status === 'completed'
                              ? 'success'
                              : h.status === 'adjourned'
                              ? 'warning'
                              : 'default'
                          }
                          size="sm"
                        >
                          {h.status_display || h.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                        {h.status === 'scheduled' && (
                          <button
                            onClick={() => {
                              setSelectedHearing(h);
                              setOutcomeModalOpen(true);
                            }}
                            className="inline-flex items-center px-2 py-1 text-[11px] border border-[#E5E7EB] rounded font-medium hover:bg-gray-100 text-black transition-colors"
                          >
                            <FileCheck className="w-3.5 h-3.5 mr-1" />
                            Outcome
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(h)}
                          title="Edit hearing"
                          className="p-1.5 text-gray-400 hover:text-black rounded hover:bg-gray-100 transition-colors inline-flex items-center"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(h)}
                          title="Delete hearing"
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

      {/* Schedule / Edit Hearing Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingHearing(null);
        }}
        title={editingHearing ? 'Edit Court Hearing' : 'Schedule Court Hearing'}
        description={
          editingHearing
            ? `Update hearing date, forum, or proceedings details for ${editingHearing.matter_reference}.`
            : 'Enter an upcoming mention, trial, ruling, or court fixture in the litigation calendar.'
        }
        maxWidth="lg"
      >
        <form onSubmit={handleSaveHearing} className="space-y-4 text-xs">
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
              <option value={0}>— Select Associated Case File —</option>
              {matters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.matter_reference} — {m.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Hearing Type *
              </label>
              <select
                value={formData.hearing_type}
                onChange={(e) => setFormData({ ...formData, hearing_type: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              >
                <option value="mention">Mention (Directions / Compliance)</option>
                <option value="hearing">Main Hearing / Trial</option>
                <option value="ruling">Ruling / Judgment Delivery</option>
                <option value="conference">Pre-Trial Conference</option>
                <option value="mediation">Court-Annexed Mediation</option>
                <option value="arbitration">Arbitration Session</option>
                <option value="other">Other Judicial Appearance</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Hearing Date & Time *
              </label>
              <input
                type="datetime-local"
                required
                value={formData.hearing_date}
                onChange={(e) => setFormData({ ...formData, hearing_date: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Court / Tribunal
              </label>
              <input
                type="text"
                placeholder="e.g. Milimani High Court (Commercial)"
                value={formData.court}
                onChange={(e) => setFormData({ ...formData, court: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Courtroom / Virtual Link
              </label>
              <input
                type="text"
                placeholder="e.g. Courtroom 4 / Teams Link"
                value={formData.location_details}
                onChange={(e) => setFormData({ ...formData, location_details: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Instructions & Preparation Notes
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Ensure physical bundle is served on 1st Respondent prior to mention."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </div>

          <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setEditingHearing(null);
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
              {submitting ? 'Saving...' : editingHearing ? 'Save Changes' : 'Schedule Appearance'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Outcome Modal */}
      <Modal
        isOpen={outcomeModalOpen}
        onClose={() => {
          setOutcomeModalOpen(false);
          setSelectedHearing(null);
        }}
        title="Record Hearing Outcome & Orders"
        description={
          selectedHearing
            ? `Record court directions for ${selectedHearing.matter_reference} — ${selectedHearing.court || 'Court'}`
            : 'Record court directions and proceedings outcome.'
        }
        maxWidth="lg"
      >
        <form onSubmit={handleRecordOutcome} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Proceedings Outcome & Court Directions *
            </label>
            <textarea
              required
              rows={4}
              placeholder="e.g. Mention before Lady Justice Wanjala. Respondent granted 14 days to file Replying Affidavit. Matter adjourned to 12th December for compliance."
              value={outcomeData.outcome_summary}
              onChange={(e) => setOutcomeData({ ...outcomeData, outcome_summary: e.target.value })}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Next Hearing / Mention Date (If ordered by Court)
            </label>
            <input
              type="datetime-local"
              value={outcomeData.next_hearing_date}
              onChange={(e) => setOutcomeData({ ...outcomeData, next_hearing_date: e.target.value })}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </div>

          <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={() => {
                setOutcomeModalOpen(false);
                setSelectedHearing(null);
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
              {submitting ? 'Recording...' : 'Save Court Outcome'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      {deletingHearing && (
        <DeleteConfirmModal
          isOpen={isDeleteOpen}
          onClose={() => {
            setIsDeleteOpen(false);
            setDeletingHearing(null);
          }}
          onConfirm={handleDeleteHearing}
          title="Delete Court Hearing"
          recordName={deletingHearing.matter_reference || deletingHearing.matter_title || 'Court Hearing'}
          recordReference={deletingHearing.matter_reference}
          message={`Are you sure you want to permanently delete this hearing on ${new Date(deletingHearing.hearing_date).toLocaleDateString()} for matter ${deletingHearing.matter_reference || deletingHearing.matter_title || ''}? This action cannot be undone.`}
        />
      )}
    </div>
  );
}
