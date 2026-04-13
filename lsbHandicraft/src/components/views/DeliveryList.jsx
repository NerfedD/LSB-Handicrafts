import React, { useState } from 'react';

export default function DeliveryList({
  deliveries,
  inventory,
  handleAddDelivery,
  handleEditDelivery,
  handleDeleteDelivery
}) {
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, deliveryId: null, productName: '' });
  const [editingDelivery, setEditingDelivery] = useState(null);
  const [newDelivery, setNewDelivery] = useState({
    product: '',
    size: '',
    location: '',
    status: 'Pending'
  });

  const openDeleteDialog = (deliveryId, productName) => {
    setDeleteConfirm({ show: true, deliveryId, productName });
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newDelivery.product || !newDelivery.location) return;

    if (editingDelivery) {
      // Update existing delivery
      handleEditDelivery({
        ...editingDelivery,
        ...newDelivery
      });
      setEditingDelivery(null);
    } else {
      // Add new delivery
      handleAddDelivery({
        ...newDelivery,
        id: Date.now(),
        createdAt: new Date().toISOString()
      });
    }

    setNewDelivery({
      product: '',
      size: '',
      location: '',
      status: 'Pending'
    });
  };

  const startEdit = (delivery) => {
    setEditingDelivery(delivery);
    setNewDelivery({
      product: delivery.product,
      size: delivery.size,
      location: delivery.location,
      status: delivery.status
    });
  };

  const cancelEdit = () => {
    setEditingDelivery(null);
    setNewDelivery({
      product: '',
      size: '',
      location: '',
      status: 'Pending'
    });
  };

  const handleProductChange = (productName) => {
    const product = inventory.find(item => item.name === productName);
    if (product) {
      // Extract size from product name (e.g., "Styro Ball 2 inch" -> "2 inch")
      const sizeMatch = product.name.match(/(\d+(?:\.\d+)?\s*\w+)$/);
      const size = sizeMatch ? sizeMatch[1] : product.name;
      setNewDelivery({
        ...newDelivery,
        product: productName,
        size: size
      });
    }
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
      case 'Pending': return 'bg-yellow-500';
      case 'In Transit': return 'bg-blue-500';
      case 'Delivered': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-wide">Deliveries</h2>
          <p className="text-xs md:text-sm text-slate-500 dark:text-gray-500 mt-1">Manage delivery orders and track their status.</p>
        </div>
      </div>

      {/* Add/Edit New Delivery Form */}
      <div className="bg-white dark:bg-gradient-to-b dark:from-[#15151a] dark:to-[#121217] border border-slate-200 dark:border-white/5 rounded-3xl p-6 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {editingDelivery ? 'Edit Delivery' : 'Add New Delivery'}
          </h3>
          {editingDelivery && (
            <button
              onClick={cancelEdit}
              className="text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm font-medium"
            >
              Cancel
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={newDelivery.product}
            onChange={(e) => handleProductChange(e.target.value)}
            className="bg-white dark:bg-[#121217] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/30"
            required
          >
            <option value="">Select Product</option>
            {inventory.map(item => (
              <option key={item.id} value={item.name}>{item.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Location"
            value={newDelivery.location}
            onChange={(e) => setNewDelivery({...newDelivery, location: e.target.value})}
            className="bg-white dark:bg-[#121217] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/30"
            required
          />
          <select
            value={newDelivery.status}
            onChange={(e) => setNewDelivery({...newDelivery, status: e.target.value})}
            className="bg-white dark:bg-[#121217] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/30"
          >
            <option value="Pending">Pending</option>
            <option value="In Transit">In Transit</option>
            <option value="Delivered">Delivered</option>
          </select>
          <button
            type="submit"
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-[0_4px_15px_rgba(139,92,246,0.25)] transition-all active:scale-95"
          >
            {editingDelivery ? 'Update Delivery' : 'Add Delivery'}
          </button>
        </form>
      </div>

      {/* Deliveries Table */}
      <div className="bg-white dark:bg-gradient-to-b dark:from-[#15151a] dark:to-[#121217] border border-slate-200 dark:border-white/5 rounded-3xl overflow-hidden shadow-sm dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/5 text-slate-500 dark:text-gray-400 bg-slate-50/80 dark:bg-black/20">
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Product</th>
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Size</th>
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Location</th>
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Status</th>
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs">Order Created</th>
                <th className="px-6 py-4 md:py-5 font-bold uppercase tracking-wider text-[10px] md:text-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {deliveries.map(delivery => (
                <tr key={delivery.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.03] transition-colors group">
                  <td className="px-6 py-3 md:py-4 font-bold text-slate-900 dark:text-gray-200 text-xs md:text-sm">{delivery.product}</td>
                  <td className="px-6 py-3 md:py-4 text-slate-600 dark:text-gray-400 text-xs md:text-sm">{delivery.size}</td>
                  <td className="px-6 py-3 md:py-4 text-slate-600 dark:text-gray-400 text-xs md:text-sm">{delivery.location}</td>
                  <td className="px-6 py-3 md:py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                      delivery.status === 'Pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300' :
                      delivery.status === 'In Transit' ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300' :
                      delivery.status === 'Delivered' ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-300'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full mr-2 ${
                        delivery.status === 'Pending' ? 'bg-yellow-500' :
                        delivery.status === 'In Transit' ? 'bg-blue-500' :
                        delivery.status === 'Delivered' ? 'bg-green-500' :
                        'bg-gray-500'
                      }`}></div>
                      {delivery.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 md:py-4 text-slate-600 dark:text-gray-400 text-xs md:text-sm">{formatDate(delivery.createdAt)}</td>
                  <td className="px-6 py-3 md:py-4 text-right opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(delivery)} className="text-slate-600 dark:text-gray-400 font-bold hover:text-amber-600 dark:hover:text-white px-2.5 py-1.5 md:px-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-transparent rounded-lg mr-2 transition-colors text-xs md:text-sm shadow-sm dark:shadow-none">Edit</button>
                    <button onClick={() => openDeleteDialog(delivery.id, delivery.product)} className="text-slate-600 dark:text-gray-400 font-bold hover:text-red-600 dark:hover:text-red-400 px-2.5 py-1.5 md:px-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-transparent rounded-lg transition-colors text-xs md:text-sm shadow-sm dark:shadow-none">Delete</button>
                  </td>
                </tr>
              ))}
              {deliveries.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500 dark:text-gray-500">
                    <div className="space-y-2">
                      <p className="font-bold text-slate-700 dark:text-gray-300">No deliveries found.</p>
                      <p className="text-sm">Add your first delivery order above.</p>
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
            <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white text-center mb-2">Delete Delivery?</h3>
            <p className="text-slate-600 dark:text-gray-400 text-center text-sm md:text-base mb-6">
              Are you sure you want to delete the delivery for <span className="font-bold text-slate-900 dark:text-white">"{deleteConfirm.productName}"</span>? This action cannot be undone.
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