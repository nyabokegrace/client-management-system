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
  ShieldCheck,
  Clock,
  RotateCw,
  ArrowLeft,
  Mail,
} from 'lucide-react';
import { api } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();

  // Mode: 'login' or 'signup'
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [isFirstTime, setIsFirstTime] = useState(false);

  // Sign In: Step 1 (Credentials) vs Step 2 (2FA Code)
  const [loginStep, setLoginStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 2: 2FA State
  const [challengeId, setChallengeId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

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

  // Tick countdown timer for 2FA code and resend cooldown
  useEffect(() => {
    if (loginStep !== 2) return;

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [loginStep]);

  // Format seconds as MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Handle Sign In: Step 1 (Username & Password)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await api.auth.login({ username, password });
      if (res.requires_2fa && res.challenge_id) {
        setChallengeId(res.challenge_id);
        setMaskedEmail(res.email_masked || '');
        setCountdown(res.expires_in_seconds || 600);
        setResendCooldown(res.seconds_until_resend || 60);
        setVerificationCode('');
        setIsLocked(false);
        setLoginStep(2);
      } else {
        // Fallback if 2FA is disabled on server
        router.push('/');
      }
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

  // Handle Sign In: Step 2 (Verify 6-digit Code)
  const handleVerifyCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const codeToVerify = verificationCode.trim();
    if (codeToVerify.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    if (countdown === 0) {
      setError('This verification code has expired. Please request a new code.');
      return;
    }

    setLoading(true);

    try {
      await api.auth.verifyCode(challengeId, codeToVerify);
      router.push('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid verification code.';
      setError(msg);
      if (msg.toLowerCase().includes('locked')) {
        setIsLocked(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Resend 2FA verification code
  const handleResendCode = async () => {
    if (resendCooldown > 0 || loading || isLocked) return;

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await api.auth.resendCode(challengeId);
      setCountdown(res.expires_in_seconds || 600);
      setResendCooldown(res.seconds_until_resend || 60);
      setVerificationCode('');
      setSuccess('A new verification code has been sent to your email.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Back from 2FA to Step 1
  const handleBackToCredentials = () => {
    setLoginStep(1);
    setVerificationCode('');
    setError(null);
    setSuccess(null);
  };

  // Handle Sign Up
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

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

      setUsername(signupUsername.trim());
      setPassword(signupPassword);

      setSignupName('');
      setSignupUsername('');
      setSignupPassword('');
      setSignupConfirmPassword('');
      setIsFirstTime(false);

      setMode('login');
      setLoginStep(1);
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
    setLoginStep(1);
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

        {/* Tab Switcher (Visible in Step 1) */}
        {loginStep === 1 && (
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
        )}

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

        {/* ================================================================= */}
        {/* SIGN IN: STEP 1 (Username & Password) */}
        {/* ================================================================= */}
        {mode === 'login' && loginStep === 1 && (
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
                  Continue
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

        {/* ================================================================= */}
        {/* SIGN IN: STEP 2 (Two-Factor 6-Digit Code) */}
        {/* ================================================================= */}
        {mode === 'login' && loginStep === 2 && (
          <form onSubmit={handleVerifyCodeSubmit} className="space-y-4">
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-black mb-2">
                <ShieldCheck className="w-5 h-5 text-black" />
              </div>
              <h2 className="text-sm font-bold text-[#111111]">Two-Factor Verification</h2>
              <div className="flex items-center justify-center text-xs text-[#6B7280] mt-1 space-x-1">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                <span>Code sent to:</span>
                <span className="font-semibold text-gray-800">{maskedEmail}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-1 text-center">
                6-Digit Security Code
              </label>
              <input
                type="text"
                required
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setVerificationCode(val);
                }}
                placeholder="000000"
                className="w-full py-2.5 px-4 text-center text-2xl font-mono tracking-widest bg-white border border-[#E5E7EB] rounded focus:outline-none focus:border-black transition-colors"
              />
            </div>

            {/* Countdown timer */}
            <div className="flex items-center justify-between text-xs text-[#6B7280]">
              <div className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5" />
                {countdown > 0 ? (
                  <span>Expires in: <strong className="text-gray-900">{formatTime(countdown)}</strong></span>
                ) : (
                  <span className="text-red-600 font-semibold">Code expired</span>
                )}
              </div>

              {/* Resend button */}
              <button
                type="button"
                disabled={resendCooldown > 0 || loading || isLocked}
                onClick={handleResendCode}
                className="inline-flex items-center text-xs font-medium text-black hover:underline disabled:opacity-50 disabled:no-underline transition-colors"
              >
                <RotateCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Code'}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || verificationCode.length !== 6 || isLocked || countdown === 0}
              className="w-full mt-2 py-2.5 px-4 bg-[#111111] hover:bg-black text-white text-xs font-semibold rounded uppercase tracking-wider flex items-center justify-center transition-colors disabled:opacity-50"
            >
              {loading ? (
                'Verifying Code...'
              ) : (
                <>
                  Verify &amp; Sign In
                  <ArrowRight className="w-3.5 h-3.5 ml-2" />
                </>
              )}
            </button>

            {/* Back link */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleBackToCredentials}
                className="inline-flex items-center text-xs text-[#6B7280] hover:text-black transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* ================================================================= */}
        {/* SIGN UP FORM */}
        {/* ================================================================= */}
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
                Your name as Principal Advocate &amp; Founder
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
                  Sign Up &amp; Continue
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
