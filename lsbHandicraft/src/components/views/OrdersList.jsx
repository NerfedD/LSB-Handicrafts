import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ShoppingCart, Calculator, Truck } from 'lucide-react';
import EmptyState from '../shared/EmptyState';
import ListHeaderBar from '../shared/ListHeaderBar';

export function OrdersList({ orders, setOrders, navigateTo, showModal }) {
  const [statusFilter, setStatusFilter] = useState('All Orders');

  const handleDelete = (id) => {
    showModal(
      "Delete Order",
      "Are you sure you want to remove this order record?",
      () => setOrders(orders.filter(o => o.id !== id))
    );
  };

  const handleStatusChange = (id, newStatus) => {
    setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus } : o));
  };

  const filteredOrders = statusFilter === 'All Orders' 
    ? orders 
    : orders.filter(order => order.status === statusFilter);

  return (
    <div className="animate-in fade-in duration-300 w-full">
      <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl overflow-hidden shadow-sm dark:shadow-lg w-full">
        <ListHeaderBar description="Manage customer orders and track sales">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none bg-zinc-50 dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl pl-4 pr-10 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-blue-500/50 cursor-pointer w-full"
              >
                <option value="All Orders" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">All Orders</option>
                <option value="Pending" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Pending</option>
                <option value="Completed" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Completed</option>
                <option value="Cancelled" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Cancelled</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={16} />
            </div>
            <button 
              onClick={() => navigateTo('create-order')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap w-full sm:w-auto shadow-[0_0_15px_rgba(37,99,235,0.2)]"
            >
              <Plus size={16} /> Create Order
            </button>
          </div>
        </ListHeaderBar>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-[#1F1F2E] text-zinc-500 bg-zinc-50/50 dark:bg-transparent">
                <th className="px-4 md:px-6 py-4 font-semibold text-xs tracking-wider uppercase">Order ID</th>
                <th className="px-4 py-4 font-semibold text-xs tracking-wider uppercase">Customer</th>
                <th className="px-4 py-4 font-semibold text-xs tracking-wider uppercase">Items</th>
                <th className="px-4 py-4 font-semibold text-xs tracking-wider uppercase">Total Amount</th>
                <th className="px-4 py-4 font-semibold text-xs tracking-wider uppercase">Status</th>
                <th className="px-4 py-4 font-semibold text-xs tracking-wider uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-[#1F1F2E]">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-zinc-500 dark:text-zinc-400">
                    <EmptyState
                      title="No orders found"
                      description="Create your first order to start tracking sales."
                      icon={<ShoppingCart size={22} />}
                    />
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-zinc-50 dark:hover:bg-[#1A1A24]/30 transition-colors">
                    <td className="px-4 md:px-6 py-5">
                      <span className="text-zinc-900 dark:text-zinc-100 font-medium">#{order.id.toString().slice(-6)}</span>
                    </td>
                    <td className="px-4 py-5 text-zinc-900 dark:text-zinc-100 font-semibold">{order.customerName}</td>
                    <td className="px-4 py-5 text-zinc-600 dark:text-zinc-400">
                      <div className="flex flex-col">
                        <span className="text-xs">{order.items.length} product(s)</span>
                        <span
                          className="text-[10px] opacity-60 truncate max-w-[90px] sm:max-w-[150px]"
                          title={order.items.map(i => i.name).join(', ')}
                        >
                          {order.items.map(i => i.name).join(', ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-5 text-zinc-900 dark:text-zinc-100 font-bold">
                      PHP {order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-5">
                      <div className="relative inline-block w-[130px]">
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          className={`appearance-none w-full outline-none pr-8 pl-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                            order.status === 'Pending' 
                              ? 'border-yellow-200 text-yellow-600 bg-yellow-50 hover:bg-yellow-100 dark:border-yellow-900/50 dark:text-yellow-500 dark:bg-yellow-950/20 dark:hover:bg-yellow-950/40' 
                              : order.status === 'Completed'
                              ? 'border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-900/50 dark:text-emerald-500 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40'
                              : 'border-red-200 text-red-600 bg-red-50 hover:bg-red-100 dark:border-red-900/50 dark:text-red-500 dark:bg-red-950/20 dark:hover:bg-red-950/40'
                          }`}
                        >
                          <option value="Pending" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Pending</option>
                          <option value="Completed" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Completed</option>
                          <option value="Cancelled" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Cancelled</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-70" />
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-5 text-right flex items-center justify-end gap-1">
                      <button 
                        onClick={() => navigateTo('add-delivery', order)} 
                        title="Create Delivery"
                        className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors inline-block p-2"
                      >
                        <Truck size={16} />
                      </button>
                      <button onClick={() => handleDelete(order.id)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors inline-block p-2">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function CreateOrder({ navigateTo, inventory, orders, setOrders, showModal }) {
  const [customerName, setCustomerName] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [currentItem, setCurrentItem] = useState({ productId: '', quantity: 1 });

  const handleAddItem = () => {
    if (!currentItem.productId || currentItem.quantity <= 0) return;
    
    const product = inventory.find(p => p.id === parseInt(currentItem.productId));
    if (!product) return;

    const existingItemIndex = selectedItems.findIndex(item => item.productId === product.id);
    
    if (existingItemIndex > -1) {
      const updatedItems = [...selectedItems];
      updatedItems[existingItemIndex].quantity += parseInt(currentItem.quantity);
      setSelectedItems(updatedItems);
    } else {
      setSelectedItems([...selectedItems, {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: parseInt(currentItem.quantity)
      }]);
    }
    
    setCurrentItem({ productId: '', quantity: 1 });
  };

  const handleRemoveItem = (index) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedItems.length === 0) return;

    const finalCustomerName = customerName.trim() || "Walk-in Customer";

    showModal(
      "Confirm Order",
      `Create this order for ${finalCustomerName} with a total of PHP ${calculateTotal().toLocaleString()}?`,
      () => {
        const newOrder = {
          id: Date.now(),
          customerName: finalCustomerName,
          items: selectedItems,
          totalAmount: calculateTotal(),
          status: 'Pending',
          createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        };

        setOrders([newOrder, ...orders]);
        navigateTo('orders');
      }
    );
  };

  return (
    <div className="animate-in fade-in duration-300 w-full">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Customer & Item Selection */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Customer Information</h3>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Customer Name</label>
              <input 
                type="text" 
                value={customerName} 
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Walk-in Customer"
                className="w-full bg-white dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Add Products</h3>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 w-full space-y-2">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Product</label>
                <div className="relative">
                  <select 
                    value={currentItem.productId} 
                    onChange={e => setCurrentItem({...currentItem, productId: e.target.value})}
                    className="appearance-none w-full bg-white dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500/50 cursor-pointer"
                  >
                    <option value="" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Select product</option>
                    {inventory.map(p => (
                      <option key={p.id} value={p.id} className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">{p.name} - PHP {p.price}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none" size={16} />
                </div>
              </div>
              <div className="w-full sm:w-24 space-y-2">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Qty</label>
                <input 
                  type="number" 
                  min="1"
                  value={currentItem.quantity} 
                  onChange={e => setCurrentItem({...currentItem, quantity: e.target.value})}
                  className="w-full bg-white dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <button 
                type="button"
                onClick={handleAddItem}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white dark:bg-white dark:text-zinc-900 px-6 py-3 rounded-xl text-sm font-medium dark:hover:opacity-90 transition-all shadow-[0_0_15px_rgba(37,99,235,0.2)] dark:shadow-none"
              >
                Add
              </button>
            </div>

            {selectedItems.length > 0 && (
              <div className="mt-8 border-t border-zinc-100 dark:border-[#1F1F2E] pt-6">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold">
                      <th className="pb-3">Product</th>
                      <th className="pb-3">Price</th>
                      <th className="pb-3">Qty</th>
                      <th className="pb-3 text-right">Subtotal</th>
                      <th className="pb-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-[#1F1F2E]">
                    {selectedItems.map((item, index) => (
                      <tr key={index}>
                        <td className="py-4 font-medium text-zinc-900 dark:text-zinc-200">{item.name}</td>
                        <td className="py-4 text-zinc-500">PHP {item.price.toFixed(2)}</td>
                        <td className="py-4 text-zinc-500">{item.quantity}</td>
                        <td className="py-4 text-right font-semibold text-zinc-900 dark:text-zinc-200">PHP {(item.price * item.quantity).toFixed(2)}</td>
                        <td className="py-4 text-right">
                          <button onClick={() => handleRemoveItem(index)} className="text-zinc-400 hover:text-red-500 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-[#1A1A24] dark:text-white rounded-2xl p-6 shadow-sm dark:shadow-xl sticky top-8 border border-blue-100 dark:border-transparent">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Calculator size={20} className="text-white" />
              </div>
              <h3 className="text-lg font-bold text-blue-900 dark:text-white">Order Summary</h3>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-blue-800/70 dark:text-zinc-400 text-sm font-medium">
                <span>Subtotal</span>
                <span>PHP {calculateTotal().toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-blue-800/70 dark:text-zinc-400 text-sm font-medium">
                <span>Tax (0%)</span>
                <span>PHP 0.00</span>
              </div>
              <div className="border-t border-blue-900/10 dark:border-white/10 pt-4 flex justify-between items-end">
                <span className="text-sm font-bold text-blue-900 dark:text-white">Total Cost</span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">PHP {calculateTotal().toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={handleSubmit}
                disabled={selectedItems.length === 0}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all ${
                  selectedItems.length === 0
                    ? 'bg-blue-900/5 text-blue-900/20 dark:bg-white/5 dark:text-white/20 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 active:scale-[0.98]'
                }`}
              >
                <ShoppingCart size={18} /> Place Order
              </button>
              <button 
                onClick={() => navigateTo('orders')}
                className="w-full py-4 rounded-xl font-medium text-blue-600 hover:text-blue-800 dark:text-zinc-400 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}