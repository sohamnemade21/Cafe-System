import React, { useState, useEffect } from 'react';
import { Customer, Order, Cafe } from '../../types';
import { api } from '../../services/api';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { generateInvoicePDF } from '../../utils/pdfGenerator';
import { Modal } from '../common/Modal';
import {
  User,
  Receipt,
  Download,
  Clock,
  ShieldCheck,
  Mail,
  LogIn,
  LogOut,
  Check,
  Phone,
  UserPlus,
  Edit2,
  Save,
  X,
  Lock,
  Sparkles,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface CustomerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  cafe: Cafe;
  initialTab?: 'profile' | 'orders';
  onOpenAuth?: (mode: 'login' | 'signup') => void;
  onLogout?: () => void;
}

const PRESET_AVATARS = [
  { id: 'av1', label: 'Barista', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80' },
  { id: 'av2', label: 'Artisan', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80' },
  { id: 'av3', label: 'Roaster', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80' },
  { id: 'av4', label: 'Patron', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80' },
];

export const CustomerProfileModal: React.FC<CustomerProfileModalProps> = ({
  isOpen,
  onClose,
  customer,
  cafe,
  initialTab = 'profile',
  onOpenAuth,
  onLogout,
}) => {
  const { updateProfile } = useCustomerAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'orders' | 'privacy'>('profile');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Edit profile form state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Marketing preferences
  const [emailConsent, setEmailConsent] = useState(true);
  const [smsConsent, setSmsConsent] = useState(false);
  const [whatsAppConsent, setWhatsAppConsent] = useState(true);
  const [consentSaved, setConsentSaved] = useState(false);

  // Reset tab & form when modal opens or customer changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setIsEditing(false);
      setProfileSuccess(null);
      setProfileError(null);
      if (customer) {
        setEditName(customer.name || '');
        setEditPhone(customer.phone || '');
        setEditAvatar(customer.profile_image || '');
      }
    }
  }, [isOpen, initialTab, customer]);

  useEffect(() => {
    if (customer?.email && isOpen) {
      setLoadingOrders(true);
      api.getCustomerOrders(customer.email)
        .then(res => setOrders(res))
        .catch(console.error)
        .finally(() => setLoadingOrders(false));
    } else {
      setOrders([]);
    }
  }, [customer, isOpen]);

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      setProfileError('Full name cannot be empty.');
      return;
    }

    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const res = await updateProfile({
        name: editName.trim(),
        phone: editPhone.trim(),
        profile_image: editAvatar.trim(),
      });

      if (!res.success) {
        setProfileError(res.error || 'Failed to update profile.');
      } else {
        setProfileSuccess('Profile details saved successfully!');
        setIsEditing(false);
        setTimeout(() => setProfileSuccess(null), 3500);
      }
    } catch (err: any) {
      setProfileError(err.message || 'An unexpected error occurred.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDownloadInvoice = async (ord: Order) => {
    const doc = await generateInvoicePDF(ord, cafe);
    doc.save(`Invoice_${cafe.slug}_Order_${ord.id.slice(-6)}.pdf`);
  };

  const handleUpdateConsent = async (email: boolean, sms: boolean, wa: boolean) => {
    setEmailConsent(email);
    setSmsConsent(sms);
    setWhatsAppConsent(wa);

    if (customer?.id) {
      try {
        await api.updateCustomerMarketing(customer.id, {
          email_marketing: email,
          sms_marketing: sms,
          whatsapp_marketing: wa,
        });
        setConsentSaved(true);
        setTimeout(() => setConsentSaved(false), 2000);
      } catch (e) {
        console.error('Failed to update marketing consent', e);
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Customer Account & Order Portal" maxWidth="max-w-xl">
      <div className="space-y-5">
        {/* If customer is authenticated */}
        {customer ? (
          <>
            {/* Top Navigation Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-[#FAF6F0] rounded-2xl border border-[#EFE7DD]">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'profile'
                    ? 'bg-white text-[#2A1810] shadow-xs border border-[#EFE2D3]'
                    : 'text-[#705648] hover:text-[#2A1810]'
                }`}
              >
                <User size={14} />
                <span>Profile &amp; Details</span>
              </button>

              <button
                onClick={() => setActiveTab('orders')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'orders'
                    ? 'bg-white text-[#2A1810] shadow-xs border border-[#EFE2D3]'
                    : 'text-[#705648] hover:text-[#2A1810]'
                }`}
              >
                <Clock size={14} />
                <span>Order History ({orders.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('privacy')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'privacy'
                    ? 'bg-white text-[#2A1810] shadow-xs border border-[#EFE2D3]'
                    : 'text-[#705648] hover:text-[#2A1810]'
                }`}
              >
                <ShieldCheck size={14} />
                <span>Privacy &amp; Consents</span>
              </button>
            </div>

            {/* Notification messages */}
            {profileSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
                <Check size={15} className="shrink-0 text-emerald-600" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle size={15} className="shrink-0 text-red-600" />
                <span>{profileError}</span>
              </div>
            )}

            {/* TAB 1: PROFILE & EDIT DETAILS */}
            {activeTab === 'profile' && (
              <div className="space-y-4">
                {/* Profile Overview Card */}
                <div className="bg-[#FAF8F5] rounded-2xl border border-[#EFE7DD] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    {customer.profile_image ? (
                      <img
                        src={customer.profile_image}
                        alt={customer.name}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80';
                        }}
                        className="w-14 h-14 rounded-2xl object-cover border border-[#EFE2D3] shadow-xs shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-[#FAF3EA] border border-[#EFE2D3] flex items-center justify-center text-[#C87D32] font-black text-xl shrink-0">
                        {customer.name ? customer.name.charAt(0).toUpperCase() : <User size={24} />}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-[#2A1810] text-sm">{customer.name}</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full flex items-center gap-1">
                          <ShieldCheck size={11} className="text-emerald-600" />
                          Authenticated
                        </span>
                      </div>
                      <p className="text-xs text-[#705648] flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3 h-3 text-[#A89284]" />
                        <span>{customer.email}</span>
                      </p>
                      {customer.phone ? (
                        <p className="text-[11px] text-[#A89284] flex items-center gap-1.5 mt-0.5">
                          <Phone className="w-3 h-3 text-[#A89284]" />
                          <span>{customer.phone}</span>
                        </p>
                      ) : (
                        <p className="text-[10px] text-[#A89284] italic mt-0.5">No phone number added</p>
                      )}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-[#EFE7DD]">
                    <div className="text-right">
                      <span className="text-[10px] text-[#8A7365] font-semibold block">Total Spent</span>
                      <span className="text-base font-black text-[#C87D32]">
                        {cafe.currency}{customer.total_spent ? customer.total_spent.toFixed(2) : '0.00'}
                      </span>
                    </div>

                    {!isEditing && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="sm:mt-2 text-xs font-bold text-[#C87D32] hover:text-[#B36B28] flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-[#EFE2D3] shadow-2xs"
                      >
                        <Edit2 size={12} />
                        <span>Edit Details</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Edit Permitted Details Form */}
                {isEditing && (
                  <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl border border-[#EFE7DD] p-4 space-y-4 shadow-sm animate-in fade-in">
                    <div className="flex items-center justify-between pb-2 border-b border-[#FAF3EA]">
                      <h5 className="text-xs font-bold text-[#2A1810] flex items-center gap-1.5">
                        <Edit2 size={13} className="text-[#C87D32]" />
                        <span>Edit Permitted Personal Details</span>
                      </h5>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(false);
                          setProfileError(null);
                        }}
                        className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
                        title="Cancel"
                      >
                        <X size={15} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Name input */}
                      <div>
                        <label className="text-[11px] font-bold text-[#2A1810] block mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          required
                          placeholder="Your display name"
                          className="w-full text-xs px-3 py-2 rounded-xl border border-[#EFE2D3] bg-[#FAF8F5] focus:bg-white focus:outline-hidden focus:border-[#C87D32]"
                        />
                      </div>

                      {/* Phone input */}
                      <div>
                        <label className="text-[11px] font-bold text-[#2A1810] block mb-1">
                          Phone Number (Optional)
                        </label>
                        <input
                          type="tel"
                          value={editPhone}
                          onChange={e => setEditPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full text-xs px-3 py-2 rounded-xl border border-[#EFE2D3] bg-[#FAF8F5] focus:bg-white focus:outline-hidden focus:border-[#C87D32]"
                        />
                      </div>
                    </div>

                    {/* Avatar URL or Preset Choice */}
                    <div>
                      <label className="text-[11px] font-bold text-[#2A1810] block mb-1">
                        Avatar Image URL
                      </label>
                      <input
                        type="url"
                        value={editAvatar}
                        onChange={e => setEditAvatar(e.target.value)}
                        placeholder="https://... (or choose a preset below)"
                        className="w-full text-xs px-3 py-2 rounded-xl border border-[#EFE2D3] bg-[#FAF8F5] focus:bg-white focus:outline-hidden focus:border-[#C87D32]"
                      />

                      {/* Preset Avatars */}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] text-[#8A7365] font-semibold">Presets:</span>
                        {PRESET_AVATARS.map(av => (
                          <button
                            key={av.id}
                            type="button"
                            onClick={() => setEditAvatar(av.url)}
                            className={`w-7 h-7 rounded-full overflow-hidden border-2 transition-transform cursor-pointer ${
                              editAvatar === av.url ? 'border-[#C87D32] scale-110' : 'border-transparent hover:border-[#EFE2D3]'
                            }`}
                            title={av.label}
                          >
                            <img src={av.url} alt={av.label} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Protected Fields Notice */}
                    <div className="bg-[#FAF8F5] p-2.5 rounded-xl border border-[#EFE7DD] flex items-center justify-between text-[11px] text-[#8A7365]">
                      <div className="flex items-center gap-1.5">
                        <Lock size={12} className="text-[#A89284]" />
                        <span>Protected Identity: Email &amp; Role cannot be modified directly.</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#A89284]">{customer.email}</span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-3 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingProfile}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-[#C87D32] hover:bg-[#B36B28] text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {savingProfile ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Save size={13} />
                            <span>Save Changes</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* Account Sign Out Action */}
                <div className="flex items-center justify-between p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#EFE7DD]">
                  <div>
                    <span className="text-xs font-bold text-[#2A1810] block">Sign Out of Account</span>
                    <span className="text-[11px] text-[#8A7365]">
                      Invalidates your active customer token and clears local session cache.
                    </span>
                  </div>

                  {onLogout && (
                    <button
                      onClick={() => {
                        onLogout();
                        onClose();
                      }}
                      className="px-3.5 py-2 text-xs font-bold text-red-600 hover:text-white hover:bg-red-600 border border-red-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <LogOut size={13} />
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: ORDER HISTORY & INVOICES */}
            {activeTab === 'orders' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#2A1810] uppercase tracking-wider">
                    Recent Table Dine-In Orders
                  </h4>
                  <span className="text-[11px] text-[#8A7365]">
                    {orders.length} orders recorded
                  </span>
                </div>

                {loadingOrders ? (
                  <div className="py-12 text-center text-xs text-[#8A7365] space-y-2">
                    <Loader2 size={20} className="animate-spin text-[#C87D32] mx-auto" />
                    <p>Retrieving your order invoices &amp; kitchen status...</p>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="py-12 text-center space-y-2 bg-[#FAF8F5] rounded-2xl border border-[#EFE7DD] p-6">
                    <Receipt className="w-10 h-10 text-[#C87D32] mx-auto opacity-70" />
                    <h5 className="text-xs font-bold text-[#2A1810]">No orders found yet</h5>
                    <p className="text-[11px] text-[#8A7365] max-w-xs mx-auto">
                      Any dine-in meals ordered from Table #{cafe.name} while signed in will automatically be saved to your profile with downloadable GST invoices.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {orders.map(ord => (
                      <div
                        key={ord.id}
                        className="bg-[#FAF8F5] rounded-2xl border border-[#EFE7DD] p-3.5 space-y-2.5 transition-all hover:border-[#D8B48D]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#2A1810]">
                              Order #{ord.id.slice(-6).toUpperCase()}
                            </span>
                            <span className="text-[10px] text-[#8A7365]">
                              · Table {ord.table_number}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              ord.order_status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : ord.order_status === 'PREPARING'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-stone-100 text-stone-700'
                            }`}>
                              {ord.order_status}
                            </span>
                            <span className="text-xs font-extrabold text-[#2A1810]">
                              {cafe.currency}{ord.total.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Items list */}
                        <div className="text-[11px] text-[#705648] bg-white p-2 rounded-xl border border-[#EFE7DD] divide-y divide-[#FAF3EA]">
                          {ord.items.map(it => (
                            <div key={it.id} className="py-1 flex items-center justify-between first:pt-0 last:pb-0">
                              <span>{it.quantity}x {it.item_name}</span>
                              <span className="font-semibold text-[#2A1810]">
                                {cafe.currency}{it.subtotal.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-1 text-[10px] text-[#8A7365]">
                          <span>{new Date(ord.created_at).toLocaleString()}</span>
                          <button
                            onClick={() => handleDownloadInvoice(ord)}
                            className="text-[#C87D32] hover:text-[#B36B28] font-bold flex items-center gap-1 cursor-pointer bg-white px-2 py-1 rounded-lg border border-[#EFE2D3] shadow-2xs"
                          >
                            <Download size={11} />
                            <span>Download Tax Invoice (PDF)</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: PRIVACY & MARKETING CONSENTS */}
            {activeTab === 'privacy' && (
              <div className="space-y-4">
                <div className="bg-[#FAF8F5] rounded-2xl border border-[#EFE7DD] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-[#2A1810] flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Communication &amp; Invoice Dispatches</span>
                    </h5>
                    {consentSaved && (
                      <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <Check size={11} />
                        Preferences updated
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#705648] leading-relaxed">
                    Under Digital Personal Data Protection (DPDP) and GDPR standards, you retain complete authority over how the café contacts you regarding bills and loyalty perks.
                  </p>

                  <div className="space-y-2 pt-2">
                    <label className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#EFE7DD] cursor-pointer">
                      <div className="text-xs">
                        <span className="font-bold text-[#2A1810] block">Email Tax Invoices &amp; Receipts</span>
                        <span className="text-[10px] text-[#8A7365]">Receive digital PDF tax invoices upon payment verification</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={emailConsent}
                        onChange={e => handleUpdateConsent(e.target.checked, smsConsent, whatsAppConsent)}
                        className="accent-[#C87D32] w-4 h-4 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#EFE7DD] cursor-pointer">
                      <div className="text-xs">
                        <span className="font-bold text-[#2A1810] block">WhatsApp Live Status Alerts</span>
                        <span className="text-[10px] text-[#8A7365]">Receive table preparation updates and ready notifications</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={whatsAppConsent}
                        onChange={e => handleUpdateConsent(emailConsent, smsConsent, e.target.checked)}
                        className="accent-[#C87D32] w-4 h-4 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#EFE7DD] cursor-pointer">
                      <div className="text-xs">
                        <span className="font-bold text-[#2A1810] block">SMS Dining Offers &amp; Rewards</span>
                        <span className="text-[10px] text-[#8A7365]">Periodic discount coupons for birthday and weekend dining</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={smsConsent}
                        onChange={e => handleUpdateConsent(emailConsent, e.target.checked, whatsAppConsent)}
                        className="accent-[#C87D32] w-4 h-4 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* LOGGED-OUT STATE BARRIER */
          <div className="bg-[#FAF8F5] rounded-2xl border border-[#EFE7DD] p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF3EA] border border-[#EFE2D3] flex items-center justify-center text-[#C87D32] mx-auto shadow-xs">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#2A1810]">Sign in to access your account</h4>
              <p className="text-xs text-[#705648] max-w-sm mx-auto mt-1">
                Save table orders to your customer profile, view live and historical tax invoices, and earn loyalty perks.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenAuth?.('login');
                }}
                className="px-5 py-2.5 bg-[#2D1B14] hover:bg-[#3E271D] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <LogIn className="w-4 h-4 text-[#E6AA68]" />
                <span>Sign In</span>
              </button>
              <button
                onClick={() => {
                  onClose();
                  onOpenAuth?.('signup');
                }}
                className="px-5 py-2.5 bg-[#C87D32] hover:bg-[#B36B28] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create Account</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
