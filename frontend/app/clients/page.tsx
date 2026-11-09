'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  Building,
  User as UserIcon,
  Archive,
  Phone,
  Mail,
  FolderOpen,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Header } from '../../components/Header';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { DeleteConfirmModal } from '../../components/DeleteConfirmModal';
import { api } from '../../lib/api';
import { Client, ClientType, ClientStatus } from '../../types';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit & Delete state
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteSummary, setDeleteSummary] = useState<{
    name: string;
    reference: string;
    matters_count: number;
    documents_count: number;
    tasks_count: number;
    can_delete: boolean;
    blocked_reason?: string;
    message: string;
  } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    client_type: 'individual' as ClientType,
    first_name: '',
    last_name: '',
    national_id: '',
    organization_name: '',
    registration_number: '',
    primary_contact_person: '',
    phone_number: '',
    email: '',
    physical_address: '',
    internal_notes: '',
  });

  const fetchClients = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (searchTerm) params.search = searchTerm;
      if (typeFilter !== 'all') params.client_type = typeFilter;
      const res = await api.clients.list(params);
      setClients(Array.isArray(res) ? res : res.results || []);
    } catch {
      // keep fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [typeFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchClients();
  };

  const openCreateModal = () => {
    setEditingClient(null);
    setFormData({
      client_type: 'individual',
      first_name: '',
      last_name: '',
      national_id: '',
      organization_name: '',
      registration_number: '',
      primary_contact_person: '',
      phone_number: '',
      email: '',
      physical_address: '',
      internal_notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormData({
      client_type: client.client_type,
      first_name: client.first_name || '',
      last_name: client.last_name || '',
      national_id: client.national_id || '',
      organization_name: client.organization_name || '',
      registration_number: client.registration_number || '',
      primary_contact_person: client.primary_contact_person || '',
      phone_number: client.phone_number || '',
      email: client.email || '',
      physical_address: client.physical_address || '',
      internal_notes: client.internal_notes || '',
    });
    setIsModalOpen(true);
  };

  const openDeleteModal = async (client: Client) => {
    setDeletingClient(client);
    setDeleteSummary(null);
    setIsDeleteOpen(true);
    try {
      const summary = await api.clients.deleteSummary(client.id);
      setDeleteSummary(summary);
    } catch {
      setDeleteSummary({
        name: client.display_name,
        reference: client.client_reference,
        matters_count: client.matters_count || 0,
        documents_count: 0,
        tasks_count: 0,
        can_delete: (client.matters_count || 0) === 0,
        blocked_reason:
          (client.matters_count || 0) > 0
            ? "Delete or reassign this client's matters first"
            : undefined,
        message:
          (client.matters_count || 0) > 0
            ? "Delete or reassign this client's matters first"
            : `Are you sure you want to permanently delete client '${client.display_name}' (${client.client_reference})?`,
      });
    }
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editingClient) {
        await api.clients.update(editingClient.id, formData);
      } else {
        await api.clients.create(formData);
      }
      setIsModalOpen(false);
      setEditingClient(null);
      fetchClients();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save client');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (id: number) => {
    if (confirm('Are you sure you want to archive this client record? All associated legal matters will remain preserved.')) {
      try {
        await api.clients.archive(id);
        fetchClients();
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'Error archiving client');
      }
    }
  };

  const handleDeleteClient = async () => {
    if (!deletingClient) return;
    await api.clients.delete(deletingClient.id);
    setDeletingClient(null);
    fetchClients();
  };

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Clients"
        subtitle="Confidential client directory, organizational profiles and contact registry"
        breadcrumbs={[{ name: 'Dashboard', href: '/' }, { name: 'Clients' }]}
        actions={
          <button
            onClick={openCreateModal}
            className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-[#111111] hover:bg-black rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Register Client
          </button>
        }
      />

      <div className="px-6 py-6 space-y-4">
        {/* Search and Filters */}
        <div className="bg-white border border-[#E5E7EB] p-4 rounded flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <form onSubmit={handleSearch} className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by client reference (CLI-...), name, organization, national ID, or email..."
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
              <option value="all">All Clients</option>
              <option value="individual">Individuals</option>
              <option value="organization">Corporate Entities</option>
            </select>
          </div>
        </div>

        {/* Clients Table */}
        <div className="bg-white border border-[#E5E7EB] rounded overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#374151] font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3">Client Identity</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Primary Contact</th>
                  <th className="px-5 py-3">Active Matters</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                      Loading clients directory...
                    </td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                      <Users className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                      <p className="font-medium text-gray-700">No client records found.</p>
                      <p className="text-[11px] text-gray-400 mt-1">Register a client to begin creating matter files.</p>
                    </td>
                  </tr>
                ) : (
                  clients.map((client) => (
                    <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-medium text-black">
                        {client.client_reference}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-gray-900 flex items-center">
                          {client.client_type === 'organization' ? (
                            <Building className="w-3.5 h-3.5 mr-1.5 text-gray-400 flex-shrink-0" />
                          ) : (
                            <UserIcon className="w-3.5 h-3.5 mr-1.5 text-gray-400 flex-shrink-0" />
                          )}
                          {client.display_name}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {client.client_type === 'organization'
                            ? `Reg: ${client.registration_number || 'N/A'}`
                            : `National ID: ${client.national_id || 'N/A'}`}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 capitalize text-gray-600">
                        {client.client_type}
                      </td>
                      <td className="px-5 py-3.5 space-y-0.5">
                        <div className="flex items-center text-gray-700">
                          <Phone className="w-3 h-3 mr-1 text-gray-400" />
                          {client.phone_number}
                        </div>
                        {client.email && (
                          <div className="flex items-center text-gray-500 text-[11px]">
                            <Mail className="w-3 h-3 mr-1 text-gray-400" />
                            {client.email}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center text-gray-700 font-medium">
                          <FolderOpen className="w-3.5 h-3.5 mr-1 text-gray-400" />
                          {client.matters_count ?? 0}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={
                            client.status === 'active'
                              ? 'success'
                              : client.status === 'archived'
                              ? 'default'
                              : 'warning'
                          }
                          size="sm"
                        >
                          {client.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => openEditModal(client)}
                          title="Edit client"
                          className="p-1.5 text-gray-400 hover:text-black rounded hover:bg-gray-100 transition-colors inline-flex items-center"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {client.status !== 'archived' && (
                          <button
                            onClick={() => handleArchive(client.id)}
                            title="Archive client"
                            className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors inline-flex items-center"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => openDeleteModal(client)}
                          title="Delete client"
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

      {/* Register/Edit Client Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingClient(null);
        }}
        title={editingClient ? `Edit Client: ${editingClient.client_reference}` : 'Register New Client'}
        description={
          editingClient
            ? `Modify details and records for ${editingClient.display_name}.`
            : "Add a new individual or institutional client to the firm's confidential records."
        }
        maxWidth="xl"
      >
        <form onSubmit={handleSaveClient} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Client Classification *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center p-2.5 border rounded cursor-pointer transition-colors ${
                  formData.client_type === 'individual'
                    ? 'border-black bg-gray-50'
                    : 'border-[#E5E7EB]'
                }`}
              >
                <input
                  type="radio"
                  name="client_type"
                  value="individual"
                  checked={formData.client_type === 'individual'}
                  onChange={() => setFormData({ ...formData, client_type: 'individual' })}
                  className="mr-2"
                />
                <span className="font-medium text-gray-800">Natural Person (Individual)</span>
              </label>

              <label
                className={`flex items-center p-2.5 border rounded cursor-pointer transition-colors ${
                  formData.client_type === 'organization'
                    ? 'border-black bg-gray-50'
                    : 'border-[#E5E7EB]'
                }`}
              >
                <input
                  type="radio"
                  name="client_type"
                  value="organization"
                  checked={formData.client_type === 'organization'}
                  onChange={() => setFormData({ ...formData, client_type: 'organization' })}
                  className="mr-2"
                />
                <span className="font-medium text-gray-800">Corporate / Organization</span>
              </label>
            </div>
          </div>

          {formData.client_type === 'individual' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  National ID / Passport Number
                </label>
                <input
                  type="text"
                  value={formData.national_id}
                  onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Company / Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.organization_name}
                  onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Registration / CPR Number
                </label>
                <input
                  type="text"
                  value={formData.registration_number}
                  onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Primary Phone Number *
              </label>
              <input
                type="text"
                required
                placeholder="+254 7..."
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="client@domain.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Physical / Business Address
            </label>
            <input
              type="text"
              placeholder="Building, Street, Town/City"
              value={formData.physical_address}
              onChange={(e) => setFormData({ ...formData, physical_address: e.target.value })}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Internal Confidential Notes
            </label>
            <textarea
              rows={3}
              value={formData.internal_notes}
              onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </div>

          <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setEditingClient(null);
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
              {submitting ? 'Saving...' : editingClient ? 'Save Changes' : 'Register Client'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      {deletingClient && (
        <DeleteConfirmModal
          isOpen={isDeleteOpen}
          onClose={() => {
            setIsDeleteOpen(false);
            setDeletingClient(null);
            setDeleteSummary(null);
          }}
          onConfirm={handleDeleteClient}
          title="Delete Client Record"
          recordName={deletingClient.display_name}
          recordReference={deletingClient.client_reference}
          requireReferenceMatch={true}
          blockedReason={deleteSummary?.blocked_reason}
          message={
            deleteSummary ? (
              <p>{deleteSummary.message}</p>
            ) : (
              <p>Checking linked records...</p>
            )
          }
        />
      )}
    </div>
  );
}
