import React, { useState } from 'react';
import { Icons } from '../components/ui/Icons';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import Dashboard from '../pages/Dashboard';
import InventoryList from '../pages/InventoryList';
import ProductForm from '../pages/ProductForm';
import ProductDetail from '../pages/ProductDetail';
import { useTheme } from '../hooks/useTheme';
import { useInventory } from '../hooks/useInventory';

export default function AdminLayout() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [currentRecord, setCurrentRecord] = useState(null);
  const [formData, setFormData] = useState({ sku: '', name: '', category: 'Styro Balls', price: 0, stock: 0 });

  const { isDarkMode, toggleTheme } = useTheme();
  const { inventory, addItem, editItem, removeItem } = useInventory();

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterCategory === 'All' || item.category === filterCategory;
    return matchesSearch && matchesFilter;
  });

  const handleView = (record) => { setCurrentRecord(record); setActiveTab('detail'); };
  const handleEdit = (record) => { setCurrentRecord(record); setFormData(record); setActiveTab('edit'); };
  
  const handleDelete = (itemId) => {
    removeItem(itemId);
    setCurrentRecord(null);
    setActiveTab('inventory');
  };
  
  const handleSaveCreate = (e) => {
    e.preventDefault();
    addItem(formData);
    setActiveTab('inventory');
    setFormData({ sku: '', name: '', category: 'Styro Balls', price: 0, stock: 0 });
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    editItem(currentRecord.id, formData);
    setActiveTab('inventory');
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#08080b] text-slate-800 dark:text-gray-300 font-sans overflow-hidden selection:bg-violet-500/30 transition-colors duration-300">
      
      {/* DESKTOP SIDEBAR */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* TOP HEADER */}
        <Header 
          isDarkMode={isDarkMode} 
          toggleTheme={toggleTheme} 
          searchQuery={searchQuery} 
          setSearchQuery={setSearchQuery} 
          setActiveTab={setActiveTab} 
          setFormData={setFormData} 
        />

        {/* SCROLLABLE VIEWPORT */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto space-y-6">

            {activeTab === 'dashboard' && (
              <Dashboard inventory={inventory} />
            )}

            {activeTab === 'inventory' && (
              <InventoryList 
                searchQuery={searchQuery} setSearchQuery={setSearchQuery}
                filterCategory={filterCategory} setFilterCategory={setFilterCategory}
                filteredInventory={filteredInventory}
                handleView={handleView} handleEdit={handleEdit} handleDelete={handleDelete}
                setActiveTab={setActiveTab} setFormData={setFormData}
              />
            )}

            {(activeTab === 'create' || activeTab === 'edit') && (
              <ProductForm 
                activeTab={activeTab} setActiveTab={setActiveTab}
                formData={formData} setFormData={setFormData}
                handleSaveCreate={handleSaveCreate} handleSaveEdit={handleSaveEdit}
              />
            )}

            {activeTab === 'detail' && (
              <ProductDetail 
                currentRecord={currentRecord} 
                setActiveTab={setActiveTab} 
                handleEdit={handleEdit}
                handleDelete={handleDelete}
              />
            )}

          </div>
        </div>
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-[#0b0b0f]/80 backdrop-blur-xl border-t border-slate-200 dark:border-white/5 flex justify-around items-center p-2 pb-safe z-50 transition-colors duration-300">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center p-2 rounded-xl transition-colors ${activeTab === 'dashboard' ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 dark:text-gray-500'}`}>
          <Icons.Dashboard />
        </button>
        <button onClick={() => { setFormData({ sku: '', name: '', category: 'Styro Balls', price: 0, stock: 0 }); setActiveTab('create'); }} className="bg-gradient-to-br from-violet-500 to-indigo-600 text-white p-3.5 rounded-full -translate-y-4 shadow-[0_4px_15px_rgba(139,92,246,0.4)] active:scale-95 transition-transform">
          <Icons.Plus />
        </button>
        <button onClick={() => setActiveTab('inventory')} className={`flex flex-col items-center p-2 rounded-xl transition-colors ${activeTab === 'inventory' ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 dark:text-gray-500'}`}>
          <Icons.Inventory />
        </button>
      </nav>
    </div>
  );
}
