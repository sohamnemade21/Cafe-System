import React, { useState } from 'react';
import { api } from '../../services/api';
import { StaffUser } from '../../types';
import { Lock, User, ShieldCheck, ChefHat, LayoutDashboard, Receipt, AlertCircle, ArrowRight, X, Eye, EyeOff } from 'lucide-react';

interface StaffLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: StaffUser) => void;
  targetRole?: 'RECEPTION' | 'KITCHEN_STAFF' | 'CAFE_OWNER' | null;
  cafeSlug?: string;
}

export const StaffLoginModal: React.FC<StaffLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  targetRole,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset fields when opening modal
  React.useEffect(() => {
    if (isOpen) {
      setIdentifier('');
      setPassword('');
      setError(null);
      setShowPassword(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedId = identifier.trim();
    if (!trimmedId || !password) {
      setError('Please provide both User ID and Password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.staffLogin(trimmedId, password);
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid User ID or Password.');
    } finally {
      setLoading(false);
    }
  };

  const getPortalTitle = () => {
    if (targetRole === 'KITCHEN_STAFF') return 'Kitchen KDS Portal';
    if (targetRole === 'RECEPTION') return 'Reception & Front Desk';
    return 'Owner & Manager Portal';
  };

  const getPortalDescription = () => {
    if (targetRole === 'KITCHEN_STAFF') return 'Access restricted to authorized Kitchen Staff and Head Chefs.';
    if (targetRole === 'RECEPTION') return 'Access restricted to Cashier and Front Desk personnel.';
    return 'Access restricted to Café Owners and Administrators.';
  };

  const getPortalIcon = () => {
    if (targetRole === 'KITCHEN_STAFF') return <ChefHat size={22} />;
    if (targetRole === 'RECEPTION') return <Receipt size={22} />;
    return <LayoutDashboard size={22} />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 border border-[#EFE2D3] shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FAF3EA] border border-[#EFE2D3] flex items-center justify-center text-[#C87D32] shadow-xs">
            {getPortalIcon()}
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#2D1B14] font-serif tracking-tight">
              {getPortalTitle()}
            </h2>
            <p className="text-xs text-[#8A7365]">
              {getPortalDescription()}
            </p>
          </div>
        </div>

        {/* Security Warning Notice */}
        <div className="bg-[#FAF8F5] p-3 rounded-2xl border border-[#EFE2D3] text-xs text-[#705648] flex items-start gap-2.5">
          <ShieldCheck size={16} className="text-[#C87D32] shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            Customer email accounts cannot access staff or owner portals. Enter your assigned portal User ID and password to proceed.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-[#2D1B14] block mb-1">
              Portal User ID or Staff Email
            </label>
            <div className="relative">
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                required
                autoComplete="username"
                placeholder="e.g. cafeOwnerAdmin, kitchenLead, serviceDesk"
                className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-[#EFE2D3] bg-[#FAF8F5] focus:bg-white focus:outline-hidden focus:border-[#C87D32]"
              />
              <User size={14} className="absolute left-2.5 top-3 text-[#A89284]" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#2D1B14] block mb-1">
              Portal Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter your portal password"
                className="w-full text-xs pl-8 pr-9 py-2.5 rounded-xl border border-[#EFE2D3] bg-[#FAF8F5] focus:bg-white focus:outline-hidden focus:border-[#C87D32]"
              />
              <Lock size={14} className="absolute left-2.5 top-3 text-[#A89284]" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-[10px] text-[#A89284] mt-1">
              Cryptographically hashed and verified on backend server.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#C87D32] hover:bg-[#B36B28] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to Portal</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
