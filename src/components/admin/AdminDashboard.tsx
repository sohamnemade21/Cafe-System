import React, { useState, useEffect } from 'react';
import { Cafe, CafeTable, MenuItem, MenuCategory, Order, StaffNotification } from '../../types';
import { api } from '../../services/api';
import { LiveOrdersView } from './LiveOrdersView';
import { TablesQRManager } from './TablesQRManager';
import { MenuManager } from './MenuManager';
import { CustomerCRM } from './CustomerCRM';
import { CouponsManager } from './CouponsManager';
import { ReportsView } from './ReportsView';
import { SettingsView } from './SettingsView';
import {
  ShoppingBag,
  QrCode,
  Utensils,
  Users,
  Tag,
  BarChart3,
  Settings,
  Bell,
  ChefHat,
  Smartphone,
  ChevronDown,
  ExternalLink,
  CheckCircle2,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { StaffUser } from '../../types';

interface AdminDashboardProps {
  currentCafe: Cafe;
  allCafes: Cafe[];
  onSelectCafe: (cafe: Cafe) => void;
  onOpenCustomerView: (tableNumber?: number) => void;
  onOpenKDS: () => void;
  currentStaff?: StaffUser | null;
  onLogout?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentCafe,
  allCafes,
  onSelectCafe,
  onOpenCustomerView,
  onOpenKDS,
  currentStaff,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'tables' | 'menu' | 'crm' | 'coupons' | 'reports' | 'settings'>('orders');
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const loadData = async () => {
    try {
      const [tData, mData, oData, nData] = await Promise.all([
        api.getTables(currentCafe.id),
        api.getMenu(currentCafe.id),
        api.getCafeOrders(currentCafe.id),
        api.getNotifications(currentCafe.id),
      ]);
      setTables(tData);
      setCategories(mData.categories);
      setMenuItems(mData.items);
      setOrders(oData);
      setNotifications(nData);
    } catch (err) {
      console.error('Failed to load admin data', err);
    }
  };

  useEffect(() => {
    loadData();

    // Subscribe to SSE updates
    const eventSource = new EventSource('/api/realtime/stream');
    eventSource.addEventListener('new_order', () => loadData());
    eventSource.addEventListener('order_status_updated', () => loadData());
    eventSource.addEventListener('waiter_called', () => loadData());
    eventSource.addEventListener('bill_requested', () => loadData());

    return () => eventSource.close();
  }, [currentCafe.id]);

  const unreadNotifications = notifications.filter(n => !n.is_resolved);
  const activeOrdersCount = orders.filter(o => ['PAID', 'ACCEPTED', 'PREPARING'].includes(o.order_status)).length;

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Left: Tenant Switcher */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={currentCafe.id}
                onChange={e => {
                  const sel = allCafes.find(c => c.id === e.target.value);
                  if (sel) onSelectCafe(sel);
                }}
                className="appearance-none bg-stone-100 hover:bg-stone-200 border border-stone-200 text-stone-900 font-bold text-xs py-2 pl-3 pr-8 rounded-xl cursor-pointer transition-colors focus:outline-hidden"
              >
                {allCafes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.currency})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-stone-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <span className="text-[11px] font-mono text-stone-400 hidden sm:inline">
              Tenant ID: {currentCafe.slug}
            </span>
          </div>

          {/* Right: Quick actions, notifications, shortcuts */}
          <div className="flex items-center gap-2">
            {/* Notification Bell for Waiter Calls */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl relative cursor-pointer transition-colors"
                title="Staff Alerts & Waiter Calls"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-500 text-stone-950 font-black text-[9px] flex items-center justify-center animate-pulse">
                    {unreadNotifications.length}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-stone-200 shadow-xl p-3 z-50 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-2 border-b border-stone-100 mb-2">
                    <span className="text-xs font-bold text-stone-900">Staff Service Alerts</span>
                    <span className="text-[10px] text-stone-400">{unreadNotifications.length} pending</span>
                  </div>

                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-stone-400">No active table calls</div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {notifications.map(n => (
                        <div
                          key={n.id}
                          className="p-2.5 rounded-xl border border-stone-100 bg-stone-50 text-xs flex items-start justify-between gap-2"
                        >
                          <div>
                            <span className="font-bold text-stone-900 block">
                              Table {n.table_number} · {n.type.replace('_', ' ')}
                            </span>
                            <p className="text-stone-600 text-[11px] mt-0.5">{n.message}</p>
                            <span className="text-[10px] text-stone-400">
                              {new Date(n.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                          {!n.is_resolved && (
                            <button
                              onClick={() => {
                                setNotifications(prev =>
                                  prev.map(item => (item.id === n.id ? { ...item, is_resolved: true } : item))
                                );
                              }}
                              className="text-[10px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-1 rounded-lg cursor-pointer transition-colors shrink-0"
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Launch KDS button */}
            <button
              onClick={onOpenKDS}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>Kitchen Display</span>
            </button>

            {/* Launch Customer QR Menu button */}
            <button
              onClick={() => onOpenCustomerView(1)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Open Dine-In View</span>
            </button>

            {currentStaff && (
              <span className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-stone-100 text-stone-700 border border-stone-200">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>{currentStaff.user_id || currentStaff.full_name}</span>
              </span>
            )}

            {onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="Sign out of Owner Portal"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container with Sidebar & Content */}
      <div className="max-w-7xl mx-auto w-full px-4 py-6 flex-1 flex flex-col md:flex-row gap-6">
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-56 shrink-0">
          <nav className="bg-white rounded-2xl border border-stone-200 p-2 space-y-1 shadow-xs">
            <button
              onClick={() => setActiveTab('orders')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-4 h-4" />
                <span>Live Orders</span>
              </div>
              {activeOrdersCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeTab === 'orders' ? 'bg-amber-500 text-stone-950' : 'bg-amber-100 text-amber-900 font-bold'
                }`}>
                  {activeOrdersCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('tables')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'tables'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>Tables & QR Standees</span>
            </button>

            <button
              onClick={() => setActiveTab('menu')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'menu'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Utensils className="w-4 h-4" />
              <span>Menu & 86 Stock</span>
            </button>

            <button
              onClick={() => setActiveTab('crm')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'crm'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Customers CRM</span>
            </button>

            <button
              onClick={() => setActiveTab('coupons')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'coupons'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Tag className="w-4 h-4" />
              <span>Coupons & Loyalty</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Sales & Reports</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings & Outbox</span>
            </button>
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0">
          {activeTab === 'orders' && (
            <LiveOrdersView cafe={currentCafe} orders={orders} onRefresh={loadData} />
          )}

          {activeTab === 'tables' && (
            <TablesQRManager
              cafe={currentCafe}
              tables={tables}
              onRefresh={loadData}
              onSelectTableForCustomerView={onOpenCustomerView}
            />
          )}

          {activeTab === 'menu' && (
            <MenuManager
              cafe={currentCafe}
              categories={categories}
              items={menuItems}
              onRefresh={loadData}
            />
          )}

          {activeTab === 'crm' && (
            <CustomerCRM cafe={currentCafe} />
          )}

          {activeTab === 'coupons' && (
            <CouponsManager cafe={currentCafe} />
          )}

          {activeTab === 'reports' && (
            <ReportsView cafe={currentCafe} />
          )}

          {activeTab === 'settings' && (
            <SettingsView cafe={currentCafe} />
          )}
        </main>
      </div>
    </div>
  );
};
