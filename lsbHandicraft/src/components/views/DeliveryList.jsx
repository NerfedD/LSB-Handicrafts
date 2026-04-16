import React, { useState, useEffect } from 'react';

export default function DeliveryList({
  deliveries,
  inventory,
  handleEditDelivery,
  handleDeleteDelivery
}) {
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, deliveryId: null, productName: '' });
  const [editingDelivery, setEditingDelivery] = useState(null);
  const [viewOrder, setViewOrder] = useState(null);
  const [statusDropdown, setStatusDropdown] = useState(null);
  const [newDelivery, setNewDelivery] = useState({
    location: ''
  });

  // Close status dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.status-dropdown')) {
        setStatusDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const deliveryStatuses = ['Not yet delivered', 'Ready to deliver', 'On the way', 'Arrived'];

  const updateDeliveryStatus = (deliveryId, status) => {
    const delivery = deliveries.find(d => d.id === deliveryId);
    if (!delivery) return;
    handleEditDelivery({
      ...delivery,
      status
    });
  };

  const openDeleteDialog = (deliveryId, itemName) => {
    setDeleteConfirm({ show: true, deliveryId, productName: itemName });
  };

  const confirmDelete = () => {
    if (deleteConfirm.deliveryId) {
      handleDeleteDelivery(deleteConfirm.deliveryId);
      setDeleteConfirm({ show: false, deliveryId: null, productName: '' });
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm({ show: false, deliveryId: null, productName: '' });
  };

  const openOrderDetails = (delivery) => {
    setViewOrder(delivery);
  };

  const closeOrderDetails = () => {
    setViewOrder(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newDelivery.location) return;

    if (editingDelivery) {
      // Update existing delivery location only
      handleEditDelivery({
        ...editingDelivery,
        location: newDelivery.location
      });
      setEditingDelivery(null);
      setNewDelivery({
        location: ''
      });
    }
  };

  const startEdit = (delivery) => {
    setEditingDelivery(delivery);
    setNewDelivery({
      location: delivery.location || ''
    });
  };

  const cancelEdit = () => {
    setEditingDelivery(null);
    setNewDelivery({
      location: ''
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Not yet delivered':
        return 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/20';
      case 'Ready to deliver':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-500/10 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-500/20';
      case 'On the way':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-500/20';
      case 'Arrived':
        return 'bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-500/20';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-500/10 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-500/20';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-wide">Deliveries</h2>
          <p className="text-xs md:text-sm text-slate-500 dark:text-gray-500 mt-1">Manage deliveries for completed orders.</p>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-3xl p-6">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-blue-900 dark:text-blue-100 mb-1">How Deliveries Work</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Orders are created in the Orders menu. When an order needs delivery, mark it for delivery from the Orders page. 
              Then manage delivery locations and track status here.
            </p>
          </div>
        </div>
      </div>

      {/* Edit Delivery Form */}
      {editingDelivery && (
        <div className="bg-white dark:bg-gradient-to-b dark:from-[#15151a] dark:to-[#121217] border border-slate-200 dark:border-white/5 rounded-3xl p-6 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Edit Delivery for {editingDelivery.customerName}
            </h3>
            <button
              onClick={cancelEdit}
              className="text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
          
          <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <div className="grid grid-cols-1 gap-4 text-sm">
              <div>
                <span className="font-medium text-slate-600 dark:text-gray-400">Items:</span>
                <div className="mt-2 space-y-2 text-slate-900 dark:text-white text-xs md:text-sm">
                  {editingDelivery.items ? (
                    editingDelivery.items.map(item => (
                      <div key={item.product} className="flex justify-between gap-3">
                        <span>{item.product || item.name}</span>
                        <span className="font-semibold">x{item.quantity}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex justify-between gap-3">
                      <span>{editingDelivery.product}</span>
                      <span className="font-semibold">x{editingDelivery.quantity}</span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <span className="font-medium text-slate-600 dark:text-gray-400">Order Total:</span>
                <span className="ml-2 text-slate-900 dark:text-white">₱{editingDelivery.total || 0}</span>
              </div>
              <div>
                <span className="font-medium text-slate-600 dark:text-gray-400">Customer:</span>
                <span className="ml-2 text-slate-900 dark:text-white">{editingDelivery.customerName}</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Delivery Location"
              value={newDelivery.location}
              onChange={(e) => setNewDelivery({...newDelivery, location: e.target.value})}
              className="bg-white dark:bg-[#121217] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/30"
              required
            />
            <button
              type="submit"
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-[0_4px_15px_rgba(139,92,246,0.25)] transition-all active:scale-95"
            >
              Update Delivery
            </button>
          </form>
        </div>
      )}

      {/* Deliveries Table */}
      <div className="bg-white dark:bg-gradient-to-b dark:from-[#15151a] dark:to-[#121217] border border-slate-200 dark:border-white/5 rounded-3xl overflow-hidden shadow-sm dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/5 text-slate-500 dark:text-gray-400 bg-slate-50/80 dark:bg-black/20">
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Customer</th>
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Items</th>
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Total</th>
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Location</th>
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Status</th>
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Order Date</th>
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {deliveries.map(delivery => (
                <tr key={delivery.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.03] transition-colors group">
                  <td className="px-6 py-3 md:py-4">
                    <div className="font-bold text-slate-900 dark:text-gray-200 text-xs md:text-sm">{delivery.customerName}</div>
                    {delivery.customerContact && <div className="text-xs text-slate-500 dark:text-gray-400">{delivery.customerContact}</div>}
                  </td>
                  <td className="px-6 py-3 md:py-4">
                    <div className="space-y-2 text-xs md:text-sm text-slate-900 dark:text-white">
                      {delivery.items ? (
                        delivery.items.map(item => (
                          <div key={item.product || item.name} className="flex justify-between gap-3">
                            <span>{item.product || item.name}</span>
                            <span className="font-semibold">x{item.quantity}</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex justify-between gap-3">
                          <span>{delivery.product}</span>
                          <span className="font-semibold">x{delivery.quantity}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3 md:py-4 font-bold text-slate-900 dark:text-gray-200 text-xs md:text-sm">₱{delivery.total || 0}</td>
                  <td className="px-6 py-3 md:py-4">
                    {delivery.location ? (
                      <span className="text-slate-600 dark:text-gray-400 text-xs md:text-sm">{delivery.location}</span>
                    ) : (
                      <span className="text-orange-600 dark:text-orange-400 text-xs font-medium">Location needed</span>
                    )}
                  </td>
                  <td className="px-6 py-3 md:py-4">
                    <div className="relative status-dropdown">
                      <button
                        onClick={() => setStatusDropdown(statusDropdown === delivery.id ? null : delivery.id)}
                        className={`relative px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all duration-200 flex items-center gap-1 ${getStatusColor(delivery.status)}`}
                      >
                        {delivery.status}
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {statusDropdown === delivery.id && (
                        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#121217] border border-slate-200 dark:border-white/5 rounded-lg shadow-lg z-10 min-w-[120px] flex flex-col">
                          {deliveryStatuses.map(status => (
                            <button
                              key={status}
                              onClick={() => {
                                updateDeliveryStatus(delivery.id, status);
                                setStatusDropdown(null);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-white/5 first:rounded-t-lg last:rounded-b-lg ${
                                delivery.status === status ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400' : 'text-slate-700 dark:text-gray-300'
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3 md:py-4 text-slate-600 dark:text-gray-400 text-xs md:text-sm">{formatDate(delivery.orderCreatedAt || delivery.createdAt)}</td>
                  <td className="px-6 py-3 md:py-4 text-right opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openOrderDetails(delivery)} className="text-slate-600 dark:text-gray-400 font-bold hover:text-violet-600 dark:hover:text-white px-2.5 py-1.5 md:px-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-transparent rounded-lg mr-2 transition-colors text-xs md:text-sm shadow-sm dark:shadow-none">View Order</button>
                    <button onClick={() => startEdit(delivery)} className="text-slate-600 dark:text-gray-400 font-bold hover:text-amber-600 dark:hover:text-white px-2.5 py-1.5 md:px-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-transparent rounded-lg mr-2 transition-colors text-xs md:text-sm shadow-sm dark:shadow-none">Edit</button>
                    <button onClick={() => openDeleteDialog(delivery.id, delivery.items ? delivery.items[0]?.product : delivery.product)} className="text-slate-600 dark:text-gray-400 font-bold hover:text-red-600 dark:hover:text-red-400 px-2.5 py-1.5 md:px-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-transparent rounded-lg transition-colors text-xs md:text-sm shadow-sm dark:shadow-none">Remove</button>
                  </td>
                </tr>
              ))}
              {deliveries.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500 dark:text-gray-500">
                    <div className="space-y-2">
                      <p className="font-bold text-slate-700 dark:text-gray-300">No deliveries pending.</p>
                      <p className="text-sm">Orders marked for delivery will appear here.</p>
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
            <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white text-center mb-2">Remove from Delivery?</h3>
            <p className="text-slate-600 dark:text-gray-400 text-center text-sm md:text-base mb-6">
              Are you sure you want to remove <span className="font-bold text-slate-900 dark:text-white">"{deleteConfirm.productName}"</span> from deliveries? The order will remain but won't be scheduled for delivery.
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

      {viewOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#15151a] border border-slate-200 dark:border-white/5 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">Order #{viewOrder.orderId || viewOrder.id}</h3>
                <p className="text-sm text-slate-500 dark:text-gray-400">{viewOrder.customerName}</p>
              </div>
              <button onClick={closeOrderDetails} className="text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm font-medium">Close</button>
            </div>
            <div className="space-y-4">
              <div className="rounded-3xl bg-slate-50 dark:bg-slate-900 p-4 text-sm text-slate-700 dark:text-gray-300">
                {viewOrder.items ? (
                  <div className="space-y-2">
                    {viewOrder.items.map(item => (
                      <div key={item.product || item.name} className="flex justify-between">
                        <span>{item.product || item.name}</span>
                        <span className="font-semibold">x{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span>{viewOrder.product}</span>
                    <span className="font-semibold">x{viewOrder.quantity}</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm text-slate-600 dark:text-gray-400">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Total</p>
                  <p>₱{viewOrder.total || 0}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Location</p>
                  <p>{viewOrder.location || 'Not set'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm text-slate-600 dark:text-gray-400">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Status</p>
                  <p>{viewOrder.status}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Order Date</p>
                  <p>{formatDate(viewOrder.orderCreatedAt || viewOrder.createdAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}