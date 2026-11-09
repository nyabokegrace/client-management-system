'use client';

import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Lock,
  Shield,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Header } from '../../components/Header';
import { Badge } from '../../components/Badge';
import { api } from '../../lib/api';
import { User, AuditLog } from '../../types';

export default function SettingsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile Form State
  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password Change Form State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [userRes, auditRes] = await Promise.all([
        api.auth.me(),
        api.audit.list(),
      ]);
      setCurrentUser(userRes);
      setProfileData({
        first_name: userRes.first_name || '',
        last_name: userRes.last_name || '',
        email: userRes.email || '',
        phone_number: userRes.phone_number || '',
      });
      setAuditLogs(Array.isArray(auditRes) ? auditRes : (auditRes as any).results || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(false);

    try {
      setProfileSaving(true);
      const updated = await api.auth.updateProfile(profileData);
      setCurrentUser(updated);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 4000);
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    try {
      setPwSaving(true);
      await api.auth.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
      });
      setPwSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setTimeout(() => setPwSuccess(false), 4000);
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Settings & Profile"
        subtitle="Manage your advocate profile, credentials and review compliance audit trails"
        breadcrumbs={[{ name: 'Dashboard', href: '/' }, { name: 'Settings' }]}
      />

      <div className="px-6 py-6 space-y-8">
        {/* Section: My Profile */}
        <div>
          <div className="mb-4">
            <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wider flex items-center">
              <UserIcon className="w-4 h-4 mr-2" />
              My Profile
            </h2>
            <p className="text-xs text-[#6B7280]">
              Principal Advocate & Founder profile information and login credentials.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: Profile Information */}
            <div className="bg-white border border-[#E5E7EB] rounded p-6 shadow-sm">
              <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wider mb-2">
                Personal & Contact Details
              </h3>
              <p className="text-xs text-[#6B7280] mb-5">
                Update your name, primary phone number and correspondence email address.
              </p>

              {profileSuccess && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-2 flex-shrink-0" />
                  Profile updated successfully.
                </div>
              )}
              {profileError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                  {profileError}
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={profileData.first_name}
                      onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
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
                      value={profileData.last_name}
                      onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
                      className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={profileData.phone_number}
                    onChange={(e) => setProfileData({ ...profileData, phone_number: e.target.value })}
                    className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
                    placeholder="+254..."
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="px-4 py-2 bg-[#111111] text-white font-medium rounded hover:bg-black disabled:opacity-50 transition-colors"
                  >
                    {profileSaving ? 'Saving Changes...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </div>

            {/* Card 2: Password Change */}
            <div className="bg-white border border-[#E5E7EB] rounded p-6 shadow-sm">
              <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wider mb-2 flex items-center">
                <Lock className="w-4 h-4 mr-2" />
                Change Password
              </h3>
              <p className="text-xs text-[#6B7280] mb-5">
                Ensure your account uses an 8+ character strong password to protect confidential client records.
              </p>

              {pwSuccess && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-2 flex-shrink-0" />
                  Password updated successfully.
                </div>
              )}
              {pwError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
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

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={pwSaving}
                    className="px-4 py-2 bg-[#111111] text-white font-medium rounded hover:bg-black disabled:opacity-50 transition-colors"
                  >
                    {pwSaving ? 'Updating Password...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Section: Audit Trail Logs (Beneath Profile) */}
        <div>
          <div className="mb-4">
            <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wider flex items-center">
              <Shield className="w-4 h-4 mr-2" />
              Audit Trail Logs
            </h2>
            <p className="text-xs text-[#6B7280]">
              Immutable audit history of legal files, documents, and records mutations.
            </p>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded overflow-hidden shadow-sm">
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
                          {new Date(log.created_at).toLocaleString('en-GB', {
                            timeZone: 'Africa/Nairobi',
                          })}
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
        </div>
      </div>
    </div>
  );
}
