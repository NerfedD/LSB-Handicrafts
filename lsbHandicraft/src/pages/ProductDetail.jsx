import React, { useState } from 'react';

export default function ProductDetail({ currentRecord, setActiveTab, handleEdit, handleDelete }) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  if (!currentRecord) return null;

  const confirmDelete = () => {
    handleDelete(currentRecord.id);
    setDeleteConfirm(false);
  };

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button onClick={() => setActiveTab('inventory')} className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white font-bold text-xs md:text-sm mb-4 md:mb-6 flex items-center gap-2 transition-colors">
        ← Back to Inventory
      </button>
      
      <div className="bg-white dark:bg-[#15151a] border border-slate-200 dark:border-white/5 rounded-3xl p-6 md:p-8 shadow-xl dark:shadow-2xl relative overflow-hidden">
        
        {/* Clean violet blur in Light Mode, deep glow in Dark Mode */}
        <div className="absolute top-0 right-0 w-48 h-48 md:w-64 md:h-64 bg-violet-100/50 dark:bg-violet-500/10 rounded-full blur-3xl -z-10 translate-x-1/3 -translate-y-1/3"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-start mb-6 md:mb-8 gap-4">
          <div>
            <p className="text-violet-600 dark:text-violet-400 text-[10px] md:text-sm font-bold uppercase tracking-widest mb-1 md:mb-2">{currentRecord.category}</p>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-1 md:mb-2">{currentRecord.name}</h2>
            <p className="text-slate-500 dark:text-gray-500 font-mono font-medium text-xs md:text-sm">SKU: {currentRecord.sku}</p>
          </div>
          <div className={`px-3 md:px-4 py-1.5 rounded-lg text-[10px] md:text-xs font-bold border ${currentRecord.status === 'Low Stock' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/20' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>
            {currentRecord.status}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
          <div className="bg-slate-50 dark:bg-[#0b0b0f] border border-slate-100 dark:border-white/5 p-4 md:p-6 rounded-2xl shadow-inner dark:shadow-none">
            <p className="text-slate-500 dark:text-gray-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1 md:mb-2">Unit Price</p>
            <p className="text-xl md:text-2xl font-black text-slate-900 dark:text-white"><span className="text-slate-400 dark:text-gray-600 mr-1">₱</span>{currentRecord.price}</p>
          </div>
          <div className="bg-slate-50 dark:bg-[#0b0b0f] border border-slate-100 dark:border-white/5 p-4 md:p-6 rounded-2xl shadow-inner dark:shadow-none">
            <p className="text-slate-500 dark:text-gray-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1 md:mb-2">Stock Level</p>
            <p className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">{currentRecord.stock} <span className="text-xs md:text-sm text-slate-400 dark:text-gray-600 font-bold">pcs</span></p>
          </div>
        </div>

        <button onClick={() => handleEdit(currentRecord)} className="w-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-900 dark:text-white py-3 md:py-4 rounded-xl font-bold border border-slate-200 dark:border-white/5 transition-all text-sm md:text-base mb-3">
          Edit Details
        </button>
        <button onClick={() => setDeleteConfirm(true)} className="w-full bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 py-3 md:py-4 rounded-xl font-bold border border-red-200 dark:border-red-500/20 transition-all text-sm md:text-base">
          Delete Product
        </button>

        {/* Delete Confirmation Dialog */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#15151a] border border-slate-200 dark:border-white/5 rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 dark:bg-red-500/10 mb-4 mx-auto">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white text-center mb-2">Delete Product?</h3>
              <p className="text-slate-600 dark:text-gray-400 text-center text-sm md:text-base mb-6">
                Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-white">"{currentRecord.name}"</span>? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirm(false)}
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
    </div>
  );
}
