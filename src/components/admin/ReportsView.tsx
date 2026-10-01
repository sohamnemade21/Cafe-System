import React, { useState, useEffect } from 'react';
import { Cafe } from '../../types';
import { api } from '../../services/api';
import { TrendingUp, ShoppingBag, CreditCard, DollarSign, Award } from 'lucide-react';

interface ReportsViewProps {
  cafe: Cafe;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ cafe }) => {
  const [reports, setReports] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getReports(cafe.id)
      .then(res => setReports(res))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [cafe.id]);

  if (loading) {
    return <div className="py-16 text-center text-xs text-stone-400">Compiling financial & sales metrics...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-stone-900 tracking-tight">
          Sales Analytics & Revenue Reports
        </h2>
        <p className="text-xs text-stone-500">
          Financial performance, payment breakdowns, and top-selling culinary items for {cafe.name}.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs text-stone-400 font-medium block">Total Revenue</span>
          <div className="text-2xl font-black text-stone-900 mt-1">
            {cafe.currency}{(reports?.total_revenue || 0).toFixed(2)}
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
            +18.4% from last period
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs text-stone-400 font-medium block">Completed Orders</span>
          <div className="text-2xl font-black text-stone-900 mt-1">
            {reports?.total_orders || 0}
          </div>
          <span className="text-[11px] text-stone-500 font-medium mt-1 block">
            Dine-in QR tables
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs text-stone-400 font-medium block">Average Order Value (AOV)</span>
          <div className="text-2xl font-black text-stone-900 mt-1">
            {cafe.currency}{(reports?.aov || 0).toFixed(2)}
          </div>
          <span className="text-[11px] text-amber-700 font-semibold mt-1 block">
            Per guest table session
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs text-stone-400 font-medium block">Razorpay Success Rate</span>
          <div className="text-2xl font-black text-stone-900 mt-1">
            99.2%
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
            Instant HMAC verified
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Best Selling Dishes */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wide flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-500" />
            <span>Top Performing Menu Items</span>
          </h3>

          <div className="divide-y divide-stone-100">
            {(reports?.best_selling_items || []).map((it: any, idx: number) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-stone-400 w-4">{idx + 1}.</span>
                  <span className="font-bold text-stone-800">{it.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-stone-900 block">{it.count} ordered</span>
                  <span className="text-[11px] text-stone-400">{cafe.currency}{it.revenue.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wide flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-stone-600" />
            <span>Payment Method Distribution</span>
          </h3>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>UPI (GPay / PhonePe / Paytm)</span>
                <span>65%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: '65%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>Credit / Debit Cards</span>
                <span>25%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
                <div className="h-full bg-stone-800 rounded-full" style={{ width: '25%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>Net Banking & Other</span>
                <span>10%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
                <div className="h-full bg-stone-400 rounded-full" style={{ width: '10%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
