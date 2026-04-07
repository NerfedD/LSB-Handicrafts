import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import Sidebar from './layout/Sidebar';
import Header from './layout/Header';
import Dashboard from './views/Dashboard';
import InventoryList from './views/InventoryList';
import ProductForm from './views/ProductForm';
import ProductDetail from './views/ProductDetail';
import { saveInventory, loadInventory, deleteFromInventory } from '../utils/storageManager';

const initialInventory = [
  { id: 1, sku: 'SB-001', name: 'Styro Ball 2 inch', category: 'Styro Balls', price: 15, stock: 120, status: 'In Stock' },
  { id: 2, sku: 'SB-002', name: 'Styro Ball 4 inch', category: 'Styro Balls', price: 30, stock: 45, status: 'Low Stock' },
  { id: 3, sku: 'SS-001', name: 'Styro Sheet 1/2 inch', category: 'Styro Sheets', price: 100, stock: 200, status: 'In Stock' },
  { id: 4, sku: 'SS-002', name: 'Styro Sheet 1 inch', category: 'Styro Sheets', price: 180, stock: 10, status: 'Low Stock' },
];

const emptyFormData = { sku: '', name: '', category: 'Styro Balls', price: '', stock: '' };

const getStatusFromStock = (stock) => (Number(stock) < 50 ? 'Low Stock' : 'In Stock');

const validateForm = (data, inventory, currentId = null) => {
  const errors = {};

  if (!data.sku.trim()) errors.sku = 'SKU is required.';
  if (!data.name.trim()) errors.name = 'Product name is required.';
  if (!data.category.trim()) errors.category = 'Category is required.';
  if (data.price === '' || Number.isNaN(Number(data.price)) || Number(data.price) < 0) errors.price = 'Enter a valid price.';
  if (data.stock === '' || Number.isNaN(Number(data.stock)) || Number(data.stock) < 0) errors.stock = 'Enter a valid stock count.';

  const duplicateSku = inventory.some(
    (item) => item.sku.trim().toLowerCase() === data.sku.trim().toLowerCase() && item.id !== currentId,
  );
  if (duplicateSku) errors.sku = 'SKU already exists.';

  return errors;
};

export default function LSBAdminSystem() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [sortBy, setSortBy] = useState('name-asc');
  const [currentRecord, setCurrentRecord] = useState(null);
  const [formData, setFormData] = useState(emptyFormData);
  const [formErrors, setFormErrors] = useState({});

  // Initialize state with localStorage using storageManager
  const [inventory, setInventory] = useState(() => {
    return loadInventory(initialInventory);
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

  // Save to localStorage whenever inventory changes using storageManager
  useEffect(() => {
    saveInventory(inventory);
  }, [inventory]);

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    }
  };

  const resetForm = () => {
    setCurrentRecord(null);
    setFormData(emptyFormData);
    setFormErrors({});
  };

  const handleCreateClick = () => {
    resetForm();
    setActiveTab('create');
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterCategory === 'All' || item.category === filterCategory;
    return matchesSearch && matchesFilter;
  });

  const sortedInventory = [...filteredInventory].sort((a, b) => {
    switch (sortBy) {
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'stock-asc':
        return Number(a.stock) - Number(b.stock);
      case 'stock-desc':
        return Number(b.stock) - Number(a.stock);
      case 'price-asc':
        return Number(a.price) - Number(b.price);
      case 'price-desc':
        return Number(b.price) - Number(a.price);
      case 'category-asc':
        return a.category.localeCompare(b.category);
      case 'name-asc':
      default:
        return a.name.localeCompare(b.name);
    }
  });

  const handleView = (record) => { setCurrentRecord(record); setFormErrors({}); setActiveTab('detail'); };
  const handleEdit = (record) => { setCurrentRecord(record); setFormErrors({}); setFormData({
    sku: record.sku,
    name: record.name,
    category: record.category,
    price: String(record.price),
    stock: String(record.stock),
  }); setActiveTab('edit'); };
  
  const handleDelete = (itemId) => {
    const updatedInventory = deleteFromInventory(inventory, itemId);
    setInventory(updatedInventory);
    setCurrentRecord(null);
    setActiveTab('inventory');
  };
  
  const handleSaveCreate = (e) => {
    e.preventDefault();
    const errors = validateForm(formData, inventory);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const newRecord = {
      id: Date.now(),
      sku: formData.sku.trim(),
      name: formData.name.trim(),
      category: formData.category,
      price: Number(formData.price),
      stock: Number(formData.stock),
      status: getStatusFromStock(formData.stock),
    };

    setInventory(prev => [...prev, newRecord]);
    resetForm();
    setActiveTab('inventory');
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    const errors = validateForm(formData, inventory, currentRecord?.id);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0 || !currentRecord) return;

    const updatedInventory = inventory.map(item => 
      item.id === currentRecord.id 
        ? {
            ...item,
            sku: formData.sku.trim(),
            name: formData.name.trim(),
            category: formData.category,
            price: Number(formData.price),
            stock: Number(formData.stock),
            status: getStatusFromStock(formData.stock),
          }
        : item
    );
    setInventory(updatedInventory);
    setCurrentRecord(updatedInventory.find(item => item.id === currentRecord.id) || null);
    resetForm();
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
          onCreateClick={handleCreateClick}
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
                sortBy={sortBy} setSortBy={setSortBy}
                filteredInventory={sortedInventory}
                handleView={handleView} handleEdit={handleEdit} handleDelete={handleDelete}
                setActiveTab={setActiveTab} onCreateClick={handleCreateClick}
              />
            )}

            {(activeTab === 'create' || activeTab === 'edit') && (
              <ProductForm 
                activeTab={activeTab} setActiveTab={setActiveTab}
                formData={formData} setFormData={setFormData}
                handleSaveCreate={handleSaveCreate} handleSaveEdit={handleSaveEdit}
                formErrors={formErrors}
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
        <button onClick={handleCreateClick} className="bg-gradient-to-br from-violet-500 to-indigo-600 text-white p-3.5 rounded-full -translate-y-4 shadow-[0_4px_15px_rgba(139,92,246,0.4)] active:scale-95 transition-transform">
          <Icons.Plus />
        </button>
        <button onClick={() => setActiveTab('inventory')} className={`flex flex-col items-center p-2 rounded-xl transition-colors ${activeTab === 'inventory' ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 dark:text-gray-500'}`}>
          <Icons.Inventory />
        </button>
      </nav>
    </div>
  );
}