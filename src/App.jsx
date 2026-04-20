import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Menu, Download } from 'lucide-react';

import { initialInventory, initialDeliveries, initialOrders } from './utils/data';
import ConfirmModal from './components/ConfirmModal';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './components/views/Dashboard';
import InventoryList from './components/views/InventoryList';
import ProductForm from './components/views/ProductForm';
import ProductDetail from './components/views/ProductDetail';
import { DeliveryList, AddDelivery } from './components/views/DeliveryList';
import { OrdersList, CreateOrder } from './components/views/OrdersList';
import {
  loadInventory,
  loadDeliveries,
  loadOrders,
  saveInventory,
  saveDeliveries,
  saveOrders,
  exportBackupData,
  loadActivityLog,
  saveActivityLog,
} from './utils/storageManager';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [inventory, setInventory] = useState(() => loadInventory(initialInventory));
  const [deliveries, setDeliveries] = useState(() => loadDeliveries(initialDeliveries));
  const [orders, setOrders] = useState(() => loadOrders(initialOrders));
  //ALLU: Persist a chronological activity log so business users can trace key actions after refresh.
  const [activityLog, setActivityLog] = useState(() => loadActivityLog([]));
  const [currentRecord, setCurrentRecord] = useState(null);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar state

  //ALLU: Keep previous snapshots to infer whether records were added, removed, or updated.
  const inventoryInitializedRef = useRef(false);
  const deliveriesInitializedRef = useRef(false);
  const ordersInitializedRef = useRef(false);
  const previousInventoryRef = useRef(inventory);
  const previousDeliveriesRef = useRef(deliveries);
  const previousOrdersRef = useRef(orders);

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

  useEffect(() => {
    saveInventory(inventory);
  }, [inventory]);

  useEffect(() => {
    saveDeliveries(deliveries);
  }, [deliveries]);

  useEffect(() => {
    saveOrders(orders);
  }, [orders]);

  //ALLU: Save activity timeline to local storage so audit context survives page reloads.
  useEffect(() => {
    saveActivityLog(activityLog);
  }, [activityLog]);

  //ALLU: Lightweight activity logger for core inventory/order/delivery actions.
  const addActivity = (type, action, description) => {
    const entry = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      type,
      action,
      description,
      date: new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    };

    setActivityLog((prev) => [entry, ...prev].slice(0, 200));
  };

  //ALLU: Automatically capture inventory changes without rewriting every child action handler.
  useEffect(() => {
    if (!inventoryInitializedRef.current) {
      inventoryInitializedRef.current = true;
      previousInventoryRef.current = inventory;
      return;
    }

    const previous = previousInventoryRef.current;
    if (inventory.length > previous.length) {
      addActivity('Product', 'Added', 'A new product was added to inventory.');
    } else if (inventory.length < previous.length) {
      addActivity('Product', 'Deleted', 'A product was removed from inventory.');
    } else {
      addActivity('Product', 'Updated', 'Product details or stock were updated.');
    }

    previousInventoryRef.current = inventory;
  }, [inventory]);

  //ALLU: Track delivery records and status updates for operational visibility.
  useEffect(() => {
    if (!deliveriesInitializedRef.current) {
      deliveriesInitializedRef.current = true;
      previousDeliveriesRef.current = deliveries;
      return;
    }

    const previous = previousDeliveriesRef.current;
    if (deliveries.length > previous.length) {
      addActivity('Delivery', 'Added', 'A new delivery record was created.');
    } else if (deliveries.length < previous.length) {
      addActivity('Delivery', 'Deleted', 'A delivery record was removed.');
    } else {
      let statusUpdated = false;
      for (const currentDelivery of deliveries) {
        const oldDelivery = previous.find((item) => item.id === currentDelivery.id);
        if (oldDelivery && oldDelivery.status !== currentDelivery.status) {
          statusUpdated = true;
          addActivity('Delivery', 'Status Updated', `${currentDelivery.product} status changed to ${currentDelivery.status}.`);
          break;
        }
      }
      if (!statusUpdated) {
        addActivity('Delivery', 'Updated', 'Delivery details were updated.');
      }
    }

    previousDeliveriesRef.current = deliveries;
  }, [deliveries]);

  //ALLU: Track order creation, deletion, and status progression for business traceability.
  useEffect(() => {
    if (!ordersInitializedRef.current) {
      ordersInitializedRef.current = true;
      previousOrdersRef.current = orders;
      return;
    }

    const previous = previousOrdersRef.current;
    if (orders.length > previous.length) {
      addActivity('Order', 'Added', 'A new customer order was created.');
    } else if (orders.length < previous.length) {
      addActivity('Order', 'Deleted', 'An order record was removed.');
    } else {
      let statusUpdated = false;
      for (const currentOrder of orders) {
        const oldOrder = previous.find((item) => item.id === currentOrder.id);
        if (oldOrder && oldOrder.status !== currentOrder.status) {
          statusUpdated = true;
          addActivity('Order', 'Status Updated', `Order #${currentOrder.id.toString().slice(-6)} changed to ${currentOrder.status}.`);
          break;
        }
      }
      if (!statusUpdated) {
        addActivity('Order', 'Updated', 'Order details were updated.');
      }
    }

    previousOrdersRef.current = orders;
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

  const handleDownloadBackup = () => {
    const backup = exportBackupData({ inventory, deliveries, orders });
    const blob = new Blob([backup], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `lsb-handicrafts-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();

    //ALLU: Record backup exports for accountability and operator traceability.
    addActivity('System', 'Backup Exported', 'Workspace backup JSON was downloaded.');

    URL.revokeObjectURL(url);
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
      case 'create-order': return 'Create Order';
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
          {/* //ALLU: Make the top bar sticky so actions stay reachable while scrolling long lists on mobile. */}
          <header className="sticky top-0 z-20 flex justify-between items-center mb-6 lg:mb-8 shrink-0 pb-4 border-b border-zinc-200 dark:border-[#1F1F2E] bg-zinc-50/90 dark:bg-[#09090B]/90 backdrop-blur">
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
            {/* //ALLU: Keep backup accessible on small screens with an icon-only button for better mobile quality-of-life. */}
            <div className="flex justify-end gap-2 ml-auto items-center">
              <button
                onClick={handleDownloadBackup}
                title="Download backup"
                className="inline-flex sm:hidden w-10 h-10 items-center justify-center rounded-full border border-zinc-200 dark:border-[#272730] bg-white dark:bg-[#111116] text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:border-blue-400/50 transition-colors"
              >
                <Download size={16} />
              </button>
              <button
                onClick={handleDownloadBackup}
                className="hidden sm:inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-[#272730] bg-white dark:bg-[#111116] px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:border-blue-400/50 transition-colors"
              >
                <Download size={14} /> Backup
              </button>
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
            {/* //ALLU: Pass activity log to dashboard so users can view operational history. */}
            {activeTab === 'dashboard' && <Dashboard inventory={inventory} deliveries={deliveries} orders={orders} activityLog={activityLog} />}
            {activeTab === 'inventory' && <InventoryList inventory={inventory} navigateTo={navigateTo} setInventory={setInventory} showModal={showModal} />}
            {activeTab === 'deliveries' && <DeliveryList deliveries={deliveries} setDeliveries={setDeliveries} navigateTo={navigateTo} showModal={showModal} />}
            {activeTab === 'orders' && <OrdersList orders={orders} setOrders={setOrders} inventory={inventory} navigateTo={navigateTo} showModal={showModal} />}
            
            {activeTab === 'add-product' && <ProductForm mode="add" navigateTo={navigateTo} inventory={inventory} setInventory={setInventory} showModal={showModal} />}
            {activeTab === 'edit-product' && <ProductForm mode="edit" record={currentRecord} navigateTo={navigateTo} inventory={inventory} setInventory={setInventory} showModal={showModal} />}
            {activeTab === 'view-product' && <ProductDetail record={currentRecord} navigateTo={navigateTo} inventory={inventory} setInventory={setInventory} showModal={showModal} />}
            {activeTab === 'add-delivery' && <AddDelivery record={currentRecord} navigateTo={navigateTo} inventory={inventory} deliveries={deliveries} setDeliveries={setDeliveries} orders={orders} showModal={showModal} />}
            {activeTab === 'create-order' && <CreateOrder navigateTo={navigateTo} inventory={inventory} orders={orders} setOrders={setOrders} showModal={showModal} />}
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