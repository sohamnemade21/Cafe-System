import React, { useState, useMemo } from 'react';
import { MenuItem, MenuItemVariant } from '../../types';
import { Modal } from '../common/Modal';
import { Minus, Plus, Sparkles, Check } from 'lucide-react';
import { CoffeeSteam } from '../common/CoffeeSteam';

interface ItemCustomizerModalProps {
  item: MenuItem | null;
  isOpen: boolean;
  currency: string;
  onClose: () => void;
  onAddToCart: (
    item: MenuItem,
    quantity: number,
    selectedVariants: MenuItemVariant[],
    notes: string,
    totalPrice: number
  ) => void;
}

export const ItemCustomizerModal: React.FC<ItemCustomizerModalProps> = ({
  item,
  isOpen,
  currency,
  onClose,
  onAddToCart,
}) => {
  if (!item) return null;

  const [quantity, setQuantity] = useState(1);
  const [selectedVariants, setSelectedVariants] = useState<MenuItemVariant[]>(() => {
    // Default select first size if available
    const sizeVariants = item.variants?.filter(v => v.type === 'SIZE') || [];
    return sizeVariants.length > 0 ? [sizeVariants[0]] : [];
  });
  const [sweetness, setSweetness] = useState<string>('Standard');
  const [notes, setNotes] = useState('');

  const isBeverage = item.category_id === 'cat-coffee' || item.category_id === 'cat-tea';

  // Group variants by type
  const groupedVariants = useMemo(() => {
    const groups: Record<string, MenuItemVariant[]> = {};
    (item.variants || []).forEach(v => {
      const typeKey = v.type || 'OPTION';
      if (!groups[typeKey]) groups[typeKey] = [];
      groups[typeKey].push(v);
    });
    return groups;
  }, [item]);

  // Handle single choice (e.g. SIZE)
  const handleSingleSelect = (variant: MenuItemVariant) => {
    setSelectedVariants(prev => {
      const filtered = prev.filter(v => v.type !== variant.type);
      return [...filtered, variant];
    });
  };

  // Handle multiple choice (e.g. ADDON)
  const handleMultiToggle = (variant: MenuItemVariant) => {
    setSelectedVariants(prev => {
      const exists = prev.some(v => v.name === variant.name);
      if (exists) {
        return prev.filter(v => v.name !== variant.name);
      } else {
        return [...prev, variant];
      }
    });
  };

  // Calculate unit price with variants
  const unitPriceWithVariants = useMemo(() => {
    const additions = selectedVariants.reduce((sum, v) => sum + v.additional_price, 0);
    return item.price + additions;
  }, [item.price, selectedVariants]);

  const totalPrice = unitPriceWithVariants * quantity;

  const handleConfirm = () => {
    const finalNotes = [
      isBeverage && sweetness !== 'Standard' ? `Sweetness: ${sweetness}` : null,
      notes.trim() || null
    ].filter(Boolean).join(' · ');

    onAddToCart(item, quantity, selectedVariants, finalNotes, totalPrice);
    setQuantity(1);
    setNotes('');
    setSweetness('Standard');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item.name} maxWidth="max-w-md">
      <div className="space-y-4">
        {/* Item Header Banner */}
        <div className="flex items-start gap-3.5 bg-[#FAF6F0] p-3 rounded-2xl border border-[#EFE5D8]">
          <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-[#E3D4C4]">
            <img
              src={item.image_url}
              alt={item.name}
              className="w-full h-full object-cover"
            />
            {isBeverage && !item.name.toLowerCase().includes('iced') && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none">
                <CoffeeSteam size="sm" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-[#2A1810] text-sm leading-tight line-clamp-1">{item.name}</h4>
              <span className="font-extrabold text-[#2A1810] text-sm">
                {currency}{item.price}
              </span>
            </div>
            <p className="text-[11px] text-[#705648] mt-1 leading-relaxed line-clamp-2">
              {item.description}
            </p>
            {item.calories && (
              <span className="inline-block text-[10px] text-[#A89284] mt-1 font-medium">
                Est. {item.calories} kcal
              </span>
            )}
          </div>
        </div>

        {/* Variant Groups (Size, Milk, Addons) */}
        {Object.entries(groupedVariants).map(([groupType, variants]) => {
          const isSingleChoice = groupType === 'SIZE' || groupType === 'OPTION';
          const groupTitle =
            groupType === 'SIZE'
              ? 'Cup / Portion Size'
              : groupType === 'ADDON'
              ? 'Add-ons & Premium Milk'
              : 'Barista Options';

          return (
            <div key={groupType} className="border-t border-[#EFE7DD] pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#4A2E1B] tracking-wide uppercase">
                  {groupTitle}
                </span>
                <span className="text-[11px] text-[#8C7667]">
                  {isSingleChoice ? 'Select one' : 'Optional'}
                </span>
              </div>

              <div className="space-y-1.5">
                {variants.map(variant => {
                  const isSelected = selectedVariants.some(v => v.name === variant.name);

                  return (
                    <button
                      type="button"
                      key={variant.id || variant.name}
                      onClick={() =>
                        isSingleChoice ? handleSingleSelect(variant) : handleMultiToggle(variant)
                      }
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-medium transition-all text-left cursor-pointer ${
                        isSelected
                          ? 'border-[#C87D32] bg-[#FAF3EA] text-[#2A1810] shadow-xs'
                          : 'border-[#EFE7DD] hover:border-[#D8B48D] text-[#553E32] bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded-${
                            isSingleChoice ? 'full' : 'md'
                          } border flex items-center justify-center transition-all ${
                            isSelected
                              ? 'border-[#C87D32] bg-[#C87D32] text-white'
                              : 'border-[#D8B48D]'
                          }`}
                        >
                          {isSelected && (
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          )}
                        </div>
                        <span className="font-medium">{variant.name}</span>
                      </div>

                      <span className="text-[#8C7667] font-semibold text-[11px]">
                        {variant.additional_price > 0
                          ? `+${currency}${variant.additional_price}`
                          : 'Included'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Beverage Sweetness Customization */}
        {isBeverage && (
          <div className="border-t border-[#EFE7DD] pt-3">
            <span className="block text-xs font-bold text-[#4A2E1B] tracking-wide uppercase mb-2">
              Sweetness Preference
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {['Zero Sugar', 'Less Sweet', 'Standard', 'Extra Sweet'].map(level => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setSweetness(level)}
                  className={`py-1.5 px-1 rounded-xl text-[11px] font-semibold transition-all border text-center cursor-pointer ${
                    sweetness === level
                      ? 'border-[#C87D32] bg-[#FAF3EA] text-[#2A1810] shadow-xs'
                      : 'border-[#EFE7DD] text-[#705648] bg-white hover:border-[#D8B48D]'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Special Instructions */}
        <div className="border-t border-[#EFE7DD] pt-3">
          <label className="block text-xs font-bold text-[#4A2E1B] mb-1.5">
            Special Barista / Kitchen Instructions
          </label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Extra hot, light foam, separate dressing"
            className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#EFE7DD] focus:outline-hidden focus:border-[#C87D32] focus:ring-1 focus:ring-[#C87D32] transition-all placeholder:text-[#A89284] bg-white text-[#2A1810]"
          />
        </div>

        {/* Quantity & Confirm Footer */}
        <div className="border-t border-[#EFE7DD] pt-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center border border-[#EFE7DD] rounded-xl p-1 bg-[#FAF6F0]">
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="p-1.5 rounded-lg text-[#553E32] hover:bg-white disabled:opacity-30 cursor-pointer transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-8 text-center text-xs font-bold text-[#2A1810]">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(q => q + 1)}
              className="p-1.5 rounded-lg text-[#553E32] hover:bg-white cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleConfirm}
            className="flex-1 py-3 px-4 rounded-xl bg-[#2D1B14] hover:bg-[#3E271D] text-[#FDFBF7] font-bold text-xs tracking-wide transition-all active:scale-98 shadow-sm flex items-center justify-between cursor-pointer"
          >
            <span>ADD TO ORDER</span>
            <span className="text-[#E6AA68] font-extrabold">{currency}{totalPrice.toFixed(2)}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
