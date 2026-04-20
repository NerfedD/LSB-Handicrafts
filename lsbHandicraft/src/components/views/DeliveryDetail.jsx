import React from 'react';
import { ArrowLeft, Edit2, Trash2, MapPin, Clock, Truck } from 'lucide-react';
import StatusDotLabel from '../shared/StatusDotLabel';

export default function DeliveryDetail({ record, navigateTo, deliveries, setDeliveries, orders = [], showModal, addActivity }) {
  if(!record) {
    console.error('DeliveryDetail: record is null/undefined!', { record, navigateTo });
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 font-bold">Error: No delivery selected. Please go back and try again.</p>
      </div>
    );
  }

  const handleDelete = () => {
    showModal(
      "Delete Delivery",
      "Are you sure you want to remove this delivery record? This action cannot be undone.",
      () => {
        setDeliveries(deliveries.filter(d => d.id !== record.id));
        addActivity?.({
          type: 'Delivery',
          title: 'Delivery Deleted',
          description: `Deleted delivery: ${record.product} to ${record.location}`,
          color: 'bg-red-500'
        });
        navigateTo('deliveries');
      }
    );
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Not Yet Delivered': return 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'On The Way': return 'bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      case 'Delivered': return 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      default: return 'bg-zinc-100 dark:bg-zinc-900/20 border-zinc-200 dark:border-zinc-800';
    }
  };

  // Check if this is an order delivery
  const isOrderDelivery = /Order #\d+/.test(record.product);
  let associatedOrder = null;
  if (isOrderDelivery) {
    const orderMatch = record.product.match(/Order #(\d+)/);
    if (orderMatch) {
      const orderId = parseInt(orderMatch[1], 10);
      associatedOrder = orders.find(o => o.id === orderId);
    }
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 w-full">
      <div className="flex flex-col sm:flex-row justify-start sm:justify-between items-start sm:items-center gap-4 mb-6">
        <button onClick={() => navigateTo('deliveries')} className="text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-white flex items-center gap-3 font-semibold text-xl transition-colors">
          <ArrowLeft size={20} className="text-zinc-500 dark:text-zinc-400" /> Delivery #{record.id}
        </button>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <button onClick={() => navigateTo('edit-delivery', record)} className="flex-1 sm:flex-none justify-center bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Edit2 size={16} /> Edit Delivery
          </button>
          <button onClick={handleDelete} className="flex-1 sm:flex-none justify-center bg-transparent border border-red-200 dark:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 w-full">
        <div className="flex-1 space-y-6">
          <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Delivery Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 sm:gap-y-8 gap-x-6">
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Delivery ID</p>
                <p className="text-zinc-900 dark:text-zinc-200 font-medium">#{record.id}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Product/Order</p>
                <p className="text-zinc-900 dark:text-zinc-200 font-medium">{record.product}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Location</p>
                <p className="text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                  <MapPin size={14} className="text-blue-500" />
                  {record.location}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Status</p>
                <StatusDotLabel status={record.status} />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Delivery Date</p>
                <p className="text-zinc-600 dark:text-zinc-400">{record.createdAt}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Amount</p>
                <p className="text-zinc-900 dark:text-zinc-200 font-semibold">PHP {(record.amount || 0).toFixed(2)}</p>
              </div>
            </div>
          </div>

          {isOrderDelivery && associatedOrder && (
            <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Associated Order Details</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-start p-4 bg-zinc-50 dark:bg-[#1A1A24] rounded-lg border border-zinc-200 dark:border-[#272730]">
                  <div className="flex-1">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">Customer</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{associatedOrder.customerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">Order Total</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">PHP {associatedOrder.totalAmount.toFixed(2)}</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Order Items</p>
                  <div className="space-y-2">
                    {associatedOrder.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-[#1A1A24] rounded border border-zinc-200 dark:border-[#272730]">
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{item.name}</span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">Qty: {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isOrderDelivery && (
            <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Product Details</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-start p-4 bg-zinc-50 dark:bg-[#1A1A24] rounded-lg border border-zinc-200 dark:border-[#272730]">
                  <div className="flex-1">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">Product</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{record.product}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">Size</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{record.size}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-full lg:w-80 space-y-6 shrink-0">
          <div className={`border-2 rounded-2xl p-5 md:p-6 relative overflow-hidden shadow-sm dark:shadow-none ${getStatusColor(record.status)}`}>
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/20 dark:bg-white/5 rounded-full blur-3xl"></div>
            <div className="flex items-center gap-2 mb-6">
              <div className="bg-blue-600 rounded p-1.5"><Truck size={18} className="text-white" /></div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Delivery Summary</h3>
            </div>
            
            <div className="space-y-6 relative z-10">
              <div>
                <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Delivery Amount</p>
                <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">PHP {(record.amount || 0).toFixed(2)}</p>
              </div>
              <div className="pt-4 border-t border-white/30 dark:border-white/10">
                <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-3">Current Status</p>
                <StatusDotLabel status={record.status} />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none">
            <div className="flex items-center gap-2 mb-6">
              <Clock size={18} className="text-zinc-400" />
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Details</h3>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-zinc-500 mb-1">Created Date</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">{record.createdAt}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 mb-1">Delivery Type</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {isOrderDelivery ? 'Order Delivery' : 'Product Delivery'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 mb-1">Destination</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                  <MapPin size={14} className="text-blue-500" />
                  {record.location}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
