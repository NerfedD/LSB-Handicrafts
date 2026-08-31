import React, { useMemo, useState } from 'react';
import { Search, Plus, Eye, Edit2, Trash2, ChevronDown } from '../icons';
import EmptyState from '../shared/EmptyState';
import StatusDotLabel from '../shared/StatusDotLabel';
import ListHeaderBar from '../shared/ListHeaderBar';
import { PRODUCT_TYPE_OPTIONS, STOCK_STATUS } from '../../utils/constants';
import { formatDimensions, formatUnit, sizeSortKey } from '../../utils/productFormat';
import { availableOf } from '../../utils/stockLedger';

/** Orange for low, red for out, blue otherwise. */
const statusTone = (status) => {
  if (status === STOCK_STATUS.OUT) {
    return { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-500' };
  }
  if (status === STOCK_STATUS.LOW) {
    return { dot: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-500' };
  }
  return { dot: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-500' };
};

export default function InventoryList({ inventory, navigateTo, setInventory, showModal, addActivity }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [sortOption, setSortOption] = useState('name-az');

  // Derived from the data rather than hardcoded, so a new category shows up in
  // the filter the moment a product uses it.
  const categories = useMemo(
    () => [...new Set(inventory.map((item) => item.category).filter(Boolean))].sort(),
    [inventory]
  );

  // Rows with nothing to sort on (no dimensions recorded yet) go last rather
  // than sorting as zero and crowding the top.
  const byNullableNumber = (a, b, pick, descending) => {
    const av = pick(a);
    const bv = pick(b);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return descending ? bv - av : av - bv;
  };

  const sortInventory = (items) => {
    return [...items].sort((a, b) => {
      switch (sortOption) {
        case 'name-az':
          return a.name.localeCompare(b.name);
        case 'name-za':
          return b.name.localeCompare(a.name);
        case 'price-low-high':
          return a.price - b.price;
        case 'price-high-low':
          return b.price - a.price;
        case 'stock-low-high':
          return availableOf(a) - availableOf(b);
        case 'stock-high-low':
          return availableOf(b) - availableOf(a);
        case 'size-small-large':
          return byNullableNumber(a, b, sizeSortKey, false);
        case 'size-large-small':
          return byNullableNumber(a, b, sizeSortKey, true);
        case 'thickness-thin-thick':
          return byNullableNumber(a, b, (i) => (i.thicknessIn ?? null), false);
        case 'category-az':
          return a.category.localeCompare(b.category);
        default:
          return 0;
      }
    });
  };

  const handleDelete = (id) => {
    const deletedItem = inventory.find(item => item.id === id);
    showModal(
      "Delete Product",
      "Are you sure you want to delete this product? This action cannot be undone.",
      () => {
        setInventory(inventory.filter(item => item.id !== id));
        if (deletedItem) {
          addActivity?.({
            type: 'Product',
            title: 'Product Deleted',
            description: `Deleted product: ${deletedItem.name} (${deletedItem.sku})`,
            color: 'bg-red-500'
          });
        }
      }
    );
  };

  const filteredInventory = inventory.filter(item => {
    const needle = searchTerm.toLowerCase();
    const matchesSearch = item.name.toLowerCase().includes(needle) ||
                          item.sku.toLowerCase().includes(needle) ||
                          formatDimensions(item).toLowerCase().includes(needle);
    const matchesCategory = categoryFilter === 'All Categories' || item.category === categoryFilter;
    const matchesType = typeFilter === 'All Types' || item.productType === typeFilter;
    return matchesSearch && matchesCategory && matchesType;
  });

  const sortedInventory = sortInventory(filteredInventory);

  return (
    <div className="animate-in fade-in duration-300">

      <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl overflow-hidden shadow-sm dark:shadow-lg w-full">
        
        <ListHeaderBar description="Manage product inventory and monitor stock levels">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={16} />
            <input 
              type="text" 
              placeholder="Search products..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-200 placeholder-zinc-500 dark:placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-auto">
              <select 
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="appearance-none bg-zinc-50 dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl pl-4 pr-10 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-blue-500/50 cursor-pointer w-full"
              >
                <option value="All Categories" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category} className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">{category}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={16} />
            </div>
            <div className="relative w-full sm:w-auto">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="appearance-none bg-zinc-50 dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl pl-4 pr-10 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-blue-500/50 cursor-pointer w-full"
              >
                <option value="All Types" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">All Types</option>
                {PRODUCT_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value} className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">{o.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={16} />
            </div>
            <div className="relative w-full sm:w-auto">
              <select 
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="appearance-none bg-zinc-50 dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl pl-4 pr-10 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-blue-500/50 cursor-pointer w-full"
              >
                <option value="name-az" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Product Name (A → Z)</option>
                <option value="name-za" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Product Name (Z → A)</option>
                <option value="price-low-high" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Price (Low → High)</option>
                <option value="price-high-low" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Price (High → Low)</option>
                <option value="stock-low-high" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Available (Low → High)</option>
                <option value="stock-high-low" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Available (High → Low)</option>
                <option value="size-small-large" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Size (Small → Large)</option>
                <option value="size-large-small" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Size (Large → Small)</option>
                <option value="thickness-thin-thick" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Thickness (Thin → Thick)</option>
                <option value="category-az" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Category (A → Z)</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={16} />
            </div>
            <button 
              onClick={() => navigateTo('add-product')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap w-full sm:w-auto"
            >
              <Plus size={16} /> Add Product
            </button>
          </div>
        </ListHeaderBar>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-[#1F1F2E] text-zinc-500">
                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase">SKU</th>
                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase">Product Description</th>
                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase">Size</th>
                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase">Category</th>
                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase">Status</th>
                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase">Available</th>
                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase">Price</th>
                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-[#1F1F2E]">
              {sortedInventory.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-10 text-center text-zinc-500 dark:text-zinc-400">
                    <EmptyState
                      title="No products found"
                      description="Try adjusting your search or category filter."
                      icon={<Search size={22} />}
                    />
                  </td>
                </tr>
              ) : (
                sortedInventory.map(item => {
                  const available = availableOf(item);
                  const tone = statusTone(item.status);
                  return (
                  <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-[#1A1A24]/50 transition-colors">
                    <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400 font-mono text-xs">{item.sku}</td>
                    <td className="px-6 py-4 text-zinc-900 dark:text-zinc-200 font-medium">{item.name}</td>
                    <td className="px-6 py-4 text-zinc-700 dark:text-zinc-300">{formatDimensions(item)}</td>
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{item.category}</td>
                    <td className="px-6 py-4">
                      <StatusDotLabel
                        label={item.status}
                        ariaLabel={`Status: ${item.status}`}
                        dotClassName={tone.dot}
                        textClassName={tone.text}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <StatusDotLabel
                        label={String(available)}
                        ariaLabel={`Available: ${available}`}
                        dotClassName={tone.dot}
                      />
                      {item.reserved > 0 && (
                        <span className="block text-xs text-zinc-500 dark:text-zinc-500 mt-0.5">
                          {item.stock} on hand · {item.reserved} reserved
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-700 dark:text-zinc-300">
                      PHP {Number(item.price).toFixed(2)}
                      <span className="block text-xs text-zinc-500 dark:text-zinc-500">{formatUnit(item)}</span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button onClick={() => navigateTo('view-product', item)} className="text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors inline-block"><Eye size={16} /></button>
                      <button onClick={() => navigateTo('edit-product', item)} className="text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors inline-block"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(item.id)} className="text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400 transition-colors inline-block"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}