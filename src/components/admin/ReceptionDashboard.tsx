import React, { useState, useEffect } from 'react';
import { Cafe, TableSessionSummary, StaffNotification, StaffUser, Order } from '../../types';
import { api } from '../../services/api';
import { buildRealtimeStreamUrl } from '../../utils/url';
import { generateInvoicePDF } from '../../utils/pdfGenerator';
import { playOrderChime } from '../../utils/audio';
import {
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle2,
  Clock,
  Printer,
  Users,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Receipt,
  LogOut,
  Coffee,
  Check,
  X,
  Volume2,
  VolumeX,
  ChevronRight,
  ShieldCheck,
  DollarSign
} from 'lucide-react';
import { CoffeeBeanIcon } from '../common/CoffeeBeanIcon';

interface ReceptionDashboardProps {
  cafe: Cafe;
  currentStaff: StaffUser;
  onLogout: () => void;
  onOpenCustomerView?: (tableNumber?: number) => void;
  onOpenKDS?: () => void;
  onOpenAdmin?: () => void;
}

export const ReceptionDashboard: React.FC<ReceptionDashboardProps> = ({
  cafe,
  currentStaff,
  onLogout,
  onOpenCustomerView,
  onOpenKDS,
  onOpenAdmin,
}) => {
  const [loading, setLoading] = useState(true);
  const [tableSummaries, setTableSummaries] = useState<TableSessionSummary[]>([]);
  const [stats, setStats] = useState({
    total_tables: 0,
    occupied_tables: 0,
    bill_requested_tables: 0,
    total_outstanding: 0,
    total_paid_today: 0,
  });
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Settlement Modal state
  const [settlingTable, setSettlingTable] = useState<TableSessionSummary | null>(null);
  const [settlingMethod, setSettlingMethod] = useState<'CASH' | 'CARD' | 'UPI_POS'>('CASH');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [releaseAfterPayment, setReleaseAfterPayment] = useState(true);
  const [isSettling, setIsSettling] = useState(false);
  const [settleSuccessMsg, setSettleSuccessMsg] = useState<string | null>(null);

  const loadReceptionData = async () => {
    try {
      setLoading(true);
      const data = await api.getReceptionOverview(cafe.id);
      setTableSummaries(data.tables || []);
      setStats(data.stats);
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error('Failed to load reception overview', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceptionData();

    // Listen to real-time events via SSE
    const eventSource = new EventSource(buildRealtimeStreamUrl());

    const handleNewOrder = () => {
      loadReceptionData();
      if (soundEnabled) playOrderChime();
    };

    eventSource.addEventListener('new_order', handleNewOrder);
    eventSource.addEventListener('order_created', handleNewOrder);
    eventSource.addEventListener('order_status_updated', () => loadReceptionData());

    eventSource.addEventListener('payment_confirmed', () => loadReceptionData());
    eventSource.addEventListener('payment_success', () => loadReceptionData());
    eventSource.addEventListener('reception_payment_settled', () => loadReceptionData());

    eventSource.addEventListener('table_status_changed', () => loadReceptionData());
    eventSource.addEventListener('table_created', () => loadReceptionData());
    eventSource.addEventListener('table_released', () => loadReceptionData());

    eventSource.addEventListener('bill_requested', () => {
      loadReceptionData();
      if (soundEnabled) playOrderChime();
    });

    eventSource.addEventListener('waiter_called', () => {
      loadReceptionData();
      if (soundEnabled) playOrderChime();
    });

    return () => eventSource.close();
  }, [cafe.id, soundEnabled]);

  const handleSettlePayment = async () => {
    if (!settlingTable) return;
    setIsSettling(true);
    setSettleSuccessMsg(null);

    try {
      const res = await api.settleReceptionPayment({
        cafe_id: cafe.id,
        table_id: settlingTable.table.id,
        method: settlingMethod,
        notes: settlementNotes,
        release_table: releaseAfterPayment,
      });

      setSettleSuccessMsg(`Settled ${cafe.currency}${res.total_settled.toFixed(2)} via ${settlingMethod}!`);
      setTimeout(() => {
        setSettlingTable(null);
        setSettleSuccessMsg(null);
        setSettlementNotes('');
        loadReceptionData();
      }, 1200);
    } catch (err: any) {
      alert(err.message || 'Failed to settle bill');
    } finally {
      setIsSettling(false);
    }
  };

  const handleReleaseTable = async (tableId: string) => {
    if (!confirm('Are you sure you want to release this table and close the active session?')) return;
    try {
      await api.releaseTable(tableId);
      loadReceptionData();
    } catch (err: any) {
      alert(err.message || 'Failed to release table');
    }
  };

  const handleResolveAlert = async (notifId: string) => {
    try {
      await api.resolveNotification(notifId);
      setNotifications(prev => prev.filter(n => n.id !== notifId));
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrintBill = async (summary: TableSessionSummary) => {
    if (summary.orders.length === 0) {
      alert('No orders found to generate invoice for this table');
      return;
    }
    // Print invoice of the most recent or primary order of this session
    const primaryOrder = summary.orders[0];
    const doc = await generateInvoicePDF(primaryOrder, cafe);
    doc.save(`Bill_Table_${summary.table.table_number}_Order_${primaryOrder.id.slice(-6)}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2D1B14] flex flex-col font-sans">
      {/* Top Reception Header */}
      <header className="bg-[#2D1B14] text-[#FAF8F5] border-b border-[#3D251B] sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Left: Branding & Staff Badge */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#C87D32] flex items-center justify-center text-white shadow-xs">
              <CoffeeBeanIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-extrabold tracking-tight text-white font-serif">
                  {cafe.name} • Front Desk Reception
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#C87D32]/30 text-[#E0A868] border border-[#C87D32]/50 flex items-center gap-1">
                  <ShieldCheck size={11} />
                  <span>RECEPTION DESK</span>
                </span>
              </div>
              <p className="text-[11px] text-[#C4B2A7]">
                Logged in as <strong className="text-white">{currentStaff.full_name}</strong> ({currentStaff.email})
              </p>
            </div>
          </div>

          {/* Right: Controls & Logout */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Mute alert sounds' : 'Enable alert sounds'}
              className="p-2 rounded-xl bg-[#3D251B] hover:bg-[#4D3023] text-[#D5C2B5] transition-colors cursor-pointer text-xs flex items-center gap-1.5"
            >
              {soundEnabled ? <Volume2 size={15} className="text-[#C87D32]" /> : <VolumeX size={15} />}
              <span className="hidden sm:inline text-[11px]">{soundEnabled ? 'Sound On' : 'Muted'}</span>
            </button>

            <button
              onClick={loadReceptionData}
              title="Refresh live tables"
              className="p-2 rounded-xl bg-[#3D251B] hover:bg-[#4D3023] text-[#D5C2B5] transition-colors cursor-pointer text-xs flex items-center gap-1"
            >
              <RotateCcw size={15} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline text-[11px]">Sync</span>
            </button>

            {/* Role-based navigation buttons if Owner/Manager */}
            {(currentStaff.role === 'CAFE_OWNER' || currentStaff.role === 'SUPER_ADMIN' || currentStaff.role === 'MANAGER') && (
              <>
                {onOpenAdmin && (
                  <button
                    onClick={onOpenAdmin}
                    className="px-3 py-1.5 rounded-xl bg-[#3D251B] hover:bg-[#4D3023] text-[#E0A868] text-xs font-bold transition-colors cursor-pointer hidden md:flex items-center gap-1.5"
                  >
                    <span>Owner Portal</span>
                  </button>
                )}
                {onOpenKDS && (
                  <button
                    onClick={onOpenKDS}
                    className="px-3 py-1.5 rounded-xl bg-[#3D251B] hover:bg-[#4D3023] text-[#D5C2B5] text-xs font-bold transition-colors cursor-pointer hidden md:flex items-center gap-1.5"
                  >
                    <span>Kitchen KDS</span>
                  </button>
                )}
              </>
            )}

            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-200 border border-red-800/40 text-xs font-bold transition-colors cursor-pointer ml-1"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-6 w-full space-y-6 flex-1">
        {/* KPI Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-[#EFE2D3] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-[#8A7365] uppercase tracking-wider">Occupancy</p>
              <h3 className="text-xl font-extrabold text-[#2D1B14] mt-0.5 font-serif">
                {stats.occupied_tables} <span className="text-xs font-medium text-[#8A7365]">/ {stats.total_tables} Tables</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#FAF3EA] border border-[#EFE2D3] flex items-center justify-center text-[#C87D32]">
              <Users size={18} />
            </div>
          </div>

          <div className={`rounded-2xl p-4 border shadow-xs flex items-center justify-between transition-all ${
            stats.bill_requested_tables > 0
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/20'
              : 'bg-white border-[#EFE2D3]'
          }`}>
            <div>
              <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Bill Requests</p>
              <h3 className="text-xl font-extrabold text-amber-900 mt-0.5 font-serif">
                {stats.bill_requested_tables} Tables
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100/80 border border-amber-200 flex items-center justify-center text-amber-700">
              <Receipt size={18} className={stats.bill_requested_tables > 0 ? 'animate-bounce' : ''} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#EFE2D3] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-red-700 uppercase tracking-wider">Total Outstanding</p>
              <h3 className="text-xl font-extrabold text-red-600 mt-0.5 font-serif">
                {cafe.currency}{stats.total_outstanding.toFixed(2)}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
              <AlertTriangle size={18} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#EFE2D3] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Collected Today</p>
              <h3 className="text-xl font-extrabold text-emerald-700 mt-0.5 font-serif">
                {cafe.currency}{stats.total_paid_today.toFixed(2)}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <CheckCircle2 size={18} />
            </div>
          </div>
        </div>

        {/* Live Alerts Drawer (Waiter calls & bill requests) */}
        {notifications.length > 0 && (
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                  Active Guest Assistance Alerts ({notifications.length})
                </h4>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {notifications.map(n => (
                <div
                  key={n.id}
                  className="bg-white p-3 rounded-xl border border-amber-200/80 flex items-center justify-between shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800 shrink-0 font-bold text-xs">
                      #{n.table_number}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-stone-900">{n.message}</p>
                      <p className="text-[10px] text-stone-400">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleResolveAlert(n.id)}
                    className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tables Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#2D1B14] font-serif tracking-tight">
              Dine-In Table Billing & Active Sessions
            </h2>
            <p className="text-xs text-[#8A7365]">
              Real-time table occupancy, server-side bill balance calculations, cash/card receipting, and instant checkout.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              Free Table
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FAF3EA] text-[#C87D32] border border-[#EFE2D3] font-semibold text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C87D32]" />
              Occupied
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
              Bill Requested
            </span>
          </div>
        </div>

        {/* Tables Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tableSummaries.map(summary => {
            const isBillRequested = summary.is_bill_requested;
            const isOccupied = summary.table.status === 'OCCUPIED' || isBillRequested;
            const hasOutstanding = summary.outstanding_amount > 0;

            return (
              <div
                key={summary.table.id}
                className={`bg-white rounded-2xl border transition-all flex flex-col justify-between shadow-xs ${
                  isBillRequested
                    ? 'border-amber-400 ring-2 ring-amber-400/30 bg-amber-50/20'
                    : isOccupied
                    ? 'border-[#E2D2C3]'
                    : 'border-[#EFE2D3] opacity-90'
                }`}
              >
                {/* Table Header */}
                <div className="p-4 border-b border-[#F4ECE3] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                        isBillRequested
                          ? 'bg-amber-500 text-white shadow-xs'
                          : isOccupied
                          ? 'bg-[#2D1B14] text-[#FAF8F5]'
                          : 'bg-[#FAF3EA] text-[#C87D32]'
                      }`}
                    >
                      {summary.table.table_number}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#2D1B14]">{summary.table.table_name}</h3>
                      <p className="text-[10px] text-[#8A7365]">Capacity: {summary.table.capacity} guests</p>
                    </div>
                  </div>

                  <div>
                    {isBillRequested ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-400 text-amber-950 uppercase tracking-wide flex items-center gap-1 animate-pulse">
                        <Receipt size={11} />
                        Bill Requested
                      </span>
                    ) : isOccupied ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#FAF3EA] text-[#C87D32] border border-[#EFE2D3]">
                        Occupied
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Free
                      </span>
                    )}
                  </div>
                </div>

                {/* Session & Financial Details */}
                <div className="p-4 space-y-3.5 flex-1">
                  {summary.session ? (
                    <>
                      {/* Billed / Paid / Outstanding Balance */}
                      <div className="grid grid-cols-3 gap-2 bg-[#FAF8F5] p-3 rounded-xl border border-[#EFE2D3] text-center">
                        <div>
                          <p className="text-[10px] font-bold text-[#8A7365] uppercase">Total Billed</p>
                          <p className="text-xs font-extrabold text-[#2D1B14] mt-0.5">
                            {cafe.currency}{summary.total_billed.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-emerald-700 uppercase">Paid Online</p>
                          <p className="text-xs font-extrabold text-emerald-700 mt-0.5">
                            {cafe.currency}{summary.total_paid.toFixed(2)}
                          </p>
                        </div>
                        <div className={`rounded-lg py-0.5 ${hasOutstanding ? 'bg-red-50 text-red-700' : 'text-stone-600'}`}>
                          <p className="text-[10px] font-bold uppercase">Outstanding</p>
                          <p className="text-xs font-extrabold mt-0.5">
                            {cafe.currency}{summary.outstanding_amount.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Orders summary */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-bold text-[#2D1B14] mb-1.5">
                          <span>Orders in Session ({summary.orders.length})</span>
                          <span className="text-[10px] text-[#8A7365] font-mono">
                            ID: {summary.session.id.slice(-6)}
                          </span>
                        </div>

                        {summary.orders.length === 0 ? (
                          <p className="text-[11px] text-[#8A7365] italic py-1">Patron seated, browsing menu...</p>
                        ) : (
                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                            {summary.orders.map(ord => (
                              <div
                                key={ord.id}
                                className="bg-[#FDFBF7] p-2 rounded-lg border border-[#F4ECE3] text-[11px] flex items-center justify-between"
                              >
                                <div>
                                  <span className="font-bold text-[#2D1B14]">#{ord.id.slice(-5)}</span>
                                  <span className="text-[#8A7365] ml-1.5">
                                    ({ord.items.reduce((s, i) => s + i.quantity, 0)} items)
                                  </span>
                                  <div className="text-[10px] text-[#A89284]">
                                    {ord.items.map(it => `${it.quantity}x ${it.item_name}`).join(', ').slice(0, 32)}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-extrabold text-[#2D1B14]">
                                    {cafe.currency}{ord.total.toFixed(2)}
                                  </div>
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                                      ord.payment_status === 'PAID'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                                    }`}
                                  >
                                    {ord.payment_status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="py-6 text-center text-[#8A7365] space-y-2">
                      <div className="w-8 h-8 rounded-full bg-[#FAF3EA] mx-auto flex items-center justify-center text-[#C87D32]">
                        <Check size={16} />
                      </div>
                      <p className="text-xs">Table is sanitized and ready for dine-in patrons.</p>
                      {onOpenCustomerView && (
                        <button
                          onClick={() => onOpenCustomerView(summary.table.table_number)}
                          className="text-[11px] text-[#C87D32] hover:underline font-bold"
                        >
                          Open Customer QR View &rarr;
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Table Actions Footer */}
                <div className="p-3 bg-[#FAF8F5] border-t border-[#F4ECE3] rounded-b-2xl flex items-center justify-between gap-2">
                  {hasOutstanding ? (
                    <button
                      onClick={() => setSettlingTable(summary)}
                      className="flex-1 py-2 px-3 bg-[#C87D32] hover:bg-[#B36B28] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CreditCard size={14} />
                      <span>Settle {cafe.currency}{summary.outstanding_amount.toFixed(2)}</span>
                    </button>
                  ) : isOccupied ? (
                    <button
                      onClick={() => handleReleaseTable(summary.table.id)}
                      className="flex-1 py-2 px-3 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 size={14} />
                      <span>Release Table</span>
                    </button>
                  ) : (
                    <div className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1 px-2 py-1">
                      <Check size={13} />
                      <span>Table Ready</span>
                    </div>
                  )}

                  {summary.orders.length > 0 && (
                    <button
                      onClick={() => handlePrintBill(summary)}
                      title="Download Tax Invoice PDF"
                      className="p-2 rounded-xl bg-white border border-[#EFE2D3] hover:bg-[#FAF3EA] text-[#2D1B14] transition-colors cursor-pointer text-xs flex items-center justify-center"
                    >
                      <Printer size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Settle Bill Modal */}
      {settlingTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 border border-[#EFE2D3] shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setSettlingTable(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            >
              <X size={18} />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#FAF3EA] flex items-center justify-center text-[#C87D32]">
                  <Receipt size={18} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#2D1B14] font-serif">
                    Reception Payment & Bill Settlement
                  </h3>
                  <p className="text-xs text-[#8A7365]">
                    {settlingTable.table.table_name} • Session #{settlingTable.session?.id.slice(-6)}
                  </p>
                </div>
              </div>
            </div>

            {/* Bill Summary Banner */}
            <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#EFE2D3] space-y-1.5">
              <div className="flex justify-between text-xs text-[#8A7365]">
                <span>Total Table Billed:</span>
                <span className="font-bold text-[#2D1B14]">{cafe.currency}{settlingTable.total_billed.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#8A7365]">
                <span>Paid via Online Gateway:</span>
                <span className="font-bold text-emerald-700">{cafe.currency}{settlingTable.total_paid.toFixed(2)}</span>
              </div>
              <div className="border-t border-[#EFE2D3] pt-2 flex justify-between items-center">
                <span className="text-xs font-extrabold text-red-700 uppercase">Amount Due Now:</span>
                <span className="text-2xl font-extrabold text-red-600 font-serif">
                  {cafe.currency}{settlingTable.outstanding_amount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#2D1B14]">Select Settlement Method</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSettlingMethod('CASH')}
                  className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    settlingMethod === 'CASH'
                      ? 'border-[#C87D32] bg-[#FAF3EA] text-[#C87D32] ring-1 ring-[#C87D32]'
                      : 'border-[#EFE2D3] text-[#8A7365] hover:bg-[#FAF8F5]'
                  }`}
                >
                  <Banknote size={20} />
                  <span>Cash Drawer</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSettlingMethod('CARD')}
                  className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    settlingMethod === 'CARD'
                      ? 'border-[#C87D32] bg-[#FAF3EA] text-[#C87D32] ring-1 ring-[#C87D32]'
                      : 'border-[#EFE2D3] text-[#8A7365] hover:bg-[#FAF8F5]'
                  }`}
                >
                  <CreditCard size={20} />
                  <span>Card POS</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSettlingMethod('UPI_POS')}
                  className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    settlingMethod === 'UPI_POS'
                      ? 'border-[#C87D32] bg-[#FAF3EA] text-[#C87D32] ring-1 ring-[#C87D32]'
                      : 'border-[#EFE2D3] text-[#8A7365] hover:bg-[#FAF8F5]'
                  }`}
                >
                  <Smartphone size={20} />
                  <span>UPI Counter</span>
                </button>
              </div>
            </div>

            {/* Notes / Reference */}
            <div>
              <label className="text-xs font-bold text-[#2D1B14] block mb-1">
                Transaction Notes or Reference (Optional)
              </label>
              <input
                type="text"
                value={settlementNotes}
                onChange={e => setSettlementNotes(e.target.value)}
                placeholder="e.g. Card slip #4829 or Cash collected"
                className="w-full text-xs px-3 py-2 rounded-xl border border-[#EFE2D3] bg-[#FAF8F5] focus:bg-white focus:outline-hidden focus:border-[#C87D32]"
              />
            </div>

            {/* Release Table Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer bg-[#FAF8F5] p-3 rounded-xl border border-[#EFE2D3]">
              <input
                type="checkbox"
                checked={releaseAfterPayment}
                onChange={e => setReleaseAfterPayment(e.target.checked)}
                className="accent-[#C87D32] rounded"
              />
              <span className="text-xs font-semibold text-[#2D1B14]">
                Release table and mark as FREE immediately after settlement
              </span>
            </label>

            {/* Success Banner */}
            {settleSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5">
                <CheckCircle2 size={16} />
                <span>{settleSuccessMsg}</span>
              </div>
            )}

            {/* Confirm Settlement Button */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSettlingTable(null)}
                disabled={isSettling}
                className="flex-1 py-2.5 rounded-xl border border-[#EFE2D3] text-stone-600 hover:bg-stone-50 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSettlePayment}
                disabled={isSettling}
                className="flex-1 py-2.5 rounded-xl bg-[#C87D32] hover:bg-[#B36B28] text-white font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSettling ? (
                  <span>Recording Payment...</span>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Record {cafe.currency}{settlingTable.outstanding_amount.toFixed(2)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
