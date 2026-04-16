import React, { useState, useEffect } from 'react';
import { Sun, Moon, Menu } from 'lucide-react';

import { initialInventory, initialDeliveries } from './utils/data';
import ConfirmModal from './components/ConfirmModal';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './components/views/Dashboard';
import InventoryList from './components/views/InventoryList';
import ProductForm from './components/views/ProductForm';
import ProductDetail from './components/views/ProductDetail';
import { DeliveryList, AddDelivery } from './components/views/DeliveryList';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [inventory, setInventory] = useState(initialInventory);
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar state

  // Manage Dark Mode Classes
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#09090B';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#fafafa'; // zinc-50
    }
  }, [isDarkMode]);

  const navigateTo = (tab, record = null) => {
    setCurrentRecord(record);
    setActiveTab(tab);
  };

  const showModal = (title, message, onConfirm) => {
    setModalConfig({ isOpen: true, title, message, onConfirm });
  };

  const closeModal = () => {
    setModalConfig({ ...modalConfig, isOpen: false });
  };

  const handleConfirm = () => {
    if (modalConfig.onConfirm) modalConfig.onConfirm();
    closeModal();
  };

  return (
    <div className="flex h-screen w-full bg-zinc-50 dark:bg-[#09090B] text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden selection:bg-blue-500/30 transition-colors duration-200">
      
      <Sidebar 
        activeTab={activeTab} 
        navigateTo={navigateTo} 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen} 
      />
      
      <main className="flex-1 flex flex-col h-full overflow-y-auto">
        <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto flex flex-col min-h-full">
          
          {/* Top Header */}
          <header className="flex justify-between items-center mb-6 lg:mb-8 shrink-0">
            {/* Mobile Sidebar Toggle & Title */}
            <div className="flex items-center gap-3 md:hidden">
              <button 
                onClick={() => setIsSidebarOpen(true)} 
                className="text-zinc-600 dark:text-zinc-400 p-2 -ml-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-[#1A1A24] transition-colors"
              >
                <Menu size={24} />
              </button>
              <span className="font-bold text-zinc-900 dark:text-white text-lg tracking-wide">LSB Handicrafts</span>
            </div>

            {/* Spacer */}
            <div className="flex-1 hidden md:block"></div>
            
            {/* Actions */}
            <div className="flex justify-end gap-3 ml-auto">
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)} 
                className="w-10 h-10 rounded-full bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#272730] flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-sm dark:shadow-none"
              >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </header>

          {/* Views Layer */}
          <div className="flex-1 flex flex-col w-full">
            {activeTab === 'dashboard' && <Dashboard inventory={inventory} deliveries={deliveries} />}
            {activeTab === 'inventory' && <InventoryList inventory={inventory} navigateTo={navigateTo} setInventory={setInventory} showModal={showModal} />}
            {activeTab === 'deliveries' && <DeliveryList deliveries={deliveries} setDeliveries={setDeliveries} navigateTo={navigateTo} showModal={showModal} />}
            
            {activeTab === 'add-product' && <ProductForm mode="add" navigateTo={navigateTo} inventory={inventory} setInventory={setInventory} showModal={showModal} />}
            {activeTab === 'edit-product' && <ProductForm mode="edit" record={currentRecord} navigateTo={navigateTo} inventory={inventory} setInventory={setInventory} showModal={showModal} />}
            {activeTab === 'view-product' && <ProductDetail record={currentRecord} navigateTo={navigateTo} inventory={inventory} setInventory={setInventory} showModal={showModal} />}
            {activeTab === 'add-delivery' && <AddDelivery navigateTo={navigateTo} inventory={inventory} deliveries={deliveries} setDeliveries={setDeliveries} showModal={showModal} />}
          </div>

        </div>
      </main>

      <ConfirmModal 
        isOpen={modalConfig.isOpen} 
        title={modalConfig.title} 
        message={modalConfig.message} 
        onConfirm={handleConfirm} 
        onCancel={closeModal} 
      />
    </div>
  );
}