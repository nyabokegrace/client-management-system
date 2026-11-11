'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  UserCheck,
  KeyRound,
  CheckCircle2,
  UserPlus,
  Sparkles,
} from 'lucide-react';
import { api } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();

  // Mode: 'login' or 'signup'
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [isFirstTime, setIsFirstTime] = useState(false);

  // Sign In state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Sign Up state
  const [signupName, setSignupName] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);

  // UI status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('siwolo_token');
      if (token) {
        router.push('/');
        return;
      }
      if (window.location.search.includes('mode=signup')) {
        setMode('signup');
      }
    }

    // Check if platform has any users configured
    api.auth
      .getSetupStatus()
      .then((status) => {
        if (!status.has_users) {
          setIsFirstTime(true);
          setMode('signup');
        }
      })
      .catch(() => {
        // Fallback silently if offline or during build
      });
  }, [router]);

  // Handle Sign In
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

  // Handle Sign Up
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (!signupName.trim()) {
      setError('Please provide your full legal name.');
      return;
    }

    if (!signupUsername.trim()) {
      setError('Please choose a username.');
      return;
    }

    if (signupPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setError('Passwords do not match. Please verify and try again.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.auth.signup({
        name: signupName.trim(),
        username: signupUsername.trim(),
        password: signupPassword,
      });

      // Populate login form with newly registered credentials
      setUsername(signupUsername.trim());
      setPassword(signupPassword);

      // Reset signup inputs
      setSignupName('');
      setSignupUsername('');
      setSignupPassword('');
      setSignupConfirmPassword('');
      setIsFirstTime(false);

      // Switch to login tab with success alert
      setMode('login');
      setSuccess(
        `Account created successfully for ${res.full_name || 'you'}! Please sign in below using your username and password.`
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Account creation failed. Please check your details and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: 'login' | 'signup') => {
    setMode(newMode);
    setError(null);
    setSuccess(null);
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
            Client & Case Management System
          </p>
        </div>

        {/* First-Time Welcome Banner */}
        {isFirstTime && mode === 'signup' && (
          <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded flex items-start text-xs text-blue-800">
            <Sparkles className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5 text-blue-600" />
            <div>
              <p className="font-semibold">Welcome to your new CMS platform</p>
              <p className="text-blue-700 mt-0.5">
                Complete your initial first-time registration below to create your administrator account.
              </p>
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex border-b border-[#E5E7EB] mb-6">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 pb-2.5 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 ${
              mode === 'login'
                ? 'border-black text-[#111111]'
                : 'border-transparent text-[#6B7280] hover:text-[#111111]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`flex-1 pb-2.5 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 flex items-center justify-center space-x-1.5 ${
              mode === 'signup'
                ? 'border-black text-[#111111]'
                : 'border-transparent text-[#6B7280] hover:text-[#111111]'
            }`}
          >
            <span>Sign Up</span>
            {isFirstTime && (
              <span className="bg-black text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                NEW
              </span>
            )}
          </button>
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

        {/* Sign In Form */}
        {mode === 'login' && (
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
                'Authenticating...'
              ) : (
                <>
                  Sign In to Portal
                  <ArrowRight className="w-3.5 h-3.5 ml-2" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="text-xs text-[#374151] hover:text-black underline underline-offset-2 transition-colors"
              >
                First time here? Sign up to create an account
              </button>
            </div>
          </form>
        )}

        {/* Sign Up Form */}
        {mode === 'signup' && (
          <form onSubmit={handleSignupSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-1">
                Full Name
              </label>
              <div className="relative">
                <UserCheck className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="e.g. Peter O. Siwolo"
                  autoComplete="name"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E5E7EB] rounded focus:outline-none focus:border-black transition-colors"
                />
              </div>
              <p className="text-[11px] text-[#6B7280] mt-1">
                Your name as Principal Advocate & Founder
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-1">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                  placeholder="Choose your system username"
                  autoComplete="username"
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
                  type={showSignupPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className="w-full pl-9 pr-9 py-2 text-sm bg-white border border-[#E5E7EB] rounded focus:outline-none focus:border-black transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword((v) => !v)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                  aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                >
                  {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type={showSignupConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={signupConfirmPassword}
                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  className="w-full pl-9 pr-9 py-2 text-sm bg-white border border-[#E5E7EB] rounded focus:outline-none focus:border-black transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowSignupConfirmPassword((v) => !v)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                  aria-label={showSignupConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showSignupConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-[#111111] hover:bg-black text-white text-xs font-semibold rounded uppercase tracking-wider flex items-center justify-center transition-colors disabled:opacity-50"
            >
              {loading ? (
                'Creating Account...'
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5 mr-2" />
                  Sign Up & Continue
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-xs text-[#374151] hover:text-black underline underline-offset-2 transition-colors"
              >
                Already have an account? Sign in
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-[#E5E7EB] text-center text-[11px] text-[#6B7280]">
          Strictly for authorized internal legal counsel and staff.
        </div>
      </div>
    </div>
  );
}
