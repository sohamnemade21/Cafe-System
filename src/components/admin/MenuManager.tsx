import React, { useState } from 'react';
import { Cafe, MenuItem, MenuCategory } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../common/Modal';
import { Plus, Check, X, Tag, FolderPlus, Loader2, AlertCircle } from 'lucide-react';

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
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);

  // Category Form State
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // Item Form state
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isVeg, setIsVeg] = useState(true);
  const [isBestseller, setIsBestseller] = useState(false);
  const [prepTime, setPrepTime] = useState('10');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);

  // Keep categoryId synced with categories if empty
  React.useEffect(() => {
    if (!categoryId && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  const handleToggleAvailability = async (itemId: string) => {
    try {
      await api.toggleAvailability(itemId);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update availability');
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setIsCategorySubmitting(true);
    setCategoryError(null);

    try {
      const created = await api.addCategory(cafe.id, {
        name: newCategoryName.trim(),
        description: newCategoryDesc.trim()
      });
      setIsAddCategoryOpen(false);
      setNewCategoryName('');
      setNewCategoryDesc('');
      setCategoryId(created.id);
      onRefresh();
    } catch (err: any) {
      setCategoryError(err.message || 'Failed to create category');
    } finally {
      setIsCategorySubmitting(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price || !categoryId) {
      setItemError('Please fill in Item Name, Category, and Price.');
      return;
    }
    setIsSubmitting(true);
    setItemError(null);

    try {
      await api.addMenuItem(cafe.id, {
        category_id: categoryId,
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        image_url: imageUrl.trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
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
    } catch (err: any) {
      setItemError(err.message || 'Failed to add menu item');
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
            Digital Menu &amp; Recipe Catalog
          </h2>
          <p className="text-xs text-stone-500">
            Configure categories, items, pricing, variants, and toggle 86 (out-of-stock) availability in real time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddCategoryOpen(true)}
            className="px-3.5 py-2 bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
          >
            <FolderPlus className="w-4 h-4 text-stone-600" />
            <span>Add Category</span>
          </button>

          <button
            onClick={() => setIsAddItemOpen(true)}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Menu Item</span>
          </button>
        </div>
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
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-stone-500 text-xs">
            No menu items found. Click &quot;Add Menu Item&quot; to create your first recipe.
          </div>
        ) : (
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
                        <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-semibold border border-amber-200">
                          Bestseller
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">
                      {item.description}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-stone-400">
                      <span className="font-bold text-stone-900">
                        {cafe.currency}{item.price.toFixed(2)}
                      </span>
                      <span>•</span>
                      <span>{item.preparation_time_minutes || 10} mins prep</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => handleToggleAvailability(item.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      item.is_available
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                        : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    {item.is_available ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>In Stock</span>
                      </>
                    ) : (
                      <>
                        <X className="w-3.5 h-3.5" />
                        <span>86 (Out of Stock)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Category Modal */}
      <Modal
        isOpen={isAddCategoryOpen}
        onClose={() => setIsAddCategoryOpen(false)}
        title="Add Menu Category"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAddCategory} className="space-y-4">
          {categoryError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{categoryError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Category Name *
            </label>
            <input
              type="text"
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              placeholder="e.g. Specialty Coffee, Artisan Tea, Breakfast Bowls"
              required
              className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden focus:border-stone-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={newCategoryDesc}
              onChange={e => setNewCategoryDesc(e.target.value)}
              placeholder="Short summary for the digital customer menu..."
              rows={2}
              className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden focus:border-stone-900 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddCategoryOpen(false)}
              className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCategorySubmitting}
              className="flex-1 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {isCategorySubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Create Category</span>}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Item Modal */}
      <Modal
        isOpen={isAddItemOpen}
        onClose={() => setIsAddItemOpen(false)}
        title="Create New Menu Item"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleAddItem} className="space-y-4">
          {itemError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{itemError}</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-stone-700">
                Category *
              </label>
              <button
                type="button"
                onClick={() => setIsAddCategoryOpen(true)}
                className="text-[11px] text-stone-900 hover:underline font-bold"
              >
                + New Category
              </button>
            </div>
            {categories.length === 0 ? (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
                <span>No categories exist yet.</span>
                <button
                  type="button"
                  onClick={() => setIsAddCategoryOpen(true)}
                  className="font-bold underline text-amber-900 cursor-pointer"
                >
                  Create one now
                </button>
              </div>
            ) : (
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden focus:border-stone-900 bg-white"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Item Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Single Origin Espresso"
              required
              className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden focus:border-stone-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe flavor notes, roast profile, or ingredients..."
              rows={2}
              className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden focus:border-stone-900 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Base Price ({cafe.currency}) *
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="160"
                required
                className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden focus:border-stone-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Preparation Time (Mins)
              </label>
              <input
                type="number"
                min="1"
                value={prepTime}
                onChange={e => setPrepTime(e.target.value)}
                placeholder="10"
                className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden focus:border-stone-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Image URL (Unsplash or Supabase Storage)
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/photo-..."
              className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden focus:border-stone-900"
            />
          </div>

          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-stone-700">
              <input
                type="checkbox"
                checked={isVeg}
                onChange={e => setIsVeg(e.target.checked)}
                className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
              />
              <span>Vegetarian Recipe</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-stone-700">
              <input
                type="checkbox"
                checked={isBestseller}
                onChange={e => setIsBestseller(e.target.checked)}
                className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
              />
              <span>Mark as Bestseller</span>
            </label>
          </div>

          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsAddItemOpen(false)}
              className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || categories.length === 0}
              className="flex-1 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Add Item to Live Menu</span>}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
