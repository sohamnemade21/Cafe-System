import React from 'react';
import { Cafe } from '../../types';
import { CoffeeSteam } from '../common/CoffeeSteam';
import { CoffeeBeanIcon } from '../common/CoffeeBeanIcon';
import { Sparkles, Wifi, Clock, ArrowDown, Award, Gift } from 'lucide-react';

interface CafeHeroProps {
  cafe: Cafe;
  tableNumber?: number | null;
  onExploreMenu: () => void;
  onOpenLoyalty: () => void;
  onScanQr?: () => void;
}

export const CafeHero: React.FC<CafeHeroProps> = ({
  cafe,
  tableNumber,
  onExploreMenu,
  onOpenLoyalty,
  onScanQr,
}) => {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#2D1B14] text-[#FDFBF7] shadow-lg border border-[#3E271D] mb-6">
      {/* Background ambient warm textures & subtle glowing lights */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(200,125,50,0.25),transparent_60%)] pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-[#C87D32]/10 blur-3xl pointer-events-none" />

      {/* Floating decorative coffee beans */}
      <div className="absolute top-4 right-16 text-[#C87D32]/25 animate-float pointer-events-none">
        <CoffeeBeanIcon size={24} />
      </div>
      <div className="absolute bottom-6 left-1/3 text-[#C87D32]/20 animate-float-slow pointer-events-none">
        <CoffeeBeanIcon size={20} />
      </div>

      <div className="relative z-10 px-5 py-6 sm:px-8 sm:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        {/* Left text & branding */}
        <div className="space-y-3.5 max-w-xl">
          {/* Table & Roast Badge */}
          <div className="flex flex-wrap items-center gap-2">
            {tableNumber ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-[#3E271D] text-[#EFE7DD] border border-[#523528]">
                <span className="w-2 h-2 rounded-full bg-[#C87D32] animate-pulse" />
                Table #{tableNumber} · Dine-In
              </span>
            ) : (
              <button
                onClick={onScanQr}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-amber-500/20 text-amber-200 border border-amber-500/40 hover:bg-amber-500/30 transition-colors cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Scan Table QR to Order
              </button>
            )}

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#3A241A] text-[#D8B48D] border border-[#523528]">
              <Clock className="w-3 h-3 text-[#C87D32]" />
              Brewing Fresh Now
            </span>
          </div>

          {/* Master Headline */}
          <div>
            <h1 className="font-serif-cafe text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[#FDFBF7] leading-tight">
              Your Coffee. <br className="hidden sm:inline" />
              <span className="text-[#E6AA68] italic">Your Moment.</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#D5C2B5] mt-1.5 font-normal leading-relaxed">
              Single-origin beans freshly ground per cup, artisan Viennoiserie, and handcrafted hearth dishes delivered straight to your table.
            </p>
          </div>

          {/* Today's Roast Tasting Notes */}
          <div className="bg-[#24150F]/80 backdrop-blur-xs rounded-2xl p-3 border border-[#3E271D] flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#3E271D] flex items-center justify-center text-[#E6AA68] shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-[11px] min-w-0">
              <span className="text-[#A89284] block font-medium">Today&apos;s Single-Estate Roast</span>
              <span className="text-[#FDFBF7] font-semibold truncate block">
                Chikmagalur Arabica · Honey Sun-Dried · Hazelnut &amp; Cacao
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={onExploreMenu}
              className="px-5 py-2.5 rounded-xl bg-[#C87D32] hover:bg-[#B46D29] text-[#FDFBF7] font-bold text-xs flex items-center gap-2 shadow-md transition-all active:scale-98 cursor-pointer"
            >
              <span>Explore Artisanal Menu</span>
              <ArrowDown className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onOpenLoyalty}
              className="px-4 py-2.5 rounded-xl bg-[#3E271D] hover:bg-[#4E3225] text-[#EFE7DD] border border-[#5A3A2C] font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Gift className="w-3.5 h-3.5 text-[#E6AA68]" />
              <span>Roastery Coffee Pass</span>
            </button>
          </div>
        </div>

        {/* Right side: Cup imagery with rising steam & live info */}
        <div className="relative flex flex-col items-center justify-center shrink-0">
          <div className="relative group">
            {/* Steam rising effect placed precisely above cup */}
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-20">
              <CoffeeSteam size="lg" />
            </div>

            {/* Cup photo showcase */}
            <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden border-2 border-[#523528] shadow-2xl relative">
              <img
                src="https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=80"
                alt="Velvet Cappuccino"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#2D1B14]/80 via-transparent to-transparent" />
              <div className="absolute bottom-2 inset-x-2 text-center">
                <span className="text-[10px] uppercase font-black tracking-widest text-[#E6AA68] bg-[#24150F]/90 px-2 py-0.5 rounded-md border border-[#3E271D]">
                  Signature Brew
                </span>
              </div>
            </div>
          </div>

          {/* Wi-Fi & Lounge Info beneath cup */}
          <div className="mt-3 flex items-center gap-3 text-[11px] text-[#A89284]">
            <div className="flex items-center gap-1">
              <Wifi className="w-3 h-3 text-[#C87D32]" />
              <span>WiFi: <strong className="text-[#EFE7DD] font-medium">RoastedBean_5G</strong></span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Award className="w-3 h-3 text-[#C87D32]" />
              <span>100% Specialty Grade</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
