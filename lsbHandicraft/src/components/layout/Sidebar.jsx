import React from 'react';
import { Icons } from '../Icons';

export default function Sidebar({ activeTab, setActiveTab }) {
  return (
    <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-[#0b0b0f] border-r border-slate-200 dark:border-white/5 h-full transition-colors duration-300">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-black shadow-md shadow-violet-500/20">L</div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">LSB Admin</h1>
      </div>

      <div className="px-3 py-2">
        <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 mb-4 px-3 uppercase tracking-widest">Main Menu</p>
        <nav className="space-y-1.5">
          <button onClick={() => setActiveTab('dashboard')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 border-l-4 ${
              activeTab === 'dashboard' 
                ? 'bg-gradient-to-r from-violet-50/80 to-transparent dark:from-violet-500/10 dark:to-transparent border-violet-600 text-violet-700 dark:text-violet-400 font-bold' 
                : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200 hover:bg-slate-50 dark:hover:bg-white/5 font-medium'
            }`}>
            <Icons.Dashboard /> <span>Dashboard</span>
          </button>
          <button onClick={() => setActiveTab('inventory')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 border-l-4 ${
              activeTab === 'inventory' 
                ? 'bg-gradient-to-r from-violet-50/80 to-transparent dark:from-violet-500/10 dark:to-transparent border-violet-600 text-violet-700 dark:text-violet-400 font-bold' 
                : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200 hover:bg-slate-50 dark:hover:bg-white/5 font-medium'
            }`}>
            <Icons.Inventory /> <span>Inventory</span>
          </button>
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-white/5 flex items-center justify-center text-sm font-bold text-slate-700 dark:text-white">US</div>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">System Admin</p>
            <p className="text-xs text-slate-500 dark:text-gray-500">Davao City</p>
          </div>
        </div>
      </div>
    </aside>
  );
}