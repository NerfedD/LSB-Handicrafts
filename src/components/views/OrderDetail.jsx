import React from 'react';
import { ArrowLeft, Edit2, Trash2, LayoutDashboard, Clock, ShoppingCart } from 'lucide-react';
import StatusDotLabel from '../shared/StatusDotLabel';

export default function OrderDetail({ record, navigateTo, orders, setOrders, deliveries, setDeliveries, showModal, addActivity }) {
  console.log('OrderDetail component RENDERED with record:', record);
  if(!record) {
    console.error('OrderDetail: record is null/undefined!', { record, navigateTo });
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 font-bold">Error: No order selected. Please go back and try again.</p>
      </div>
    );
  }

  const handleDelete = () => {
    showModal(
      "Delete Order",
      "Are you sure you want to remove this order record? Associated deliveries will also be deleted.",
      () => {
        setOrders(orders.filter(o => o.id !== record.id));
        
        // Delete associated deliveries for this order
        if (deliveries && setDeliveries) {
          const updatedDeliveries = deliveries.filter(d => !d.product.includes(`Order #${record.id}`));
          setDeliveries(updatedDeliveries);
        }
        
        addActivity?.({
          type: 'Order',
          title: 'Order Deleted',
          description: `Deleted order #${record.id} for ${record.customerName}`,
          amount: record.totalAmount,
          color: 'bg-red-500'
        });
        navigateTo('orders');
      }
    );
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Pending': return 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'Completed': return 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'Cancelled': return 'bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      default: return 'bg-zinc-100 dark:bg-zinc-900/20 border-zinc-200 dark:border-zinc-800';
    }
  };

  const totalItems = record.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
  const itemCount = record.items?.length || 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 w-full">
      <div className="flex flex-col sm:flex-row justify-start sm:justify-between items-start sm:items-center gap-4 mb-6">
        <button onClick={() => navigateTo('orders')} className="text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-white flex items-center gap-3 font-semibold text-xl transition-colors">
          <ArrowLeft size={20} className="text-zinc-500 dark:text-zinc-400" /> Order #{record.id}
        </button>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <button onClick={() => navigateTo('edit-order', record)} className="flex-1 sm:flex-none justify-center bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Edit2 size={16} /> Edit Order
          </button>
          <button onClick={handleDelete} className="flex-1 sm:flex-none justify-center bg-transparent border border-red-200 dark:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 w-full">
        <div className="flex-1 space-y-6">
          <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Order Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 sm:gap-y-8 gap-x-6">
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Order ID</p>
                <p className="text-zinc-900 dark:text-zinc-200 font-medium">#{record.id}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Customer Name</p>
                <p className="text-zinc-900 dark:text-zinc-200 font-medium">{record.customerName}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Order Date</p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {record.createdAt ? new Date(record.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Status</p>
                <StatusDotLabel 
                  label={record.status}
                  dotClassName={
                    record.status === 'Pending' ? 'bg-yellow-500' :
                    record.status === 'Completed' ? 'bg-emerald-500' :
                    'bg-red-500'
                  }
                  textClassName={
                    record.status === 'Pending' ? 'text-yellow-600 dark:text-yellow-500' :
                    record.status === 'Completed' ? 'text-emerald-600 dark:text-emerald-500' :
                    'text-red-600 dark:text-red-500'
                  }
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Order Items ({itemCount})</h3>
            {record.items && record.items.length > 0 ? (
              <div className="space-y-3">
                {record.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start p-4 bg-zinc-50 dark:bg-[#1A1A24] rounded-lg border border-zinc-200 dark:border-[#272730]">
                    <div className="flex-1">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">{item.name}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">SKU: {item.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-zinc-900 dark:text-zinc-100 font-semibold">PHP {(item.price * (item.quantity || 1)).toFixed(2)}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Qty: {item.quantity || 1} × PHP {item.price.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">No items in this order</p>
            )}
          </div>
        </div>

        <div className="w-full lg:w-80 space-y-6 shrink-0">
          <div className={`border-2 rounded-2xl p-5 md:p-6 relative overflow-hidden shadow-sm dark:shadow-none ${getStatusColor(record.status)}`}>
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/20 dark:bg-white/5 rounded-full blur-3xl"></div>
            <div className="flex items-center gap-2 mb-6">
              <div className="bg-blue-600 rounded p-1.5"><ShoppingCart size={18} className="text-white" /></div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Order Summary</h3>
            </div>
            
            <div className="space-y-6 relative z-10">
              <div>
                <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Total Amount</p>
                <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">PHP {record.totalAmount.toFixed(2)}</p>
              </div>
              <div className="pt-4 border-t border-white/30 dark:border-white/10">
                <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-3">Quick Stats</p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Total Items</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{totalItems}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Item Variety</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{itemCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none">
            <div className="flex items-center gap-2 mb-6">
              <Clock size={18} className="text-zinc-400" />
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Timestamps</h3>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-zinc-500 mb-1">Created</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {record.createdAt ? new Date(record.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 mb-1">Status</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">{record.status}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
