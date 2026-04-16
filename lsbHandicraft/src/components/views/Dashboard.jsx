import React, { useState } from 'react';
import { MoreHorizontal, Clock } from 'lucide-react';

export default function Dashboard({ inventory, deliveries, orders = [] }) {
  const [invFilter, setInvFilter] = useState('All');

  const totalProducts = inventory.length;
  const totalVolume = inventory.reduce((sum, item) => sum + Number(item.stock), 0);
  const lowStockCount = inventory.filter(i => i.status === 'Low Stock').length;
  
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);

  const filteredInventory = inventory.filter(item => {
    if (invFilter === 'All') return true;
    return item.status === invFilter;
  });

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl font-medium text-zinc-900 dark:text-zinc-100 mb-1">Dashboard</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Here is today's report and performances</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
        <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 relative shadow-sm dark:shadow-none w-full">
          <button className="absolute top-5 right-5 md:top-6 md:right-6 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"><MoreHorizontal size={18}/></button>
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3 md:mb-4">Total Products</h3>
          <p className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-3 md:mb-4">{totalProducts}</p>
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="text-emerald-600 bg-emerald-50 dark:text-emerald-500 dark:bg-emerald-500/10 px-2 py-0.5 rounded">+12%</span>
            <span className="text-zinc-500">from last month</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 relative shadow-sm dark:shadow-none w-full">
          <button className="absolute top-5 right-5 md:top-6 md:right-6 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"><MoreHorizontal size={18}/></button>
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3 md:mb-4">Total Orders</h3>
          <p className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-3 md:mb-4">{totalOrders}</p>
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="text-emerald-600 bg-emerald-50 dark:text-emerald-500 dark:bg-emerald-500/10 px-2 py-0.5 rounded">+8%</span>
            <span className="text-zinc-500">from last month</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 relative shadow-sm dark:shadow-none w-full">
          <button className="absolute top-5 right-5 md:top-6 md:right-6 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"><MoreHorizontal size={18}/></button>
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3 md:mb-4">Total Revenue</h3>
          <p className="text-3xl md:text-4xl font-bold text-blue-600 dark:text-blue-500 mb-3 md:mb-4">PHP {totalRevenue.toLocaleString()}</p>
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="text-emerald-600 bg-emerald-50 dark:text-emerald-500 dark:bg-emerald-500/10 px-2 py-0.5 rounded">+15%</span>
            <span className="text-zinc-500">from last month</span>
          </div>
        </div>

        <div className="bg-red-50 dark:bg-[#181111] border border-red-100 dark:border-red-900/30 rounded-2xl p-5 md:p-6 relative shadow-sm dark:shadow-[inset_0_0_20px_rgba(239,68,68,0.02)] w-full">
          <button className="absolute top-5 right-5 md:top-6 md:right-6 text-red-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-zinc-300"><MoreHorizontal size={18}/></button>
          <h3 className="text-sm font-medium text-red-600/80 dark:text-red-400/80 mb-3 md:mb-4">Low Stock Alerts</h3>
          <p className="text-3xl md:text-4xl font-bold text-red-600 dark:text-red-500 mb-3 md:mb-4">{lowStockCount}</p>
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="text-red-600 dark:text-red-500">Needs Attention</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 w-full">
        <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none w-full">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Recent Activity</h3>
            <Clock size={16} className="text-zinc-400 dark:text-zinc-500" />
          </div>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>
              <div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  <span className="text-blue-600 dark:text-blue-400 font-medium">Delivery Added</span> Styro Ball 4 inch - <span className="text-red-500 dark:text-red-400">Not Yet Delivered</span>
                </p>
                <p className="text-xs text-zinc-500 mt-1">Just now</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none w-full">
          <div className="flex justify-between items-center mb-5 md:mb-6">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Inventory Levels</h3>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-6">
            <button 
              onClick={() => setInvFilter('All')} 
              className={`text-xs font-medium px-4 py-1.5 rounded-lg transition-colors ${invFilter === 'All' ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-[#1A1A24] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
            >
              View All
            </button>
            <button 
              onClick={() => setInvFilter('In Stock')} 
              className={`text-xs font-medium px-4 py-1.5 rounded-lg transition-colors ${invFilter === 'In Stock' ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-[#1A1A24] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
            >
              In Stock
            </button>
            <button 
              onClick={() => setInvFilter('Low Stock')} 
              className={`text-xs font-medium px-4 py-1.5 rounded-lg transition-colors ${invFilter === 'Low Stock' ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-[#1A1A24] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
            >
              Low Stock
            </button>
          </div>
          
          <div className="space-y-3">
            {filteredInventory.map(item => (
              <div key={item.id} className="bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-[#1F1F2E] p-4 rounded-xl flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'Low Stock' ? 'bg-orange-500' : 'bg-blue-500'} shrink-0`}></div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200 line-clamp-1">{item.name}</p>
                    <p className="text-xs text-zinc-500">{item.sku}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap ${item.status === 'Low Stock' ? 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-500/10' : 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-500/10'}`}>
                  {item.stock} units
                </span>
              </div>
            ))}
            {filteredInventory.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-4">No items found for this filter.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}