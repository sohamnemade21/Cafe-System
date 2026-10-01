import React, { useState, useEffect } from 'react';
import { Cafe, Coupon } from '../../types';
import { api } from '../../services/api';
import { Tag, Sparkles, Percent, Plus } from 'lucide-react';

interface CouponsManagerProps {
  cafe: Cafe;
}

export const CouponsManager: React.FC<CouponsManagerProps> = ({ cafe }) => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCoupons(cafe.id)
      .then(res => setCoupons(res))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [cafe.id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">
            Promo Coupons & Next-Visit Loyalty Rewards
          </h2>
          <p className="text-xs text-stone-500">
            Automated server-side coupon validation prevents abuse and encourages repeat café visits.
          </p>
        </div>
      </div>

      {/* Coupons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-xs text-stone-400">
            Loading promotional coupons...
          </div>
        ) : coupons.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-stone-400">
            No active promo codes found
          </div>
        ) : (
          coupons.map(cp => (
            <div
              key={cp.id}
              className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-sm tracking-wider bg-stone-100 px-2.5 py-1 rounded-lg text-stone-900 border border-stone-200">
                      {cp.code}
                    </span>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                      {cp.status}
                    </span>
                  </div>

                  <div className="text-xs font-black text-amber-800">
                    {cp.discount_type === 'PERCENTAGE'
                      ? `${cp.discount_value}% OFF`
                      : `-${cafe.currency}${cp.discount_value}`}
                  </div>
                </div>

                <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                  {cp.description}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
                <span>Min Order: {cafe.currency}{cp.minimum_order}</span>
                <span>Used {cp.usage_count} / {cp.usage_limit} times</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Next-Visit Loyalty Automation Card */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
        <div className="p-2.5 bg-amber-500 text-stone-950 rounded-xl shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wide">
            Automated Post-Payment Loyalty Engine Active
          </h4>
          <p className="text-xs text-stone-600 mt-1 leading-relaxed">
            Every customer who completes a digital checkout receives an auto-generated unique coupon (e.g. <code>REWARD-XXXXX</code>) granting 15% off their next visit, automatically attached to their digital invoice and email.
          </p>
        </div>
      </div>
    </div>
  );
};
