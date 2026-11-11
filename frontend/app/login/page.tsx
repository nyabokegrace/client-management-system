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
  Sparkles,
  ShieldCheck,
  Clock,
  RotateCw,
  ArrowLeft,
  Mail,
  Copy,
  Check,
} from 'lucide-react';
import { api } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();

  // Mode: 'login' | 'forgot'
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
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

  // Step 2: Recovery Code toggle
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');

  // Forgot Password State
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  // First-Run Setup State (Stage D)
  const [setupStep, setSetupStep] = useState<1 | 2 | 3>(1);
  const [setupCode, setSetupCode] = useState('');
  const [setupName, setSetupName] = useState('');
  const [setupUsername, setSetupUsername] = useState('admin');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');
  const [showSetupPassword, setShowSetupPassword] = useState(false);
  const [showSetupConfirmPassword, setShowSetupConfirmPassword] = useState(false);
  const [setupChallengeId, setSetupChallengeId] = useState('');
  const [setupVerificationCode, setSetupVerificationCode] = useState('');
  const [setupMaskedEmail, setSetupMaskedEmail] = useState('');
  const [setupRecoveryCodes, setSetupRecoveryCodes] = useState<string[]>([]);
  const [copiedSetupCodes, setCopiedSetupCodes] = useState(false);

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
    }

    // Check whether database has zero users (requires first-run setup)
    api.auth
      .getSetupStatus()
      .then((status) => {
        if (!status.has_users || status.needs_setup) {
          setIsFirstTime(true);
        } else {
          setIsFirstTime(false);
        }
      })
      .catch(() => {
        // Fallback silently if offline or during build
      });
  }, [router]);

  // Tick countdown timer for 2FA code and resend cooldown (login and setup)
  useEffect(() => {
    if (loginStep !== 2 && setupStep !== 2) return;

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [loginStep, setupStep]);

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

  // Handle Sign In: Step 2 Recovery Code alternative
  const handleVerifyRecoveryCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const codeToVerify = recoveryCodeInput.trim();
    if (!codeToVerify) {
      setError('Please enter your recovery code.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.auth.verifyRecoveryCode(challengeId, codeToVerify);
      if (res.warning) {
        alert(res.warning);
      }
      router.push('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid recovery code.';
      setError(msg);
      if (msg.toLowerCase().includes('locked')) {
        setIsLocked(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Password: Step 1 (Request code)
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!forgotIdentifier.trim()) {
      setError('Please enter your username or email address.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.auth.forgotPassword(forgotIdentifier.trim());
      setSuccess(res.message);
      setForgotStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to request password reset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Password: Step 2 (Reset password with code)
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (resetCode.trim().length !== 6) {
      setError('Please enter the 6-digit reset code sent to your email.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match. Please verify and try again.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.auth.resetPassword({
        identifier: forgotIdentifier.trim(),
        code: resetCode.trim(),
        new_password: newPassword,
      });
      setMode('login');
      setLoginStep(1);
      setUsername(forgotIdentifier.trim());
      setPassword('');
      setResetCode('');
      setNewPassword('');
      setConfirmNewPassword('');
      setSuccess(res.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Password reset failed. Please check your code and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Back from 2FA to Step 1
  const handleBackToCredentials = () => {
    setLoginStep(1);
    setVerificationCode('');
    setUseRecoveryCode(false);
    setRecoveryCodeInput('');
    setError(null);
    setSuccess(null);
  };

  // Handle First-Run Setup: Step 1 (Validate setup code & send email code)
  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!setupCode.trim()) {
      setError('Please enter the server SETUP_CODE.');
      return;
    }
    if (!setupName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!setupEmail.trim()) {
      setError('Please enter your administrator email address.');
      return;
    }
    if (setupPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (setupPassword !== setupConfirmPassword) {
      setError('Passwords do not match. Please verify and try again.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.auth.setup({
        setup_code: setupCode.trim(),
        name: setupName.trim(),
        username: setupUsername.trim() || 'admin',
        email: setupEmail.trim(),
        password: setupPassword,
      });
      setSetupChallengeId(res.challenge_id);
      setSetupMaskedEmail(res.masked_email || res.target_email);
      setCountdown(res.expires_in_seconds || 600);
      setResendCooldown(60);
      setSetupStep(2);
      setSuccess('Setup code verified! A 6-digit confirmation code has been emailed to you.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Setup failed. Please check your setup code.');
    } finally {
      setLoading(false);
    }
  };

  // Handle First-Run Setup: Step 2 (Verify emailed code & generate recovery codes)
  const handleSetupVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (setupVerificationCode.trim().length !== 6) {
      setError('Please enter the 6-digit code sent to your email.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.auth.setupVerify(setupChallengeId, setupVerificationCode.trim());
      setSetupRecoveryCodes(res.recovery_codes || []);
      setSetupStep(3);
      setSuccess('Administrator account created successfully! Save your recovery codes below.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Handle First-Run Setup: Step 2 Resend code
  const handleSetupResendCode = async () => {
    if (resendCooldown > 0 || !setupChallengeId) return;
    setError(null);
    try {
      const res = await api.auth.resendCode(setupChallengeId);
      setCountdown(res.expires_in_seconds);
      setResendCooldown(res.seconds_until_resend || 60);
      setSuccess('A new verification code has been emailed to you.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not resend code. Please wait.');
    }
  };

  const handleCopySetupCodes = () => {
    if (setupRecoveryCodes.length > 0) {
      navigator.clipboard.writeText(setupRecoveryCodes.join('\n'));
      setCopiedSetupCodes(true);
      setTimeout(() => setCopiedSetupCodes(false), 3000);
    }
  };

  const handleFinishSetup = () => {
    router.push('/');
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
            {isFirstTime ? 'Set up your account' : 'Siwolo P.O Law Advocates'}
          </h1>
          <p className="text-xs text-[#6B7280] mt-1 uppercase tracking-wider font-medium">
            {isFirstTime ? 'Initial Administrator Setup' : 'Client & Case Management System'}
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

        {/* ================================================================= */}
        {/* FIRST-RUN SETUP (Shown ONLY when zero users exist in the database) */}
        {/* Normal login form is completely hidden */}
        {/* ================================================================= */}
        {isFirstTime ? (
          <div>
            {setupStep === 1 && (
              <form onSubmit={handleSetupSubmit} className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900 mb-2">
                  <p className="font-semibold flex items-center">
                    <Sparkles className="w-4 h-4 mr-1 text-blue-600" />
                    First-Time Platform Initialization
                  </p>
                  <p className="mt-0.5 text-[11px] text-blue-700">
                    To establish the master advocate account, provide the server SETUP_CODE secret and your administrator details.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-1">
                    Server Setup Authorization Code *
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      autoFocus
                      value={setupCode}
                      onChange={(e) => setSetupCode(e.target.value)}
                      placeholder="Enter SETUP_CODE environment secret"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E5E7EB] rounded focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-1">
                    Full Legal Name *
                  </label>
                  <div className="relative">
                    <UserCheck className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={setupName}
                      onChange={(e) => setSetupName(e.target.value)}
                      placeholder="Peter O. Siwolo"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E5E7EB] rounded focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-1">
                    Administrator Email (2FA Destination) *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={setupEmail}
                      onChange={(e) => setSetupEmail(e.target.value)}
                      placeholder="counsel@siwoloadvocates.com"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E5E7EB] rounded focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
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
                      value={setupUsername}
                      onChange={(e) => setSetupUsername(e.target.value)}
                      placeholder="admin"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E5E7EB] rounded focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-1">
                    Chosen Password (Min 8 characters) *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type={showSetupPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-9 py-2 text-sm bg-white border border-[#E5E7EB] rounded focus:outline-none focus:border-black transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSetupPassword((v) => !v)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showSetupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-1">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type={showSetupConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={setupConfirmPassword}
                      onChange={(e) => setSetupConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-9 py-2 text-sm bg-white border border-[#E5E7EB] rounded focus:outline-none focus:border-black transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSetupConfirmPassword((v) => !v)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showSetupConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 bg-[#111111] hover:bg-black text-white text-xs font-semibold rounded uppercase tracking-wider flex items-center justify-center transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    'Validating...'
                  ) : (
                    <>
                      Send Email Verification Code
                      <ArrowRight className="w-3.5 h-3.5 ml-2" />
                    </>
                  )}
                </button>
              </form>
            )}

            {setupStep === 2 && (
              <form onSubmit={handleSetupVerifySubmit} className="space-y-4">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mb-3 text-black">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">
                    Confirm Your Email
                  </h3>
                  <p className="text-xs text-[#6B7280] mt-1">
                    A 6-digit setup code was sent to <strong>{setupMaskedEmail || setupEmail}</strong> to prove delivery.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-2 text-center">
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={setupVerificationCode}
                    onChange={(e) => setSetupVerificationCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full py-2.5 px-4 text-center text-2xl font-mono tracking-widest bg-white border border-[#E5E7EB] rounded focus:outline-none focus:border-black transition-colors"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-[#6B7280]">
                  <span className="flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1" />
                    Expires: {formatTime(countdown)}
                  </span>
                  <button
                    type="button"
                    onClick={handleSetupResendCode}
                    disabled={resendCooldown > 0 || loading}
                    className="text-xs text-black font-semibold hover:underline disabled:opacity-40 flex items-center"
                  >
                    <RotateCw className="w-3 h-3 mr-1" />
                    {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Code'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading || setupVerificationCode.length !== 6}
                  className="w-full py-2.5 px-4 bg-[#111111] hover:bg-black text-white text-xs font-semibold rounded uppercase tracking-wider flex items-center justify-center transition-colors disabled:opacity-50"
                >
                  {loading ? 'Creating Account...' : 'Verify Code & Finalize Account'}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setSetupStep(1)}
                    className="inline-flex items-center text-xs text-[#6B7280] hover:text-black transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                    Back to Account Details
                  </button>
                </div>
              </form>
            )}

            {setupStep === 3 && (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-full mb-3 text-emerald-800">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Administrator Account Created
                  </h3>
                  <p className="text-xs text-gray-600 mt-1">
                    Your single master account is initialized. Save your emergency recovery codes below.
                  </p>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                      Emergency Recovery Codes
                    </span>
                    <button
                      type="button"
                      onClick={handleCopySetupCodes}
                      className="inline-flex items-center text-xs font-semibold text-black hover:underline"
                    >
                      {copiedSetupCodes ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          Copy All
                        </>
                      )}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center mb-2">
                    {setupRecoveryCodes.map((code, idx) => (
                      <div
                        key={idx}
                        className="py-1 px-2 bg-white border border-amber-300 rounded font-mono text-xs font-bold text-gray-900 tracking-wider shadow-2xs"
                      >
                        {code}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-amber-800">
                    ⚠️ <strong>Important:</strong> These 10 single-use codes are shown only once. Store them in your password manager now.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleFinishSetup}
                  className="w-full py-2.5 px-4 bg-[#111111] hover:bg-black text-white text-xs font-semibold rounded uppercase tracking-wider flex items-center justify-center transition-colors"
                >
                  I Have Saved My Recovery Codes — Go to Dashboard
                  <ArrowRight className="w-3.5 h-3.5 ml-2" />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* =============================================================== */
          /* NORMAL FORM (Visible ONLY when account already exists)          */
          /* =============================================================== */
          <div>
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setForgotStep(1);
                        setForgotIdentifier(username || '');
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-[11px] text-[#4B5563] hover:text-black hover:underline transition-colors"
                    >
                      Forgot password?
                    </button>
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
            )}

            {mode === 'login' && loginStep === 2 && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mb-3 text-black">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wider">
                    Two-Factor Authentication
                  </h2>
                  <p className="text-xs text-[#6B7280] mt-1">
                    {useRecoveryCode ? (
                      'Enter one of your 10 single-use emergency recovery codes.'
                    ) : (
                      <>
                        A 6-digit verification code has been emailed to{' '}
                        <strong className="text-black">{maskedEmail || 'your email'}</strong>.
                      </>
                    )}
                  </p>
                </div>

                {!useRecoveryCode ? (
                  <form onSubmit={handleVerifyCodeSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-2 text-center">
                        6-Digit Verification Code
                      </label>
                      <input
                        type="text"
                        required
                        autoFocus
                        disabled={isLocked}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className="w-full py-2.5 px-4 text-center text-2xl font-mono tracking-widest bg-white border border-[#E5E7EB] rounded focus:outline-none focus:border-black transition-colors disabled:bg-gray-100 disabled:text-gray-400"
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#6B7280]">
                      <span className="flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1" />
                        Code expires in: {formatTime(countdown)}
                      </span>
                      <button
                        type="button"
                        onClick={handleResendCode}
                        disabled={resendCooldown > 0 || loading || isLocked}
                        className="text-xs text-black font-semibold hover:underline disabled:opacity-40 flex items-center"
                      >
                        <RotateCw className="w-3 h-3 mr-1" />
                        {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Code'}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || verificationCode.length !== 6 || isLocked}
                      className="w-full py-2.5 px-4 bg-[#111111] hover:bg-black text-white text-xs font-semibold rounded uppercase tracking-wider flex items-center justify-center transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Verifying...' : 'Verify Code & Sign In'}
                    </button>

                    <div className="pt-2 text-center border-t border-gray-100 space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          setUseRecoveryCode(true);
                          setError(null);
                        }}
                        className="block w-full text-xs text-black font-medium hover:underline"
                      >
                        Can&apos;t get the email? Use a recovery code
                      </button>
                      <button
                        type="button"
                        onClick={handleBackToCredentials}
                        className="inline-flex items-center text-xs text-[#6B7280] hover:text-black transition-colors"
                      >
                        <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                        Back to credentials
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyRecoveryCodeSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-2 text-center">
                        Emergency Recovery Code (XXXX-XXXX)
                      </label>
                      <input
                        type="text"
                        required
                        autoFocus
                        disabled={isLocked}
                        value={recoveryCodeInput}
                        onChange={(e) => setRecoveryCodeInput(e.target.value.toUpperCase())}
                        placeholder="ABCD-1234"
                        className="w-full py-2.5 px-4 text-center text-lg font-mono tracking-wider bg-white border border-[#E5E7EB] rounded focus:outline-none focus:border-black transition-colors disabled:bg-gray-100 disabled:text-gray-400"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !recoveryCodeInput.trim() || isLocked}
                      className="w-full py-2.5 px-4 bg-[#111111] hover:bg-black text-white text-xs font-semibold rounded uppercase tracking-wider flex items-center justify-center transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Verifying...' : 'Verify Recovery Code & Sign In'}
                    </button>

                    <div className="pt-2 text-center border-t border-gray-100 space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          setUseRecoveryCode(false);
                          setError(null);
                        }}
                        className="block w-full text-xs text-black font-medium hover:underline"
                      >
                        Back to email verification code
                      </button>
                      <button
                        type="button"
                        onClick={handleBackToCredentials}
                        className="inline-flex items-center text-xs text-[#6B7280] hover:text-black transition-colors"
                      >
                        <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                        Back to credentials
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {mode === 'forgot' && forgotStep === 1 && (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div className="text-center mb-4">
                  <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wider">
                    Forgot Password
                  </h2>
                  <p className="text-xs text-[#6B7280] mt-1">
                    Enter your username or email address and we will send a 15-minute reset code.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-1">
                    Username or Email
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      autoFocus
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      placeholder="admin or counsel@siwoloadvocates.com"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E5E7EB] rounded focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-[#111111] hover:bg-black text-white text-xs font-semibold rounded uppercase tracking-wider flex items-center justify-center transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    'Sending Code...'
                  ) : (
                    <>
                      Send Reset Code
                      <ArrowRight className="w-3.5 h-3.5 ml-2" />
                    </>
                  )}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setForgotStep(1);
                      setError(null);
                      setSuccess(null);
                    }}
                    className="inline-flex items-center text-xs text-[#6B7280] hover:text-black transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                    Back to Sign In
                  </button>
                </div>
              </form>
            )}

            {mode === 'forgot' && forgotStep === 2 && (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div className="text-center mb-4">
                  <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wider">
                    Reset Password
                  </h2>
                  <p className="text-xs text-[#6B7280] mt-1">
                    Enter the 6-digit reset code sent to your email and your new password.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-2 text-center">
                    6-Digit Reset Code
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full py-2.5 px-4 text-center text-2xl font-mono tracking-widest bg-white border border-[#E5E7EB] rounded focus:outline-none focus:border-black transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-1">
                    New Password (Min 8 characters)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-9 py-2 text-sm bg-white border border-[#E5E7EB] rounded focus:outline-none focus:border-black transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wider mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-9 py-2 text-sm bg-white border border-[#E5E7EB] rounded focus:outline-none focus:border-black transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword((v) => !v)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || resetCode.length !== 6 || newPassword.length < 8}
                  className="w-full mt-2 py-2.5 px-4 bg-[#111111] hover:bg-black text-white text-xs font-semibold rounded uppercase tracking-wider flex items-center justify-center transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    'Resetting Password...'
                  ) : (
                    <>
                      Reset Password &amp; Continue
                      <ArrowRight className="w-3.5 h-3.5 ml-2" />
                    </>
                  )}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setForgotStep(1);
                      setError(null);
                      setSuccess(null);
                    }}
                    className="inline-flex items-center text-xs text-[#6B7280] hover:text-black transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                    Back to Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-[#E5E7EB] text-center text-[11px] text-[#6B7280]">
          Strictly for authorized internal legal counsel and staff.
        </div>
      </div>
    </div>
  );
}
