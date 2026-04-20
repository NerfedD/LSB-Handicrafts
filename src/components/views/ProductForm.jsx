import React, { useState } from 'react';
import { ArrowLeft, Save, Lightbulb } from 'lucide-react';

export default function ProductForm({ mode, record, navigateTo, inventory, setInventory, showModal }) {
  const [formData, setFormData] = useState(
    record || { sku: '', name: '', category: '', price: '', stock: '', maxStock: '' }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    
    showModal(
      mode === 'edit' ? "Save Changes" : "Add Product",
      `Are you sure you want to ${mode === 'edit' ? 'save changes to' : 'add'} this product?`,
      () => {
        const isEditing = mode === 'edit';
        const status = Number(formData.stock) < 50 ? 'Low Stock' : 'In Stock';
        
        if (isEditing) {
          setInventory(inventory.map(item => item.id === record.id ? { ...formData, price: Number(formData.price), stock: Number(formData.stock), status } : item));
        } else {
          setInventory([...inventory, { ...formData, id: Date.now(), price: Number(formData.price), stock: Number(formData.stock), status }]);
        }
        navigateTo('inventory');
      }
    );
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 w-full">


      <button onClick={() => navigateTo('inventory')} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 flex items-center gap-2 mb-6 text-sm font-medium transition-colors w-fit">
        <ArrowLeft size={16} /> Back
      </button>

      <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-6 w-full">
        <div className="flex-1 space-y-6">
          <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">SKU <span className="text-red-500">*</span></label>
                <input required type="text" placeholder="e.g., SB-001" 
                  value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})}
                  className="w-full bg-zinc-50 dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Product Description <span className="text-red-500">*</span></label>
                <input required type="text" placeholder="e.g., Styro Ball" 
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-zinc-50 dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Category <span className="text-red-500">*</span></label>
                <input required type="text" placeholder="e.g., Styro Balls" 
                  value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full bg-zinc-50 dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Price (Php) <span className="text-red-500">*</span></label>
                <input required type="number" step="0.01" placeholder="0" 
                  value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})}
                  className="w-full bg-zinc-50 dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Stock Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Current Stock Level <span className="text-red-500">*</span></label>
                <input required type="number" placeholder="0" 
                  value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})}
                  className="w-full bg-zinc-50 dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Maximum Stock <span className="text-red-500">*</span></label>
                <input required type="number" placeholder="0" 
                  value={formData.maxStock || ''} onChange={e => setFormData({...formData, maxStock: e.target.value})}
                  className="w-full bg-zinc-50 dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors" />
              </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-80 space-y-6 shrink-0">
          <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Actions</h3>
            <div className="space-y-3">
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                {mode === 'edit' ? <><Save size={18} /> Update Product</> : 'Add Product'}
              </button>
              <button type="button" onClick={() => navigateTo('inventory')} className="w-full bg-zinc-100 dark:bg-[#1A1A24] hover:bg-zinc-200 dark:hover:bg-[#22222E] text-zinc-700 dark:text-zinc-300 font-medium py-3 rounded-xl transition-colors">
                Cancel
              </button>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-[#0f1422] border border-blue-200 dark:border-blue-900/30 rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none">
            <div className="flex items-center gap-2 mb-4 text-blue-600 dark:text-blue-400">
              <Lightbulb size={20} />
              <h3 className="text-lg font-semibold">Tips</h3>
            </div>
            <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400 list-disc pl-4 marker:text-zinc-400 dark:marker:text-zinc-600">
              <li>SKU should be unique for each product</li>
              <li>Status is auto-calculated based on stock level</li>
              <li>Stock below 50 is marked as "Low Stock"</li>
              <li>All fields marked with * are required</li>
            </ul>
          </div>
        </div>
      </form>
    </div>
  );
}