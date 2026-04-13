import React, { useState } from 'react';
import { Icons } from '../Icons';

export default function Header({ isDarkMode, toggleTheme, searchQuery, setSearchQuery, setActiveTab, onCreateClick }) {
  const [showNotifications, setShowNotifications] = useState(false);
  return (
    <header className="h-20 px-4 md:px-8 flex items-center justify-between bg-white/60 dark:bg-[#0b0b0f]/60 backdrop-blur-xl border-b border-slate-200/50 dark:border-white/5 shrink-0 transition-colors duration-300 z-10 relative">
      <div className="md:hidden flex items-center gap-3">
         <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-black shadow-md">L</div>
         <h1 className="text-lg font-bold text-slate-900 dark:text-white">LSB</h1>
      </div>

      <div className="hidden md:flex items-center gap-4 w-full max-w-md">
        <div className="relative w-full flex items-center">
          <span className="absolute left-4 text-slate-400 dark:text-gray-500"><Icons.Search /></span>
          <input type="text" placeholder="Search something..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setActiveTab('inventory'); }}
            className="w-full bg-slate-100/80 dark:bg-[#121217] border border-transparent dark:border-white/5 rounded-full py-2.5 pl-12 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-colors" />
        </div>
      </div>
      
      <div className="flex items-center gap-2 md:gap-4">
        <button onClick={toggleTheme} className="p-2.5 rounded-full bg-slate-100 dark:bg-[#121217] text-slate-600 dark:text-gray-400 hover:text-violet-600 dark:hover:text-white transition-all shadow-sm dark:shadow-none">
          {isDarkMode ? '☀️' : '🌙'}
        </button>
        <button className="hidden md:block p-2 text-slate-400 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors relative" onClick={() => setShowNotifications(!showNotifications)}>
          <Icons.Bell />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-gradient-to-br from-violet-500 to-indigo-500 rounded-full border-2 border-white dark:border-[#0b0b0f]"></span>
        </button>
        {showNotifications && (
          <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-[#121217] border border-slate-200 dark:border-white/5 rounded-2xl shadow-lg dark:shadow-2xl z-50 p-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Notifications</h3>
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-[#0b0b0f] rounded-lg">
                <p className="text-xs text-slate-600 dark:text-gray-400">New delivery order received for Styro Ball 2 inch</p>
                <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">2 minutes ago</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-[#0b0b0f] rounded-lg">
                <p className="text-xs text-slate-600 dark:text-gray-400">Stock low for Styro Sheet 1 inch</p>
                <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">1 hour ago</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-[#0b0b0f] rounded-lg">
                <p className="text-xs text-slate-600 dark:text-gray-400">Delivery status updated to "Arrived"</p>
                <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">3 hours ago</p>
              </div>
            </div>
          </div>
        )}
        <button onClick={onCreateClick} 
          className="hidden md:flex ml-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold items-center gap-2 transition-all shadow-[0_4px_15px_rgba(139,92,246,0.25)] dark:shadow-[0_4px_15px_rgba(139,92,246,0.15)]">
          <Icons.Plus /> Add Product
        </button>
      </div>
    </header>
  );
}