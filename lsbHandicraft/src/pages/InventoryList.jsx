import React, { useState } from 'react';

export default function InventoryList({ 
  searchQuery, setSearchQuery, 
  filterCategory, setFilterCategory, 
  filteredInventory, handleView, handleEdit, handleDelete,
  setActiveTab, setFormData 
}) {
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, itemId: null, itemName: '' });

  const openDeleteDialog = (itemId, itemName) => {
    setDeleteConfirm({ show: true, itemId, itemName });
  };

  const confirmDelete = () => {
    if (deleteConfirm.itemId) {
      handleDelete(deleteConfirm.itemId);
      setDeleteConfirm({ show: false, itemId: null, itemName: '' });
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm({ show: false, itemId: null, itemName: '' });
  };
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-wide">Products</h2>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="md:hidden flex-1 bg-white dark:bg-[#121217] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/30" />
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-white dark:bg-[#121217] border border-slate-200 dark:border-white/5 text-slate-700 dark:text-gray-300 text-sm font-medium rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/30">
            <option value="All">All Categories</option>
            <option value="Styro Balls">Styro Balls</option>
            <option value="Styro Sheets">Styro Sheets</option>
          </select>
          <button onClick={() => { setFormData({ sku: '', name: '', category: 'Styro Balls', price: 0, stock: 0 }); setActiveTab('create'); }}
            className="hidden md:flex bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-[0_4px_15px_rgba(139,92,246,0.25)] transition-all active:scale-95 items-center justify-center gap-2">
            <span>+</span> Add Product
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gradient-to-b dark:from-[#15151a] dark:to-[#121217] border border-slate-200 dark:border-white/5 rounded-3xl overflow-hidden shadow-sm dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/5 text-slate-500 dark:text-gray-400 bg-slate-50/80 dark:bg-black/20">
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">SKU</th>
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Product Name</th>
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Category</th>
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Status</th>
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Stock Level</th>
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredInventory.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.03] transition-colors group">
                  <td className="px-6 py-3 md:py-4 font-mono font-medium text-slate-500 dark:text-gray-400 text-xs md:text-sm">{item.sku}</td>
                  <td className="px-6 py-3 md:py-4 font-bold text-slate-900 dark:text-gray-200 text-xs md:text-sm">{item.name}</td>
                  <td className="px-6 py-3 md:py-4 text-slate-600 dark:text-gray-400 text-xs md:text-sm">{item.category}</td>
                  <td className="px-6 py-3 md:py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'Low Stock' ? 'bg-orange-500' : 'bg-violet-500'}`}></div>
                      <span className="text-slate-700 dark:text-gray-300 font-medium text-xs md:text-sm">{item.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 md:py-4">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="w-16 md:w-24 h-1.5 bg-slate-100 dark:bg-[#0b0b0f] rounded-full overflow-hidden shadow-inner">
                        <div className={`h-full rounded-full bg-gradient-to-r ${item.stock < 50 ? 'from-orange-500 to-red-500' : 'from-violet-500 to-indigo-500'}`} style={{ width: `${Math.min((item.stock / 200) * 100, 100)}%` }}></div>
                      </div>
                      <span className="font-bold text-slate-700 dark:text-gray-400 text-xs md:text-sm w-6">{item.stock}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 md:py-4 text-right opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleView(item)} className="text-slate-600 dark:text-gray-400 font-bold hover:text-violet-600 dark:hover:text-white px-2.5 py-1.5 md:px-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-transparent rounded-lg mr-2 transition-colors text-xs md:text-sm shadow-sm dark:shadow-none">View</button>
                    <button onClick={() => handleEdit(item)} className="text-slate-600 dark:text-gray-400 font-bold hover:text-amber-600 dark:hover:text-white px-2.5 py-1.5 md:px-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-transparent rounded-lg mr-2 transition-colors text-xs md:text-sm shadow-sm dark:shadow-none">Edit</button>
                    <button onClick={() => openDeleteDialog(item.id, item.name)} className="text-slate-600 dark:text-gray-400 font-bold hover:text-red-600 dark:hover:text-red-400 px-2.5 py-1.5 md:px-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-transparent rounded-lg transition-colors text-xs md:text-sm shadow-sm dark:shadow-none">Delete</button>
                  </td>
                </tr>
              ))}
              {filteredInventory.length === 0 && (
                <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-500 dark:text-gray-500">No products found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#15151a] border border-slate-200 dark:border-white/5 rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 dark:bg-red-500/10 mb-4 mx-auto">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white text-center mb-2">Delete Product?</h3>
            <p className="text-slate-600 dark:text-gray-400 text-center text-sm md:text-base mb-6">
              Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-white">"{deleteConfirm.itemName}"</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={cancelDelete}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors text-sm md:text-base"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold bg-red-600 hover:bg-red-500 text-white shadow-[0_4px_15px_rgba(220,38,38,0.2)] transition-colors text-sm md:text-base"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
