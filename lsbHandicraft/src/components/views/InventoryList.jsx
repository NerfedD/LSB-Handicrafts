import React, { useState } from 'react';
import { Search, Plus, Eye, Edit2, Trash2, ChevronDown } from 'lucide-react';
import EmptyState from '../shared/EmptyState';
import StatusDotLabel from '../shared/StatusDotLabel';
import ListHeaderBar from '../shared/ListHeaderBar';

export default function InventoryList({ inventory, navigateTo, setInventory, showModal }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');

  const handleDelete = (id) => {
    showModal(
      "Delete Product",
      "Are you sure you want to delete this product? This action cannot be undone.",
      () => setInventory(inventory.filter(item => item.id !== id))
    );
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All Categories' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

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
                <option value="Styro Balls" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Styro Balls</option>
                <option value="Styro Sheets" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Styro Sheets</option>
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
                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase">Category</th>
                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase">Status</th>
                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase">Stock Level</th>
                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase">Price</th>
                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-[#1F1F2E]">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-10 text-center text-zinc-500 dark:text-zinc-400">
                    <EmptyState
                      title="No products found"
                      description="Try adjusting your search or category filter."
                      icon={<Search size={22} />}
                    />
                  </td>
                </tr>
              ) : (
                filteredInventory.map(item => (
                  <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-[#1A1A24]/50 transition-colors">
                    <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400 font-mono text-xs">{item.sku}</td>
                    <td className="px-6 py-4 text-zinc-900 dark:text-zinc-200 font-medium">{item.name}</td>
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{item.category}</td>
                    <td className="px-6 py-4">
                      <StatusDotLabel
                        label={item.status}
                        ariaLabel={`Status: ${item.status}`}
                        dotClassName={item.status === 'Low Stock' ? 'bg-orange-500' : 'bg-blue-500'}
                        textClassName={item.status === 'Low Stock' ? 'text-orange-600 dark:text-orange-500' : 'text-blue-600 dark:text-blue-500'}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <StatusDotLabel
                        label={String(item.stock)}
                        ariaLabel={`Stock level: ${item.stock}`}
                        dotClassName={item.stock < 50 ? 'bg-orange-500' : 'bg-blue-500'}
                      />
                    </td>
                    <td className="px-6 py-4 text-zinc-700 dark:text-zinc-300">PHP {item.price.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button onClick={() => navigateTo('view-product', item)} className="text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors inline-block"><Eye size={16} /></button>
                      <button onClick={() => navigateTo('edit-product', item)} className="text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors inline-block"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(item.id)} className="text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400 transition-colors inline-block"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}