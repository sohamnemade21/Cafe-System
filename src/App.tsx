import React, { useState, useEffect } from 'react';
import { Cafe, StaffUser } from './types';
import { api } from './services/api';
import { CustomerMenu } from './pages/CustomerMenu';
import { KitchenDisplay } from './components/kitchen/KitchenDisplay';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { ReceptionDashboard } from './components/admin/ReceptionDashboard';
import { StaffLoginModal } from './components/common/StaffLoginModal';
import { CustomerAuthProvider } from './context/CustomerAuthContext';
import { Smartphone, ChefHat, LayoutDashboard, Store, Receipt, ShieldCheck, LogIn, LogOut } from 'lucide-react';
import { CoffeeBeanIcon } from './components/common/CoffeeBeanIcon';

export default function App() {
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null);
  const [currentMode, setCurrentMode] = useState<'customer' | 'reception' | 'kds' | 'admin'>('customer');
  const [selectedTableNumber, setSelectedTableNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Authenticated Staff state
  const [currentStaff, setCurrentStaff] = useState<StaffUser | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pendingTargetMode, setPendingTargetMode] = useState<'reception' | 'kds' | 'admin' | null>(null);

  // Check existing session & parse URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    const tableParam = params.get('table');

    if (modeParam === 'admin' || modeParam === 'kds' || modeParam === 'reception' || modeParam === 'customer') {
      setCurrentMode(modeParam as any);
    }
    if (tableParam) {
      const parsed = parseInt(tableParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        setSelectedTableNumber(parsed);
      } else {
        setSelectedTableNumber(null);
      }
    } else {
      setSelectedTableNumber(null);
    }

    // Try restoring staff session if token exists
    const token = api.getStaffToken();
    if (token) {
      api.getStaffMe()
        .then(user => {
          setCurrentStaff(user);
        })
        .catch(() => {
          api.staffLogout();
          setCurrentStaff(null);
        });
    }

    // Load available cafes
    api.getCafes()
      .then(res => {
        setCafes(res);
        if (res.length > 0) {
          const cafeSlugParam = params.get('cafe');
          const matched = res.find(c => c.slug === cafeSlugParam || c.id === cafeSlugParam);
          setSelectedCafe(matched || res[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleModeChange = (mode: 'customer' | 'reception' | 'kds' | 'admin', table?: number | null) => {
    if (table !== undefined) setSelectedTableNumber(table);

    // Customer mode is always unrestricted
    if (mode === 'customer') {
      setCurrentMode('customer');
      updateUrl('customer', selectedCafe?.slug, table !== undefined ? table : selectedTableNumber);
      return;
    }

    // Role-based protection: Check if user is authenticated with correct role
    if (!currentStaff) {
      setPendingTargetMode(mode);
      setIsLoginModalOpen(true);
      return;
    }

    // Check specific role authorization
    const role = currentStaff.role;
    const isOwnerOrManager = role === 'CAFE_OWNER' || role === 'MANAGER' || role === 'SUPER_ADMIN';

    if (mode === 'reception' && (role === 'RECEPTION' || isOwnerOrManager)) {
      setCurrentMode('reception');
      updateUrl('reception', selectedCafe?.slug, table !== undefined ? table : selectedTableNumber);
      return;
    }

    if (mode === 'kds' && (role === 'KITCHEN_STAFF' || isOwnerOrManager)) {
      setCurrentMode('kds');
      updateUrl('kds', selectedCafe?.slug, table !== undefined ? table : selectedTableNumber);
      return;
    }

    if (mode === 'admin' && isOwnerOrManager) {
      setCurrentMode('admin');
      updateUrl('admin', selectedCafe?.slug, table !== undefined ? table : selectedTableNumber);
      return;
    }

    // If logged in with different role, open modal to switch role
    setPendingTargetMode(mode);
    setIsLoginModalOpen(true);
  };

  const updateUrl = (mode: string, cafeSlug?: string, table?: number | null) => {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', mode);
    if (cafeSlug) url.searchParams.set('cafe', cafeSlug);
    if (table) {
      url.searchParams.set('table', String(table));
    } else {
      url.searchParams.delete('table');
    }
    window.history.pushState({}, '', url.toString());
  };

  const handleLoginSuccess = (user: StaffUser) => {
    setCurrentStaff(user);

    // Match cafe if user belongs to specific cafe
    if (user.cafe_id) {
      const userCafe = cafes.find(c => c.id === user.cafe_id);
      if (userCafe) {
        setSelectedCafe(userCafe);
      }
    }

    const target = pendingTargetMode || (user.role === 'RECEPTION' ? 'reception' : user.role === 'KITCHEN_STAFF' ? 'kds' : 'admin');
    setCurrentMode(target);
    updateUrl(target, selectedCafe?.slug, selectedTableNumber);
    setPendingTargetMode(null);
  };

  const handleStaffLogout = () => {
    api.staffLogout();
    setCurrentStaff(null);
    setCurrentMode('customer');
    updateUrl('customer', selectedCafe?.slug, selectedTableNumber);
  };

  if (loading || !selectedCafe) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#FAF3EA] border border-[#EFE2D3] flex items-center justify-center text-[#C87D32] animate-bounce mx-auto">
            <CoffeeBeanIcon size={24} />
          </div>
          <p className="text-xs font-bold text-[#2A1810]">Warming up roastery tables & security...</p>
        </div>
      </div>
    );
  }

  return (
    <CustomerAuthProvider>
      <div className="min-h-screen flex flex-col bg-[#FAF8F5]">
      {/* Top Universal Mode Switcher Navigation bar */}
      <div className="bg-[#20120B] text-[#D5C2B5] px-4 py-2 text-xs flex items-center justify-between border-b border-[#361E13] z-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold tracking-tight text-[#FDFBF7]">
            <CoffeeBeanIcon size={16} className="text-[#C87D32]" />
            <span>QRDine Platform</span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-[#A89284] text-[11px]">
            <Store className="w-3.5 h-3.5 text-[#C87D32]" />
            <span>Active Roastery:</span>
            <span className="font-semibold text-[#FDFBF7]">{selectedCafe.name}</span>
          </div>

          {currentStaff && (
            <div className="flex items-center gap-1.5">
              <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#C87D32]/25 text-[#E0A868] border border-[#C87D32]/40">
                <ShieldCheck size={11} />
                <span>{currentStaff.role} ({currentStaff.user_id || currentStaff.full_name?.split(' ')[0] || currentStaff.email?.split('@')[0] || 'Staff'})</span>
              </span>
              <button
                onClick={handleStaffLogout}
                className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800 transition-colors cursor-pointer"
                title="Log out from staff portal"
              >
                <LogOut size={10} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>

        {/* View Switchers */}
        <div className="flex items-center gap-1 bg-[#180C07] p-1 rounded-xl border border-[#361E13]">
          {/* Customer Table Ordering */}
          <button
            onClick={() => handleModeChange('customer', selectedTableNumber)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              currentMode === 'customer'
                ? 'bg-[#C87D32] text-white shadow-xs'
                : 'text-[#A89284] hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Table #{selectedTableNumber} Menu</span>
          </button>

          {/* Dedicated Authenticated Reception Dashboard */}
          <button
            onClick={() => handleModeChange('reception')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              currentMode === 'reception'
                ? 'bg-[#C87D32] text-white shadow-xs'
                : 'text-[#A89284] hover:text-white'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Reception Desk</span>
          </button>

          {/* Kitchen KDS */}
          <button
            onClick={() => handleModeChange('kds')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              currentMode === 'kds'
                ? 'bg-[#C87D32] text-white shadow-xs'
                : 'text-[#A89284] hover:text-white'
            }`}
          >
            <ChefHat className="w-3.5 h-3.5" />
            <span>Kitchen KDS</span>
          </button>

          {/* Owner Portal */}
          <button
            onClick={() => handleModeChange('admin')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              currentMode === 'admin'
                ? 'bg-[#C87D32] text-white shadow-xs'
                : 'text-[#A89284] hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Owner Portal</span>
          </button>
        </div>
      </div>

      {/* Render Current View */}
      <div className="flex-1">
        {currentMode === 'customer' && (
          <CustomerMenu
            cafeSlug={selectedCafe.slug}
            tableNumber={selectedTableNumber}
            onOpenAdmin={() => handleModeChange('admin')}
            onOpenKDS={() => handleModeChange('kds')}
            onTableSelect={(tbl) => {
              setSelectedTableNumber(tbl);
              updateUrl('customer', selectedCafe?.slug, tbl);
            }}
          />
        )}

        {/* RECEPTION PORTAL */}
        {currentMode === 'reception' && (
          currentStaff && (currentStaff.role === 'RECEPTION' || currentStaff.role === 'CAFE_OWNER' || currentStaff.role === 'MANAGER' || currentStaff.role === 'SUPER_ADMIN') ? (
            <ReceptionDashboard
              cafe={selectedCafe}
              currentStaff={currentStaff}
              onLogout={handleStaffLogout}
              onOpenCustomerView={table => handleModeChange('customer', table || 1)}
              onOpenKDS={() => handleModeChange('kds')}
              onOpenAdmin={() => handleModeChange('admin')}
            />
          ) : (
            <div className="min-h-[70vh] flex items-center justify-center p-4">
              <div className="max-w-md w-full text-center space-y-4 bg-white p-8 rounded-3xl border border-[#EFE2D3] shadow-md">
                <div className="w-12 h-12 rounded-2xl bg-[#FAF3EA] text-[#C87D32] flex items-center justify-center mx-auto">
                  <Receipt size={24} />
                </div>
                <h2 className="text-lg font-bold text-[#2D1B14] font-serif">
                  {currentStaff ? 'Reception Access Denied' : 'Reception Authentication Required'}
                </h2>
                <p className="text-xs text-[#8A7365]">
                  {currentStaff
                    ? `Your active role (${currentStaff.role}) does not have permission to access the Reception Desk. Please sign in with authorized Reception credentials.`
                    : 'Front Desk cashier & table billing requires authorized staff credentials with RECEPTION or OWNER role.'}
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => {
                      setPendingTargetMode('reception');
                      setIsLoginModalOpen(true);
                    }}
                    className="px-6 py-2.5 rounded-xl bg-[#C87D32] hover:bg-[#B36B28] text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    {currentStaff ? 'Switch to Reception Account' : 'Sign In to Reception'}
                  </button>
                  <button
                    onClick={() => handleModeChange('customer')}
                    className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Dine-in Menu
                  </button>
                </div>
              </div>
            </div>
          )
        )}

        {/* KITCHEN KDS PORTAL */}
        {currentMode === 'kds' && (
          currentStaff && (currentStaff.role === 'KITCHEN_STAFF' || currentStaff.role === 'CAFE_OWNER' || currentStaff.role === 'MANAGER' || currentStaff.role === 'SUPER_ADMIN') ? (
            <KitchenDisplay
              cafe={selectedCafe}
              onExit={() => handleModeChange('customer')}
              currentStaff={currentStaff}
              onLogout={handleStaffLogout}
            />
          ) : (
            <div className="min-h-[70vh] flex items-center justify-center p-4">
              <div className="max-w-md w-full text-center space-y-4 bg-white p-8 rounded-3xl border border-[#EFE2D3] shadow-md">
                <div className="w-12 h-12 rounded-2xl bg-[#FAF3EA] text-[#C87D32] flex items-center justify-center mx-auto">
                  <ChefHat size={24} />
                </div>
                <h2 className="text-lg font-bold text-[#2D1B14] font-serif">
                  {currentStaff ? 'Kitchen Access Denied' : 'Kitchen KDS Authentication Required'}
                </h2>
                <p className="text-xs text-[#8A7365]">
                  {currentStaff
                    ? `Your active role (${currentStaff.role}) does not have permission to access the Kitchen Display System. Please sign in with Kitchen Lead credentials.`
                    : 'The live Kitchen Display System requires authorized kitchen staff credentials with KITCHEN_STAFF or OWNER role.'}
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => {
                      setPendingTargetMode('kds');
                      setIsLoginModalOpen(true);
                    }}
                    className="px-6 py-2.5 rounded-xl bg-[#C87D32] hover:bg-[#B36B28] text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    {currentStaff ? 'Switch to Kitchen Account' : 'Sign In to Kitchen KDS'}
                  </button>
                  <button
                    onClick={() => handleModeChange('customer')}
                    className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Dine-in Menu
                  </button>
                </div>
              </div>
            </div>
          )
        )}

        {/* OWNER PORTAL */}
        {currentMode === 'admin' && (
          currentStaff && (currentStaff.role === 'CAFE_OWNER' || currentStaff.role === 'MANAGER' || currentStaff.role === 'SUPER_ADMIN') ? (
            <AdminDashboard
              currentCafe={selectedCafe}
              allCafes={cafes}
              currentStaff={currentStaff}
              onLogout={handleStaffLogout}
              onSelectCafe={cafe => {
                setSelectedCafe(cafe);
                const url = new URL(window.location.href);
                url.searchParams.set('cafe', cafe.slug);
                window.history.pushState({}, '', url.toString());
              }}
              onOpenCustomerView={table => handleModeChange('customer', table || 1)}
              onOpenKDS={() => handleModeChange('kds')}
            />
          ) : (
            <div className="min-h-[70vh] flex items-center justify-center p-4">
              <div className="max-w-md w-full text-center space-y-4 bg-white p-8 rounded-3xl border border-[#EFE2D3] shadow-md">
                <div className="w-12 h-12 rounded-2xl bg-[#FAF3EA] text-[#C87D32] flex items-center justify-center mx-auto">
                  <LayoutDashboard size={24} />
                </div>
                <h2 className="text-lg font-bold text-[#2D1B14] font-serif">
                  {currentStaff ? 'Owner Portal Access Denied' : 'Owner Portal Authentication Required'}
                </h2>
                <p className="text-xs text-[#8A7365]">
                  {currentStaff
                    ? `Your active role (${currentStaff.role}) does not have permission to access Owner functions. Kitchen and Reception credentials cannot access the Owner Portal.`
                    : 'Owner dashboard, multi-tenant reports, and cafe settings require verified Owner/Administrator credentials (cafeOwnerAdmin).'}
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => {
                      setPendingTargetMode('admin');
                      setIsLoginModalOpen(true);
                    }}
                    className="px-6 py-2.5 rounded-xl bg-[#C87D32] hover:bg-[#B36B28] text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    {currentStaff ? 'Switch to Owner Account' : 'Sign In as Owner'}
                  </button>
                  <button
                    onClick={() => handleModeChange('customer')}
                    className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Dine-in Menu
                  </button>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* Staff Login Modal */}
      <StaffLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={handleLoginSuccess}
        targetRole={pendingTargetMode === 'reception' ? 'RECEPTION' : pendingTargetMode === 'kds' ? 'KITCHEN_STAFF' : 'CAFE_OWNER'}
        cafeSlug={selectedCafe.slug}
      />
    </div>
  </CustomerAuthProvider>
  );
}
