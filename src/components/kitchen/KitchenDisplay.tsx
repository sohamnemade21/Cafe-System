import React, { useState, useEffect } from 'react';
import { Cafe, Order } from '../../types';
import { api } from '../../services/api';
import { playOrderChime } from '../../utils/audio';
import { ChefHat, Volume2, VolumeX, Maximize2, Minimize2, Clock, Check, AlertCircle, RefreshCw, LogOut, ArrowLeft } from 'lucide-react';
import { StaffUser } from '../../types';

interface KitchenDisplayProps {
  cafe: Cafe;
  onExit?: () => void;
  currentStaff?: StaffUser | null;
  onLogout?: () => void;
}

export const KitchenDisplay: React.FC<KitchenDisplayProps> = ({ cafe, onExit, currentStaff, onLogout }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'PREPARING' | 'READY'>('ACTIVE');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Ticker for timers
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const loadOrders = async () => {
    try {
      const data = await api.getCafeOrders(cafe.id);
      setOrders(data);
    } catch (err) {
      console.error('Failed to load kitchen orders', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();

    // Listen to real-time events via SSE
    const eventSource = new EventSource('/api/realtime/stream');

    eventSource.addEventListener('new_order', (e: any) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.order && payload.order.cafe_id === cafe.id) {
          setOrders(prev => [payload.order, ...prev.filter(o => o.id !== payload.order.id)]);
          if (soundEnabled) playOrderChime();
        }
      } catch (err) {
        console.error(err);
      }
    });

    eventSource.addEventListener('order_status_updated', (e: any) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.order && payload.order.cafe_id === cafe.id) {
          setOrders(prev => prev.map(o => (o.id === payload.order.id ? payload.order : o)));
        }
      } catch (err) {
        console.error(err);
      }
    });

    return () => {
      eventSource.close();
    };
  }, [cafe.id, soundEnabled]);

  const handleStatusChange = async (orderId: string, nextStatus: string) => {
    try {
      const updated = await api.updateOrderStatus(orderId, nextStatus);
      setOrders(prev => prev.map(o => (o.id === updated.id ? updated : o)));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter(o => {
    if (activeFilter === 'ACTIVE') {
      return ['PAID', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.order_status);
    }
    if (activeFilter === 'PREPARING') {
      return o.order_status === 'PREPARING';
    }
    if (activeFilter === 'READY') {
      return o.order_status === 'READY';
    }
    return true; // ALL
  });

  const getElapsedMinutes = (dateStr: string) => {
    const diffMs = currentTime - new Date(dateStr).getTime();
    return Math.floor(diffMs / 60000);
  };

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col font-sans">
      {/* KDS Header */}
      <header className="px-6 py-3 bg-stone-950 border-b border-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-stone-950 shadow-xs">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base tracking-tight text-white">
                KITCHEN DISPLAY SYSTEM (KDS)
              </h1>
              <span className="bg-emerald-950 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-800 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Stream
              </span>
            </div>
            <p className="text-xs text-stone-400">
              {cafe.name} · Real-time Ticket Dispatch
            </p>
          </div>
        </div>

        {/* Filter Pills & Controls */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center bg-stone-800 p-1 rounded-xl border border-stone-700">
            {(['ACTIVE', 'PREPARING', 'READY', 'ALL'] as const).map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeFilter === f
                    ? 'bg-amber-500 text-stone-950 shadow-xs'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              soundEnabled
                ? 'bg-stone-800 border-stone-700 text-amber-400'
                : 'bg-stone-800 border-stone-700 text-stone-500'
            }`}
            title={soundEnabled ? 'Audio Alert Enabled' : 'Audio Alert Muted'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={loadOrders}
            className="p-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-300 hover:text-white cursor-pointer"
            title="Refresh Tickets"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-300 hover:text-white cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {onExit && (
            <button
              onClick={onExit}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-800 border border-stone-700 text-stone-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
              title="Return to Customer Menu"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exit KDS</span>
            </button>
          )}

          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-950/80 border border-red-800 text-red-300 hover:bg-red-900 text-xs font-bold transition-colors cursor-pointer"
              title="Sign out of Kitchen Portal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Tickets Grid */}
      <main className="flex-1 p-6 overflow-y-auto">
        {loading ? (
          <div className="h-64 flex items-center justify-center text-stone-500 text-sm">
            Loading kitchen tickets...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center text-stone-500 border border-dashed border-stone-800 rounded-2xl">
            <ChefHat className="w-12 h-12 text-stone-700 mb-2" />
            <p className="text-base font-bold text-stone-400">Kitchen is all caught up!</p>
            <p className="text-xs text-stone-600 mt-1">New paid orders will appear here automatically.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOrders.map(order => {
              const elapsed = getElapsedMinutes(order.created_at);
              const isUrgent = elapsed >= 15;
              const isWarning = elapsed >= 8 && elapsed < 15;

              return (
                <div
                  key={order.id}
                  className={`bg-stone-950 rounded-2xl border flex flex-col justify-between overflow-hidden shadow-lg transition-all ${
                    order.order_status === 'READY'
                      ? 'border-emerald-500/80 shadow-emerald-950/40'
                      : isUrgent
                      ? 'border-rose-600 shadow-rose-950/40 animate-pulse'
                      : isWarning
                      ? 'border-amber-500/80'
                      : 'border-stone-800'
                  }`}
                >
                  {/* Ticket Header */}
                  <div>
                    <div
                      className={`p-3.5 flex items-center justify-between border-b ${
                        order.order_status === 'READY'
                          ? 'bg-emerald-950/60 border-emerald-800'
                          : isUrgent
                          ? 'bg-rose-950/60 border-rose-900'
                          : 'bg-stone-900 border-stone-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-white tracking-tight">
                            TABLE {order.table_number}
                          </span>
                          <span className="text-xs font-mono text-stone-400">
                            #{order.id.slice(-5)}
                          </span>
                        </div>
                        <span className="text-[11px] text-stone-400">
                          {order.customer_name || 'Guest'}
                        </span>
                      </div>

                      <div className="text-right">
                        <div
                          className={`text-xs font-mono font-bold flex items-center gap-1 justify-end ${
                            isUrgent
                              ? 'text-rose-400'
                              : isWarning
                              ? 'text-amber-400'
                              : 'text-stone-300'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{elapsed}m ago</span>
                        </div>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md inline-block mt-0.5 ${
                            order.order_status === 'READY'
                              ? 'bg-emerald-500 text-stone-950'
                              : order.order_status === 'PREPARING'
                              ? 'bg-amber-500 text-stone-950'
                              : 'bg-stone-700 text-stone-200'
                          }`}
                        >
                          {order.order_status}
                        </span>
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="p-4 space-y-3 divide-y divide-stone-900">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="pt-2 first:pt-0">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-base font-black text-white">
                              {item.quantity}×
                            </span>
                            <div className="flex-1">
                              <span className="text-sm font-bold text-stone-100 leading-snug">
                                {item.item_name}
                              </span>
                              {item.selected_variants_json && item.selected_variants_json.length > 0 && (
                                <p className="text-xs text-amber-400 font-medium mt-0.5">
                                  + {item.selected_variants_json.map((v: any) => v.name).join(', ')}
                                </p>
                              )}
                              {item.item_notes && (
                                <p className="text-xs text-rose-300 font-semibold bg-rose-950/50 border border-rose-900 px-2 py-0.5 rounded-md mt-1">
                                  Note: {item.item_notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {order.notes && (
                        <div className="pt-2">
                          <div className="bg-stone-900 p-2 rounded-xl text-xs text-stone-300 border border-stone-800">
                            <span className="font-bold text-stone-400 block text-[10px] uppercase">
                              Order Notes
                            </span>
                            {order.notes}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Chef Action Buttons */}
                  <div className="p-3 bg-stone-900/60 border-t border-stone-800">
                    {order.order_status === 'PAID' || order.order_status === 'PENDING' ? (
                      <button
                        onClick={() => handleStatusChange(order.id, 'ACCEPTED')}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs rounded-xl tracking-wider uppercase transition-all active:scale-98 cursor-pointer shadow-md"
                      >
                        [ ACCEPT ORDER ]
                      </button>
                    ) : order.order_status === 'ACCEPTED' ? (
                      <button
                        onClick={() => handleStatusChange(order.id, 'PREPARING')}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs rounded-xl tracking-wider uppercase transition-all active:scale-98 cursor-pointer shadow-md"
                      >
                        [ START PREPARING ]
                      </button>
                    ) : order.order_status === 'PREPARING' ? (
                      <button
                        onClick={() => handleStatusChange(order.id, 'READY')}
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs rounded-xl tracking-wider uppercase transition-all active:scale-98 cursor-pointer shadow-md"
                      >
                        [ MARK AS READY TO SERVE ]
                      </button>
                    ) : order.order_status === 'READY' ? (
                      <button
                        onClick={() => handleStatusChange(order.id, 'SERVED')}
                        className="w-full py-3 bg-stone-200 hover:bg-white text-stone-950 font-black text-xs rounded-xl tracking-wider uppercase transition-all active:scale-98 cursor-pointer shadow-md"
                      >
                        [ MARK AS SERVED ]
                      </button>
                    ) : (
                      <div className="text-center py-2 text-xs text-stone-500 font-bold">
                        ORDER COMPLETED
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
