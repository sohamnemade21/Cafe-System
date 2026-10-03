import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Customer } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { api } from '../services/api';

export interface AuthNotice {
  type: 'error' | 'success' | 'info';
  code?: string;
  title: string;
  message: string;
  action?: 'resend_confirmation' | 'login' | 'retry_sync';
}

interface CustomerAuthContextType {
  customer: Customer | null;
  supabaseUser: any | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'signup' | 'forgot_password' | 'reset_password';
  authNotice: AuthNotice | null;
  dismissNotice: () => void;
  openAuthModal: (mode?: 'login' | 'signup' | 'forgot_password' | 'reset_password') => void;
  closeAuthModal: () => void;
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signupWithEmail: (fullName: string, email: string, password: string, phone?: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  resendConfirmationEmail: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  updateProfile: (updates: { name?: string; phone?: string; profile_image?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

// Dynamically compute the exact callback origin for both local preview and production Cloud Run
function getAppRedirectUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin + window.location.pathname;
  }
  return '';
}

export const CustomerAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup' | 'forgot_password' | 'reset_password'>('login');
  const [authNotice, setAuthNotice] = useState<AuthNotice | null>(null);

  const openAuthModal = (mode: 'login' | 'signup' | 'forgot_password' | 'reset_password' = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const dismissNotice = () => {
    setAuthNotice(null);
  };

  // Synchronize authenticated Supabase user with backend profile and order history
  const syncUserToCustomer = async (user: any, tokenOverride?: string, retryCount = 0): Promise<Customer | null> => {
    if (!user || !user.email) return null;
    try {
      const email = user.email.toLowerCase().trim();
      const fullName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email.split('@')[0];
      const avatarUrl =
        user.user_metadata?.avatar_url ||
        user.user_metadata?.picture ||
        '';
      const phone = user.user_metadata?.phone || user.phone || '';

      const token = tokenOverride || api.getCustomerToken();
      if (token) {
        api.setCustomerToken(token);
      }

      const syncedCust = await api.syncCustomerProfile({
        auth_user_id: user.id,
        email,
        name: fullName,
        phone,
        profile_image: avatarUrl,
      }, token || undefined);

      api.setCustomerEmail(syncedCust.email);
      api.setCustomerAuthId(user.id);
      setCustomer(syncedCust);
      return syncedCust;
    } catch (err: any) {
      console.error('Failed to sync customer profile with backend:', err);
      // Auto-retry transient network failure up to 2 times
      if (retryCount < 2 && (err?.message?.includes('fetch') || err?.name === 'TypeError')) {
        await new Promise(r => setTimeout(r, 600 * (retryCount + 1)));
        return syncUserToCustomer(user, tokenOverride, retryCount + 1);
      }

      // Never silently ignore profile-sync failures
      setAuthNotice({
        type: 'error',
        title: 'Profile Synchronization Pending',
        message: 'Could not sync customer profile with café backend. Tap retry to reconnect.',
        action: 'retry_sync',
      });
      return null;
    }
  };

  // Restore authenticated session & handle confirmation URL callbacks
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        if (!isSupabaseConfigured()) {
          console.warn('Supabase is not configured. Customer authentication requires valid SUPABASE_URL and SUPABASE_ANON_KEY.');
          return;
        }

        // 1. Detect URL hash and query errors from email confirmation / password reset
        if (typeof window !== 'undefined') {
          const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
          const rawSearch = window.location.search.startsWith('?') ? window.location.search.slice(1) : '';
          const hashParams = new URLSearchParams(rawHash);
          const searchParams = new URLSearchParams(rawSearch);

          const error = hashParams.get('error') || searchParams.get('error');
          const errorCode = hashParams.get('error_code') || searchParams.get('error_code');
          const errorDesc = hashParams.get('error_description') || searchParams.get('error_description');
          const type = hashParams.get('type') || searchParams.get('type');

          if (type === 'recovery') {
            setAuthModalMode('reset_password');
            setIsAuthModalOpen(true);
          }

          if (error || errorCode) {
            console.warn('Supabase confirmation callback issue:', { error, errorCode, errorDesc });
            if (errorCode === 'otp_expired' || error === 'access_denied') {
              setAuthNotice({
                type: 'error',
                code: 'otp_expired',
                title: 'Email Link Expired',
                message: 'Your verification or password reset link is invalid or has expired. Request a fresh link below.',
                action: 'resend_confirmation',
              });
            } else {
              setAuthNotice({
                type: 'error',
                code: (errorCode || error) || undefined,
                title: 'Authentication Notice',
                message: decodeURIComponent((errorDesc || error || 'Authentication could not be completed.').replace(/\+/g, ' ')),
              });
            }

            // Clean error query / hash from URL so it does not persist across user interactions
            try {
              const url = new URL(window.location.href);
              url.hash = '';
              url.searchParams.delete('error');
              url.searchParams.delete('error_code');
              url.searchParams.delete('error_description');
              window.history.replaceState({}, document.title, url.toString());
            } catch {}
          }
        }

        // 2. Fetch session from Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Supabase getSession error:', error.message);
        }

        if (session?.user && mounted) {
          if (session.access_token) {
            api.setCustomerToken(session.access_token);
          }
          setSupabaseUser(session.user);
          await syncUserToCustomer(session.user, session.access_token);
        } else {
          setSupabaseUser(null);
          setCustomer(null);
          api.clearCustomerAuth();
        }
      } catch (err) {
        console.error('CustomerAuth initialization error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    // Listen for real-time auth changes from Supabase
    let subscription: any = null;
    if (isSupabaseConfigured()) {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return;

        if (event === 'PASSWORD_RECOVERY') {
          setAuthModalMode('reset_password');
          setIsAuthModalOpen(true);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (session?.access_token) {
            api.setCustomerToken(session.access_token);
          }
          if (session?.user) {
            setSupabaseUser(session.user);
            await syncUserToCustomer(session.user, session?.access_token);
          }
        } else if (event === 'SIGNED_OUT') {
          api.clearCustomerAuth();
          setSupabaseUser(null);
          setCustomer(null);
        }
      });
      subscription = data.subscription;
    }

