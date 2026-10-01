import React, { useState } from 'react';
import { Cafe, MenuItem, MenuCategory } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../common/Modal';
import { Plus, Check, X, Tag } from 'lucide-react';

interface MenuManagerProps {
  cafe: Cafe;
  categories: MenuCategory[];
  items: MenuItem[];
  onRefresh: () => void;
}

export const MenuManager: React.FC<MenuManagerProps> = ({
  cafe,
  categories,
  items,
  onRefresh,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);

  // Form state
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isVeg, setIsVeg] = useState(true);
  const [isBestseller, setIsBestseller] = useState(false);
  const [prepTime, setPrepTime] = useState('10');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggleAvailability = async (itemId: string) => {
    await api.toggleAvailability(itemId);
    onRefresh();
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || !categoryId) return;
    setIsSubmitting(true);

    try {
      await api.addMenuItem(cafe.id, {
        category_id: categoryId,
        name,
        description,
        price: Number(price),
        image_url: imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
        is_veg: isVeg,
        is_bestseller: isBestseller,
        preparation_time_minutes: Number(prepTime) || 12,
        variants: [
          { name: 'Regular Size', type: 'SIZE', additional_price: 0, is_available: true },
          { name: 'Large Size', type: 'SIZE', additional_price: 50, is_available: true }
        ]
      });

      setIsAddItemOpen(false);
      setName('');
      setDescription('');
      setPrice('');
      setImageUrl('');
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = items.filter(i => {
    if (selectedCategory === 'ALL') return true;
    return i.category_id === selectedCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">
            Digital Menu & Recipe Catalog
          </h2>
          <p className="text-xs text-stone-500">
            Configure items, pricing, variants, and toggle 86 (out-of-stock) availability in real time.
          </p>
        </div>

        <button
          onClick={() => setIsAddItemOpen(true)}
          className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Menu Item</span>
        </button>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            selectedCategory === 'ALL'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
          }`}
        >
          All Items ({items.length})
        </button>
        {categories.map(c => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === c.id
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Items Table / Cards */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
        <div className="divide-y divide-stone-100">
          {filteredItems.map(item => (
            <div
              key={item.id}
              className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-stone-50/60 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={item.image_url}
                  alt={item.name}
                  className={`w-14 h-14 rounded-xl object-cover border border-stone-200 shrink-0 ${
                    !item.is_available ? 'grayscale opacity-50' : ''
                  }`}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-stone-900 text-sm truncate">
                      {item.name}
                    </h4>
                    {item.is_veg ? (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold border border-emerald-200">
                        Veg
                      </span>
                    ) : (
                      <span className="text-[10px] text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded font-semibold border border-rose-200">
                        Non-Veg
                      </span>
                    )}
                    {item.is_bestseller && (
                      <span className="text-[10px] text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded font-bold">
                        Bestseller
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">
                    {item.description}
                  </p>
                  <p className="text-[11px] text-stone-400 mt-1">
                    Prep: {item.preparation_time_minutes}m · {item.variants?.length || 0} variant options
                  </p>
                </div>
              </div>

              {/* Price & Stock status */}
              <div className="flex items-center gap-4 self-end sm:self-center shrink-0">
                <div className="text-right">
                  <span className="text-sm font-extrabold text-stone-900">
                    {cafe.currency}{item.price.toFixed(2)}
                  </span>
                  <span
                    className={`block text-[10px] font-bold uppercase tracking-wider ${
                      item.is_available ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {item.is_available ? 'In Stock' : '86’d / Sold Out'}
                  </span>
                </div>

                {/* Toggle Availability button */}
                <button
                  onClick={() => handleToggleAvailability(item.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    item.is_available
                      ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  {item.is_available ? 'Mark 86 (Sold Out)' : 'Restock Item'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Item Modal */}
      <Modal isOpen={isAddItemOpen} onClose={() => setIsAddItemOpen(false)} title="Create New Menu Item" maxWidth="max-w-md">
        <form onSubmit={handleAddItem} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 bg-white"
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1">Item Title</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Sourdough Burrata Tartine"
              className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden focus:border-stone-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1">Description & Ingredients</label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Fresh pugliese burrata, heirloom cherry tomatoes, balsamico glaze"
              className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden focus:border-stone-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">Price ({cafe.currency})</label>
              <input
                type="number"
                step="0.01"
                required
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="280"
                className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden focus:border-stone-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">Prep Time (mins)</label>
              <input
                type="number"
                value={prepTime}
                onChange={e => setPrepTime(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden focus:border-stone-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1">Photo Image URL</label>
            <input
              type="url"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden focus:border-stone-900"
            />
          </div>

          <div className="flex gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs font-medium text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isVeg}
                onChange={e => setIsVeg(e.target.checked)}
                className="rounded-sm border-stone-300 text-stone-900 focus:ring-stone-900 cursor-pointer"
              />
              <span>Vegetarian Dish</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-medium text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isBestseller}
                onChange={e => setIsBestseller(e.target.checked)}
                className="rounded-sm border-stone-300 text-stone-900 focus:ring-stone-900 cursor-pointer"
              />
              <span>Highlight as Bestseller</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all disabled:opacity-60"
          >
            {isSubmitting ? 'Saving Menu Item...' : 'Add Item to Live Menu'}
          </button>
        </form>
      </Modal>
    </div>
  );
};
