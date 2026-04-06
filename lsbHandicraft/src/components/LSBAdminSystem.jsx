import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Icons } from './Icons';
import Sidebar from './layout/Sidebar';
import Header from './layout/Header';
import Dashboard from './views/Dashboard';
import InventoryList from './views/InventoryList';
import ProductForm from './views/ProductForm';
import ProductDetail from './views/ProductDetail';

const initialInventory = [
  { id: 1, sku: 'SB-001', name: 'Styro Ball 2 inch', category: 'Styro Balls', price: 15, stock: 120, status: 'In Stock' },
  { id: 2, sku: 'SB-002', name: 'Styro Ball 4 inch', category: 'Styro Balls', price: 30, stock: 45, status: 'Low Stock' },
  { id: 3, sku: 'SS-001', name: 'Styro Sheet 1/2 inch', category: 'Styro Sheets', price: 100, stock: 200, status: 'In Stock' },
  { id: 4, sku: 'SS-002', name: 'Styro Sheet 1 inch', category: 'Styro Sheets', price: 180, stock: 10, status: 'Low Stock' },
];

export default function LSBAdminSystem() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [currentRecord, setCurrentRecord] = useState(null);
  const [formData, setFormData] = useState({ sku: '', name: '', category: 'Styro Balls', price: 0, stock: 0 });

  // Initialize state with localStorage to persist data across reloads
  const [inventory, setInventory] = useState(() => {
    const savedInventory = localStorage.getItem('lsb_inventory');
    if (savedInventory) {
      return JSON.parse(savedInventory);
    }
    return initialInventory;
  });

  // Handle Dark Mode
  useEffect(() => {
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const hasDarkClass = document.documentElement.classList.contains('dark');
    if (hasDarkClass || systemPrefersDark) {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    } else {
      document.documentElement.classList.remove('dark');
      setIsDarkMode(false);
    }
  }, []);

  // Save to localStorage whenever inventory changes
  useEffect(() => {
    localStorage.setItem('lsb_inventory', JSON.stringify(inventory));
  }, [inventory]);

  const toggleTheme = useCallback(() => {
    setIsDarkMode(prev => {
      if (prev) {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }
      return !prev;
    });
  }, []);

  const filteredInventory = useMemo(() => inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterCategory === 'All' || item.category === filterCategory;
    return matchesSearch && matchesFilter;
  }), [inventory, searchQuery, filterCategory]);

  const handleView = useCallback((record) => {
    setCurrentRecord(record);
    setActiveTab('detail');
  }, []);

  const handleEdit = useCallback((record) => {
    setCurrentRecord(record);
    setFormData(record);
    setActiveTab('edit');
  }, []);
  
  const resetFormData = useCallback(() => {
    setFormData({ sku: '', name: '', category: 'Styro Balls', price: 0, stock: 0 });
  }, []);

  const handleSaveCreate = useCallback((e) => {
    e.preventDefault();
    const newRecord = { ...formData, id: Date.now(), status: formData.stock < 50 ? 'Low Stock' : 'In Stock' };
    setInventory(prev => [...prev, newRecord]);
    setActiveTab('inventory');
    resetFormData();
  }, [formData, resetFormData]);

  const handleSaveEdit = useCallback((e) => {
    e.preventDefault();
    setInventory(prev => prev.map(item => 
      item.id === currentRecord.id ? { ...formData, status: formData.stock < 50 ? 'Low Stock' : 'In Stock' } : item
    ));
    setActiveTab('inventory');
  }, [formData, currentRecord]);

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
                handleView={handleView} handleEdit={handleEdit}
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