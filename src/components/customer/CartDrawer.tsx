import React, { useState } from 'react';
import { Cafe, CartItem, Customer } from '../../types';
import { api } from '../../services/api';
import { X, Minus, Plus, Trash2, Tag, Check, ArrowRight, ShieldCheck, AlertCircle, Loader2, Sparkles, Award } from 'lucide-react';
import { CoffeeBeanIcon } from '../common/CoffeeBeanIcon';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cafe: Cafe;
  tableNumber?: number | null;
  cartItems: CartItem[];
  customer: Customer | null;
  checkoutError?: string | null;
  isSubmitting?: boolean;
  onUpdateQuantity: (index: number, newQty: number) => void;
  onRemoveItem: (index: number) => void;
  onOpenLogin?: () => void;
  onScanQr?: () => void;
  onCheckout: (orderDetails: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    notes: string;
    couponCode?: string;
    marketingConsent: boolean;
  }) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cafe,
  tableNumber,
  cartItems,
  customer,
  checkoutError,
  isSubmitting,
  onUpdateQuantity,
  onRemoveItem,
  onOpenLogin,
  onScanQr,
  onCheckout,
}) => {
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount_amount: number;
    description: string;
  } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Customer form state
  const [name, setName] = useState(customer?.name || '');
  const [email, setEmail] = useState(customer?.email || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [tableNotes, setTableNotes] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(true);

  React.useEffect(() => {
    if (customer) {
      if (customer.name) setName(customer.name);
      if (customer.email) setEmail(customer.email);
      if (customer.phone) setPhone(customer.phone);
    }
  }, [customer]);

  if (!isOpen) return null;

  // Calculate prices
  const subtotal = cartItems.reduce((sum, item) => sum + item.itemTotal, 0);
  const discount = appliedCoupon ? appliedCoupon.discount_amount : 0;
  const taxableBase = Math.max(0, subtotal - discount);
  const tax = Number(((taxableBase * (cafe.tax_rate || 5)) / 100).toFixed(2));
  const serviceCharge = Number(((taxableBase * (cafe.service_charge_rate || 0)) / 100).toFixed(2));
  const grandTotal = Number((taxableBase + tax + serviceCharge).toFixed(2));

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    setCouponError('');
    try {
      const res = await api.validateCoupon(cafe.id, couponCode.trim(), subtotal);
      setAppliedCoupon(res);
      setCouponError('');
    } catch (err: any) {
      setCouponError(err.message || 'Invalid coupon code');
      setAppliedCoupon(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) return;

    onCheckout({
      customerName: name.trim(),
      customerEmail: email.trim(),
      customerPhone: phone.trim(),
      notes: tableNotes.trim(),
      couponCode: appliedCoupon?.code,
      marketingConsent,
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#2A1810]/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#FAF8F5] shadow-2xl flex flex-col justify-between border-l border-[#EFE7DD]">
          {/* Header */}
          <div className="p-4 bg-[#2D1B14] text-[#FDFBF7] flex items-center justify-between border-b border-[#3E271D]">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif-cafe font-bold text-base text-[#FDFBF7]">Table Order</h3>
                {tableNumber ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#3E271D] text-[#E6AA68] border border-[#523528]">
                    Table #{tableNumber}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                    No Table Scanned
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#D5C2B5] mt-0.5">
                {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'} selected
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-[#3E271D] text-[#D5C2B5] hover:text-[#FDFBF7] hover:bg-[#523528] cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cartItems.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6">
                <div className="w-14 h-14 rounded-full bg-[#F5EFEB] flex items-center justify-center text-[#C87D32] mb-3 border border-[#EFE7DD]">
                  <CoffeeBeanIcon size={24} />
                </div>
                <h4 className="font-bold text-[#2A1810] text-sm">Your order is empty</h4>
                <p className="text-xs text-[#705648] mt-1 max-w-xs">
                  Discover single-origin pours, artisanal teas, and fresh baked pastries to add to your table.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2.5">
                  {cartItems.map((cartItem, idx) => (
                    <div
                      key={`${cartItem.menuItem.id}-${idx}`}
                      className="p-3 bg-white rounded-2xl border border-[#EFE7DD] shadow-xs flex items-start justify-between gap-3 hover:border-[#D8B48D] transition-colors"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <img
                          src={cartItem.menuItem.image_url}
                          alt={cartItem.menuItem.name}
                          className="w-13 h-13 rounded-xl object-cover border border-[#EFE7DD] shrink-0"
                        />
                        <div className="min-w-0">
                          <h5 className="font-bold text-xs text-[#2A1810] leading-snug line-clamp-1">
                            {cartItem.menuItem.name}
                          </h5>

                          {/* Selected Variants */}
                          {cartItem.selectedVariants.length > 0 && (
                            <div className="text-[11px] text-[#705648] mt-0.5 space-y-0.5">
                              {cartItem.selectedVariants.map((v, vIdx) => (
                                <span key={vIdx} className="inline-block mr-1.5 font-medium text-[#8C7667]">
                                  • {v.name}
                                </span>
                              ))}
                            </div>
                          )}

                          {cartItem.notes && (
                            <p className="text-[10px] text-[#A89284] italic mt-0.5">
                              &ldquo;{cartItem.notes}&rdquo;
                            </p>
                          )}

                          <div className="mt-1.5 font-bold text-xs text-[#2A1810]">
                            {cafe.currency}{cartItem.itemTotal.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Quantity Modifier & Remove */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <button
                          onClick={() => onRemoveItem(idx)}
                          className="text-[#A89284] hover:text-rose-600 transition-colors p-1 cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <div className="flex items-center border border-[#EFE7DD] rounded-lg p-0.5 bg-[#FAF6F0]">
                          <button
                            onClick={() => onUpdateQuantity(idx, cartItem.quantity - 1)}
                            className="p-1 rounded text-[#553E32] hover:bg-white cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-[#2A1810]">
                            {cartItem.quantity}
                          </span>
                          <button
                            onClick={() => onUpdateQuantity(idx, cartItem.quantity + 1)}
                            className="p-1 rounded text-[#553E32] hover:bg-white cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Loyalty Reward Points Preview */}
                <div className="p-3 rounded-xl bg-[#FAF3EA] border border-[#EFE2D3] flex items-center gap-2.5 text-xs text-[#8C5E3B]">
                  <div className="w-7 h-7 rounded-lg bg-[#C87D32]/20 flex items-center justify-center text-[#9A4B1A] shrink-0">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-[#2A1810] block">
                      +{Math.max(1, Math.floor(grandTotal / 50))} Roastery Bean Stamps
                    </span>
                    <span className="text-[11px] text-[#705648]">
                      Applied to your coffee pass after instant payment.
                    </span>
                  </div>
                </div>

                {/* Promo / Coupon Section */}
                <div className="pt-2 border-t border-[#EFE7DD]">
                  <span className="block text-xs font-bold text-[#4A2E1B] uppercase tracking-wide mb-1.5">
                    Offers &amp; Coupons
                  </span>
                  {!appliedCoupon ? (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="w-3.5 h-3.5 absolute left-3 top-3 text-[#A89284]" />
                        <input
                          type="text"
                          placeholder="Enter Promo Code (e.g. WELCOME20)"
                          value={couponCode}
                          onChange={e => setCouponCode(e.target.value.toUpperCase())}
                          className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-[#EFE7DD] focus:outline-hidden focus:border-[#C87D32] uppercase placeholder:normal-case font-mono bg-white text-[#2A1810]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={validatingCoupon || !couponCode.trim()}
                        className="px-3.5 py-2 rounded-xl bg-[#2D1B14] hover:bg-[#3E271D] text-[#FDFBF7] font-bold text-xs disabled:opacity-50 cursor-pointer transition-colors"
                      >
                        {validatingCoupon ? '...' : 'APPLY'}
                      </button>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-800">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <div>
                          <span className="font-bold font-mono">{appliedCoupon.code}</span>
                          <span className="block text-[11px] text-emerald-700">
                            {appliedCoupon.description}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="text-xs text-rose-600 font-semibold hover:underline cursor-pointer ml-2"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  {couponError && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">{couponError}</p>
                  )}
                </div>

                {/* Customer Details Form */}
                <div className="pt-2 border-t border-[#EFE7DD] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#4A2E1B] uppercase tracking-wide">
                      Patron Details
                    </span>
                    {customer ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ Connected to Account
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#8C7667]">For digital invoice &amp; tracking</span>
                    )}
                  </div>

                  <input
                    type="text"
                    required
                    placeholder="Full Name (e.g. Aditi Verma)"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#EFE7DD] focus:outline-hidden focus:border-[#C87D32] bg-white text-[#2A1810]"
                  />

                  <input
                    type="email"
                    required
                    placeholder="Email Address (for PDF tax invoice)"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#EFE7DD] focus:outline-hidden focus:border-[#C87D32] bg-white text-[#2A1810]"
                  />

                  <input
                    type="tel"
                    placeholder="Phone Number (optional, for SMS tracking)"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#EFE7DD] focus:outline-hidden focus:border-[#C87D32] bg-white text-[#2A1810]"
                  />

                  {/* Table notes */}
                  <input
                    type="text"
                    placeholder="Table instructions (e.g. bring extra glasses or napkins)"
                    value={tableNotes}
                    onChange={e => setTableNotes(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#EFE7DD] focus:outline-hidden focus:border-[#C87D32] bg-white text-[#2A1810]"
                  />

                  {/* Explicit Marketing Consent */}
                  <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={e => setMarketingConsent(e.target.checked)}
                      className="mt-0.5 rounded-sm border-[#D8B48D] text-[#C87D32] focus:ring-[#C87D32] cursor-pointer"
                    />
                    <span className="text-[11px] text-[#705648] leading-snug">
                      I agree to receive seasonal menus, loyalty offers, and visit discounts via email &amp; WhatsApp.
                    </span>
                  </label>
                </div>

                {/* Price Breakdown */}
                <div className="pt-3 border-t border-[#EFE7DD] space-y-1.5 text-xs text-[#705648]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-semibold text-[#2A1810]">{cafe.currency}{subtotal.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Discount ({appliedCoupon?.code})</span>
                      <span>-{cafe.currency}{discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>GST ({cafe.tax_rate}%)</span>
                    <span className="font-semibold text-[#2A1810]">{cafe.currency}{tax.toFixed(2)}</span>
                  </div>
                  {cafe.service_charge_rate > 0 && (
                    <div className="flex justify-between">
                      <span>Service Charge ({cafe.service_charge_rate}%)</span>
                      <span className="font-semibold text-[#2A1810]">{cafe.currency}{serviceCharge.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-[#EFE7DD] flex justify-between text-sm font-extrabold text-[#2A1810]">
                    <span>Grand Total</span>
                    <span className="text-[#C87D32] font-black">{cafe.currency}{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Checkout Footer */}
          {cartItems.length > 0 && (
            <div className="p-4 border-t border-[#EFE7DD] bg-white space-y-2.5">
              {checkoutError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{checkoutError}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[11px] text-[#705648] justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Verified Razorpay 256-Bit Encrypted Dine-in Checkout</span>
              </div>
              {!tableNumber ? (
                <button
                  type="button"
                  onClick={onScanQr}
                  className="w-full py-3.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>SCAN TABLE QR TO UNLOCK ORDERING</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : !customer ? (
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="w-full py-3.5 px-4 bg-[#C87D32] hover:bg-[#B36B28] text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>SIGN IN TO ORDER (TABLE #{tableNumber})</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 bg-[#2D1B14] hover:bg-[#3E271D] text-[#FDFBF7] font-bold text-xs rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-between cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2 mx-auto">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Order &amp; Verifying Items...</span>
                    </div>
                  ) : (
                    <>
                      <span className="tracking-wide">PROCEED TO SECURE PAYMENT</span>
                      <div className="flex items-center gap-1.5 text-[#E6AA68]">
                        <span>{cafe.currency}{grandTotal.toFixed(2)}</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
