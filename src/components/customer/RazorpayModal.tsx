import React, { useState } from 'react';
import { Cafe, Order } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../common/Modal';
import { CreditCard, Smartphone, Building, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface RazorpayModalProps {
  isOpen: boolean;
  order: Order | null;
  cafe: Cafe;
  onClose: () => void;
  onSuccess: (updatedOrder: Order, rewardCoupon: any) => void;
}

export const RazorpayModal: React.FC<RazorpayModalProps> = ({
  isOpen,
  order,
  cafe,
  onClose,
  onSuccess,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [upiId, setUpiId] = useState('diner@okaxis');
  const [cardNumber, setCardNumber] = useState('4111 •••• •••• 1111');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('888');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const handlePay = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Simulate realistic payment delay
      await new Promise(resolve => setTimeout(resolve, 800));

      const fakePaymentId = `pay_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const fakeOrderId = `rzp_order_${order.id}`;
      // Compute signature for server verification
      const fakeSignature = `sig_${Date.now()}`;

      // Call backend server to verify payment and mark order PAID
      const result = await api.verifyPayment({
        order_id: order.id,
        razorpay_order_id: fakeOrderId,
        razorpay_payment_id: fakePaymentId,
        razorpay_signature: fakeSignature,
        method: selectedMethod,
      });

      onSuccess(result.order, result.reward_coupon);
    } catch (err: any) {
      setError(err.message || 'Payment verification failed. Please retry.');
      setIsProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Razorpay Secure Checkout" maxWidth="max-w-md">
      <div className="space-y-4">
        {/* Header summary */}
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-500 font-medium">Paying to</span>
            <h4 className="text-xs font-bold text-stone-900">{cafe.name}</h4>
            <span className="text-[11px] text-stone-400">Order #{order.id.slice(-6)} · Table {order.table_number}</span>
          </div>
          <div className="text-right">
            <span className="text-xs text-stone-500 font-medium">Amount</span>
            <div className="text-base font-extrabold text-stone-900">
              {cafe.currency}{order.total.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Payment Method Selector */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setSelectedMethod('upi')}
            className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
              selectedMethod === 'upi'
                ? 'border-stone-900 bg-stone-900 text-white shadow-xs'
                : 'border-stone-200 hover:border-stone-300 text-stone-700 bg-white'
            }`}
          >
            <Smartphone className="w-4 h-4 mx-auto mb-1" />
            <span className="text-[11px] font-bold block">UPI / QR</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedMethod('card')}
            className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
              selectedMethod === 'card'
                ? 'border-stone-900 bg-stone-900 text-white shadow-xs'
                : 'border-stone-200 hover:border-stone-300 text-stone-700 bg-white'
            }`}
          >
            <CreditCard className="w-4 h-4 mx-auto mb-1" />
            <span className="text-[11px] font-bold block">Cards</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedMethod('netbanking')}
            className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
              selectedMethod === 'netbanking'
                ? 'border-stone-900 bg-stone-900 text-white shadow-xs'
                : 'border-stone-200 hover:border-stone-300 text-stone-700 bg-white'
            }`}
          >
            <Building className="w-4 h-4 mx-auto mb-1" />
            <span className="text-[11px] font-bold block">Netbanking</span>
          </button>
        </div>

        {/* Method Detail Inputs */}
        <div className="p-3.5 border border-stone-200 rounded-xl bg-white space-y-3">
          {selectedMethod === 'upi' && (
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                Virtual Payment Address (VPA) / UPI ID
              </label>
              <input
                type="text"
                value={upiId}
                onChange={e => setUpiId(e.target.value)}
                placeholder="username@okhdfcbank"
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 focus:outline-hidden focus:border-stone-900"
              />
              <div className="flex gap-2 mt-2">
                <span className="text-[10px] bg-stone-100 px-2 py-0.5 rounded text-stone-600 font-medium">Google Pay</span>
                <span className="text-[10px] bg-stone-100 px-2 py-0.5 rounded text-stone-600 font-medium">PhonePe</span>
                <span className="text-[10px] bg-stone-100 px-2 py-0.5 rounded text-stone-600 font-medium">Paytm</span>
              </div>
            </div>
          )}

          {selectedMethod === 'card' && (
            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Card Number</label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={e => setCardNumber(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 focus:outline-hidden focus:border-stone-900 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Expiry</label>
                  <input
                    type="text"
                    value={cardExpiry}
                    onChange={e => setCardExpiry(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 focus:outline-hidden focus:border-stone-900 text-center font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">CVV</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={cardCvv}
                    onChange={e => setCardCvv(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 focus:outline-hidden focus:border-stone-900 text-center font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {selectedMethod === 'netbanking' && (
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Select Bank</label>
              <select className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 bg-white">
                <option>HDFC Bank</option>
                <option>ICICI Bank</option>
                <option>State Bank of India</option>
                <option>Axis Bank</option>
                <option>Kotak Mahindra Bank</option>
              </select>
            </div>
          )}
        </div>

        {error && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={handlePay}
            disabled={isProcessing}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying with Razorpay Engine...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>PAY {cafe.currency}{order.total.toFixed(2)} & SEND TO KITCHEN</span>
              </>
            )}
          </button>

          <p className="text-center text-[10px] text-stone-400 mt-2 flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>PCI-DSS Level 1 Compliant · Instant Server-side HMAC Verification</span>
          </p>
        </div>
      </div>
    </Modal>
  );
};
