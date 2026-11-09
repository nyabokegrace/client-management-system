'use client';

import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Plus,
  Search,
  Filter,
  Phone,
  Mail,
  Building,
  Pencil,
  Trash2,
  Briefcase,
} from 'lucide-react';
import { Header } from '../../components/Header';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { DeleteConfirmModal } from '../../components/DeleteConfirmModal';
import { api } from '../../lib/api';
import { Contact, ContactType } from '../../types';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Delete modal state
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteSummary, setDeleteSummary] = useState<{
    name: string;
    reference: string;
    matters_count: number;
    blocked: boolean;
    blocked_reason?: string | null;
    message: string;
  } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    contact_type: 'advocate' as ContactType,
    firm_name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (searchTerm) params.search = searchTerm;
      if (typeFilter !== 'all') params.contact_type = typeFilter;

      const res = await api.contacts.list(params);
      setContacts(Array.isArray(res) ? res : res.results || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [typeFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const openCreateModal = () => {
    setEditingContact(null);
    setFormData({
      name: '',
      contact_type: 'advocate',
      firm_name: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      contact_type: contact.contact_type,
      firm_name: contact.firm_name || '',
      phone: contact.phone || '',
      email: contact.email || '',
      address: contact.address || '',
      notes: contact.notes || '',
    });
    setIsModalOpen(true);
  };

  const openDeleteModal = async (contact: Contact) => {
    setDeletingContact(contact);
    setDeleteSummary(null);
    setIsDeleteOpen(true);
    try {
      const summary = await api.contacts.deleteSummary(contact.id);
      setDeleteSummary(summary);
    } catch {
      setDeleteSummary({
        name: contact.name,
        reference: contact.firm_name || contact.contact_type,
        matters_count: contact.matters_count || 0,
        blocked: (contact.matters_count || 0) > 0,
        blocked_reason: (contact.matters_count || 0) > 0
          ? 'This contact is linked to one or more matters as opposing counsel and cannot be deleted.'
          : null,
        message: `Are you sure you want to delete contact '${contact.name}'?`,
      });
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a name for the contact.');
      return;
    }

    try {
      setSubmitting(true);
      if (editingContact) {
        await api.contacts.update(editingContact.id, formData);
      } else {
        await api.contacts.create(formData);
      }
      setIsModalOpen(false);
      setEditingContact(null);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save contact.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!deletingContact) return;
    try {
      await api.contacts.delete(deletingContact.id);
      setIsDeleteOpen(false);
      setDeletingContact(null);
      setDeleteSummary(null);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error deleting contact.');
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Contacts & Opposing Counsel"
        subtitle="Directory of external advocates, law firms, process servers and opposing party representatives"
        breadcrumbs={[{ name: 'Dashboard', href: '/' }, { name: 'Contacts' }]}
        actions={
          <button
            onClick={openCreateModal}
            className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-[#111111] hover:bg-black rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Contact
          </button>
        }
      />

      <div className="px-6 py-6 space-y-4">
        {/* Filters */}
        <div className="bg-white border border-[#E5E7EB] p-4 rounded flex flex-col sm:flex-row items-center justify-between gap-3">
          <form onSubmit={handleSearch} className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search contacts by name, firm name, phone or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </form>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <div className="flex items-center space-x-1.5 text-xs text-[#6B7280]">
              <Filter className="w-3.5 h-3.5" />
              <span>Type:</span>
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded text-[#111111] focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="advocate">Advocates</option>
              <option value="law_firm">Law Firms</option>
              <option value="other">Other / Process Servers</option>
            </select>
          </div>
        </div>

        {/* Contacts Table */}
        <div className="bg-white border border-[#E5E7EB] rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#374151] font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3">Contact Name</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Firm Name</th>
                  <th className="px-5 py-3">Phone & Email</th>
                  <th className="px-5 py-3">Address / Notes</th>
                  <th className="px-5 py-3">Linked Matters</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                      Loading contacts directory...
                    </td>
                  </tr>
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                      <UserCheck className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                      <p className="font-medium text-gray-700">No contacts found.</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Add opposing advocates, law firms, and external parties to link to legal matters.
                      </p>
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-gray-900 block">{contact.name}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={
                            contact.contact_type === 'advocate'
                              ? 'info'
                              : contact.contact_type === 'law_firm'
                              ? 'default'
                              : 'warning'
                          }
                          size="sm"
                        >
                          {contact.contact_type_display || contact.contact_type}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {contact.firm_name ? (
                          <div className="flex items-center space-x-1">
                            <Building className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span>{contact.firm_name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 space-y-0.5">
                        {contact.phone && (
                          <div className="flex items-center space-x-1.5 text-gray-700">
                            <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                        {contact.email && (
                          <div className="flex items-center space-x-1.5 text-gray-500 text-[11px]">
                            <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span>{contact.email}</span>
                          </div>
                        )}
                        {!contact.phone && !contact.email && (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 max-w-xs truncate">
                        {contact.address || contact.notes || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {contact.matters_count && contact.matters_count > 0 ? (
                          <span className="inline-flex items-center text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <Briefcase className="w-3 h-3 mr-1" />
                            {contact.matters_count} {contact.matters_count === 1 ? 'matter' : 'matters'}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">0 matters</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => openEditModal(contact)}
                          title="Edit contact"
                          className="p-1.5 text-gray-400 hover:text-black rounded hover:bg-gray-100 transition-colors inline-flex items-center"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(contact)}
                          title="Delete contact"
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

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingContact(null);
        }}
        title={editingContact ? `Edit Contact: ${editingContact.name}` : 'Add New Contact'}
        description={
          editingContact
            ? 'Update professional contact details, firm representation and notes.'
            : 'Add opposing counsel, an external law firm, or a legal professional to attach to legal matters.'
        }
        maxWidth="lg"
      >
        <form onSubmit={handleSaveContact} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Contact Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. John Ochieng, Advocate or Bowmans Kenya"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Contact Type
              </label>
              <select
                value={formData.contact_type}
                onChange={(e) => setFormData({ ...formData, contact_type: e.target.value as ContactType })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              >
                <option value="advocate">Advocate (Opposing / External)</option>
                <option value="law_firm">Law Firm / Chambers</option>
                <option value="other">Other / Process Server / Expert</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Firm Name (for Advocates)
              </label>
              <input
                type="text"
                placeholder="e.g. Hamilton Harrison & Mathews"
                value={formData.firm_name}
                onChange={(e) => setFormData({ ...formData, firm_name: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="+254 7..."
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="counsel@firm.co.ke"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Physical / Postal Address
            </label>
            <input
              type="text"
              placeholder="e.g. Delta Corner Annex, Westlands, Nairobi"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Notes / Practice Area
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Commercial litigation partner; acts for ABC Bank"
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
                setEditingContact(null);
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
              {submitting ? 'Saving...' : editingContact ? 'Save Changes' : 'Create Contact'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      {deletingContact && (
        <DeleteConfirmModal
          isOpen={isDeleteOpen}
          onClose={() => {
            setIsDeleteOpen(false);
            setDeletingContact(null);
            setDeleteSummary(null);
          }}
          onConfirm={handleDeleteContact}
          title="Delete Contact Record"
          recordName={deletingContact.name}
          recordReference={deletingContact.firm_name || deletingContact.contact_type}
          requireReferenceMatch={false}
          blockedReason={deleteSummary?.blocked ? deleteSummary.blocked_reason : null}
          message={
            deleteSummary ? (
              <p>{deleteSummary.message}</p>
            ) : (
              <p>Checking linked matter relationships...</p>
            )
          }
        />
      )}
    </div>
  );
}
