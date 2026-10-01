import React from 'react';
import { Modal } from '../common/Modal';
import { CoffeeBeanIcon } from '../common/CoffeeBeanIcon';
import { Gift, Sparkles, Clock, CheckCircle2, Award, Calendar, Flame } from 'lucide-react';

interface CoffeePassModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName?: string;
  onApplyPromo?: (code: string) => void;
}

export const CoffeePassModal: React.FC<CoffeePassModalProps> = ({
  isOpen,
  onClose,
  customerName = 'Patron',
  onApplyPromo,
}) => {
  const stamps = [true, true, true, true, false, false]; // 4 of 6 collected

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Roastery Coffee Club & Perks" maxWidth="max-w-md">
      <div className="space-y-5">
        {/* Coffee Pass Digital Stamp Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2D1B14] to-[#43281C] text-[#FDFBF7] p-5 shadow-lg border border-[#523528]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#C87D32]/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between pb-3 border-b border-[#523528]/80">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#D8B48D]">
                Dine-In Loyalty Pass
              </span>
              <h4 className="font-serif-cafe text-base font-bold text-[#FDFBF7]">
                {customerName}&apos;s Brew Card
              </h4>
            </div>
            <div className="w-9 h-9 rounded-xl bg-[#523528] flex items-center justify-center text-[#E6AA68]">
              <Award className="w-5 h-5" />
            </div>
          </div>

          {/* Stamp Grid */}
          <div className="my-4">
            <div className="flex justify-between items-center text-xs text-[#D5C2B5] mb-2 font-medium">
              <span>4 / 6 Stamps Collected</span>
              <span className="text-[#E6AA68] font-bold">2 more for FREE Pour-over</span>
            </div>

            <div className="grid grid-cols-6 gap-2">
              {stamps.map((collected, i) => (
                <div
                  key={i}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center border transition-all ${
                    collected
                      ? 'bg-[#C87D32] border-[#E6AA68] text-white shadow-sm'
                      : 'bg-[#24150F] border-[#523528] text-[#8C7667]'
                  }`}
                >
                  {collected ? (
                    <CoffeeBeanIcon size={18} className="text-[#FDFBF7]" />
                  ) : (
                    <span className="text-xs font-bold font-mono">#{i + 1}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-[#A89284] leading-relaxed">
            Every table order earns 1 bean stamp. Stamp #6 unlocks any specialty handcrafted beverage or Viennoiserie complimentary.
          </p>
        </div>

        {/* Live Offers & Member Privileges */}
        <div className="space-y-3">
          <h5 className="text-xs font-bold uppercase tracking-wider text-[#4A2E1B] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#C87D32]" />
            <span>Active Member Privileges</span>
          </h5>

          {/* Happy hour offer */}
          <div className="p-3.5 rounded-xl bg-[#FDF8F3] border border-[#EFE2D3] flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#F4E3D2] flex items-center justify-center text-[#B45309] shrink-0 mt-0.5">
              <Clock className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#2A1810]">Afternoon Brew Happy Hour</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-[#C87D32]/15 text-[#9A4B1A] rounded-md">
                  Active
                </span>
              </div>
              <p className="text-[11px] text-[#705648] mt-0.5">
                Enjoy 10% off any single origin pour or cold brew with code <strong className="font-mono text-[#2A1810]">COFFEE10</strong>.
              </p>
              {onApplyPromo && (
                <button
                  onClick={() => {
                    onApplyPromo('COFFEE10');
                    onClose();
                  }}
                  className="mt-2 text-[11px] font-bold text-[#C87D32] hover:underline cursor-pointer"
                >
                  Apply Code to Current Cart →
                </button>
              )}
            </div>
          </div>

          {/* Birthday offer */}
          <div className="p-3.5 rounded-xl bg-[#FAF5F0] border border-[#EFE2D3] flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#F4E3D2] flex items-center justify-center text-[#9A3412] shrink-0 mt-0.5">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-[#2A1810] block">Birthday Month Treat</span>
              <p className="text-[11px] text-[#705648] mt-0.5">
                Complimentary slice of New York Baked Cheesecake or Tiramisu with any main meal during your birth week.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-[#2D1B14] hover:bg-[#3E271D] text-[#FDFBF7] font-bold text-xs shadow-sm transition-all cursor-pointer"
        >
          Got it, Return to Table Menu
        </button>
      </div>
    </Modal>
  );
};
