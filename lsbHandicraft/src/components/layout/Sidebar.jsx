import React from 'react';
import { LayoutDashboard, Package, Truck, X } from 'lucide-react';

export default function Sidebar({ activeTab, navigateTo, isSidebarOpen, setIsSidebarOpen }) {
  const isInventoryGroup = ['inventory', 'add-product', 'edit-product', 'view-product'].includes(activeTab);
  const isDeliveryGroup = ['deliveries', 'add-delivery'].includes(activeTab);

  const handleNavigate = (tab) => {
    navigateTo(tab);
    setIsSidebarOpen(false); // Close menu on mobile after selection
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 dark:bg-black/80 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-[#09090B] border-r border-zinc-200 dark:border-[#1F1F2E] flex flex-col h-full shrink-0 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 rounded-md p-1.5 shadow-lg shadow-blue-600/20 shrink-0">
              <LayoutDashboard size={20} className="text-white" />
            </div>
            <span className="font-bold text-zinc-900 dark:text-white text-lg tracking-wide whitespace-nowrap">LSB Handicrafts</span>
          </div>
          {/* Mobile Close Button */}
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="md:hidden text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-4 py-2 flex-1">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-4 px-2 uppercase tracking-widest">Main Menu</p>
          <nav className="space-y-1">
            <button 
              onClick={() => handleNavigate('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                activeTab === 'dashboard' 
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-500' 
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#1A1A24]'
              }`}
            >
              <div className={activeTab === 'dashboard' ? 'border-l-2 border-blue-600 dark:border-blue-500 h-4 absolute left-4' : 'hidden'}></div>
              <LayoutDashboard size={18} /> <span className="font-medium text-sm">Dashboard</span>
            </button>

            <button 
              onClick={() => handleNavigate('inventory')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                isInventoryGroup
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-500' 
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#1A1A24]'
              }`}
            >
              <div className={isInventoryGroup ? 'border-l-2 border-blue-600 dark:border-blue-500 h-4 absolute left-4' : 'hidden'}></div>
              <Package size={18} /> <span className="font-medium text-sm">Inventory</span>
            </button>

            <button 
              onClick={() => handleNavigate('deliveries')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                isDeliveryGroup
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-500' 
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#1A1A24]'
              }`}
            >
              <div className={isDeliveryGroup ? 'border-l-2 border-blue-600 dark:border-blue-500 h-4 absolute left-4' : 'hidden'}></div>
              <Truck size={18} /> <span className="font-medium text-sm">Deliveries</span>
            </button>
          </nav>
        </div>

        <div className="p-6 border-t border-zinc-200 dark:border-[#1F1F2E]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-[#1A1A24] border border-zinc-200 dark:border-[#272730] flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-300">
              SA
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">System Admin</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-500">Davao City</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}