import React, { useState, useEffect } from 'react';
import { Icons } from '../Icons';

export default function OrdersList({ inventory, orders, setOrders, deliveries, setDeliveries }) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [orderItems, setOrderItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, orderId: null, customerName: '' });
  const [editingOrder, setEditingOrder] = useState(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(null);

  // Close status dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.status-dropdown')) {
        setShowStatusDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addOrderItem = (productId) => {
    const product = inventory.find(p => p.id === productId);
    if (!product) return;

    const existingItem = orderItems.find(item => item.productId === productId);
    if (existingItem) {
      setOrderItems(orderItems.map(item =>
        item.productId === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setOrderItems([...orderItems, {
        productId,
        name: product.name,
        price: product.price,
        quantity: 1
      }]);
    }
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      setOrderItems(orderItems.filter(item => item.productId !== productId));
    } else {
      setOrderItems(orderItems.map(item =>
        item.productId === productId
          ? { ...item, quantity: parseInt(quantity) || 0 }
          : item
      ));
    }
  };

  const calculateTotal = () => {
    return orderItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const createOrder = () => {
    if (orderItems.length === 0 || !customerName.trim()) return;

    const newOrder = {
      id: Date.now(),
      customerName: customerName.trim(),
      customerContact: customerContact.trim(),
      items: orderItems,
      total: calculateTotal(),
      status: 'Pending',
      createdAt: new Date().toISOString()
    };

    setOrders([...orders, newOrder]);
    setOrderItems([]);
    setCustomerName('');
    setCustomerContact('');
    setShowCreateForm(false);
  };

  const updateOrderStatus = (orderId, status) => {
    setOrders(orders.map(order =>
      order.id === orderId ? { ...order, status } : order
    ));
  };

  const openDeleteDialog = (orderId, customerName) => {
    setDeleteConfirm({ show: true, orderId, customerName });
  };

  const confirmDelete = () => {
    if (deleteConfirm.orderId) {
      setOrders(orders.filter(order => order.id !== deleteConfirm.orderId));
      setDeleteConfirm({ show: false, orderId: null, customerName: '' });
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm({ show: false, orderId: null, customerName: '' });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-500/20';
      case 'Processing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-500/20';
      case 'Completed':
        return 'bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-500/20';
      case 'Cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/20';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-500/10 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-500/20';
    }
  };

  const handleEditOrder = (order) => {
    setEditingOrder(order);
    setOrderItems(order.items);
    setCustomerName(order.customerName);
    setCustomerContact(order.customerContact || '');
    setShowCreateForm(true);
  };

  const updateOrder = () => {
    if (orderItems.length === 0 || !customerName.trim() || !editingOrder) return;

    const updatedOrder = {
      ...editingOrder,
      customerName: customerName.trim(),
      customerContact: customerContact.trim(),
      items: orderItems,
      total: calculateTotal()
    };

    setOrders(orders.map(order =>
      order.id === editingOrder.id ? updatedOrder : order
    ));

    setEditingOrder(null);
    setOrderItems([]);
    setCustomerName('');
    setCustomerContact('');
    setShowCreateForm(false);
  };

  const cancelEdit = () => {
    setEditingOrder(null);
    setOrderItems([]);
    setCustomerName('');
    setCustomerContact('');
    setShowCreateForm(false);
  };

  const handleMarkForDelivery = (order) => {
    const existingDelivery = deliveries.find(d => d.orderId === order.id);
    if (existingDelivery) {
      alert('This order is already marked for delivery.');
      return;
    }

    const deliveryRecord = {
      id: Date.now(),
      orderId: order.id,
      customerName: order.customerName,
      customerContact: order.customerContact || '',
      items: order.items.map(item => ({ product: item.name, quantity: item.quantity, price: item.price })),
      total: order.total,
      location: '',
      status: 'Ready to deliver',
      createdAt: new Date().toISOString(),
      orderCreatedAt: order.createdAt
    };

    setDeliveries(prev => [...prev, deliveryRecord]);
    alert('Order marked for delivery successfully!');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-wide">Orders</h2>
          <p className="text-xs md:text-sm text-slate-500 dark:text-gray-500 mt-1">Create and manage customer orders.</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-[0_4px_15px_rgba(139,92,246,0.25)] transition-all active:scale-95 flex items-center gap-2"
        >
          <Icons.Plus className="w-4 h-4" /> Create Order
        </button>
      </div>

      {/* Create/Edit Order Form */}
      {showCreateForm && (
        <div className="bg-white dark:bg-gradient-to-b dark:from-[#15151a] dark:to-[#121217] border border-slate-200 dark:border-white/5 rounded-3xl p-6 shadow-sm dark:shadow-none">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
            {editingOrder ? 'Update Order' : 'Create New Order'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Customer Name *</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-white dark:bg-[#121217] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/30"
                placeholder="Enter customer name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Contact Info</label>
              <input
                type="text"
                value={customerContact}
                onChange={(e) => setCustomerContact(e.target.value)}
                className="w-full bg-white dark:bg-[#121217] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/30"
                placeholder="Phone or email"
              />
            </div>
          </div>

          <div className="mb-6">
            <h4 className="text-md font-bold text-slate-900 dark:text-white mb-3">Add Products</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {inventory.map(product => (
                <button
                  key={product.id}
                  onClick={() => addOrderItem(product.id)}
                  className="p-3 bg-slate-50 dark:bg-[#0b0b0f] border border-slate-200 dark:border-white/5 rounded-xl hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors text-left"
                >
                  <div className="font-medium text-slate-900 dark:text-white text-sm">{product.name}</div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">₱{product.price} • {product.stock} in stock</div>
                </button>
              ))}
            </div>
          </div>

          {orderItems.length > 0 && (
            <div className="mb-6">
              <h4 className="text-md font-bold text-slate-900 dark:text-white mb-3">Order Items</h4>
              <div className="space-y-3">
                {orderItems.map(item => (
                  <div key={item.productId} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#0b0b0f] rounded-xl">
                    <div className="flex-1">
                      <div className="font-medium text-slate-900 dark:text-white">{item.name}</div>
                      <div className="text-sm text-slate-500 dark:text-gray-400">₱{item.price} each</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.productId, e.target.value)}
                        className="w-16 bg-white dark:bg-[#121217] border border-slate-200 dark:border-white/5 rounded-lg px-2 py-1 text-center text-sm"
                      />
                      <div className="font-bold text-slate-900 dark:text-white">₱{item.price * item.quantity}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-slate-900 dark:text-white">Total:</span>
                  <span className="text-xl font-bold text-violet-600 dark:text-violet-400">₱{calculateTotal()}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={editingOrder ? cancelEdit : () => setShowCreateForm(false)}
              className="flex-1 px-4 py-2 rounded-xl font-bold border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={editingOrder ? updateOrder : createOrder}
              disabled={orderItems.length === 0 || !customerName.trim()}
              className="flex-1 px-4 py-2 rounded-xl font-bold bg-violet-600 hover:bg-violet-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white transition-colors"
            >
              {editingOrder ? 'Update Order' : 'Create Order'}
            </button>
          </div>
        </div>
      )}

      {/* Orders List */}
      <div className="bg-white dark:bg-gradient-to-b dark:from-[#15151a] dark:to-[#121217] border border-slate-200 dark:border-white/5 rounded-3xl overflow-hidden shadow-sm dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/5 text-slate-500 dark:text-gray-400 bg-slate-50/80 dark:bg-black/20">
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Order ID</th>
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Customer</th>
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Items</th>
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Total</th>
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Status</th>
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Date</th>
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.03] transition-colors">
                  <td className="px-6 py-3 md:py-4 font-mono font-medium text-slate-500 dark:text-gray-400 text-xs md:text-sm">#{order.id}</td>
                  <td className="px-6 py-3 md:py-4">
                    <div className="font-bold text-slate-900 dark:text-gray-200 text-xs md:text-sm">{order.customerName}</div>
                    {order.customerContact && <div className="text-xs text-slate-500 dark:text-gray-400">{order.customerContact}</div>}
                  </td>
                  <td className="px-6 py-3 md:py-4 text-slate-600 dark:text-gray-400 text-xs md:text-sm">
                    {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-6 py-3 md:py-4 font-bold text-violet-600 dark:text-violet-400">₱{order.total}</td>
                  <td className="px-6 py-3 md:py-4">
                    <div className="relative status-dropdown">
                      <button
                        onClick={() => setShowStatusDropdown(showStatusDropdown === order.id ? null : order.id)}
                        className={`relative px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all duration-200 flex items-center gap-1 ${getStatusColor(order.status)}`}
                      >
                        {order.status}
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {showStatusDropdown === order.id && (
                        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#121217] border border-slate-200 dark:border-white/5 rounded-lg shadow-lg z-10 min-w-[120px] flex flex-col">
                          {['Pending', 'Processing', 'Completed', 'Cancelled'].map(status => (
                            <button
                              key={status}
                              onClick={() => {
                                updateOrderStatus(order.id, status);
                                setShowStatusDropdown(null);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-white/5 first:rounded-t-lg last:rounded-b-lg ${
                                order.status === status ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400' : 'text-slate-700 dark:text-gray-300'
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3 md:py-4 text-slate-600 dark:text-gray-400 text-xs md:text-sm">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3 md:py-4 text-right">
                    <button onClick={() => handleEditOrder(order)} className="text-slate-600 dark:text-gray-400 font-bold hover:text-violet-600 dark:hover:text-white px-2.5 py-1.5 md:px-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-transparent rounded-lg mr-2 transition-colors text-xs md:text-sm shadow-sm dark:shadow-none">
                      Update Order
                    </button>
                    <button onClick={() => handleMarkForDelivery(order)} className="text-slate-600 dark:text-gray-400 font-bold hover:text-blue-600 dark:hover:text-blue-400 px-2.5 py-1.5 md:px-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-transparent rounded-lg mr-2 transition-colors text-xs md:text-sm shadow-sm dark:shadow-none">
                      Mark for Delivery
                    </button>
                    <button onClick={() => openDeleteDialog(order.id, order.customerName)} className="text-slate-600 dark:text-gray-400 font-bold hover:text-red-600 dark:hover:text-red-400 px-2.5 py-1.5 md:px-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-transparent rounded-lg transition-colors text-xs md:text-sm shadow-sm dark:shadow-none">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500 dark:text-gray-500">
                    <div className="space-y-2">
                      <p className="font-bold text-slate-700 dark:text-gray-300">No orders yet.</p>
                      <p className="text-sm">Create your first order to get started.</p>
                      <button
                        onClick={() => setShowCreateForm(true)}
                        className="mt-2 inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                      >
                        <Icons.Plus className="w-4 h-4" /> Create Order
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#15151a] border border-slate-200 dark:border-white/5 rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 dark:bg-red-500/10 mb-4 mx-auto">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white text-center mb-2">Delete Order?</h3>
            <p className="text-slate-600 dark:text-gray-400 text-center text-sm md:text-base mb-6">
              Are you sure you want to delete the order for <span className="font-bold text-slate-900 dark:text-white">"{deleteConfirm.customerName}"</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelDelete}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors text-sm md:text-base"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold bg-red-600 hover:bg-red-500 text-white shadow-[0_4px_15px_rgba(220,38,38,0.2)] transition-colors text-sm md:text-base"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}