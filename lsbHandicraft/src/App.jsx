import React, { useState, useEffect } from 'react';
import { Sun, Moon, Menu } from 'lucide-react';

import { initialInventory, initialDeliveries, initialOrders } from './utils/data';
import { saveInventory, loadInventory, saveDeliveries, loadDeliveries, saveOrders, loadOrders } from './utils/storageManager';
import ConfirmModal from './components/ConfirmModal';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './components/views/Dashboard';
import InventoryList from './components/views/InventoryList';
import ProductForm from './components/views/ProductForm';
import ProductDetail from './components/views/ProductDetail';
import { DeliveryList, AddDelivery } from './components/views/DeliveryList';
import { OrdersList, CreateOrder } from './components/views/OrdersList';
import EditDelivery from './components/views/EditDelivery';
import EditOrder from './components/views/EditOrder';
import OrderDetail from './components/views/OrderDetail';
import DeliveryDetail from './components/views/DeliveryDetail';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [inventory, setInventory] = useState(() => {
    // Only clear on first app initialization (check if we've ever run before)
    const hasRunBefore = localStorage.getItem('lsb_app_has_run');
    if (!hasRunBefore) {
      // First run ever - clear old/corrupted data and start fresh
      localStorage.removeItem('lsb_inventory');
      localStorage.removeItem('lsb_inventory_version');
      localStorage.removeItem('lsb_deliveries');
      localStorage.removeItem('lsb_deliveries_version');
      localStorage.removeItem('lsb_orders');
      localStorage.removeItem('lsb_orders_version');
      localStorage.setItem('lsb_app_has_run', 'true');
      return initialInventory;
    }
    // On subsequent runs, load from localStorage
    return loadInventory(initialInventory);
  });
  
  const [deliveries, setDeliveries] = useState(() => {
    const hasRunBefore = localStorage.getItem('lsb_app_has_run');
    if (!hasRunBefore) {
      return initialDeliveries;
    }
    return loadDeliveries(initialDeliveries);
  });
  
  const [orders, setOrders] = useState(() => {
    const hasRunBefore = localStorage.getItem('lsb_app_has_run');
    if (!hasRunBefore) {
      return initialOrders;
    }
    return loadOrders(initialOrders);
  });
  const [currentRecord, setCurrentRecord] = useState(null);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [activityLog, setActivityLog] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar state

  const addActivity = ({ type, title, description, amount, status, color }) => {
    const newActivity = {
      id: Date.now(),
      type,
      title,
      description,
      amount,
      status,
      color,
      date: new Date().toLocaleString(),
    };
    setActivityLog(prev => [newActivity, ...prev]);
  };

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

  // Persist Inventory to localStorage
  useEffect(() => {
    saveInventory(inventory);
  }, [inventory]);

  // Persist Deliveries to localStorage
  useEffect(() => {
    saveDeliveries(deliveries);
  }, [deliveries]);

  // Persist Orders to localStorage
  useEffect(() => {
    saveOrders(orders);
  }, [orders]);

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

  const getPageTitle = (tab) => {
    switch (tab) {
      case 'dashboard': return 'Dashboard';
      case 'inventory': return 'Products'; /* In picture 1, Inventory nav leads to Products header */
      case 'deliveries': return 'Delivery List';
      case 'orders': return 'Orders';
      case 'add-product': return 'Add Product';
      case 'edit-product': return 'Edit Product';
      case 'view-product': return 'View Product';
      case 'add-delivery': return 'Add Delivery';
      case 'edit-delivery': return 'Edit Delivery';
      case 'create-order': return 'Create Order';
      case 'edit-order': return 'Edit Order';
      case 'order-detail': return 'Order Details';
      case 'delivery-detail': return 'Delivery Details';
      default: return 'Dashboard';
    }
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
        <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto flex flex-col min-h-full pb-20">
          
          {/* Top Header */}
          <header className="flex justify-between items-center mb-6 lg:mb-8 shrink-0 pb-4 border-b border-zinc-200 dark:border-[#1F1F2E]">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsSidebarOpen(true)} 
                className="text-zinc-600 dark:text-zinc-400 p-2 -ml-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-[#1A1A24] transition-colors md:hidden"
              >
                <Menu size={24} />
              </button>
              <h1 className="text-2xl font-medium text-zinc-900 dark:text-zinc-100 hidden md:block">
                {getPageTitle(activeTab)}
              </h1>
              <span className="font-bold text-zinc-900 dark:text-white text-lg tracking-wide md:hidden">
                {getPageTitle(activeTab)}
              </span>
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
            {activeTab === 'dashboard' && <Dashboard inventory={inventory} deliveries={deliveries} orders={orders} activityLog={activityLog} />}
            {activeTab === 'inventory' && <InventoryList inventory={inventory} navigateTo={navigateTo} setInventory={setInventory} showModal={showModal} addActivity={addActivity} />}
            {activeTab === 'deliveries' && <DeliveryList deliveries={deliveries} orders={orders} setDeliveries={setDeliveries} navigateTo={navigateTo} showModal={showModal} addActivity={addActivity} />}
            {activeTab === 'orders' && <OrdersList orders={orders} setOrders={setOrders} deliveries={deliveries} setDeliveries={setDeliveries} inventory={inventory} navigateTo={navigateTo} showModal={showModal} addActivity={addActivity} />}
            
            {activeTab === 'add-product' && <ProductForm mode="add" navigateTo={navigateTo} inventory={inventory} setInventory={setInventory} showModal={showModal} />}
            {activeTab === 'edit-product' && <ProductForm mode="edit" record={currentRecord} navigateTo={navigateTo} inventory={inventory} setInventory={setInventory} showModal={showModal} />}
            {activeTab === 'view-product' && <ProductDetail record={currentRecord} navigateTo={navigateTo} inventory={inventory} setInventory={setInventory} showModal={showModal} addActivity={addActivity} />}
            {activeTab === 'add-delivery' && <AddDelivery record={currentRecord} navigateTo={navigateTo} inventory={inventory} deliveries={deliveries} setDeliveries={setDeliveries} orders={orders} showModal={showModal} />}
            {activeTab === 'edit-delivery' && <EditDelivery data={currentRecord} navigateTo={navigateTo} onSave={(updatedDelivery) => {
              setDeliveries(deliveries.map(d => d.id === updatedDelivery.id ? updatedDelivery : d));
              addActivity({
                type: 'Delivery',
                title: 'Delivery Updated',
                description: `Updated delivery: ${updatedDelivery.product}`,
                color: 'bg-blue-500'
              });
            }} showModal={showModal} addActivity={addActivity} />}
            {activeTab === 'create-order' && <CreateOrder navigateTo={navigateTo} inventory={inventory} orders={orders} setOrders={setOrders} showModal={showModal} />}
            {activeTab === 'order-detail' && <OrderDetail record={currentRecord} navigateTo={navigateTo} orders={orders} setOrders={setOrders} deliveries={deliveries} setDeliveries={setDeliveries} showModal={showModal} addActivity={addActivity} />}
            {activeTab === 'delivery-detail' && <DeliveryDetail record={currentRecord} navigateTo={navigateTo} deliveries={deliveries} setDeliveries={setDeliveries} orders={orders} showModal={showModal} addActivity={addActivity} />}
            {activeTab === 'edit-order' && <EditOrder data={currentRecord} navigateTo={navigateTo} onSave={(updatedOrder) => {
              setOrders(orders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
              addActivity({
                type: 'Order',
                title: 'Order Updated',
                description: `Updated order for ${updatedOrder.customerName}`,
                color: 'bg-blue-500'
              });
            }} showModal={showModal} addActivity={addActivity} />}
          </div>

          {/* Spacer to prevent elements sticking to bottom */}
          <div className="h-12 md:h-24 w-full shrink-0"></div>
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