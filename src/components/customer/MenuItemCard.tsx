import React from 'react';
import { MenuItem } from '../../types';
import { CoffeeSteam } from '../common/CoffeeSteam';
import { Plus, Clock, Star, Flame, Award, Sparkles } from 'lucide-react';

interface MenuItemCardProps {
  item: MenuItem;
  currency: string;
  onSelect: (item: MenuItem) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (itemId: string) => void;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({
  item,
  currency,
  onSelect,
}) => {
  const isHotCoffee = item.category_id === 'cat-coffee' && !item.name.toLowerCase().includes('iced') && !item.name.toLowerCase().includes('cold');

  return (
    <div className="group relative bg-[#FFFFFF] rounded-2xl border border-[#EFE7DD] hover:border-[#D8B48D] p-3.5 sm:p-4 transition-all duration-300 shadow-[0_2px_8px_rgba(42,24,16,0.04)] hover:shadow-[0_8px_20px_rgba(42,24,16,0.08)] flex flex-col justify-between">
      <div>
        {/* Image Container with indicators */}
        <div className="relative aspect-4/3 w-full rounded-xl overflow-hidden bg-[#F5EFEB] mb-3">
          <img
            src={item.image_url}
            alt={item.name}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80';
            }}
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-106 ${
              !item.is_available ? 'grayscale opacity-60' : ''
            }`}
            loading="lazy"
          />

          {/* Gentle steam effect on hot coffee cards when hovered */}
          {isHotCoffee && item.is_available && (
            <div className="absolute top-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
              <CoffeeSteam size="sm" />
            </div>
          )}

          {/* Veg / Non-Veg Indicator */}
          <div className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-xs p-1 rounded-md shadow-xs flex items-center justify-center border border-stone-100">
            {item.is_veg ? (
              <div className="w-3.5 h-3.5 border-2 border-emerald-600 flex items-center justify-center p-0.5" title="Pure Vegetarian">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              </div>
            ) : (
              <div className="w-3.5 h-3.5 border-2 border-rose-600 flex items-center justify-center p-0.5" title="Contains Egg / Meat">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-600" />
              </div>
            )}
          </div>

          {/* Badges on Top Right */}
          <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 items-end">
            {item.is_chef_special && (
              <span className="bg-[#2D1B14] text-[#E6AA68] font-bold text-[10px] px-2 py-0.5 rounded-md shadow-sm uppercase tracking-wider flex items-center gap-1 border border-[#523528]">
                <Award className="w-2.5 h-2.5" /> Chef&apos;s Special
              </span>
            )}
            {item.is_bestseller && !item.is_chef_special && (
              <span className="bg-[#C87D32] text-white font-bold text-[10px] px-2 py-0.5 rounded-md shadow-xs uppercase tracking-wider">
                Bestseller
              </span>
            )}
            {item.is_seasonal && (
              <span className="bg-[#556B2F] text-white font-bold text-[10px] px-2 py-0.5 rounded-md shadow-xs uppercase tracking-wider flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> Seasonal
              </span>
            )}
            {item.is_spicy && (
              <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                <Flame className="w-2.5 h-2.5" /> Mild Spice
              </span>
            )}
          </div>

          {/* Sold Out Overlay */}
          {!item.is_available && (
            <div className="absolute inset-0 bg-[#2A1810]/60 backdrop-blur-xs flex items-center justify-center">
              <span className="bg-[#2A1810] text-[#EFE7DD] text-xs font-semibold px-3 py-1 rounded-lg border border-[#523528]">
                86 / Sold Out
              </span>
            </div>
          )}
        </div>

        {/* Item Title & Rating */}
        <div className="mb-2.5">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-bold text-[#2A1810] text-sm sm:text-base leading-snug group-hover:text-[#B45309] transition-colors line-clamp-1">
              {item.name}
            </h3>
          </div>

          {/* Rating and Reviews */}
          <div className="flex items-center gap-2 text-xs mb-1.5">
            <div className="flex items-center gap-1 text-[#B45309] font-bold text-[11px]">
              <Star className="w-3.5 h-3.5 fill-[#C87D32] text-[#C87D32]" />
              <span>{item.rating || 4.9}</span>
            </div>
            {item.review_count && (
              <span className="text-[11px] text-[#8C7667]">
                ({item.review_count})
              </span>
            )}
            {item.calories && (
              <>
                <span className="text-stone-300">•</span>
                <span className="text-[11px] text-[#8C7667]">
                  {item.calories} kcal
                </span>
              </>
            )}
          </div>

          <p className="text-xs text-[#705648] line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        </div>
      </div>

      {/* Footer: Price & Add Button */}
      <div className="pt-2.5 border-t border-[#EFE7DD] flex items-center justify-between mt-auto">
        <div>
          <span className="text-xs text-[#8C7667] font-semibold">{currency}</span>
          <span className="text-base font-extrabold text-[#2A1810] ml-0.5">
            {item.price}
          </span>
          {item.variants && item.variants.length > 0 && (
            <span className="block text-[10px] text-[#C87D32] font-semibold">
              Customizable options
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {item.preparation_time_minutes && (
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-[#8C7667] font-medium">
              <Clock className="w-3 h-3 text-[#A89284]" /> {item.preparation_time_minutes}m
            </span>
          )}

          <button
            onClick={() => onSelect(item)}
            disabled={!item.is_available}
            className={`flex items-center gap-1 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-xs ${
              item.is_available
                ? 'bg-[#2D1B14] hover:bg-[#3E271D] text-[#FDFBF7]'
                : 'bg-stone-100 text-stone-400 cursor-not-allowed'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ADD</span>
          </button>
        </div>
      </div>
    </div>
  );
};
