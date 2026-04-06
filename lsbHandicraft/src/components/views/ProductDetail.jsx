import React from 'react';

export default function ProductDetail({ currentRecord, setActiveTab, handleEdit }) {
  if (!currentRecord) return null;

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

        <button onClick={() => handleEdit(currentRecord)} className="w-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-900 dark:text-white py-3 md:py-4 rounded-xl font-bold border border-slate-200 dark:border-white/5 transition-all text-sm md:text-base">
          Edit Details
        </button>
      </div>
    </div>
  );
}