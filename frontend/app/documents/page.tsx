'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Lock,
  Search,
  Filter,
  ShieldAlert,
  Paperclip,
  Pencil,
} from 'lucide-react';
import { Header } from '../../components/Header';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { DeleteConfirmModal } from '../../components/DeleteConfirmModal';
import { api } from '../../lib/api';
import { Document, Client, Matter } from '../../types';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<Document | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteSummary, setDeleteSummary] = useState<{
    name: string;
    filename: string;
    reference: string;
    message: string;
  } | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [confidentiality, setConfidentiality] = useState<'standard' | 'confidential' | 'restricted'>('standard');
  const [clientId, setClientId] = useState<number>(0);
  const [matterId, setMatterId] = useState<number>(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (searchTerm) params.search = searchTerm;
      if (categoryFilter !== 'all') params.category = categoryFilter;

      const [docsRes, clientsRes, mattersRes] = await Promise.all([
        api.documents.list(params),
        api.clients.list({ status: 'active' }),
        api.matters.list(),
      ]);

      setDocuments(Array.isArray(docsRes) ? docsRes : docsRes.results || []);
      setClients(Array.isArray(clientsRes) ? clientsRes : clientsRes.results || []);
      setMatters(Array.isArray(mattersRes) ? mattersRes : mattersRes.results || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [categoryFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const openUploadModal = () => {
    setEditingDoc(null);
    setTitle('');
    setCategory('general');
    setConfidentiality('standard');
    setClientId(0);
    setMatterId(0);
    setSelectedFile(null);
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (doc: Document) => {
    setEditingDoc(doc);
    setTitle(doc.title);
    setCategory(doc.category);
    setConfidentiality(doc.confidentiality);
    setClientId(doc.client);
    setMatterId(doc.matter || 0);
    setSelectedFile(null);
    setDescription(doc.description || '');
    setIsModalOpen(true);
  };

  const openDeleteModal = async (doc: Document) => {
    setDeletingDoc(doc);
    setDeleteSummary(null);
    setIsDeleteOpen(true);
    try {
      const summary = await api.documents.deleteSummary(doc.id);
      setDeleteSummary(summary);
    } catch {
      setDeleteSummary({
        name: doc.title,
        filename: doc.original_filename,
        reference: doc.matter_reference || doc.client_name || '',
        message: `Deleting '${doc.title}' permanently removes the file (${doc.original_filename}) from disk. It cannot be recovered.`,
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingDoc) return;
    try {
      await api.documents.delete(deletingDoc.id);
      setIsDeleteOpen(false);
      setDeletingDoc(null);
      setDeleteSummary(null);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error deleting document');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      alert('Please select a client.');
      return;
    }

    try {
      setSubmitting(true);
      if (editingDoc) {
        // Editing document metadata
        await api.documents.update(editingDoc.id, {
          title,
          category,
          confidentiality,
          client: clientId,
          matter: matterId || null,
          description,
        });
      } else {
        // New document upload
        if (!selectedFile) {
          alert('Please choose a file to upload.');
          setSubmitting(false);
          return;
        }
        const formData = new FormData();
        formData.append('title', title);
        formData.append('category', category);
        formData.append('confidentiality', confidentiality);
        formData.append('client', String(clientId));
        if (matterId) formData.append('matter', String(matterId));
        formData.append('file', selectedFile);
        if (description) formData.append('description', description);

        await api.documents.upload(formData);
      }

      setIsModalOpen(false);
      setEditingDoc(null);
      setTitle('');
      setSelectedFile(null);
      setDescription('');
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Document operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const token = localStorage.getItem('siwolo_token');
      const url = api.documents.downloadUrl(doc.id);
      const response = await fetch(url, {
        headers: token ? { Authorization: `Token ${token}` } : {},
      });

      if (!response.ok) {
        if (response.status === 403) {
          alert('Access Denied: You do not have permission to view or download this restricted document.');
          return;
        }
        throw new Error('Failed to retrieve document.');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = doc.original_filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error downloading file');
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Documents"
        subtitle="Confidential legal vault, court pleadings, exhibits and protected document storage"
        breadcrumbs={[{ name: 'Dashboard', href: '/' }, { name: 'Documents' }]}
        actions={
          <button
            onClick={openUploadModal}
            className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-[#111111] hover:bg-black rounded transition-colors"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Upload Document
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
              placeholder="Search documents by title, file name, or reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </form>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <div className="flex items-center space-x-1.5 text-xs text-[#6B7280]">
              <Filter className="w-3.5 h-3.5" />
              <span>Category:</span>
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded text-[#111111] focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="pleadings">Pleadings</option>
              <option value="evidence">Evidence & Exhibits</option>
              <option value="correspondence">Correspondence</option>
              <option value="contracts">Contracts</option>
              <option value="corporate">Corporate</option>
              <option value="general">General</option>
            </select>
          </div>
        </div>

        {/* Documents Table */}
        <div className="bg-white border border-[#E5E7EB] rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#374151] font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3">Document Title & File</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Client / Matter</th>
                  <th className="px-5 py-3">Confidentiality</th>
                  <th className="px-5 py-3">File Size</th>
                  <th className="px-5 py-3">Uploaded</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                      Loading confidential documents...
                    </td>
                  </tr>
                ) : documents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                      <FileText className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                      <p className="font-medium text-gray-700">No documents uploaded yet.</p>
                      <p className="text-[11px] text-gray-400 mt-1">Upload confidential legal filings, contracts, or court pleadings.</p>
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div>
                            <span className="font-semibold text-gray-900">{doc.title}</span>
                            <p className="text-[11px] text-gray-400 font-mono mt-0.5">{doc.original_filename}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {doc.category_display || doc.category}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-gray-900">{doc.client_name || 'N/A'}</div>
                        {doc.matter_reference && (
                          <span className="text-[11px] text-gray-500">
                            Matter: {doc.matter_reference}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={
                            doc.confidentiality === 'restricted'
                              ? 'danger'
                              : doc.confidentiality === 'confidential'
                              ? 'warning'
                              : 'default'
                          }
                          size="sm"
                        >
                          {doc.confidentiality === 'restricted' && <Lock className="w-3 h-3 mr-1 inline" />}
                          {doc.confidentiality_display || doc.confidentiality}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-gray-500 text-[11px]">
                        {doc.file_size_display}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-[11px]">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => handleDownload(doc)}
                          title="Download Document"
                          className="p-1.5 text-gray-600 hover:text-black rounded hover:bg-gray-100 transition-colors inline-flex items-center"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(doc)}
                          title="Edit Document"
                          className="p-1.5 text-gray-400 hover:text-black rounded hover:bg-gray-100 transition-colors inline-flex items-center"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(doc)}
                          title="Delete Document"
                          className="p-1.5 text-gray-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors inline-flex items-center"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Upload/Edit Document Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingDoc(null);
        }}
        title={editingDoc ? `Edit Document: ${editingDoc.title}` : 'Upload Legal Document'}
        description={
          editingDoc
            ? 'Update document title, category, confidentiality, filing notes, and linked client/matter.'
            : 'Attach confidential documents to a client or matter. Files are stored securely on private disk and accessed exclusively via authorized endpoints.'
        }
        maxWidth="xl"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Document Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Plaint & Verifying Affidavit"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              >
                <option value="pleadings">Pleadings & Court Submissions</option>
                <option value="evidence">Evidence & Exhibits</option>
                <option value="correspondence">Correspondence</option>
                <option value="contracts">Contracts & Agreements</option>
                <option value="corporate">Statutory & Corporate</option>
                <option value="financial">Billing, Invoices & Receipts</option>
                <option value="general">General Legal Document</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Confidentiality Level
              </label>
              <select
                value={confidentiality}
                onChange={(e) => setConfidentiality(e.target.value as 'standard' | 'confidential' | 'restricted')}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              >
                <option value="standard">Standard Internal</option>
                <option value="confidential">Highly Confidential</option>
                <option value="restricted">Restricted to Assigned Advocate</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Client *
              </label>
              <select
                required
                value={clientId}
                onChange={(e) => setClientId(Number(e.target.value))}
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
                Associated Matter (Optional)
              </label>
              <select
                value={matterId}
                onChange={(e) => setMatterId(Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              >
                <option value={0}>— None (Client Record Only) —</option>
                {matters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.matter_reference} - {m.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {editingDoc ? (
            <div className="bg-[#F9FAFB] border border-[#E5E7EB] p-2.5 rounded text-[11px] text-gray-600">
              <span className="font-semibold text-gray-800">Attached File: </span>
              <span className="font-mono">{editingDoc.original_filename}</span> ({editingDoc.file_size_display})
              <p className="text-gray-400 mt-0.5">Replacing the file is out of scope. Upload a new document if you need to attach a different file.</p>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Select File * (Max 25MB: PDF, DOC, DOCX, TXT, XLS, PNG, JPG, ZIP)
              </label>
              <input
                type="file"
                required
                onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                className="w-full px-3 py-2 border border-[#E5E7EB] rounded bg-[#F9FAFB] text-xs focus:outline-none focus:border-black"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Description / Filing Notes
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </div>

          <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setEditingDoc(null);
              }}
              className="px-4 py-2 border border-[#E5E7EB] rounded font-medium hover:bg-gray-50 text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[#111111] text-white font-medium rounded hover:bg-black disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editingDoc ? 'Save Changes' : 'Upload File'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Document Modal */}
      {deletingDoc && (
        <DeleteConfirmModal
          isOpen={isDeleteOpen}
          onClose={() => {
            setIsDeleteOpen(false);
            setDeletingDoc(null);
            setDeleteSummary(null);
          }}
          onConfirm={handleDeleteConfirm}
          title="Delete Legal Document"
          recordName={deletingDoc.title}
          recordReference={deletingDoc.original_filename}
          requireReferenceMatch={false}
          message={
            deleteSummary ? (
              <p>{deleteSummary.message}</p>
            ) : (
              <p>Deleting this document permanently removes the file from disk; it cannot be recovered.</p>
            )
          }
        />
      )}
    </div>
  );
}
