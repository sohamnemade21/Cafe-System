import React, { useState, useEffect, useRef } from 'react';
import { Cafe, MenuItem, MenuCategory, CartItem, Customer, Order, Coupon, MenuItemVariant } from '../types';
import { api } from '../services/api';
import { buildRealtimeStreamUrl } from '../utils/url';
import { Header } from '../components/customer/Header';
import { CafeHero } from '../components/customer/CafeHero';
import { CoffeePassModal } from '../components/customer/CoffeePassModal';
import { MenuItemCard } from '../components/customer/MenuItemCard';
import { ItemCustomizerModal } from '../components/customer/ItemCustomizerModal';
import { CartDrawer } from '../components/customer/CartDrawer';
import { RazorpayModal } from '../components/customer/RazorpayModal';
import { OrderTracker } from '../components/customer/OrderTracker';
import { CustomerProfileModal } from '../components/customer/CustomerProfileModal';
import { CallWaiterModal } from '../components/customer/CallWaiterModal';
import { AuthModal } from '../components/customer/AuthModal';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { Search, ShoppingBag, Sparkles, Award, Flame, Coffee, AlertCircle, X, QrCode, Lock, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { CoffeeBeanIcon } from '../components/common/CoffeeBeanIcon';

interface CustomerMenuProps {
  cafeSlug: string;
  tableNumber?: number | null;
  onOpenAdmin?: () => void;
  onOpenKDS?: () => void;
  onTableSelect?: (tableNumber: number) => void;
}

export const CustomerMenu: React.FC<CustomerMenuProps> = ({
  cafeSlug,
  tableNumber,
  onOpenAdmin,
  onOpenKDS,
  onTableSelect,
}) => {
  const {
    customer,
    loading: authLoading,
    isAuthModalOpen,
    authModalMode,
    authNotice,
    dismissNotice,
    resendConfirmationEmail,
    refreshProfile,
    openAuthModal,
    closeAuthModal,
    logout,
  } = useCustomerAuth();

  const [profileModalTab, setProfileModalTab] = useState<'profile' | 'orders'>('profile');
  const [resendEmailInput, setResendEmailInput] = useState('');
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);

  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);

  // Table QR Session & Simulator state
  const [tableSession, setTableSession] = useState<{
    session_id: string;
    session_token: string;
    table_id: string;
    table_number: number;
    table_name: string;
    status: string;
  } | null>(null);
  const [tableSessionError, setTableSessionError] = useState<string | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [cafeTables, setCafeTables] = useState<any[]>([]);

  // Modals & Drawers state
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCallWaiterOpen, setIsCallWaiterOpen] = useState(false);
  const [isRazorpayOpen, setIsRazorpayOpen] = useState(false);
  const [isLoyaltyOpen, setIsLoyaltyOpen] = useState(false);

  // Cart & Order state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [activeRewardCoupon, setActiveRewardCoupon] = useState<Coupon | null>(null);
  const [billRequestNotice, setBillRequestNotice] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const menuSectionRef = useRef<HTMLDivElement>(null);

  // Bug #1 fix: Auto-open auth modal when unauthenticated customer lands via QR scan
  useEffect(() => {
    // Wait until auth initialization finishes, then check
    if (!authLoading && !customer && tableNumber) {
      openAuthModal('login');
    }
  }, [authLoading, customer, tableNumber]);

  // Load Café & Menu Data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const cafeData = await api.getCafe(cafeSlug);
        setCafe(cafeData);

        const menuData = await api.getMenu(cafeData.id);
        setCategories(menuData.categories);
        setMenuItems(menuData.items);

        // Fetch cafe tables for QR scan dialog / table simulator
        try {
          const tbls = await api.getTables(cafeData.id);
          setCafeTables(tbls);
        } catch {
          // ignore
        }

        // Initialize table session ONLY when tableNumber is provided from scanned QR
        if (tableNumber) {
          try {
            const sessionData = await api.initTableSession(cafeData.id, tableNumber);
            setTableSession(sessionData);
            setTableSessionError(null);
          } catch (err: any) {
            console.warn('Table session initialization note:', err);
            setTableSession(null);
            setTableSessionError(err.message || 'Table session is closed or unavailable.');
          }
        } else {
          setTableSession(null);
          setTableSessionError(null);
          api.setCustomerSessionToken(null);
        }
      } catch (err) {
        console.error('Failed to load menu or table session', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [cafeSlug, tableNumber]);

  // Subscribe to SSE updates for live order tracking
  useEffect(() => {
    if (!currentOrder) return;

    const eventSource = new EventSource(buildRealtimeStreamUrl());
    eventSource.addEventListener('order_status_updated', (e: any) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.order && payload.order.id === currentOrder.id) {
          setCurrentOrder(payload.order);
        }
      } catch (err) {
        console.error(err);
      }
    });

    return () => eventSource.close();
  }, [currentOrder?.id]);

  // Handlers - RULE 1 & 2 Enforced
  const handleItemSelect = (item: MenuItem) => {
    // RULE 2: A valid QR/table session MUST exist before menu ordering is enabled.
    if (!tableNumber || !tableSession || tableSession.status !== 'ACTIVE') {
      setIsQrModalOpen(true);
      return;
    }

    // RULE 1: Customer Login / Signup -> Authentication succeeds -> Menu unlocks
    if (!customer) {
      openAuthModal('login');
      return;
    }

    if (item.variants && item.variants.length > 0) {
      setCustomizingItem(item);
    } else {
      // Add directly without customization
      setCartItems(prev => {
        const existingIdx = prev.findIndex(
          ci => ci.menuItem.id === item.id && ci.selectedVariants.length === 0 && !ci.notes
        );
        if (existingIdx > -1) {
          const updated = [...prev];
          updated[existingIdx].quantity += 1;
          updated[existingIdx].itemTotal = updated[existingIdx].quantity * item.price;
          return updated;
        }
        return [
          ...prev,
          {
            menuItem: item,
            quantity: 1,
            selectedVariants: [],
            notes: '',
            itemTotal: item.price,
          },
        ];
      });
    }
  };

  const handleCustomizerAdd = (
    item: MenuItem,
    quantity: number,
    selectedVariants: MenuItemVariant[],
    notes: string,
    totalPrice: number
  ) => {
    // RULE 2: A valid QR/table session MUST exist
    if (!tableNumber || !tableSession || tableSession.status !== 'ACTIVE') {
      setIsQrModalOpen(true);
      return;
    }

    // RULE 1: Customer Login / Signup -> Authentication succeeds -> Menu unlocks
    if (!customer) {
      openAuthModal('login');
      return;
    }

    setCartItems(prev => [
      ...prev,
      {
        menuItem: item,
        quantity,
        selectedVariants,
        notes,
        itemTotal: totalPrice,
      },
    ]);
  };

  const handleUpdateQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveCartItem(index);
      return;
    }
    setCartItems(prev => {
      const updated = [...prev];
      const item = updated[index];
      const unitPrice = item.itemTotal / item.quantity;
      item.quantity = newQty;
      item.itemTotal = unitPrice * newQty;
      return updated;
    });
  };

  const handleRemoveCartItem = (index: number) => {
    setCartItems(prev => prev.filter((_, i) => i !== index));
  };

  // Checkout flow: sends payload to server with session_token
  const handleCheckout = async (orderDetails: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    notes: string;
    couponCode?: string;
    marketingConsent: boolean;
  }) => {
    if (!cafe) return;

    // RULE 2: Valid Table QR Session required
    if (!tableNumber || !tableSession || tableSession.status !== 'ACTIVE') {
      setCheckoutError('A valid active table QR session is required to place an order. Please scan your table QR.');
      setIsQrModalOpen(true);
      return;
    }

    // RULE 1: Customer Authentication required
    if (!customer) {
      openAuthModal('login');
      return;
    }

    if (cartItems.length === 0) {
      setCheckoutError('Your cart is empty. Please add items before checking out.');
      return;
    }

    setCheckoutError(null);
    setIsCheckingOut(true);

    try {
      const payloadCartItems = cartItems.map(item => ({
        menu_item_id: item.menuItem.id,
        quantity: item.quantity,
        selected_variants: item.selectedVariants,
        notes: item.notes,
      }));

      const orderPayload = {
        cafe_id: cafe.id,
        table_number: tableNumber,
        session_token: tableSession.session_token,
        customer_name: customer.name || orderDetails.customerName,
        customer_email: customer.email,
        customer_phone: customer.phone || orderDetails.customerPhone,
        cart_items: payloadCartItems,
        coupon_code: orderDetails.couponCode,
        notes: orderDetails.notes,
        marketing_consent: orderDetails.marketingConsent,
      };

      const res = await api.createOrder(orderPayload);
      setCurrentOrder(res.order);
      setCartItems([]);
      setIsCartOpen(false);
      // Food order placed successfully and sent to Kitchen KDS. Payment happens when customer completes meal.
    } catch (err: any) {
      console.error('Checkout error:', err);
      setCheckoutError(err.message || 'Failed to place order. Please try again.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Payment completed
  const handlePaymentSuccess = (verifiedOrder: Order, coupon?: Coupon) => {
    setIsRazorpayOpen(false);
    setCurrentOrder(verifiedOrder);
    setCartItems([]);
    if (coupon) {
      setActiveRewardCoupon(coupon);
    }
  };

  // Request bill action
  const handleRequestBill = async () => {
    if (!cafe) return;
    try {
      await api.requestBill(String(tableNumber));
      const res = await api.callWaiter(String(tableNumber), `Bill invoice requested by Table #${tableNumber}`);
      setBillRequestNotice(res.message || 'Printed bill requested. Staff alerted.');
      setTimeout(() => setBillRequestNotice(null), 5000);
    } catch {
      setBillRequestNotice('Bill request sent to server.');
      setTimeout(() => setBillRequestNotice(null), 4000);
    }
  };

  const scrollToMenu = () => {
    menuSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading || !cafe) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-[#FAF3EA] border border-[#EFE2D3] flex items-center justify-center text-[#C87D32] animate-bounce mb-3">
          <CoffeeBeanIcon size={24} />
        </div>
        <p className="text-sm font-bold text-[#2A1810]">Warming up the espresso machine...</p>
        <p className="text-xs text-[#8C7667] mt-1">Connecting to {cafeSlug} roastery table system</p>
      </div>
    );
  }

  // Filter menu items
  const filteredItems = menuItems.filter(item => {
    if (selectedCategory !== 'ALL' && item.category_id !== selectedCategory) {
      return false;
    }
    if (vegOnly && !item.is_veg) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Featured Specials
  const chefSpecials = menuItems.filter(item => item.is_chef_special || item.is_bestseller).slice(0, 4);

  const cartTotalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cartItems.reduce((sum, item) => sum + item.itemTotal, 0);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#292524] pb-28 font-sans">
      {/* Top Navigation */}
      <Header
        cafe={cafe}
        tableNumber={tableNumber}
        cartCount={cartTotalItems}
        customer={customer}
        onOpenCart={() => setIsCartOpen(true)}
        onCallWaiter={() => setIsCallWaiterOpen(true)}
        onRequestBill={handleRequestBill}
        onOpenProfile={(tab) => {
          setProfileModalTab(tab || 'profile');
          if (customer) {
            setIsProfileOpen(true);
          } else {
            openAuthModal('login');
          }
        }}
        onOpenLoyalty={() => setIsLoyaltyOpen(true)}
        onOpenLogin={() => openAuthModal('login')}
        onOpenSignup={() => openAuthModal('signup')}
        onLogout={logout}
        onScanQr={() => setIsQrModalOpen(true)}
      />

      {/* Email Confirmation / Auth Callback Notification Banner */}
      {authNotice && (
        <div className="max-w-4xl mx-auto px-4 mt-3">
          <div className={`p-4 rounded-2xl border shadow-xs animate-in fade-in flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            authNotice.type === 'error'
              ? 'bg-amber-50/95 border-amber-300 text-amber-950'
              : 'bg-emerald-50/95 border-emerald-300 text-emerald-950'
          }`}>
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <AlertCircle className={`w-4 h-4 shrink-0 ${authNotice.type === 'error' ? 'text-amber-700' : 'text-emerald-700'}`} />
                <h4 className="text-xs font-extrabold">{authNotice.title}</h4>
              </div>
              <p className="text-xs text-stone-700 leading-relaxed">{authNotice.message}</p>
              {resendStatus && (
                <p className="text-xs font-semibold text-emerald-700 mt-1">{resendStatus}</p>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              {authNotice.action === 'resend_confirmation' && (
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <input
                    type="email"
                    value={resendEmailInput}
                    onChange={e => setResendEmailInput(e.target.value)}
                    placeholder="name@example.com"
                    className="text-xs px-2.5 py-1.5 rounded-xl border border-amber-300 bg-white text-stone-900 w-full sm:w-48 focus:outline-hidden"
                  />
                  <button
                    onClick={async () => {
                      if (!resendEmailInput.trim()) return;
                      setResendLoading(true);
                      const res = await resendConfirmationEmail(resendEmailInput);
                      setResendLoading(false);
                      setResendStatus(res.message || res.error || null);
                    }}
                    disabled={resendLoading || !resendEmailInput.trim()}
                    className="px-3 py-1.5 text-xs font-bold bg-[#C87D32] hover:bg-[#B36B28] text-white rounded-xl transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {resendLoading ? 'Sending...' : 'Resend'}
                  </button>
                </div>
              )}
              {authNotice.action === 'retry_sync' && (
                <button
                  onClick={async () => {
                    await refreshProfile();
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-[#C87D32] hover:bg-[#B36B28] text-white rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  Retry Sync
                </button>
              )}
              <button
                onClick={dismissNotice}
                className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer ml-auto"
                title="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Request Alert Toast */}
      {billRequestNotice && (
        <div className="max-w-md mx-auto px-4 mt-2">
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2 rounded-xl text-xs font-semibold text-center animate-in fade-in">
            {billRequestNotice}
          </div>
        </div>
      )}

      {/* Switcher Bar to easily hop between Admin/Kitchen/Dine-In */}
      <div className="bg-[#F3ECE4] border-b border-[#E7DDD0] py-1.5 px-4 text-center">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-[11px] text-[#7A6354] font-medium">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${tableNumber && tableSession ? 'bg-emerald-600' : 'bg-amber-500 animate-pulse'}`} />
            {tableNumber ? `Specialty Roast Dine-In · Table #${tableNumber}` : 'Browse Mode · Scan Table QR to Order'}
          </span>
          <div className="flex gap-3">
            {onOpenKDS && (
              <button
                onClick={onOpenKDS}
                className="text-[#4A2E1B] hover:text-[#2A1810] font-bold underline cursor-pointer"
              >
                Kitchen KDS
              </button>
            )}
            {onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="text-[#C87D32] hover:text-[#9A4B1A] font-bold underline cursor-pointer"
              >
                Café Management
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table & QR Ordering Security Status Banner */}
      <div className="max-w-4xl mx-auto px-4 mt-3">
        {!tableNumber ? (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                  <span>Browse-Only Menu Preview</span>
                  <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">QR Required</span>
                </h4>
                <p className="text-xs text-amber-900 mt-0.5 leading-relaxed">
                  You are viewing the digital menu. To unlock ordering and have items served to your seat, please scan the QR code located on your table.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsQrModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-amber-50 text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Scan / Select Table QR</span>
            </button>
          </div>
        ) : tableSessionError ? (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0" />
              <div>
                <h4 className="text-xs font-black text-rose-950">Table #{tableNumber} Session Closed</h4>
                <p className="text-xs text-rose-800 mt-0.5">{tableSessionError}</p>
              </div>
            </div>
            <button
              onClick={() => setIsQrModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-rose-700 text-white text-xs font-bold hover:bg-rose-800 cursor-pointer"
            >
              Switch Table
            </button>
          </div>
        ) : !customer ? (
          <div className="p-4 rounded-2xl bg-[#FAF3EA] border border-[#EFE2D3] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-[#2D1B14] text-[#E6AA68] shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-[#2D1B14] uppercase tracking-wider flex items-center gap-1.5">
                  <span>Table #{tableNumber} • Customer Authentication Required</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">QR Validated</span>
                </h4>
                <p className="text-xs text-[#705648] mt-0.5 leading-relaxed">
                  Table #{tableNumber} is ready. Sign in or create a customer account to unlock live ordering and billing for your table.
                </p>
              </div>
            </div>
            <button
              onClick={() => openAuthModal('login')}
              className="px-4 py-2 rounded-xl bg-[#C87D32] hover:bg-[#B36B28] text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
            >
              Sign In to Order
            </button>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-200 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <div>
                <p className="text-xs text-emerald-950 font-bold">
                  Table #{tableNumber} • Ordering Unlocked for {customer.name || customer.email}
                </p>
                <p className="text-[11px] text-emerald-700">
                  Active roastery table session • Dishes are freshly prepared and served to Table #{tableNumber}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsQrModalOpen(true)}
              className="text-[11px] text-emerald-800 hover:text-emerald-950 font-semibold underline cursor-pointer"
            >
              Change Table
            </button>
          </div>
        )}
      </div>

      {/* Main Container */}
      {currentOrder ? (
        /* Live Order Tracking Page */
        <OrderTracker
          order={currentOrder}
          cafe={cafe}
          rewardCoupon={activeRewardCoupon}
          onBackToMenu={() => setCurrentOrder(null)}
          onCallWaiter={() => setIsCallWaiterOpen(true)}
          onRequestBill={handleRequestBill}
          onPayOnline={() => setIsRazorpayOpen(true)}
          onReorder={() => setCurrentOrder(null)}
        />
      ) : (
        /* Standard Menu Browsing Flow */
        <main className="max-w-4xl mx-auto px-4 pt-4 space-y-5">
          {/* Master Café Hero Section */}
          <CafeHero
            cafe={cafe}
            tableNumber={tableNumber}
            onExploreMenu={scrollToMenu}
            onOpenLoyalty={() => setIsLoyaltyOpen(true)}
            onScanQr={() => setIsQrModalOpen(true)}
          />

          {/* Chef's Signature & Recommended Strip */}
          {selectedCategory === 'ALL' && !searchQuery.trim() && chefSpecials.length > 0 && (
            <div className="bg-[#FAF3EA] border border-[#EFE2D3] rounded-3xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#C87D32] text-white flex items-center justify-center shadow-xs">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="font-serif-cafe font-bold text-sm sm:text-base text-[#2A1810]">
                    Barista Recommendations &amp; House Specials
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-[#8C5E3B] uppercase tracking-wider hidden sm:inline">
                  Fresh Daily
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {chefSpecials.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleItemSelect(item)}
                    className="bg-white rounded-2xl p-2.5 border border-[#EFE7DD] hover:border-[#C87D32] transition-all cursor-pointer group shadow-xs hover:shadow-md flex flex-col justify-between"
                  >
                    <div className="aspect-square rounded-xl overflow-hidden bg-[#F5EFEB] mb-2 relative">
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-1.5 left-1.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-[#2D1B14] text-[#E6AA68]">
                        ★ {item.rating || 4.9}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-[#2A1810] line-clamp-1 group-hover:text-[#C87D32] transition-colors">
                        {item.name}
                      </h4>
                      <div className="flex items-center justify-between mt-1 pt-1 border-t border-[#FAF6F0]">
                        <span className="text-xs font-black text-[#2A1810]">
                          {cafe.currency}{item.price}
                        </span>
                        <span className="text-[10px] font-bold text-[#C87D32] bg-[#FAF3EA] px-2 py-0.5 rounded-md">
                          + ADD
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search & Dietary Filter Section */}
          <div ref={menuSectionRef} className="bg-white rounded-2xl border border-[#EFE7DD] p-3.5 sm:p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#A89284] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search single-origin coffee, sourdough toast, fresh bakery..."
                  className="w-full text-xs pl-10 pr-4 py-2.5 bg-[#FAF8F5] rounded-xl border border-[#EFE7DD] focus:outline-hidden focus:border-[#C87D32] focus:bg-white transition-all placeholder:text-[#A89284] text-[#2A1810]"
                />
              </div>

              {/* Pure Veg Filter Toggle */}
              <button
                type="button"
                onClick={() => setVegOnly(!vegOnly)}
                className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors border cursor-pointer ${
                  vegOnly
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                    : 'bg-white border-[#EFE7DD] text-[#553E32] hover:bg-[#FAF6F0]'
                }`}
              >
                <div className="w-3.5 h-3.5 border-2 border-emerald-600 flex items-center justify-center p-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                </div>
                <span>Veg Only</span>
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="sticky top-14 z-20 bg-[#FAF8F5]/95 backdrop-blur-xs py-2 -mx-4 px-4 overflow-x-auto no-scrollbar border-b border-[#EFE7DD] flex gap-2">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === 'ALL'
                  ? 'bg-[#2D1B14] text-[#FDFBF7] shadow-xs'
                  : 'bg-white text-[#705648] hover:text-[#2A1810] border border-[#EFE7DD]'
              }`}
            >
              <CoffeeBeanIcon size={14} className={selectedCategory === 'ALL' ? 'text-[#E6AA68]' : 'text-[#8C7667]'} />
              <span>Full Artisanal Menu</span>
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-[#2D1B14] text-[#FDFBF7] shadow-xs'
                    : 'bg-white text-[#705648] hover:text-[#2A1810] border border-[#EFE7DD]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Menu Items Grid */}
          {filteredItems.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-3xl border border-[#EFE7DD] p-6">
              <div className="w-12 h-12 rounded-full bg-[#FAF3EA] text-[#C87D32] flex items-center justify-center mx-auto mb-3">
                <CoffeeBeanIcon size={20} />
              </div>
              <h4 className="font-bold text-[#2A1810] text-sm">No items found</h4>
              <p className="text-xs text-[#705648] mt-1">Try resetting the search or category filters.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setVegOnly(false);
                  setSelectedCategory('ALL');
                }}
                className="mt-3 text-xs font-bold text-[#C87D32] underline cursor-pointer"
              >
                View Full Menu
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map(item => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  currency={cafe.currency}
                  onSelect={handleItemSelect}
                />
              ))}
            </div>
          )}
        </main>
      )}

      {/* Floating Bottom Cart Bar for Mobile & Desktop when cart has items */}
      {cartItems.length > 0 && !isCartOpen && (!currentOrder || currentOrder.payment_status !== 'PAID') && (
        <div className="fixed bottom-4 inset-x-0 z-40 px-4 pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto">
            <button
              onClick={() => setIsCartOpen(true)}
              className="w-full p-4 bg-[#2D1B14] text-[#FDFBF7] rounded-2xl shadow-xl flex items-center justify-between active:scale-98 transition-transform cursor-pointer border border-[#43281C]"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#C87D32] text-white flex items-center justify-center font-black text-xs shadow-xs">
                  {cartTotalItems}
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold block leading-tight text-[#FDFBF7]">View Dine-In Order</span>
                  <span className="text-[11px] text-[#D5C2B5]">
                    Table #{tableNumber} · Review &amp; Pay
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-sm font-black text-[#E6AA68]">
                  {cafe.currency}{cartSubtotal.toFixed(2)}
                </span>
                <span className="block text-[10px] text-[#D5C2B5]">Proceed →</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Modals & Drawers */}
      <ItemCustomizerModal
        item={customizingItem}
        isOpen={Boolean(customizingItem)}
        currency={cafe.currency}
        onClose={() => setCustomizingItem(null)}
        onAddToCart={handleCustomizerAdd}
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => {
          setIsCartOpen(false);
          setCheckoutError(null);
        }}
        cafe={cafe}
        tableNumber={tableNumber}
        cartItems={cartItems}
        customer={customer}
        checkoutError={checkoutError}
        isSubmitting={isCheckingOut}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveCartItem}
        onCheckout={handleCheckout}
      />

      <CoffeePassModal
        isOpen={isLoyaltyOpen}
        onClose={() => setIsLoyaltyOpen(false)}
        customerName={customer?.name}
        onApplyPromo={code => {
          setIsCartOpen(true);
        }}
      />

      <RazorpayModal
        isOpen={isRazorpayOpen}
        order={currentOrder}
        cafe={cafe}
        onClose={() => setIsRazorpayOpen(false)}
        onSuccess={handlePaymentSuccess}
      />

      <CustomerProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        customer={customer}
        cafe={cafe}
        initialTab={profileModalTab}
        onOpenAuth={mode => openAuthModal(mode)}
        onLogout={logout}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        initialMode={authModalMode}
      />

      <CallWaiterModal
        isOpen={isCallWaiterOpen}
        onClose={() => setIsCallWaiterOpen(false)}
        tableNumber={tableNumber}
        tableId={cafe.id}
      />
    </div>
  );
};
