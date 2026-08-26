import React from 'react';
import { ArrowLeft, Edit2, Trash2, LayoutDashboard, Clock } from '../icons';

export default function ProductDetail({ record, navigateTo, inventory, setInventory, showModal, addActivity }) {
  if(!record) return null;

  const handleDelete = () => {
    showModal(
      "Delete Product",
      "Are you sure you want to delete this product? This action cannot be undone.",
      () => {
        setInventory(inventory.filter(item => item.id !== record.id));
        addActivity?.({
          type: 'Product',
          title: 'Product Deleted',
          description: `Deleted product: ${record.name} (${record.sku})`,
          color: 'bg-red-500'
        });
        navigateTo('inventory');
      }
    );
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 w-full">


      <div className="flex flex-col sm:flex-row justify-start sm:justify-between items-start sm:items-center gap-4 mb-6">
        <button onClick={() => navigateTo('inventory')} className="text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-white flex items-center gap-3 font-semibold text-xl transition-colors">
          <ArrowLeft size={20} className="text-zinc-500 dark:text-zinc-400" /> {record.name}
        </button>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <button onClick={() => navigateTo('edit-product', record)} className="flex-1 sm:flex-none justify-center bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Edit2 size={16} /> Edit Product
          </button>
          <button onClick={handleDelete} className="flex-1 sm:flex-none justify-center bg-transparent border border-red-200 dark:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 w-full">
        <div className="flex-1 space-y-6">
          <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Product Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 sm:gap-y-8 gap-x-6">
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Product Name</p>
                <p className="text-zinc-900 dark:text-zinc-200 font-medium">{record.name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">SKU</p>
                <p className="text-zinc-600 dark:text-zinc-400 font-mono text-sm">{record.sku}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Category</p>
                <p className="text-zinc-900 dark:text-zinc-200">{record.category}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Price</p>
                {/* Changed $ to PHP here */}
                <p className="text-zinc-900 dark:text-zinc-200 font-medium">PHP {record.price.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Size</p>
                <p className="text-zinc-900 dark:text-zinc-200">{record.name.split(' ').slice(-2).join(' ')}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Stock Information</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Status</p>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${record.status === 'Low Stock' ? 'bg-orange-500' : 'bg-blue-500'}`}></div>
                  <span className={`font-medium text-sm ${record.status === 'Low Stock' ? 'text-orange-600 dark:text-orange-500' : 'text-blue-600 dark:text-blue-500'}`}>
                    {record.status}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Current Stock</p>
                <p className="text-zinc-900 dark:text-zinc-200 font-medium text-xl">{record.stock}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-80 space-y-6 shrink-0">
          <div className="bg-blue-50 dark:bg-[#0f1422] border border-blue-200 dark:border-blue-900/30 rounded-2xl p-5 md:p-6 relative overflow-hidden shadow-sm dark:shadow-none">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-200/50 dark:bg-blue-600/10 rounded-full blur-3xl"></div>
            <div className="flex items-center gap-2 mb-6">
              <div className="bg-blue-600 rounded p-1.5"><LayoutDashboard size={18} className="text-white" /></div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Quick Stats</h3>
            </div>
            
            <div className="space-y-6 relative z-10">
              <div>
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Total Value</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">PHP {(record.price * record.stock).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Stock Turnover</p>
                <p className="text-zinc-700 dark:text-zinc-300 font-medium">8.5 days avg.</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none">
            <div className="flex items-center gap-2 mb-6">
              <Clock size={18} className="text-zinc-400" />
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Timestamps</h3>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-zinc-500 mb-1">Created</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">March 15, 2026</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 mb-1">Last Updated</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">April 10, 2026</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}