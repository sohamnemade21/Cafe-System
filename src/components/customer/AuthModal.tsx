import React, { useState } from 'react';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { Modal } from '../common/Modal';
import { CoffeeBeanIcon } from '../common/CoffeeBeanIcon';
import { Mail, Lock, User, Eye, EyeOff, Loader2, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup' | 'forgot_password' | 'reset_password';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
}) => {
  const {
    loginWithEmail,
    signupWithEmail,
    loginWithGoogle,
    resetPassword,
    updatePassword,
    resendConfirmationEmail,
  } = useCustomerAuth();

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot_password' | 'reset_password'>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync mode when modal opens or initialMode changes
  React.useEffect(() => {
    setMode(initialMode);
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const validateEmail = (val: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();
    if (!validateEmail(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address (e.g. name@example.com)');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password');
      return;
    }

    try {
      setLoading(true);
      const res = await loginWithEmail(trimmedEmail, password);
      if (!res.success) {
        setErrorMessage(res.error || 'Invalid email or password');
      } else {
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setErrorMessage('Please enter your full name');
      return;
    }
    if (!validateEmail(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify both entries.');
      return;
    }

    try {
      setLoading(true);
      const res = await signupWithEmail(trimmedName, trimmedEmail, password, phone);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to create account');
      } else {
        if (res.message) {
          setSuccessMessage(res.message);
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();
    if (!validateEmail(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address to receive reset instructions');
      return;
    }

    try {
      setLoading(true);
      const res = await resetPassword(trimmedEmail);
      if (!res.success) {
        setErrorMessage(res.error || 'Unable to send password reset email');
      } else {
        setSuccessMessage(res.message || 'If an account exists for this email, a password reset link has been sent.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Password reset request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    try {
      setLoading(true);
      const res = await updatePassword(password);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to update password');
      } else {
        setSuccessMessage(res.message || 'Password updated successfully! Switching to sign in...');
        setTimeout(() => {
          setMode('login');
          setPassword('');
          setConfirmPassword('');
        }, 1500);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleClick = async () => {
    if (googleLoading) return;
    setErrorMessage(null);
    try {
      setGoogleLoading(true);
      const res = await loginWithGoogle();
      if (!res.success) {
        setErrorMessage(res.error || 'Google login failed');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Google authentication error');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === 'login'
          ? 'Customer Sign In'
          : mode === 'signup'
          ? 'Create Customer Account'
          : mode === 'reset_password'
          ? 'Choose New Password'
          : 'Reset Your Password'
      }
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        {/* Roastery Branding Header Badge */}
        <div className="flex items-center gap-3 p-3 bg-[#FAF3EA] border border-[#EFE2D3] rounded-2xl">
          <div className="w-10 h-10 rounded-xl bg-white border border-[#EFE2D3] flex items-center justify-center text-[#C87D32] shadow-xs shrink-0">
            <CoffeeBeanIcon size={20} />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-[#2A1810]">Artisan Roastery Account</h4>
            <p className="text-[11px] text-[#705648] truncate">
              Order history, saved table invoices &amp; coffee pass rewards
            </p>
          </div>
        </div>

        {/* Tab switch between Login & Signup */}
        {mode !== 'forgot_password' && mode !== 'reset_password' && (
          <div className="grid grid-cols-2 p-1 bg-[#FAF6F0] rounded-xl border border-[#EFE7DD] text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-2 rounded-lg transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-[#2A1810] shadow-xs'
                  : 'text-[#8A7365] hover:text-[#2A1810]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-2 rounded-lg transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white text-[#2A1810] shadow-xs'
                  : 'text-[#8A7365] hover:text-[#2A1810]'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1.5 animate-shake">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="leading-tight">{errorMessage}</span>
            </div>
            {(errorMessage.toLowerCase().includes('confirm') || errorMessage.toLowerCase().includes('not verified')) && email && (
              <button
                type="button"
                onClick={async () => {
                  setResendingEmail(true);
                  const res = await resendConfirmationEmail(email);
                  setResendingEmail(false);
                  if (res.success) {
                    setSuccessMessage(res.message || 'Confirmation email dispatched!');
                    setErrorMessage(null);
                  } else {
                    setErrorMessage(res.error || 'Failed to resend confirmation email.');
                  }
                }}
                disabled={resendingEmail}
                className="text-[11px] font-bold text-[#C87D32] hover:underline flex items-center gap-1 cursor-pointer pt-0.5"
              >
                <span>{resendingEmail ? 'Sending...' : 'Click here to resend verification email'}</span>
              </button>
            )}
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="leading-tight">{successMessage}</span>
          </div>
        )}

        {/* 1. LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-[#2A1810] mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8A7365]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#EFE7DD] bg-white focus:outline-none focus:ring-2 focus:ring-[#C87D32]/30 focus:border-[#C87D32] transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-[#2A1810]">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot_password');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="text-[11px] text-[#C87D32] hover:underline font-semibold cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8A7365]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-[#EFE7DD] bg-white focus:outline-none focus:ring-2 focus:ring-[#C87D32]/30 focus:border-[#C87D32] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8A7365] hover:text-[#2A1810] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-2.5 px-4 bg-[#2D1B14] hover:bg-[#3E271D] disabled:opacity-60 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#E6AA68]" />
                </>
              )}
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#EFE7DD]"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold text-[#8A7365]">
                <span className="bg-white px-3 tracking-wider">or</span>
              </div>
            </div>

            {/* Google OAuth Button with explicit account selection */}
            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={loading || googleLoading}
              className="w-full py-2.5 px-4 bg-white hover:bg-stone-50 border border-[#EFE7DD] text-[#2A1810] rounded-xl font-semibold text-xs flex items-center justify-center gap-2.5 shadow-xs cursor-pointer transition-colors"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#C87D32]" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>Continue with Google</span>
            </button>

            <div className="text-center pt-2 text-xs text-[#705648]">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="font-bold text-[#C87D32] hover:underline cursor-pointer"
              >
                Sign Up
              </button>
            </div>
          </form>
        )}

        {/* 2. SIGNUP / REGISTRATION FORM */}
        {mode === 'signup' && (
          <form onSubmit={handleSignupSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#2A1810] mb-1">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8A7365]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Priya Sharma"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#EFE7DD] bg-white focus:outline-none focus:ring-2 focus:ring-[#C87D32]/30 focus:border-[#C87D32] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2A1810] mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8A7365]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#EFE7DD] bg-white focus:outline-none focus:ring-2 focus:ring-[#C87D32]/30 focus:border-[#C87D32] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2A1810] mb-1">
                Phone Number <span className="text-[10px] text-[#8A7365] font-normal">(Optional for bill SMS)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE7DD] bg-white focus:outline-none focus:ring-2 focus:ring-[#C87D32]/30 focus:border-[#C87D32] transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-[#2A1810] mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 8 chars"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE7DD] bg-white focus:outline-none focus:ring-2 focus:ring-[#C87D32]/30 focus:border-[#C87D32] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2A1810] mb-1">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE7DD] bg-white focus:outline-none focus:ring-2 focus:ring-[#C87D32]/30 focus:border-[#C87D32] transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#705648] pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={e => setShowPassword(e.target.checked)}
                  className="rounded border-[#EFE7DD] text-[#C87D32] focus:ring-[#C87D32]"
                />
                <span>Show passwords</span>
              </label>
              <span className="text-[10px] text-[#8A7365]">Secure Supabase Auth</span>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-2.5 px-4 bg-[#C87D32] hover:bg-[#B36B28] disabled:opacity-60 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#EFE7DD]"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold text-[#8A7365]">
                <span className="bg-white px-3 tracking-wider">or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={loading || googleLoading}
              className="w-full py-2.5 px-4 bg-white hover:bg-stone-50 border border-[#EFE7DD] text-[#2A1810] rounded-xl font-semibold text-xs flex items-center justify-center gap-2.5 shadow-xs cursor-pointer transition-colors"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#C87D32]" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>Continue with Google</span>
            </button>

            <div className="text-center pt-1 text-xs text-[#705648]">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="font-bold text-[#C87D32] hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* 3. FORGOT PASSWORD FORM */}
        {mode === 'forgot_password' && (
          <form onSubmit={handleForgotPasswordSubmit} className="space-y-3.5">
            <p className="text-xs text-[#705648] leading-relaxed">
              Enter the email address associated with your account. We will send you secure instructions to reset your password.
            </p>

            <div>
              <label className="block text-xs font-bold text-[#2A1810] mb-1">
                Your Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8A7365]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#EFE7DD] bg-white focus:outline-none focus:ring-2 focus:ring-[#C87D32]/30 focus:border-[#C87D32] transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#2D1B14] hover:bg-[#3E271D] disabled:opacity-60 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending Instructions...</span>
                </>
              ) : (
                <span>Send Password Reset Link</span>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="text-xs font-bold text-[#C87D32] hover:underline cursor-pointer"
              >
                ← Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* 4. SET NEW PASSWORD (RECOVERY) FORM */}
        {mode === 'reset_password' && (
          <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
            <p className="text-xs text-[#705648] leading-relaxed">
              Please enter and confirm your new account password below.
            </p>

            <div>
              <label className="block text-xs font-bold text-[#2A1810] mb-1">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8A7365]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-[#EFE7DD] bg-white focus:outline-none focus:ring-2 focus:ring-[#C87D32]/30 focus:border-[#C87D32] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8A7365] hover:text-[#2A1810] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2A1810] mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8A7365]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#EFE7DD] bg-white focus:outline-none focus:ring-2 focus:ring-[#C87D32]/30 focus:border-[#C87D32] transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#C87D32] hover:bg-[#B36B28] disabled:opacity-60 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <span>Update Password &amp; Continue</span>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="text-xs font-bold text-[#C87D32] hover:underline cursor-pointer"
              >
                ← Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