    return () => {
      mounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user || supabaseUser;
      if (currentUser) {
        const synced = await syncUserToCustomer(currentUser, session?.access_token);
        if (synced) {
          setAuthNotice(null);
          return;
        }
      } else if (customer?.email) {
        const updated = await api.getCustomerProfile(customer.auth_user_id || customer.email);
        setCustomer(updated);
        setAuthNotice(null);
      }
    } catch (err) {
      console.error('Failed to refresh customer profile:', err);
    }
  };

  // Update Permitted Profile Details (Name, Phone, Profile Image)
  const updateProfile = async (updates: { name?: string; phone?: string; profile_image?: string }): Promise<{ success: boolean; error?: string }> => {
    if (!customer?.id && !customer?.email) {
      return { success: false, error: 'No active authenticated customer session' };
    }

    try {
      // 1. Update in backend persistent store
      const updated = await api.updateCustomerProfile(customer.id || customer.email, updates);
      setCustomer(updated);

      // 2. Sync to Supabase user metadata
      if (isSupabaseConfigured() && supabaseUser) {
        await supabase.auth.updateUser({
          data: {
            full_name: updates.name || customer.name,
            phone: updates.phone !== undefined ? updates.phone : customer.phone,
            avatar_url: updates.profile_image !== undefined ? updates.profile_image : customer.profile_image,
          },
        }).catch(err => console.warn('Supabase metadata update note:', err));
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to save profile changes' };
    }
  };

  // Customer Login with Email & Password via Supabase Auth
  const loginWithEmail = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      return { success: false, error: 'Please enter your email address' };
    }
    if (!password) {
      return { success: false, error: 'Please enter your password' };
    }

    if (!isSupabaseConfigured()) {
      return {
        success: false,
        error: 'Authentication service is unavailable. Please verify Supabase configuration.'
      };
    }

    try {
      // Direct call to Supabase Auth - strictly enforced
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        // Any incorrect password, wrong email, or auth error MUST FAIL 100%
        return { success: false, error: error.message };
      }

      if (!data?.session || !data?.user) {
        return { success: false, error: 'Invalid login credentials' };
      }

      if (data.session?.access_token) {
        api.setCustomerToken(data.session.access_token);
      }
      setSupabaseUser(data.user);
      const synced = await syncUserToCustomer(data.user, data.session?.access_token);
      if (!synced) {
        return {
          success: false,
          error: 'Logged in to Supabase, but profile synchronization failed with backend. Please retry.'
        };
      }
      closeAuthModal();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Authentication error' };
    }
  };

  // Customer Signup with Email & Password via Supabase Auth
  const signupWithEmail = async (
    fullName: string,
    email: string,
    password: string,
    phone?: string
  ): Promise<{ success: boolean; error?: string; message?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = fullName.trim();

    if (!trimmedName) {
      return { success: false, error: 'Please enter your full name' };
    }
    if (!trimmedEmail) {
      return { success: false, error: 'Please enter a valid email address' };
    }
    if (password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long' };
    }

    if (!isSupabaseConfigured()) {
      return {
        success: false,
        error: 'Authentication service is unavailable. Please verify Supabase configuration.'
      };
    }

    try {
      const redirectUrl = getAppRedirectUrl();
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: trimmedName,
            phone: phone?.trim() || '',
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        if (data.session) {
          if (data.session.access_token) {
            api.setCustomerToken(data.session.access_token);
          }
          setSupabaseUser(data.user);
          await syncUserToCustomer(data.user, data.session.access_token);
        }
        closeAuthModal();
        return {
          success: true,
          message: data.session
            ? 'Account created successfully!'
            : `Registration received! A confirmation email has been dispatched to ${trimmedEmail}.`
        };
      }
      return { success: false, error: 'Failed to create user account' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Registration failed' };
    }
  };

  // Resend Confirmation Email with production redirect URL
  const resendConfirmationEmail = async (email: string): Promise<{ success: boolean; error?: string; message?: string }> => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      return { success: false, error: 'Please enter your email address' };
    }

    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase configuration missing.' };
    }

    try {
      const redirectUrl = getAppRedirectUrl();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: trimmed,
        options: {
          emailRedirectTo: redirectUrl,
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }
      return {
        success: true,
        message: `A fresh confirmation link has been sent to ${trimmed}.`
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to resend confirmation email.' };
    }
  };

  // Google OAuth via Supabase with explicit account chooser (prompt=select_account) and production redirect
  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          error: 'Supabase configuration is missing in environment variables.'
        };
      }

      const redirectUrl = getAppRedirectUrl();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: {
            prompt: 'select_account',
            access_type: 'offline',
          },
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Google authentication failed' };
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string; message?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      return { success: false, error: 'Please enter your email address' };
    }

    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase configuration missing.' };
    }

    try {
      const redirectUrl = getAppRedirectUrl();
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: redirectUrl,
      });
      if (error) {
        // Do not reveal user enumeration, but handle true network/rate-limit blocks gracefully
        console.warn('Supabase resetPassword note:', error.message);
      }
      return {
        success: true,
        message: 'If an account exists for this email, a password reset link has been sent.'
      };
    } catch (err: any) {
      return {
        success: true,
        message: 'If an account exists for this email, a password reset link has been sent.'
      };
    }
  };

  const updatePassword = async (newPassword: string): Promise<{ success: boolean; error?: string; message?: string }> => {
    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }

    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase configuration missing.' };
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        return { success: false, error: error.message };
      }
      return {
        success: true,
        message: 'Your password has been successfully updated. You can now log in.'
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update password' };
    }
  };

  const logout = async () => {
    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('SignOut error:', err);
    } finally {
      setSupabaseUser(null);
      setCustomer(null);
      api.clearCustomerAuth();
    }
  };

  return (
    <CustomerAuthContext.Provider
      value={{
        customer,
        supabaseUser,
        loading,
        isAuthenticated: Boolean(customer),
        isAuthModalOpen,
        authModalMode,
        authNotice,
        dismissNotice,
        openAuthModal,
        closeAuthModal,
        loginWithEmail,
        signupWithEmail,
        loginWithGoogle,
        resetPassword,
        updatePassword,
        resendConfirmationEmail,
        updateProfile,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
};

export const useCustomerAuth = (): CustomerAuthContextType => {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
  }
  return context;
};
