'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check setup status on page load
  useEffect(() => {
    let mounted = true;
    api.auth
      .getSetupStatus()
      .then((status) => {
        if (mounted && (status.setup_required || !status.has_users)) {
          setIsFirstTime(true);
        }
      })
      .catch(() => {
        // Fallback to normal login screen if status call fails
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await api.auth.login({ username, password });
      router.push('/');
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Authentication failed. Please verify your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F4F6] p-4">
      <div className="w-full max-w-md bg-white border border-[#E5E7EB] rounded shadow-sm p-8">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded overflow-hidden mb-3">
            <Image
              src="/logo.png"
              alt="Siwolo P.O Law Advocates Logo"
              width={56}
              height={56}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#111111]">
            Siwolo P.O Law Advocates
          </h1>
          <p className="text-xs text-[#6B7280] mt-1 uppercase tracking-wider font-medium">
            Client &amp; Case Management System
          </p>
        </div>

        {/* Success Alert */}
        {success && (
          <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 rounded flex items-start text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded flex items-start text-xs text-red-700">
            <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-1">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E5E7EB] rounded focus:outline-none focus:border-black transition-colors"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider">
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full pl-9 pr-9 py-2 text-sm bg-white border border-[#E5E7EB] rounded focus:outline-none focus:border-black transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-[#111111] hover:bg-black text-white text-xs font-semibold rounded uppercase tracking-wider flex items-center justify-center transition-colors disabled:opacity-50"
          >
            {loading ? (
              'Signing In...'
            ) : (
              <>
                Sign In
                <ArrowRight className="w-3.5 h-3.5 ml-2" />
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="mt-8 pt-4 border-t border-[#E5E7EB] text-center">
          <p className="text-[11px] text-[#6B7280]">
            Authorized internal access only. All actions are logged and audited.
          </p>
        </div>
      </div>
    </div>
  );
}
