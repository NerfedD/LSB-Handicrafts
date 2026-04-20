import React from 'react';
import { X, Trash2, MapPin, Truck } from 'lucide-react';
import StatusDotLabel from './shared/StatusDotLabel';

export default function DeliveryDetailModal({ isOpen, delivery, onClose, onDelete }) {
  if (!isOpen || !delivery) return null;

  const isOrderDelivery = /Order #\d+/.test(delivery.product);

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="sticky top-0 flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Delivery #{delivery.id}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Delivery Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Item</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">{delivery.product}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Status</p>
              <StatusDotLabel status={delivery.status} />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Location</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <MapPin size={18} className="text-slate-500" /> {delivery.location}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Delivery Date</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">{delivery.date}</p>
            </div>
          </div>

          {/* Amount Card */}
          <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-slate-700/50 dark:to-slate-700/30 p-4 rounded-lg border border-violet-200 dark:border-slate-600">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-slate-900 dark:text-white">Amount:</span>
              <span className="text-2xl font-bold text-violet-600 dark:text-violet-400">₱{delivery.amount?.toFixed(2)}</span>
            </div>
          </div>

          {/* Notes */}
          {delivery.notes && (
            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
              <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Notes</p>
              <p className="text-slate-700 dark:text-slate-300">{delivery.notes}</p>
            </div>
          )}

          {/* Type Badge */}
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Truck size={18} />
            <span className="text-sm">{isOrderDelivery ? 'Order Delivery' : 'Product Delivery'}</span>
          </div>

          {/* Timestamps */}
          <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <p>Created: {delivery.createdAt}</p>
            <p>Last Updated: {delivery.updatedAt}</p>
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
