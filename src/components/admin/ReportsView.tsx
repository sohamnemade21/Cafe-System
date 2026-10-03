import React, { useState, useEffect } from 'react';
import { Cafe } from '../../types';
import { api } from '../../services/api';
import { TrendingUp, ShoppingBag, CreditCard, DollarSign, Award, Users, QrCode, RefreshCw } from 'lucide-react';

interface ReportsViewProps {
  cafe: Cafe;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ cafe }) => {
  const [reports, setReports] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    api.getReports(cafe.id)
      .then(res => setReports(res))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [cafe.id]);

  if (loading) {
    return (
      <div className="py-16 text-center text-xs text-stone-400 flex flex-col items-center justify-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-stone-500" />
        <span>Compiling financial &amp; sales metrics from database...</span>
      </div>
    );
  }

  const totalPaid = reports?.payment_breakdown?.total_paid || 0;
  const upiCount = reports?.payment_breakdown?.UPI || 0;
  const cardCount = reports?.payment_breakdown?.Cards || 0;
  const cashCount = reports?.payment_breakdown?.Cash || 0;
  const otherCount = reports?.payment_breakdown?.Other || 0;

  const upiPct = totalPaid > 0 ? Math.round((upiCount / totalPaid) * 100) : 0;
  const cardPct = totalPaid > 0 ? Math.round((cardCount / totalPaid) * 100) : 0;
  const cashPct = totalPaid > 0 ? Math.round((cashCount / totalPaid) * 100) : 0;
  const otherPct = totalPaid > 0 ? Math.round((otherCount / totalPaid) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">
            Sales Analytics &amp; Revenue Reports
          </h2>
          <p className="text-xs text-stone-500">
            Authoritative financial performance, table billing inspection, and live business data for {cafe.name}.
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-3 py-1.5 text-xs font-bold bg-white border border-stone-200 rounded-xl hover:bg-stone-50 flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-stone-600" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Revenue & Total Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs text-stone-400 font-medium block">Today&apos;s Sales</span>
          <div className="text-2xl font-black text-stone-900 mt-1">
            {cafe.currency}{(reports?.today_revenue || 0).toFixed(2)}
          </div>
          <span className="text-[11px] text-stone-500 font-medium mt-1 block">
            Lifetime Sales: {cafe.currency}{(reports?.total_revenue || 0).toFixed(2)}
          </span>
        </div>

        {/* Card 2: Today's & Active Orders */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs text-stone-400 font-medium block">Today&apos;s Orders</span>
          <div className="text-2xl font-black text-stone-900 mt-1">
            {reports?.today_orders || 0}
          </div>
          <span className="text-[11px] text-amber-700 font-medium mt-1 block">
            {reports?.active_orders || 0} active · {reports?.completed_orders || 0} completed
          </span>
        </div>

        {/* Card 3: Active Table Totals & AOV */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs text-stone-400 font-medium block">Active Table Bills</span>
          <div className="text-2xl font-black text-[#C87D32] mt-1">
            {cafe.currency}{(reports?.active_table_totals || 0).toFixed(2)}
          </div>
          <span className="text-[11px] text-stone-500 font-medium mt-1 block">
            Average Order Value: {cafe.currency}{(reports?.aov || 0).toFixed(2)}
          </span>
        </div>

        {/* Card 4: Tables & Patron Count */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs text-stone-400 font-medium block">Table Capacity</span>
          <div className="text-2xl font-black text-stone-900 mt-1">
            {reports?.occupied_tables || 0} / {reports?.total_tables || 0}
          </div>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 block">
            {reports?.customer_count || 0} total registered patrons
          </span>
        </div>
      </div>

      {/* OWNER TABLE BILL VIEW (Requirement 3) */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wide flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-amber-600" />
              <span>Live Table Bills &amp; Active Session Inspection</span>
            </h3>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Authoritative bill calculated strictly from active session orders.
            </p>
          </div>
          <span className="text-xs font-extrabold text-stone-800 bg-stone-100 px-3 py-1 rounded-xl">
            Active Total: {cafe.currency}{(reports?.active_table_totals || 0).toFixed(2)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(reports?.table_bills || []).map((tb: any) => (
            <div
              key={tb.table_id}
              className={`p-4 rounded-2xl border transition-all ${
                tb.status === 'OCCUPIED' || tb.status === 'BILL_REQUESTED' || tb.current_bill > 0
                  ? 'bg-amber-50/40 border-amber-200'
                  : 'bg-stone-50 border-stone-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-stone-900">
                  Table {tb.table_number}
                </span>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                    tb.status === 'OCCUPIED' || tb.status === 'BILL_REQUESTED'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {tb.status}
                </span>
              </div>

              <p className="text-[11px] text-stone-500 mt-1">{tb.table_name}</p>

              <div className="mt-3 pt-2.5 border-t border-stone-200/60 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-stone-400 block uppercase font-semibold">Active Orders</span>
                  <span className="font-bold text-stone-800">{tb.order_count} {tb.order_count === 1 ? 'order' : 'orders'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-stone-400 block uppercase font-semibold">Current Bill</span>
                  <span className="font-black text-sm text-stone-900">
                    {cafe.currency}{tb.current_bill.toFixed(2)}
                  </span>
                </div>
              </div>

              {tb.total_paid > 0 && (
                <div className="mt-1.5 flex justify-between text-[11px] text-emerald-700 font-medium">
                  <span>Paid so far:</span>
                  <span>{cafe.currency}{tb.total_paid.toFixed(2)}</span>
                </div>
              )}
            </div>
          ))}
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
            {(!reports?.best_selling_items || reports.best_selling_items.length === 0) ? (
              <div className="py-8 text-center text-xs text-stone-400">No sales data available yet</div>
            ) : (
              reports.best_selling_items.map((it: any, idx: number) => (
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
              ))
            )}
          </div>
        </div>

        {/* Payment Methods Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wide flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-stone-600" />
            <span>Payment Method Distribution</span>
          </h3>

          {totalPaid === 0 ? (
            <div className="py-8 text-center text-xs text-stone-400">No payment data recorded yet</div>
          ) : (
            <div className="space-y-3 pt-2">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>UPI (GPay / PhonePe / QR) ({upiCount} orders)</span>
                  <span>{upiPct}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${upiPct}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Credit / Debit Cards ({cardCount} orders)</span>
                  <span>{cardPct}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
                  <div className="h-full bg-stone-800 rounded-full" style={{ width: `${cardPct}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Cash / Front Desk ({cashCount} orders)</span>
                  <span>{cashPct}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
                  <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${cashPct}%` }} />
                </div>
              </div>

              {otherCount > 0 && (
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Other ({otherCount} orders)</span>
                    <span>{otherPct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
                    <div className="h-full bg-stone-400 rounded-full" style={{ width: `${otherPct}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
