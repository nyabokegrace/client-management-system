'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Clock,
  MapPin,
  ExternalLink,
  FileCheck,
} from 'lucide-react';
import { Header } from '../../components/Header';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { api } from '../../lib/api';
import { Hearing, Matter, User } from '../../types';

export default function HearingsPage() {
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [advocates, setAdvocates] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'all'>('upcoming');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [outcomeModalOpen, setOutcomeModalOpen] = useState(false);
  const [selectedHearing, setSelectedHearing] = useState<Hearing | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    matter: 0,
    hearing_type: 'mention',
    hearing_date: new Date().toISOString().slice(0, 16),
    court: '',
    court_case_number: '',
    location_details: '',
    assigned_advocate: null as number | null,
    notes: '',
  });

  const [outcomeData, setOutcomeData] = useState({
    outcome_summary: '',
    next_hearing_date: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [hearingsRes, mattersRes, usersRes] = await Promise.all([
        activeTab === 'upcoming' ? api.hearings.upcoming() : api.hearings.list(),
        api.matters.list(),
        api.users.list({ role: 'advocate' }),
      ]);

      setHearings(Array.isArray(hearingsRes) ? hearingsRes : (hearingsRes as any).results || []);
      setMatters(Array.isArray(mattersRes) ? mattersRes : mattersRes.results || []);
      setAdvocates(Array.isArray(usersRes) ? usersRes : usersRes.results || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleScheduleHearing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.matter) {
      alert('Please select a matter.');
      return;
    }

    try {
      setSubmitting(true);
      await api.hearings.create({
        ...formData,
        hearing_date: new Date(formData.hearing_date).toISOString(),
        assigned_advocate: formData.assigned_advocate || undefined,
      });
      setIsModalOpen(false);
      setFormData({
        matter: 0,
        hearing_type: 'mention',
        hearing_date: new Date().toISOString().slice(0, 16),
        court: '',
        court_case_number: '',
        location_details: '',
        assigned_advocate: null,
        notes: '',
      });
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error scheduling hearing');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHearing) return;

    try {
      setSubmitting(true);
      await api.hearings.recordOutcome(selectedHearing.id, {
        outcome_summary: outcomeData.outcome_summary,
        next_hearing_date: outcomeData.next_hearing_date
          ? new Date(outcomeData.next_hearing_date).toISOString()
          : undefined,
      });
      setOutcomeModalOpen(false);
      setSelectedHearing(null);
      setOutcomeData({ outcome_summary: '', next_hearing_date: '' });
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error recording outcome');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Calendar & Court Hearings"
        subtitle="Court diary, cause list schedule, virtual hearing links and post-appearance proceedings records"
        breadcrumbs={[{ name: 'Dashboard', href: '/' }, { name: 'Hearings' }]}
        actions={
          <button
            onClick={() => setIsModalOpen(true)}
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
            Upcoming Diary & Appearances
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-3 font-semibold transition-colors border-b-2 ${
              activeTab === 'all'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-black'
            }`}
          >
            All Historical Hearing Records
          </button>
        </div>

        {/* Hearings List */}
        <div className="bg-white border border-[#E5E7EB] rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#374151] font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3">Date & Time</th>
                  <th className="px-5 py-3">Hearing Type</th>
                  <th className="px-5 py-3">Matter & Client</th>
                  <th className="px-5 py-3">Court / Venue</th>
                  <th className="px-5 py-3">Advocate</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                      Loading court hearings...
                    </td>
                  </tr>
                ) : hearings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                      <CalendarIcon className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                      <p className="font-medium text-gray-700">No hearings found for this view.</p>
                      <p className="text-[11px] text-gray-400 mt-1">Schedule an upcoming mention, trial or ruling date.</p>
                    </td>
                  </tr>
                ) : (
                  hearings.map((h) => (
                    <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-gray-900">
                          {new Date(h.hearing_date).toLocaleDateString([], {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                        <div className="text-[11px] text-gray-500 flex items-center mt-0.5">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(h.hearing_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant="info" size="sm">
                          {h.hearing_type_display || h.hearing_type}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-mono font-medium text-black">{h.matter_reference}</div>
                        <div className="text-gray-600 line-clamp-1">{h.matter_title}</div>
                      </td>
                      <td className="px-5 py-3.5 space-y-0.5">
                        <div className="font-medium text-gray-800">{h.court || 'Milimani Courts'}</div>
                        <div className="text-[11px] text-gray-500 flex items-center">
                          <MapPin className="w-3 h-3 mr-1 text-gray-400" />
                          {h.location_details || 'Courtroom'}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {h.assigned_advocate_name || 'Counsel'}
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
                      <td className="px-5 py-3.5 text-right">
                        {h.status === 'scheduled' && (
                          <button
                            onClick={() => {
                              setSelectedHearing(h);
                              setOutcomeModalOpen(true);
                            }}
                            className="inline-flex items-center px-2 py-1 text-xs border border-[#E5E7EB] rounded font-medium hover:bg-gray-100 text-black transition-colors"
                          >
                            <FileCheck className="w-3.5 h-3.5 mr-1" />
                            Record Outcome
                          </button>
                        )}
                        {h.outcome_summary && (
                          <div className="text-[11px] text-gray-500 italic max-w-xs truncate text-right">
                            {h.outcome_summary}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Schedule Hearing Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Schedule Court Hearing"
        description="Calendar a mention, trial date, ruling or chamber appearance."
        maxWidth="lg"
      >
        <form onSubmit={handleScheduleHearing} className="space-y-4 text-xs">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Hearing Type
              </label>
              <select
                value={formData.hearing_type}
                onChange={(e) => setFormData({ ...formData, hearing_type: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              >
                <option value="mention">Mention</option>
                <option value="application">Hearing of Application</option>
                <option value="trial">Main Trial / Hearing</option>
                <option value="ruling">Ruling</option>
                <option value="judgment">Judgment</option>
                <option value="pre_trial">Pre-Trial Conference</option>
                <option value="mediation">Court Annexed Mediation</option>
                <option value="taxation">Taxation of Costs</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Date & Time *
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
                Court / Forum
              </label>
              <input
                type="text"
                placeholder="Defaults to matter's court if empty"
                value={formData.court}
                onChange={(e) => setFormData({ ...formData, court: e.target.value })}
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
                <option value="">— Select Advocate —</option>
                {advocates.map((a) => (
                  <option key={a.id} value={a.id}>{a.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Venue / Virtual Court Details
            </label>
            <input
              type="text"
              placeholder="e.g. Courtroom No. 7 / MS Teams Link"
              value={formData.location_details}
              onChange={(e) => setFormData({ ...formData, location_details: e.target.value })}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Instructions & Preparation Notes
            </label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
              {submitting ? 'Scheduling...' : 'Schedule Hearing'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Outcome Modal */}
      <Modal
        isOpen={outcomeModalOpen}
        onClose={() => setOutcomeModalOpen(false)}
        title="Record Hearing Proceedings Outcome"
        description={`Record judicial orders, directions, and next dates for ${selectedHearing?.matter_reference}.`}
        maxWidth="md"
      >
        <form onSubmit={handleRecordOutcome} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Court Orders / Proceedings Summary *
            </label>
            <textarea
              rows={4}
              required
              placeholder="Record judge's directions, filings admitted, oral arguments made, or consent entered..."
              value={outcomeData.outcome_summary}
              onChange={(e) => setOutcomeData({ ...outcomeData, outcome_summary: e.target.value })}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Next Court Hearing Date (If Fixed)
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
              onClick={() => setOutcomeModalOpen(false)}
              className="px-4 py-2 border border-[#E5E7EB] rounded font-medium hover:bg-gray-50 text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[#111111] text-white font-medium rounded hover:bg-black disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Outcome'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
