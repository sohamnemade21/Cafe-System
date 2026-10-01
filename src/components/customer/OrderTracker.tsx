import React, { useState } from 'react';
import { Cafe, Order, Coupon } from '../../types';
import { api } from '../../services/api';
import { generateInvoicePDF } from '../../utils/pdfGenerator';
import {
  CheckCircle2,
  Clock,
  ChefHat,
  Utensils,
  Download,
  Mail,
  Sparkles,
  ArrowLeft,
  RefreshCw,
  CreditCard,
  Building2,
  Banknote,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { CoffeeSteam } from '../common/CoffeeSteam';
import { CoffeeBeanIcon } from '../common/CoffeeBeanIcon';

interface OrderTrackerProps {
  order: Order;
  cafe: Cafe;
  rewardCoupon?: Coupon | null;
  onBackToMenu: () => void;
  onCallWaiter: () => void;
  onRequestBill: () => void;
  onPayOnline?: () => void;
  onReorder?: () => void;
}

export const OrderTracker: React.FC<OrderTrackerProps> = ({
  order,
  cafe,
  rewardCoupon,
  onBackToMenu,
  onCallWaiter,
  onRequestBill,
  onPayOnline,
  onReorder,
}) => {
  const [emailing, setEmailing] = useState(false);
  const [emailSentMessage, setEmailSentMessage] = useState<string | null>(null);
  const [cashRequested, setCashRequested] = useState(false);
  const [receptionRequested, setReceptionRequested] = useState(false);

  // Status mapping
  const steps = [
    { key: 'PENDING', label: 'Order Sent', icon: Clock },
    { key: 'ACCEPTED', label: 'Kitchen Accepted', icon: ChefHat },
    { key: 'PREPARING', label: 'Fresh Brewing', icon: Clock },
    { key: 'READY', label: 'Ready to Serve', icon: Sparkles },
    { key: 'SERVED', label: 'Delivered to Table', icon: Utensils },
  ];

  const currentStatusIndex = steps.findIndex(s => s.key === order.order_status);
  const activeStep = currentStatusIndex !== -1 ? currentStatusIndex : 0;
  const isPaid = order.payment_status === 'PAID';

  const handleDownloadInvoice = () => {
    const doc = generateInvoicePDF(order, cafe);
    doc.save(`Invoice_${cafe.slug}_Order_${order.id.slice(-6)}.pdf`);
  };

  const handleEmailInvoice = async () => {
    if (!order.customer_email) return;
    setEmailing(true);
    setEmailSentMessage(null);
    try {
      const res = await api.sendInvoiceEmail(order.id, order.customer_email);
      setEmailSentMessage(res.message || 'Invoice sent to your email.');
    } catch {
      setEmailSentMessage('Failed to email invoice. Please download PDF instead.');
    } finally {
      setEmailing(false);
    }
  };

  const handlePayAtReception = async () => {
    try {
      await api.requestBill(String(order.table_number));
      setReceptionRequested(true);
      onRequestBill();
    } catch {
      setReceptionRequested(true);
    }
  };

  const handlePayCash = async () => {
    try {
      await api.callWaiter(String(order.table_number), `Cash payment requested for Table #${order.table_number}`);
      setCashRequested(true);
    } catch {
      setCashRequested(true);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Top navigation bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToMenu}
          className="flex items-center gap-1.5 text-xs font-bold text-[#553E32] hover:text-[#2A1810] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Café Menu</span>
        </button>

        <div className="flex gap-2">
          <button
            onClick={onCallWaiter}
            className="px-3 py-1.5 text-xs font-semibold text-[#553E32] bg-[#FAF6F0] hover:bg-[#EFE5D8] border border-[#EFE7DD] rounded-xl cursor-pointer transition-colors"
          >
            Call Waiter
          </button>
          <button
            onClick={onRequestBill}
            className="px-3 py-1.5 text-xs font-semibold text-[#553E32] bg-[#FAF6F0] hover:bg-[#EFE5D8] border border-[#EFE7DD] rounded-xl cursor-pointer transition-colors"
          >
            Request Bill
          </button>
        </div>
      </div>

      {/* Main Status Header Card */}
      <div className="bg-[#FFFFFF] rounded-3xl border border-[#EFE7DD] p-6 shadow-xs text-center space-y-3 relative overflow-hidden">
        {(order.order_status === 'PREPARING' || order.order_status === 'READY') && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none">
            <CoffeeSteam size="md" />
          </div>
        )}

        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FAF6F0] text-[#C87D32] border border-[#EFE5D8] mx-auto mt-2">
          {order.order_status === 'SERVED' || order.order_status === 'COMPLETED' ? (
            <Utensils className="w-6 h-6 text-emerald-700" />
          ) : order.order_status === 'READY' ? (
            <Sparkles className="w-6 h-6 text-[#C87D32] animate-bounce" />
          ) : order.order_status === 'PREPARING' ? (
            <Clock className="w-6 h-6 text-[#B45309] animate-spin" />
          ) : (
            <ChefHat className="w-6 h-6 text-[#4A2E1B]" />
          )}
        </div>

        <div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-[11px] font-bold tracking-wider text-[#C87D32] uppercase bg-[#FAF3EA] px-3 py-1 rounded-full border border-[#EFE2D3]">
              Order #{order.id.slice(-6)} · Table {order.table_number}
            </span>
            <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
              isPaid
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              {isPaid ? '● PAID' : '○ BILL UNPAID'}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-serif-cafe font-bold text-[#2A1810] mt-2.5">
            {order.order_status === 'SERVED'
              ? 'Delivered to Your Table · Enjoy Your Meal!'
              : order.order_status === 'READY'
              ? 'Fresh Brew Ready to Serve'
              : order.order_status === 'PREPARING'
              ? 'Kitchen Freshly Preparing Your Order'
              : order.order_status === 'ACCEPTED'
              ? 'Order Accepted by Kitchen'
              : 'Order Placed & Sent to Kitchen'}
          </h2>
          <p className="text-xs text-[#705648] mt-1 max-w-sm mx-auto">
            {order.order_status === 'SERVED'
              ? 'Your handcrafted items have been served. Savor your meal and pay when ready!'
              : 'Kitchen is preparing your items with fresh ingredients.'}
          </p>
        </div>

        {/* Status Stepper */}
        <div className="pt-4 border-t border-[#EFE7DD]">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-[#EFE7DD] z-0" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-[#C87D32] transition-all duration-500 z-0"
              style={{ width: `${(activeStep / (steps.length - 1)) * 100}%` }}
            />

            {steps.map((step, idx) => {
              const isPast = idx < activeStep;
              const isCurrent = idx === activeStep;
              const IconComponent = step.icon;

              return (
                <div key={step.key} className="relative z-10 flex flex-col items-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                      isCurrent
                        ? 'bg-[#C87D32] border-[#C87D32] text-white shadow-xs scale-110'
                        : isPast
                        ? 'bg-emerald-700 border-emerald-700 text-white'
                        : 'bg-white border-[#D8B48D] text-[#8C7667]'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                  </div>
                  <span
                    className={`text-[10px] mt-1.5 font-medium whitespace-nowrap hidden sm:block ${
                      isCurrent
                        ? 'text-[#2A1810] font-bold'
                        : isPast
                        ? 'text-[#553E32]'
                        : 'text-[#A89284]'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bill & Payment Choice Section */}
      <div className="bg-[#FFFFFF] rounded-3xl border border-[#EFE7DD] p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#EFE7DD] pb-3">
          <h3 className="text-xs font-bold text-[#4A2E1B] uppercase tracking-wide">
            Table Bill Summary
          </h3>
          {onReorder && (
            <button
              onClick={onReorder}
              className="text-xs font-bold text-[#C87D32] hover:text-[#9A4B1A] flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Order More Items</span>
            </button>
          )}
        </div>

        {/* Itemized List */}
        <div className="divide-y divide-[#FAF6F0]">
          {order.items.map((item, i) => (
            <div key={i} className="py-2.5 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-[#2A1810]">{item.quantity}×</span>{' '}
                <span className="font-semibold text-[#4A2E1B]">{item.item_name}</span>
                {item.selected_variants_json && item.selected_variants_json.length > 0 && (
                  <p className="text-[11px] text-[#8C7667] ml-4">
                    {item.selected_variants_json.map((v: any) => v.name).join(', ')}
                  </p>
                )}
              </div>
              <span className="font-bold text-[#2A1810]">
                {cafe.currency}{item.subtotal.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Pricing Totals */}
        <div className="pt-3 border-t border-[#EFE7DD] space-y-1 text-xs text-[#705648]">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-medium text-[#2A1810]">{cafe.currency}{order.subtotal.toFixed(2)}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>Coupon Discount ({order.coupon_code})</span>
              <span>-{cafe.currency}{order.discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>GST ({cafe.tax_rate}%)</span>
            <span className="font-medium text-[#2A1810]">{cafe.currency}{order.tax.toFixed(2)}</span>
          </div>
          {order.service_charge > 0 && (
            <div className="flex justify-between">
              <span>Service Charge ({cafe.service_charge_rate}%)</span>
              <span className="font-medium text-[#2A1810]">{cafe.currency}{order.service_charge.toFixed(2)}</span>
            </div>
          )}
          <div className="pt-2 border-t border-[#EFE7DD] flex justify-between text-base font-extrabold text-[#2A1810]">
            <span>Final Bill Amount:</span>
            <span className="text-[#C87D32] font-black">{cafe.currency}{order.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Actions / Options */}
        {!isPaid ? (
          <div className="pt-4 border-t border-[#EFE7DD] space-y-3">
            <h4 className="text-xs font-extrabold text-stone-900 flex items-center gap-1.5 uppercase tracking-wide">
              <CreditCard className="w-4 h-4 text-[#C87D32]" />
              <span>Choose Payment Method</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Option 1: Razorpay Online */}
              <button
                type="button"
                onClick={onPayOnline}
                className="p-3.5 bg-[#2D1B14] hover:bg-[#3E271D] text-white rounded-2xl text-left transition-all shadow-xs cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <CreditCard className="w-4 h-4 text-[#E6AA68] mb-1.5" />
                  <span className="text-xs font-bold block">Pay Online</span>
                  <span className="text-[10px] text-stone-300">UPI, Cards, GPay</span>
                </div>
                <span className="text-[11px] font-extrabold text-[#E6AA68] mt-2 block">
                  {cafe.currency}{order.total.toFixed(2)} →
                </span>
              </button>

              {/* Option 2: Pay at Reception */}
              <button
                type="button"
                onClick={handlePayAtReception}
                className="p-3.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-900 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <Building2 className="w-4 h-4 text-stone-700 mb-1.5" />
                  <span className="text-xs font-bold block">Pay at Front Desk</span>
                  <span className="text-[10px] text-stone-500">Reception POS</span>
                </div>
                <span className="text-[10px] font-bold text-stone-700 mt-2 block">
                  {receptionRequested ? 'Desk Alerted ✓' : 'Alert Cashier →'}
                </span>
              </button>

              {/* Option 3: Pay with Cash */}
              <button
                type="button"
                onClick={handlePayCash}
                className="p-3.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-900 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <Banknote className="w-4 h-4 text-stone-700 mb-1.5" />
                  <span className="text-xs font-bold block">Pay Cash</span>
                  <span className="text-[10px] text-stone-500">Hand to server</span>
                </div>
                <span className="text-[10px] font-bold text-stone-700 mt-2 block">
                  {cashRequested ? 'Waiter Alerted ✓' : 'Call Server →'}
                </span>
              </button>
            </div>

            {receptionRequested && (
              <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-center font-medium">
                Reception cashier desk has been alerted for Table #{order.table_number}. You may pay when leaving!
              </p>
            )}
          </div>
        ) : (
          /* When Paid -> Tax Invoice & PDF Actions */
          <div className="pt-3 border-t border-[#EFE7DD] space-y-3">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <div>
                <strong>Payment Verified ({order.payment_id || 'Settled'})</strong>
                <p className="text-[11px] text-emerald-700">Your digital tax invoice is ready for download.</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleDownloadInvoice}
                className="flex-1 py-2.5 px-3 bg-[#2D1B14] hover:bg-[#3E271D] text-[#FDFBF7] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Tax Invoice (PDF)</span>
              </button>

              {order.customer_email && (
                <button
                  onClick={handleEmailInvoice}
                  disabled={emailing}
                  className="flex-1 py-2.5 px-3 bg-[#FAF6F0] hover:bg-[#EFE5D8] text-[#4A2E1B] border border-[#EFE7DD] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>{emailing ? 'Dispatching...' : 'Email Invoice'}</span>
                </button>
              )}
            </div>

            {emailSentMessage && (
              <p className="text-[11px] text-emerald-800 font-medium text-center bg-emerald-50 py-1.5 rounded-lg border border-emerald-200">
                {emailSentMessage}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Next-Visit Loyalty Coupon Banner */}
      {rewardCoupon && isPaid && (
        <div className="bg-gradient-to-r from-[#2D1B14] to-[#43281C] text-[#FDFBF7] rounded-3xl p-5 shadow-xs relative overflow-hidden border border-[#523528]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#E6AA68]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Next-Visit Loyalty Reward</span>
              </div>
              <h3 className="text-lg font-serif-cafe font-bold text-[#FDFBF7] mt-1">
                {rewardCoupon.discount_value}% OFF on your next visit
              </h3>
              <p className="text-xs text-[#D5C2B5] mt-0.5">
                Use code <span className="font-mono font-bold bg-[#FAF6F0] px-2 py-0.5 rounded-md text-[#2A1810]">{rewardCoupon.code}</span>
              </p>
            </div>
            <div className="p-2.5 bg-[#523528] rounded-2xl text-[#E6AA68]">
              <CoffeeBeanIcon size={24} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
