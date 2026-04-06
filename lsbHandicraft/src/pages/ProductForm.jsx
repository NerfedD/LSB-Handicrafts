import React from 'react';

export default function ProductForm({ activeTab, setActiveTab, formData, setFormData, handleSaveCreate, handleSaveEdit }) {
  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button onClick={() => setActiveTab('inventory')} className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white font-bold text-xs md:text-sm mb-4 md:mb-6 flex items-center gap-2 transition-colors">
        ← Back to Inventory
      </button>
      
      <div className="bg-white dark:bg-[#121217] border border-slate-200 dark:border-white/5 rounded-3xl p-5 md:p-8 shadow-lg dark:shadow-2xl">
        <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-6 md:mb-8">
          {activeTab === 'create' ? 'Create New Product' : 'Edit Product'}
        </h2>

        <form onSubmit={activeTab === 'create' ? handleSaveCreate : handleSaveEdit} className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-2">
              <label className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">SKU Code</label>
              <input required type="text" className="w-full bg-slate-50 dark:bg-[#0b0b0f] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 md:py-3 text-sm md:text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-colors shadow-inner dark:shadow-none" 
                value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Category</label>
              <select className="w-full bg-slate-50 dark:bg-[#0b0b0f] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 md:py-3 text-sm md:text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-colors appearance-none shadow-inner dark:shadow-none"
                value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                <option value="Styro Balls">Styro Balls</option>
                <option value="Styro Sheets">Styro Sheets</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Product Name</label>
            <input required type="text" className="w-full bg-slate-50 dark:bg-[#0b0b0f] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 md:py-3 text-sm md:text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-colors shadow-inner dark:shadow-none" 
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-2">
              <label className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Price (₱)</label>
              <input required type="number" min="0" className="w-full bg-slate-50 dark:bg-[#0b0b0f] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 md:py-3 text-sm md:text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-colors shadow-inner dark:shadow-none" 
                value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Stock</label>
              <input required type="number" min="0" className="w-full bg-slate-50 dark:bg-[#0b0b0f] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 md:py-3 text-sm md:text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-colors shadow-inner dark:shadow-none" 
                value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} />
            </div>
          </div>

          <div className="pt-4 md:pt-6">
            <button type="submit" className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white py-3 md:py-4 rounded-xl font-bold shadow-[0_4px_15px_rgba(139,92,246,0.3)] transition-all active:scale-[0.98] text-sm md:text-base">
              {activeTab === 'create' ? 'Save Product' : 'Update Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
