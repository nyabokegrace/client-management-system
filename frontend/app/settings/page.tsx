'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Users,
  Shield,
  Key,
  Plus,
  Lock,
  UserCheck,
  UserX,
} from 'lucide-react';
import { Header } from '../../components/Header';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { api } from '../../lib/api';
import { User, AuditLog, UserRole } from '../../types';

export default function SettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'security'>('users');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Add User Form
  const [userData, setUserData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    role: 'advocate' as UserRole,
    phone_number: '',
    password: '',
  });

  // Password Change Form
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, auditRes] = await Promise.all([
        api.users.list(),
        api.audit.list(),
      ]);
      setUsers(Array.isArray(usersRes) ? usersRes : (usersRes as any).results || []);
      setAuditLogs(Array.isArray(auditRes) ? auditRes : (auditRes as any).results || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.request('/users/', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      setIsAddUserOpen(false);
      setUserData({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        role: 'advocate',
        phone_number: '',
        password: '',
      });
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error creating user account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    try {
      setSubmitting(true);
      await api.request('/auth/change-password/', {
        method: 'POST',
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      });
      setPwSuccess(true);
      setOldPassword('');
      setNewPassword('');
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Settings & Administration"
        subtitle="Internal user permissions, authorized roles, compliance audit trails and security preferences"
        breadcrumbs={[{ name: 'Dashboard', href: '/' }, { name: 'Settings' }]}
        actions={
          activeTab === 'users' && (
            <button
              onClick={() => setIsAddUserOpen(true)}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-[#111111] hover:bg-black rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add System User
            </button>
          )
        }
      />

      <div className="px-6 py-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="border-b border-[#E5E7EB] flex space-x-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 font-semibold transition-colors border-b-2 ${
              activeTab === 'users'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-black'
            }`}
          >
            User & Role Management
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 font-semibold transition-colors border-b-2 ${
              activeTab === 'audit'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-black'
            }`}
          >
            Audit Trail Logs
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`pb-3 font-semibold transition-colors border-b-2 ${
              activeTab === 'security'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-black'
            }`}
          >
            Account Security & Credentials
          </button>
        </div>

        {/* Tab 1: Users */}
        {activeTab === 'users' && (
          <div className="bg-white border border-[#E5E7EB] rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#374151] font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-5 py-3">Full Name & Username</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Phone</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                        Loading users list...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                        No user accounts found.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-gray-900">{u.full_name}</div>
                          <div className="text-[11px] text-gray-400 font-mono">@{u.username}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge
                            variant={
                              u.role === 'admin'
                                ? 'danger'
                                : u.role === 'advocate'
                                ? 'info'
                                : 'default'
                            }
                            size="sm"
                          >
                            {u.role.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-gray-700">{u.email}</td>
                        <td className="px-5 py-3.5 text-gray-700">{u.phone_number || '—'}</td>
                        <td className="px-5 py-3.5">
                          <Badge variant={u.is_active ? 'success' : 'default'} size="sm">
                            {u.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 text-[11px]">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Audit Logs */}
        {activeTab === 'audit' && (
          <div className="bg-white border border-[#E5E7EB] rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#374151] font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">Actor</th>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Module</th>
                    <th className="px-5 py-3">Record / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-gray-500">
                        Loading audit trail logs...
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-gray-500">
                        No audit events recorded.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 text-[11px] text-gray-500 font-mono whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 font-semibold text-gray-900">
                          {log.actor_name || 'System'}
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant="default" size="sm">
                            {log.action_display || log.action}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-gray-700">
                          {log.module_display || log.module}
                        </td>
                        <td className="px-5 py-3 text-gray-800">
                          {log.target_repr}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Security & Change Password */}
        {activeTab === 'security' && (
          <div className="max-w-md bg-white border border-[#E5E7EB] rounded p-6">
            <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wider mb-2 flex items-center">
              <Lock className="w-4 h-4 mr-2" />
              Change Personal Password
            </h3>
            <p className="text-xs text-[#6B7280] mb-5">
              Ensure your account uses an 8+ character strong password to protect confidential client records.
            </p>

            {pwSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
                Password updated successfully.
              </div>
            )}
            {pwError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                {pwError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Current Password *
                </label>
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  New Password * (Min 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 bg-[#111111] text-white font-medium rounded hover:bg-black disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      <Modal
        isOpen={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
        title="Add Internal System User"
        description="Provision an individual account for counsel or authorized support staff."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                First Name *
              </label>
              <input
                type="text"
                required
                value={userData.first_name}
                onChange={(e) => setUserData({ ...userData, first_name: e.target.value })}
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
                value={userData.last_name}
                onChange={(e) => setUserData({ ...userData, last_name: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Username *
              </label>
              <input
                type="text"
                required
                value={userData.username}
                onChange={(e) => setUserData({ ...userData, username: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Role *
              </label>
              <select
                value={userData.role}
                onChange={(e) => setUserData({ ...userData, role: e.target.value as UserRole })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              >
                <option value="advocate">Advocate (Counsel)</option>
                <option value="staff">Authorized Staff (Clerk / Assistant)</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={userData.email}
                onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Initial Password * (Min 8 chars)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={userData.password}
                onChange={(e) => setUserData({ ...userData, password: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsAddUserOpen(false)}
              className="px-4 py-2 border border-[#E5E7EB] rounded font-medium hover:bg-gray-50 text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[#111111] text-white font-medium rounded hover:bg-black disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
