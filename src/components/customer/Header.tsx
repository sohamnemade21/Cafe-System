import React, { useState, useRef, useEffect } from 'react';
import { Cafe, Customer } from '../../types';
import {
  ShoppingBag,
  Bell,
  Receipt,
  User as UserIcon,
  Gift,
  LogIn,
  LogOut,
  UserPlus,
  ChevronDown,
  ShieldCheck,
  Clock,
  Sparkles,
} from 'lucide-react';

interface HeaderProps {
  cafe: Cafe;
  tableNumber?: number | null;
  cartCount: number;
  customer: Customer | null;
  onOpenCart: () => void;
  onCallWaiter: () => void;
  onRequestBill: () => void;
  onOpenProfile: (tab?: 'profile' | 'orders') => void;
  onOpenLoyalty?: () => void;
  onOpenLogin?: () => void;
  onOpenSignup?: () => void;
  onLogout?: () => void;
  onScanQr?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  cafe,
  tableNumber,
  cartCount,
  customer,
  onOpenCart,
  onCallWaiter,
  onRequestBill,
  onOpenProfile,
  onOpenLoyalty,
  onOpenLogin,
  onOpenSignup,
  onLogout,
  onScanQr,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  return (
    <header className="sticky top-0 z-30 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-[#EFE7DD] shadow-[0_1px_3px_rgba(42,24,16,0.03)]">
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Left: Brand info & Table */}
        <div className="flex items-center gap-3 min-w-0">
          {cafe.logo_url && (
            <img
              src={cafe.logo_url}
              alt={cafe.name}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200&auto=format&fit=crop&q=80';
              }}
              className="w-9 h-9 rounded-xl object-cover border border-[#EFE7DD] shadow-xs shrink-0"
            />
          )}
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-serif font-bold text-[#2A1810] truncate leading-tight tracking-tight">
              {cafe.name}
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-[#705648] font-medium">
              {tableNumber ? (
                <span className="text-[#C87D32] font-bold">Table #{tableNumber}</span>
              ) : (
                <button
                  onClick={onScanQr}
                  className="text-amber-800 font-semibold bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>Scan Table QR</span>
                </button>
              )}
              <span aria-hidden="true">•</span>
              <span className="truncate">{cafe.currency} Dine-In</span>
            </div>
          </div>
        </div>

        {/* Right: Actions & Authentication */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Coffee Pass / Loyalty Perk shortcut */}
          {onOpenLoyalty && (
            <button
              onClick={onOpenLoyalty}
              title="Roastery Coffee Pass"
              className="hidden md:flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#8C5E3B] bg-[#FAF3EA] hover:bg-[#F5E8D8] border border-[#EFE2D3] rounded-xl transition-colors cursor-pointer"
            >
              <Gift className="w-3.5 h-3.5 text-[#C87D32]" />
              <span>Pass</span>
            </button>
          )}

          {/* Call Waiter */}
          <button
            onClick={onCallWaiter}
            title="Call Waiter"
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-xs font-semibold text-[#553E32] bg-[#FAF6F0] hover:bg-[#EFE5D8] border border-[#EFE7DD] rounded-xl transition-colors cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5 text-[#705648]" />
            <span className="hidden sm:inline">Waiter</span>
          </button>

          {/* Request Bill */}
          <button
            onClick={onRequestBill}
            title="Request Bill"
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-xs font-semibold text-[#553E32] bg-[#FAF6F0] hover:bg-[#EFE5D8] border border-[#EFE7DD] rounded-xl transition-colors cursor-pointer"
          >
            <Receipt className="w-3.5 h-3.5 text-[#705648]" />
            <span className="hidden sm:inline">Bill</span>
          </button>

          {/* ==================================================== */}
          {/* AUTHENTICATION SECTION (Requirement #1 & #2)         */}
          {/* ==================================================== */}
          {customer ? (
            // AUTHENTICATED STATE: Profile/Avatar Icon with rich Dropdown Menu
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                title={`Account: ${customer.name}`}
                className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1.5 text-xs font-bold text-[#2A1810] bg-[#FAF3EA] hover:bg-[#F5E8D8] border border-[#EFE2D3] rounded-xl transition-all cursor-pointer shadow-2xs"
                aria-expanded={isDropdownOpen}
              >
                {customer.profile_image ? (
                  <img
                    src={customer.profile_image}
                    alt={customer.name}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80';
                    }}
                    className="w-6 h-6 rounded-full object-cover border border-[#D8B48D] shrink-0"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[#EFE2D3] text-[#705648] flex items-center justify-center font-bold text-[11px] shrink-0">
                    {customer.name ? customer.name.charAt(0).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
                  </div>
                )}
                <span className="hidden sm:inline max-w-[110px] truncate">{customer.name.split(' ')[0]}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-[#8A7365] transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-[#EFE2D3] shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {/* Customer Identity Banner */}
                  <div className="p-2.5 bg-[#FAF8F5] rounded-xl border border-[#EFE7DD] mb-1.5">
                    <div className="flex items-center gap-2.5">
                      {customer.profile_image ? (
                        <img
                          src={customer.profile_image}
                          alt={customer.name}
                          className="w-9 h-9 rounded-xl object-cover border border-[#EFE2D3] shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-[#FAF3EA] border border-[#EFE2D3] text-[#C87D32] flex items-center justify-center font-bold text-sm shrink-0">
                          {customer.name ? customer.name.charAt(0).toUpperCase() : <UserIcon size={16} />}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-extrabold text-[#2A1810] truncate">{customer.name}</p>
                          <span title="Verified Customer" className="inline-flex shrink-0">
                            <ShieldCheck size={13} className="text-emerald-600" />
                          </span>
                        </div>
                        <p className="text-[11px] text-[#8A7365] truncate">{customer.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#EFE2D3] text-[10px]">
                      <span className="text-[#8A7365]">Total Dine-in Orders:</span>
                      <span className="font-bold text-[#C87D32]">{customer.total_orders || 0}</span>
                    </div>
                  </div>

                  {/* Menu Item 1: Profile / Edit Details */}
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onOpenProfile('profile');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-[#2A1810] hover:bg-[#FAF3EA] rounded-xl transition-colors cursor-pointer text-left"
                  >
                    <UserIcon className="w-4 h-4 text-[#C87D32]" />
                    <span>Profile / Edit Details</span>
                  </button>

                  {/* Menu Item 2: Order History */}
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onOpenProfile('orders');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-[#2A1810] hover:bg-[#FAF3EA] rounded-xl transition-colors cursor-pointer text-left"
                  >
                    <Clock className="w-4 h-4 text-[#C87D32]" />
                    <span>Order History & Invoices</span>
                  </button>

                  {/* Menu Item 3: Coffee Pass (if available) */}
                  {onOpenLoyalty && (
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onOpenLoyalty();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-[#2A1810] hover:bg-[#FAF3EA] rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <Sparkles className="w-4 h-4 text-[#C87D32]" />
                      <span>Roastery Rewards Pass</span>
                    </button>
                  )}

                  <div className="my-1 border-t border-[#EFE7DD]" />

                  {/* Menu Item 4: Logout */}
                  {onLogout && (
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <LogOut className="w-4 h-4 text-red-600" />
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            // LOGGED-OUT STATE: Clear [ Login ] and [ Sign Up ] buttons
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                onClick={onOpenLogin || (() => onOpenProfile('profile'))}
                title="Customer Login"
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#2A1810] bg-[#FAF6F0] hover:bg-[#EFE5D8] border border-[#EFE7DD] rounded-xl transition-colors cursor-pointer shadow-2xs"
              >
                <LogIn className="w-3.5 h-3.5 text-[#705648]" />
                <span>Login</span>
              </button>

              <button
                onClick={onOpenSignup || (() => onOpenProfile('profile'))}
                title="Customer Sign Up"
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-[#C87D32] hover:bg-[#B36B28] rounded-xl transition-colors cursor-pointer shadow-xs active:scale-95"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Up</span>
              </button>
            </div>
          )}

          {/* Cart Trigger */}
          <button
            onClick={onOpenCart}
            className="relative flex items-center justify-center p-2 sm:p-2.5 bg-[#2D1B14] hover:bg-[#3E271D] text-[#FDFBF7] rounded-xl transition-transform active:scale-95 cursor-pointer shadow-sm ml-0.5"
            aria-label="View Cart"
          >
            <ShoppingBag className="w-4 h-4 text-[#E6AA68]" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#C87D32] text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
