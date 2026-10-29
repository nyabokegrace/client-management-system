'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Scale, Lock, User, AlertCircle, ArrowRight, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { api } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('siwolo_token');
      if (token) {
        router.push('/');
      }
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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

  const handleQuickLogin = (userVal: string) => {
    setUsername(userVal);
    setPassword('Advocate@2026!');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F4F6] p-4">
      <div className="w-full max-w-md bg-white border border-[#E5E7EB] rounded shadow-sm p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded bg-[#111111] text-white mb-4">
            <Scale className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#111111]">
            Siwolo P.O Law Advocates
          </h1>
          <p className="text-xs text-[#6B7280] mt-1 uppercase tracking-wider font-medium">
            Client & Case Management System
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded flex items-start text-xs text-red-700">
            <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="Enter your system username"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E5E7EB] rounded focus:outline-none focus:border-black transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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
              'Authenticating...'
            ) : (
              <>
                Sign In to Portal
                <ArrowRight className="w-3.5 h-3.5 ml-2" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Credentials */}
        <div className="mt-6 pt-5 border-t border-[#E5E7EB]">
          <div className="flex items-center space-x-1.5 text-xs font-medium text-gray-600 mb-2.5">
            <ShieldCheck className="w-3.5 h-3.5 text-gray-500" />
            <span>Quick Fill Demonstration Credentials:</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleQuickLogin('admin')}
              className="p-2 border border-gray-200 rounded hover:bg-gray-50 text-left transition-colors"
            >
              <div className="font-semibold text-gray-900">Administrator</div>
              <div className="text-[11px] text-gray-500 font-mono">admin</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('siwolo')}
              className="p-2 border border-gray-200 rounded hover:bg-gray-50 text-left transition-colors"
            >
              <div className="font-semibold text-gray-900">Senior Counsel</div>
              <div className="text-[11px] text-gray-500 font-mono">siwolo</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('jane.wanjiru')}
              className="p-2 border border-gray-200 rounded hover:bg-gray-50 text-left transition-colors"
            >
              <div className="font-semibold text-gray-900">Associate Advocate</div>
              <div className="text-[11px] text-gray-500 font-mono">jane.wanjiru</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('clerk.omondi')}
              className="p-2 border border-gray-200 rounded hover:bg-gray-50 text-left transition-colors"
            >
              <div className="font-semibold text-gray-900">Legal Assistant</div>
              <div className="text-[11px] text-gray-500 font-mono">clerk.omondi</div>
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 text-center">
            Default Password: <code className="font-mono text-gray-600">Advocate@2026!</code>
          </p>
        </div>

        <div className="mt-6 pt-4 border-t border-[#E5E7EB] text-center text-[11px] text-[#6B7280]">
          Strictly for authorized internal legal counsel and staff.
        </div>
      </div>
    </div>
  );
}
