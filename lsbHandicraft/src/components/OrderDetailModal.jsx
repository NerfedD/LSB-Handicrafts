import React from 'react';
import { X, Edit2, Trash2 } from 'lucide-react';
import StatusDotLabel from './shared/StatusDotLabel';

export default function OrderDetailModal({ isOpen, order, onClose, onDelete, navigateTo }) {
  if (!isOpen || !order) return null;

  const totalItems = order.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="sticky top-0 flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Order #{order.id}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Customer Name</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">{order.customerName}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Order Date</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">{order.date}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Status</p>
              <StatusDotLabel 
                label={order.status}
                dotClassName={
                  order.status === 'Pending' ? 'bg-yellow-500' :
                  order.status === 'Completed' ? 'bg-emerald-500' :
                  'bg-red-500'
                }
                textClassName={
                  order.status === 'Pending' ? 'text-yellow-600 dark:text-yellow-500' :
                  order.status === 'Completed' ? 'text-emerald-600 dark:text-emerald-500' :
                  'text-red-600 dark:text-red-500'
                }
              />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Items</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">{totalItems}</p>
            </div>
          </div>

          {/* Items List */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Order Items</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {order.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{item.product}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-semibold text-slate-900 dark:text-white">₱{(item.price * item.quantity).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-slate-700/50 dark:to-slate-700/30 p-4 rounded-lg border border-violet-200 dark:border-slate-600">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-slate-900 dark:text-white">Total Amount:</span>
              <span className="text-2xl font-bold text-violet-600 dark:text-violet-400">₱{order.totalAmount?.toFixed(2)}</span>
            </div>
          </div>

          {/* Timestamps */}
          <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <p>Created: {order.createdAt}</p>
            <p>Last Updated: {order.updatedAt}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 flex gap-3 p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-900 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 font-medium transition-colors"
          >
            Close
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Trash2 size={18} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}
