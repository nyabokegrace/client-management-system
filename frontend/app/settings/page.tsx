'use client';

import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Lock,
  Shield,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Copy,
  Check,
} from 'lucide-react';
import { Header } from '../../components/Header';
import { Badge } from '../../components/Badge';
import { api } from '../../lib/api';
import { formatNairobiDateTime } from '../../lib/dates';
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

  // Recovery Codes State
  const [remainingCodes, setRemainingCodes] = useState<number | null>(null);
  const [showGenerateCodes, setShowGenerateCodes] = useState(false);
  const [generatePassword, setGeneratePassword] = useState('');
  const [newCodesList, setNewCodesList] = useState<string[]>([]);
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [codesError, setCodesError] = useState<string | null>(null);
  const [codesSuccess, setCodesSuccess] = useState<string | null>(null);
  const [copiedCodes, setCopiedCodes] = useState(false);


  const fetchData = async () => {
    try {
      setLoading(true);
      const [userRes, auditRes, codesRes] = await Promise.all([
        api.auth.me(),
        api.audit.list(),
        api.auth.getRecoveryCodesCount().catch(() => ({ remaining: 0 })),
      ]);
      setCurrentUser(userRes);
      setProfileData({
        first_name: userRes.first_name || '',
        last_name: userRes.last_name || '',
        email: userRes.email || '',
        phone_number: userRes.phone_number || '',
      });
      setRemainingCodes(codesRes.remaining);
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

  const handleGenerateRecoveryCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodesError(null);
    setCodesSuccess(null);
    setCopiedCodes(false);

    if (!generatePassword) {
      setCodesError('Please enter your current password to generate new recovery codes.');
      return;
    }

    try {
      setGeneratingCodes(true);
      const res = await api.auth.generateRecoveryCodes(generatePassword);
      setNewCodesList(res.recovery_codes);
      setRemainingCodes(res.count);
      setGeneratePassword('');
      setCodesSuccess('New recovery codes generated successfully. Store them in a safe place.');
    } catch (err: unknown) {
      setCodesError(err instanceof Error ? err.message : 'Failed to generate recovery codes.');
    } finally {
      setGeneratingCodes(false);
    }
  };

  const handleCopyCodes = () => {
    if (newCodesList.length > 0) {
      navigator.clipboard.writeText(newCodesList.join('\n'));
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 3000);
    }
  };


  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(false);

    try {
      setProfileSaving(true);
      const updated = await api.auth.updateProfile({
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        phone_number: profileData.phone_number,
      });
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
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      readOnly
                      disabled
                      value={profileData.email}
                      className="w-full px-3 py-1.5 bg-gray-50 text-gray-700 border border-[#E5E7EB] rounded cursor-not-allowed font-medium"
                    />
                    <div className="absolute right-2.5 top-2 text-[10px] text-emerald-700 font-semibold flex items-center bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      <Shield className="w-3 h-3 mr-1 text-emerald-600" />
                      Verified 2FA
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    To prevent accidental lockouts, changing your email requires password confirmation and verification of a one-time code sent to the new address.
                  </p>
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

            {/* Card 3: Emergency Recovery Codes */}
            <div className="bg-white border border-[#E5E7EB] rounded p-6 shadow-sm lg:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wider flex items-center">
                  <KeyRound className="w-4 h-4 mr-2" />
                  Two-Factor Emergency Recovery Codes
                </h3>
                {remainingCodes !== null && (
                  <Badge
                    variant={remainingCodes === 0 ? 'danger' : remainingCodes <= 3 ? 'warning' : 'success'}
                  >
                    {remainingCodes === 0
                      ? '0 codes remaining'
                      : `${remainingCodes} active code${remainingCodes === 1 ? '' : 's'} remaining`}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-[#6B7280] mb-4">
                Single-use recovery codes allow you to access your administrator account if you are temporarily unable to access your authenticator app. Each code can only be used once.
              </p>

              {remainingCodes !== null && remainingCodes <= 3 && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-start">
                  <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <span className="font-semibold">Few recovery codes remaining: </span>
                    You have {remainingCodes} recovery code{remainingCodes === 1 ? '' : 's'} left. We recommend generating a new set of 8 codes and storing them securely.
                  </div>
                </div>
              )}

              {codesSuccess && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-2 flex-shrink-0" />
                  {codesSuccess}
                </div>
              )}
              {codesError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                  {codesError}
                </div>
              )}

              {/* Newly generated codes display */}
              {newCodesList.length > 0 && (
                <div className="mb-5 p-4 bg-gray-50 border border-gray-300 rounded">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      Your New Emergency Recovery Codes
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCodes}
                      className="inline-flex items-center text-xs font-medium text-black hover:underline"
                    >
                      {copiedCodes ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          Copy All Codes
                        </>
                      )}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center mb-3">
                    {newCodesList.map((code, idx) => (
                      <div
                        key={idx}
                        className="py-1.5 px-2 bg-white border border-gray-300 rounded font-mono text-xs font-semibold text-gray-900 tracking-wider shadow-2xs"
                      >
                        {code}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-600">
                    ⚠️ <strong>Important:</strong> Store these 8 single-use codes offline or in your secure password manager. They will not be displayed again after you leave this page. All previously generated recovery codes have been invalidated.
                  </p>
                </div>
              )}

              {/* Generate codes toggle / form */}
              {!showGenerateCodes ? (
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowGenerateCodes(true);
                      setCodesError(null);
                    }}
                    className="px-4 py-2 bg-[#111111] text-white text-xs font-medium rounded hover:bg-black transition-colors"
                  >
                    Generate New Recovery Codes
                  </button>
                </div>
              ) : (
                <form onSubmit={handleGenerateRecoveryCodes} className="space-y-3 max-w-md pt-2">
                  <p className="text-xs text-gray-700 font-medium">
                    Please confirm your current password to invalidate old codes and generate 8 new recovery codes:
                  </p>
                  <div>
                    <input
                      type="password"
                      required
                      autoFocus
                      placeholder="Enter current password"
                      value={generatePassword}
                      onChange={(e) => setGeneratePassword(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      type="submit"
                      disabled={generatingCodes || !generatePassword}
                      className="px-4 py-2 bg-[#111111] text-white text-xs font-medium rounded hover:bg-black disabled:opacity-50 transition-colors"
                    >
                      {generatingCodes ? 'Generating...' : 'Confirm & Generate 10 Codes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowGenerateCodes(false);
                        setGeneratePassword('');
                        setCodesError(null);
                      }}
                      className="px-3 py-2 text-xs text-gray-600 hover:text-black transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
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
                          {formatNairobiDateTime(log.created_at)}
                        </td>
                        <td className="px-5 py-3 font-semibold text-gray-900">
                          {log.actor_name || 'System'}
                        </td>
                        <td className="px-5 py-3">
                          <Badge
                            variant={
                              log.action === 'create'
                                ? 'success'
                                : log.action === 'update'
                                ? 'warning'
                                : log.action === 'delete'
                                ? 'danger'
                                : 'default'
                            }
                            size="sm"
                          >
                            {log.action_display || log.action}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-gray-700">
                          {log.module_display || log.module}
                        </td>
                        <td className="px-5 py-3 text-gray-800">
                          <div className="font-medium text-gray-900">{log.target_repr}</div>
                          {/* If delete */}
                          {log.action === 'delete' && log.details ? (
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              {log.details.name ? (
                                <span>Name: <strong className="text-gray-700">{String(log.details.name)}</strong></span>
                              ) : null}
                              {log.details.reference ? (
                                <span className="ml-2 font-mono">Ref: {String(log.details.reference)}</span>
                              ) : null}
                            </div>
                          ) : null}
                          {/* If update with changed fields */}
                          {log.details?.changes &&
                          typeof log.details.changes === 'object' &&
                          Object.keys(log.details.changes).length > 0 ? (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {Object.entries(
                                log.details.changes as Record<string, { old: unknown; new: unknown }>
                              ).map(([field, delta]) => (
                                <span
                                  key={field}
                                  className="text-[10px] font-mono bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 text-gray-700 inline-flex items-center"
                                >
                                  <strong className="text-gray-900 mr-1">{field}:</strong>
                                  <span className="text-rose-600 line-through mr-1">
                                    {delta.old !== null && delta.old !== undefined ? String(delta.old) : 'empty'}
                                  </span>
                                  <span className="text-gray-400 mr-1">→</span>
                                  <span className="text-emerald-700 font-semibold">
                                    {delta.new !== null && delta.new !== undefined ? String(delta.new) : 'empty'}
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : null}
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
