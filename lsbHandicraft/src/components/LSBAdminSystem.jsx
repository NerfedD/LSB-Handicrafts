import React, { useState, useEffect } from 'react';

const initialInventory = [
  { id: 1, sku: 'SB-001', name: 'Styro Ball 2 inch', category: 'Styro Balls', price: 15, stock: 120, status: 'In Stock' },
  { id: 2, sku: 'SB-002', name: 'Styro Ball 4 inch', category: 'Styro Balls', price: 30, stock: 45, status: 'Low Stock' },
  { id: 3, sku: 'SS-001', name: 'Styro Sheet 1/2 inch', category: 'Styro Sheets', price: 100, stock: 200, status: 'In Stock' },
  { id: 4, sku: 'SS-002', name: 'Styro Sheet 1 inch', category: 'Styro Sheets', price: 180, stock: 10, status: 'Low Stock' },
];

const Icons = {
  Dashboard: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>,
  Inventory: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>,
  Search: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>,
  Bell: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>,
  Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>,
  Dots: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"></path></svg>
};

export default function LSBAdminSystem() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [inventory, setInventory] = useState(initialInventory);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [currentRecord, setCurrentRecord] = useState(null);
  const [formData, setFormData] = useState({ sku: '', name: '', category: 'Styro Balls', price: 0, stock: 0 });

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

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    }
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterCategory === 'All' || item.category === filterCategory;
    return matchesSearch && matchesFilter;
  });

  const handleView = (record) => { setCurrentRecord(record); setActiveTab('detail'); };
  const handleEdit = (record) => { setCurrentRecord(record); setFormData(record); setActiveTab('edit'); };
  
  const handleSaveCreate = (e) => {
    e.preventDefault();
    const newRecord = { ...formData, id: Date.now(), status: formData.stock < 50 ? 'Low Stock' : 'In Stock' };
    setInventory([...inventory, newRecord]);
    setActiveTab('inventory');
    setFormData({ sku: '', name: '', category: 'Styro Balls', price: 0, stock: 0 });
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    const updatedInventory = inventory.map(item => 
      item.id === currentRecord.id ? { ...formData, status: formData.stock < 50 ? 'Low Stock' : 'In Stock' } : item
    );
    setInventory(updatedInventory);
    setActiveTab('inventory');
  };

  return (
    // Clean, consistent base backgrounds. Crisp in light mode, deep and glassy in dark mode.
    <div className="flex h-screen bg-slate-50 dark:bg-[#08080b] text-slate-800 dark:text-gray-300 font-sans overflow-hidden selection:bg-violet-500/30 transition-colors duration-300">
      
      {/* --- SIDEBAR (DESKTOP) --- */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-[#0b0b0f] border-r border-slate-200 dark:border-white/5 h-full transition-colors duration-300">
        <div className="p-6 flex items-center gap-3">
          {/* Vibrant brand icon gradient */}
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-black shadow-md shadow-violet-500/20">
            L
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">
            LSB Admin
          </h1>
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
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-white/5 flex items-center justify-center text-sm font-bold text-slate-700 dark:text-white">
              US
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">System Admin</p>
              <p className="text-xs text-slate-500 dark:text-gray-500">Davao City</p>
            </div>
          </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* TOP HEADER */}
        <header className="h-20 px-4 md:px-8 flex items-center justify-between bg-white/60 dark:bg-[#0b0b0f]/60 backdrop-blur-xl border-b border-slate-200/50 dark:border-white/5 shrink-0 transition-colors duration-300 z-10">
          
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
            <button className="hidden md:block p-2 text-slate-400 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors relative">
              <Icons.Bell />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-gradient-to-br from-violet-500 to-indigo-500 rounded-full border-2 border-white dark:border-[#0b0b0f]"></span>
            </button>
            <button onClick={() => { setFormData({ sku: '', name: '', category: 'Styro Balls', price: 0, stock: 0 }); setActiveTab('create'); }} 
              className="hidden md:flex ml-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold items-center gap-2 transition-all shadow-[0_4px_15px_rgba(139,92,246,0.25)] dark:shadow-[0_4px_15px_rgba(139,92,246,0.15)]">
              <Icons.Plus /> Add Product
            </button>
          </div>
        </header>

        {/* SCROLLABLE VIEWPORT */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* --- Module 1: Dashboard --- */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-end mb-4 md:mb-8">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-wide">Dashboard</h2>
                    <p className="text-xs md:text-sm text-slate-500 dark:text-gray-500 mt-1">Here is today's report and performances</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
                  {/* Clean white cards in light mode, glassy dark cards in dark mode */}
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
            )}

            {/* --- Module 2 & 6: Inventory List --- */}
            {activeTab === 'inventory' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-4">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-wide">Products</h2>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      className="md:hidden flex-1 bg-white dark:bg-[#121217] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/30" />
                    <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
                      className="bg-white dark:bg-[#121217] border border-slate-200 dark:border-white/5 text-slate-700 dark:text-gray-300 text-sm font-medium rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/30">
                      <option value="All">All Categories</option>
                      <option value="Styro Balls">Styro Balls</option>
                      <option value="Styro Sheets">Styro Sheets</option>
                    </select>
                    <button onClick={() => { setFormData({ sku: '', name: '', category: 'Styro Balls', price: 0, stock: 0 }); setActiveTab('create'); }}
                      className="hidden md:flex bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-[0_4px_15px_rgba(139,92,246,0.25)] transition-all active:scale-95 items-center justify-center gap-2">
                      <span>+</span> Add Product
                    </button>
                  </div>
                </div>

                <div className="bg-white dark:bg-gradient-to-b dark:from-[#15151a] dark:to-[#121217] border border-slate-200 dark:border-white/5 rounded-3xl overflow-hidden shadow-sm dark:shadow-none">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-white/5 text-slate-500 dark:text-gray-400 bg-slate-50/80 dark:bg-black/20">
                          <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">SKU</th>
                          <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Product Name</th>
                          <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Category</th>
                          <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Status</th>
                          <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Stock Level</th>
                          <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {filteredInventory.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.03] transition-colors group">
                            <td className="px-6 py-3 md:py-4 font-mono font-medium text-slate-500 dark:text-gray-400 text-xs md:text-sm">{item.sku}</td>
                            <td className="px-6 py-3 md:py-4 font-bold text-slate-900 dark:text-gray-200 text-xs md:text-sm">{item.name}</td>
                            <td className="px-6 py-3 md:py-4 text-slate-600 dark:text-gray-400 text-xs md:text-sm">{item.category}</td>
                            <td className="px-6 py-3 md:py-4">
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'Low Stock' ? 'bg-orange-500' : 'bg-violet-500'}`}></div>
                                <span className="text-slate-700 dark:text-gray-300 font-medium text-xs md:text-sm">{item.status}</span>
                              </div>
                            </td>
                            <td className="px-6 py-3 md:py-4">
                              <div className="flex items-center gap-2 md:gap-3">
                                <div className="w-16 md:w-24 h-1.5 bg-slate-100 dark:bg-[#0b0b0f] rounded-full overflow-hidden shadow-inner">
                                  <div className={`h-full rounded-full bg-gradient-to-r ${item.stock < 50 ? 'from-orange-500 to-red-500' : 'from-violet-500 to-indigo-500'}`} style={{ width: `${Math.min((item.stock / 200) * 100, 100)}%` }}></div>
                                </div>
                                <span className="font-bold text-slate-700 dark:text-gray-400 text-xs md:text-sm w-6">{item.stock}</span>
                              </div>
                            </td>
                            <td className="px-6 py-3 md:py-4 text-right opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleView(item)} className="text-slate-600 dark:text-gray-400 font-bold hover:text-violet-600 dark:hover:text-white px-2.5 py-1.5 md:px-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-transparent rounded-lg mr-2 transition-colors text-xs md:text-sm shadow-sm dark:shadow-none">View</button>
                              <button onClick={() => handleEdit(item)} className="text-slate-600 dark:text-gray-400 font-bold hover:text-amber-600 dark:hover:text-white px-2.5 py-1.5 md:px-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-transparent rounded-lg transition-colors text-xs md:text-sm shadow-sm dark:shadow-none">Edit</button>
                            </td>
                          </tr>
                        ))}
                        {filteredInventory.length === 0 && (
                          <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-500 dark:text-gray-500">No products found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* --- Module 3 & 4: Form --- */}
            {(activeTab === 'create' || activeTab === 'edit') && (
              <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                <button onClick={() => setActiveTab('inventory')} className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white font-bold text-xs md:text-sm mb-4 md:mb-6 flex items-center gap-2 transition-colors">
                  ← Back to Inventory
                </button>
                
                <div className="bg-white dark:bg-[#121217] border border-slate-200 dark:border-white/5 rounded-3xl p-5 md:p-8 shadow-lg dark:shadow-2xl">
                  <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-6 md:mb-8">
                    {activeTab === 'create' ? 'Create New Product' : 'Edit Product'}
                  </h2>

                  <form onSubmit={activeTab === 'create' ? handleSaveCreate : handleSaveEdit} className="space-y-4 md:space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">SKU Code</label>
                        <input required type="text" className="w-full bg-slate-50 dark:bg-[#0b0b0f] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 md:py-3 text-sm md:text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-colors shadow-inner dark:shadow-none" 
                          value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Category</label>
                        <select className="w-full bg-slate-50 dark:bg-[#0b0b0f] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 md:py-3 text-sm md:text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-colors appearance-none shadow-inner dark:shadow-none"
                          value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                          <option value="Styro Balls">Styro Balls</option>
                          <option value="Styro Sheets">Styro Sheets</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Product Name</label>
                      <input required type="text" className="w-full bg-slate-50 dark:bg-[#0b0b0f] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 md:py-3 text-sm md:text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-colors shadow-inner dark:shadow-none" 
                        value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Price (₱)</label>
                        <input required type="number" min="0" className="w-full bg-slate-50 dark:bg-[#0b0b0f] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 md:py-3 text-sm md:text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-colors shadow-inner dark:shadow-none" 
                          value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Stock</label>
                        <input required type="number" min="0" className="w-full bg-slate-50 dark:bg-[#0b0b0f] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2.5 md:py-3 text-sm md:text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-colors shadow-inner dark:shadow-none" 
                          value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} />
                      </div>
                    </div>

                    <div className="pt-4 md:pt-6">
                      <button type="submit" className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white py-3 md:py-4 rounded-xl font-bold shadow-[0_4px_15px_rgba(139,92,246,0.3)] transition-all active:scale-[0.98] text-sm md:text-base">
                        {activeTab === 'create' ? 'Save Product' : 'Update Product'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* --- Module 5: Detail View --- */}
            {activeTab === 'detail' && currentRecord && (
              <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                <button onClick={() => setActiveTab('inventory')} className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white font-bold text-xs md:text-sm mb-4 md:mb-6 flex items-center gap-2 transition-colors">
                  ← Back to Inventory
                </button>
                
                <div className="bg-white dark:bg-[#15151a] border border-slate-200 dark:border-white/5 rounded-3xl p-6 md:p-8 shadow-xl dark:shadow-2xl relative overflow-hidden">
                  
                  {/* Clean violet blur in Light Mode, deep glow in Dark Mode */}
                  <div className="absolute top-0 right-0 w-48 h-48 md:w-64 md:h-64 bg-violet-100/50 dark:bg-violet-500/10 rounded-full blur-3xl -z-10 translate-x-1/3 -translate-y-1/3"></div>
                  
                  <div className="flex flex-col md:flex-row justify-between items-start mb-6 md:mb-8 gap-4">
                    <div>
                      <p className="text-violet-600 dark:text-violet-400 text-[10px] md:text-sm font-bold uppercase tracking-widest mb-1 md:mb-2">{currentRecord.category}</p>
                      <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-1 md:mb-2">{currentRecord.name}</h2>
                      <p className="text-slate-500 dark:text-gray-500 font-mono font-medium text-xs md:text-sm">SKU: {currentRecord.sku}</p>
                    </div>
                    <div className={`px-3 md:px-4 py-1.5 rounded-lg text-[10px] md:text-xs font-bold border ${currentRecord.status === 'Low Stock' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/20' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>
                      {currentRecord.status}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
                    <div className="bg-slate-50 dark:bg-[#0b0b0f] border border-slate-100 dark:border-white/5 p-4 md:p-6 rounded-2xl shadow-inner dark:shadow-none">
                      <p className="text-slate-500 dark:text-gray-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1 md:mb-2">Unit Price</p>
                      <p className="text-xl md:text-2xl font-black text-slate-900 dark:text-white"><span className="text-slate-400 dark:text-gray-600 mr-1">₱</span>{currentRecord.price}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-[#0b0b0f] border border-slate-100 dark:border-white/5 p-4 md:p-6 rounded-2xl shadow-inner dark:shadow-none">
                      <p className="text-slate-500 dark:text-gray-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1 md:mb-2">Stock Level</p>
                      <p className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">{currentRecord.stock} <span className="text-xs md:text-sm text-slate-400 dark:text-gray-600 font-bold">pcs</span></p>
                    </div>
                  </div>

                  <button onClick={() => handleEdit(currentRecord)} className="w-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-900 dark:text-white py-3 md:py-4 rounded-xl font-bold border border-slate-200 dark:border-white/5 transition-all text-sm md:text-base">
                    Edit Details
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* --- MOBILE BOTTOM NAVIGATION --- */}
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