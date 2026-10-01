import React, { useState, useEffect } from 'react';
import { Cafe } from '../../types';
import { ShieldCheck, Mail, CreditCard, Store, CheckCircle, Clock } from 'lucide-react';

interface SettingsViewProps {
  cafe: Cafe;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ cafe }) => {
  const [emailLogs, setEmailLogs] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/admin/emails')
      .then(res => res.json())
      .then(json => {
        if (json.data) setEmailLogs(json.data);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-lg font-bold text-stone-900 tracking-tight">
          Café Settings & Production Integrations
        </h2>
        <p className="text-xs text-stone-500">
          Tenant identity, tax invoicing configuration, Razorpay payments, and Resend transactional email outbox.
        </p>
      </div>

      {/* Tenant Profile */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wide flex items-center gap-2">
          <Store className="w-4 h-4 text-amber-600" />
          <span>Tenant Organization Details</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-stone-400 font-medium mb-1">Café Name</label>
            <input
              type="text"
              readOnly
              value={cafe.name}
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 font-semibold"
            />
          </div>

          <div>
            <label className="block text-stone-400 font-medium mb-1">Tenant Slug</label>
            <input
              type="text"
              readOnly
              value={cafe.slug}
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono text-stone-800"
            />
          </div>

          <div>
            <label className="block text-stone-400 font-medium mb-1">GSTIN Number</label>
            <input
              type="text"
              readOnly
              value={cafe.gst_number || '29AAAAA0000A1Z5'}
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono text-stone-800"
            />
          </div>

          <div>
            <label className="block text-stone-400 font-medium mb-1">Tax & Service Rates</label>
            <div className="flex gap-2">
              <span className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 font-medium">
                GST: {cafe.tax_rate}%
              </span>
              <span className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 font-medium">
                Service: {cafe.service_charge_rate}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Razorpay & Resend Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Razorpay Card */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <h4 className="text-xs font-bold text-stone-900">Razorpay Integration</h4>
            </div>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Active
            </span>
          </div>
          <p className="text-xs text-stone-500 leading-relaxed">
            Direct UPI (GPay, PhonePe, Paytm), Credit Cards, Netbanking with server-side HMAC-SHA256 signature verification.
          </p>
          <div className="text-[11px] font-mono text-stone-400 bg-stone-50 p-2 rounded-lg border border-stone-100">
            Webhook: /api/payments/webhook
          </div>
        </div>

        {/* Resend Card */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold text-stone-900">Resend Transactional Email</h4>
            </div>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Ready
            </span>
          </div>
          <p className="text-xs text-stone-500 leading-relaxed">
            Automated tax invoice PDFs, order receipts, and post-dine-in loyalty coupons dispatched after payment.
          </p>
          <div className="text-[11px] font-mono text-stone-400 bg-stone-50 p-2 rounded-lg border border-stone-100">
            Outbox Count: {emailLogs.length} dispatched
          </div>
        </div>
      </div>

      {/* Email Outbox Log */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wide flex items-center gap-2">
          <Mail className="w-4 h-4 text-stone-600" />
          <span>Transactional Emails Outbox Log</span>
        </h3>

        {emailLogs.length === 0 ? (
          <div className="py-8 text-center text-xs text-stone-400 border border-dashed border-stone-200 rounded-xl">
            No transactional emails dispatched yet in this session.
          </div>
        ) : (
          <div className="divide-y divide-stone-100 max-h-60 overflow-y-auto">
            {emailLogs.map((em, i) => (
              <div key={i} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-stone-900">{em.to}</span>
                  <p className="text-[11px] text-stone-500">{em.subject}</p>
                </div>
                <div className="text-right text-[11px] text-stone-400 flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(em.sent_at).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
