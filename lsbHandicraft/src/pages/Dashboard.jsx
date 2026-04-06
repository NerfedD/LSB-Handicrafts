import React from 'react';
import { Icons } from '../components/ui/Icons';

export default function Dashboard({ inventory = [] }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end mb-4 md:mb-8">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-wide">Dashboard</h2>
          <p className="text-xs md:text-sm text-slate-500 dark:text-gray-500 mt-1">Here is today's report and performances</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
        <div className="bg-white dark:bg-gradient-to-br dark:from-[#15151a] dark:to-[#101014] border border-slate-200 dark:border-white/5 rounded-2xl p-4 md:p-6 relative group hover:border-slate-300 dark:hover:border-white/10 transition-colors shadow-sm dark:shadow-none">
          <button className="hidden md:block absolute top-6 right-6 text-slate-400 dark:text-gray-500 hover:text-slate-900 dark:hover:text-white"><Icons.Dots /></button>
          <h3 className="text-xs md:text-sm font-bold text-slate-500 dark:text-gray-400 mb-2 md:mb-4">Total Products</h3>
          <p className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white mb-2 md:mb-4">{inventory.length}</p>
          <p className="text-[10px] md:text-xs font-bold text-slate-400 dark:text-gray-500 flex items-center gap-1">
            <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 rounded">↑ 12%</span> <span className="hidden sm:inline">from last quarter</span>
          </p>
        </div>

        <div className="bg-white dark:bg-gradient-to-br dark:from-[#15151a] dark:to-[#101014] border border-slate-200 dark:border-white/5 rounded-2xl p-4 md:p-6 relative group hover:border-slate-300 dark:hover:border-white/10 transition-colors shadow-sm dark:shadow-none">
          <button className="hidden md:block absolute top-6 right-6 text-slate-400 dark:text-gray-500 hover:text-slate-900 dark:hover:text-white"><Icons.Dots /></button>
          <h3 className="text-xs md:text-sm font-bold text-slate-500 dark:text-gray-400 mb-2 md:mb-4">Total Volume</h3>
          <p className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white mb-2 md:mb-4">{inventory.reduce((sum, item) => sum + Number(item.stock), 0)}</p>
          <p className="text-[10px] md:text-xs font-bold text-slate-400 dark:text-gray-500 flex items-center gap-1">
            <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 rounded">↑ 5%</span> <span className="hidden sm:inline">from last quarter</span>
          </p>
        </div>

        <div className="col-span-2 md:col-span-1 bg-gradient-to-br from-red-50 to-orange-50/50 dark:from-[#151010] dark:to-[#100a0a] border border-red-100 dark:border-red-500/10 rounded-2xl p-4 md:p-6 relative group transition-colors shadow-sm dark:shadow-none">
          <button className="hidden md:block absolute top-6 right-6 text-red-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400"><Icons.Dots /></button>
          <h3 className="text-xs md:text-sm font-bold text-red-600/80 dark:text-red-400/80 mb-2 md:mb-4">Low Stock Alerts</h3>
          <p className="text-2xl md:text-4xl font-black text-red-600 dark:text-red-400 mb-2 md:mb-4">{inventory.filter(i => i.status === 'Low Stock').length}</p>
          <p className="text-[10px] md:text-xs font-bold text-red-600/80 dark:text-red-500/80 flex items-center gap-1">
            <span>Needs Attention</span>
          </p>
        </div>
      </div>
      
      <div className="bg-white dark:bg-[#121217] border border-slate-200 dark:border-white/5 rounded-3xl p-4 md:p-6 shadow-sm dark:shadow-none">
        <div className="flex justify-between items-center mb-4 md:mb-6">
          <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">Inventory Alerts</h3>
          <button className="bg-slate-50 dark:bg-[#0b0b0f] border border-slate-200 dark:border-white/5 px-3 py-1.5 md:px-4 rounded-lg text-xs font-bold text-slate-600 dark:text-gray-300 hover:bg-slate-100 transition-colors">View All ⌄</button>
        </div>
        <div className="space-y-2 md:space-y-3">
          {inventory.filter(i => i.status === 'Low Stock').map(item => (
            <div key={item.id} className="flex justify-between items-center p-3 md:p-4 bg-white dark:bg-[#0b0b0f] rounded-xl border border-slate-100 dark:border-white/5 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 shadow-[0_0_8px_rgba(139,92,246,0.6)]"></div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{item.name}</p>
                  <p className="text-xs font-mono text-slate-500">{item.sku}</p>
                </div>
              </div>
              <span className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20 px-2.5 py-1 rounded-md text-[10px] md:text-xs font-bold">
                {item.stock} left
              </span>
            </div>
          ))}
          {inventory.filter(i => i.status === 'Low Stock').length === 0 && (
            <p className="text-sm text-slate-500 dark:text-gray-500 py-4 text-center">No low stock alerts at this time.</p>
          )}
        </div>
      </div>
    </div>
  );
}
