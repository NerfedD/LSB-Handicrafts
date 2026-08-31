import React, { useState } from 'react';
import { MoreHorizontal, Clock, Truck, History, X } from '../icons';
import { ORDER_STATUS, STOCK_STATUS } from '../../utils/constants';
import { availableOf } from '../../utils/stockLedger';

/** Orange for low, red for out, blue otherwise. */
const stockTone = (status) => {
  if (status === STOCK_STATUS.OUT) {
    return { dot: 'bg-red-500', pill: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-500/10' };
  }
  if (status === STOCK_STATUS.LOW) {
    return { dot: 'bg-orange-500', pill: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-500/10' };
  }
  return { dot: 'bg-blue-500', pill: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-500/10' };
};

export default function Dashboard({ inventory, deliveries, orders = [], activityLog = [] }) {
  const [invFilter, setInvFilter] = useState('All');
  const [showHistory, setShowHistory] = useState(false);

  const totalProducts = inventory.length;
  const totalVolume = inventory.reduce((sum, item) => sum + Number(item.stock), 0);
  // Anything not comfortably in stock — low and out both need attention.
  const lowStockCount = inventory.filter(
    i => i.status === STOCK_STATUS.LOW || i.status === STOCK_STATUS.OUT
  ).length;
  // Cancelled orders were never earned, so they don't count toward revenue.
  const totalRevenue = orders
    .filter(order => order.status !== ORDER_STATUS.CANCELLED)
    .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

  // Combine orders and deliveries into a single activity list
  const fallbackActivities = [
    ...orders.map(order => ({
      id: `order-${order.id}`,
      type: 'Order',
      title: 'Order Created',
      description: `Order #${order.id.toString().slice(-6)} for ${order.customerName}`,
      amount: order.totalAmount,
      date: order.createdAt,
      color: 'bg-blue-500'
    })),
    ...deliveries.map(delivery => ({
      id: `delivery-${delivery.id}`,
      type: 'Delivery',
      title: 'Delivery Update',
      description: `${delivery.product} to ${delivery.location}`,
      status: delivery.status,
      date: delivery.createdAt,
      color: delivery.status === 'Delivered' ? 'bg-emerald-500' : 'bg-yellow-500'
    }))
  ];

  const recentActivities = activityLog.length > 0 ? activityLog.slice(0, 5) : fallbackActivities.slice(0, 5);
  const activityHistory = activityLog.length > 0 ? activityLog : fallbackActivities;

  const filteredInventory = inventory.filter(item => {
    if (invFilter === 'All') return true;
    return item.status === invFilter;
  });

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6">
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Here is today's report and performances</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 md:gap-6 mb-6">
        <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 relative shadow-sm dark:shadow-none w-full">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3 md:mb-4">Total Products</h3>
          <p className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-3 md:mb-4">{totalProducts}</p>
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="text-emerald-600 bg-emerald-50 dark:text-emerald-500 dark:bg-emerald-500/10 px-2 py-0.5 rounded">+12%</span>
            <span className="text-zinc-500">from last quarter</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 relative shadow-sm dark:shadow-none w-full">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3 md:mb-4">Total Volume</h3>
          <p className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-3 md:mb-4">{totalVolume}</p>
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="text-emerald-600 bg-emerald-50 dark:text-emerald-500 dark:bg-emerald-500/10 px-2 py-0.5 rounded">+5%</span>
            <span className="text-zinc-500">from last quarter</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 relative shadow-sm dark:shadow-none w-full">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3 md:mb-4">Total Revenue</h3>
          <p className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-3 md:mb-4">PHP {totalRevenue.toLocaleString()}</p>
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="text-emerald-600 bg-emerald-50 dark:text-emerald-500 dark:bg-emerald-500/10 px-2 py-0.5 rounded">+8%</span>
            <span className="text-zinc-500">from last quarter</span>
          </div>
        </div>

        <div className="bg-red-50 dark:bg-[#181111] border border-red-100 dark:border-red-900/30 rounded-2xl p-5 md:p-6 relative shadow-sm dark:shadow-[inset_0_0_20px_rgba(239,68,68,0.02)] w-full">
          <h3 className="text-sm font-medium text-red-600/80 dark:text-red-400/80 mb-3 md:mb-4">Low Stock Alerts</h3>
          <p className="text-3xl md:text-4xl font-bold text-red-600 dark:text-red-500 mb-3 md:mb-4">{lowStockCount}</p>
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="text-red-600 dark:text-red-500">Needs Attention</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 w-full">
        <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none w-full">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Recent Activity</h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowHistory(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                <History size={14} />
                View History
              </button>
              <Clock size={16} className="text-zinc-400 dark:text-zinc-500" />
            </div>
          </div>
          <div className="space-y-4">
            {recentActivities.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-4">No recent activity found.</p>
            ) : (
              recentActivities.map((activity, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className={`mt-1.5 w-1.5 h-1.5 rounded-full ${activity.color} shrink-0`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      <span className={`font-medium ${activity.type === 'Order' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                        {activity.title}:
                      </span> {activity.description}
                      {activity.amount && <span className="ml-1 font-bold"> - PHP {activity.amount.toLocaleString()}</span>}
                      {activity.status && <span className={`ml-1 italic ${activity.status === 'Delivered' ? 'text-emerald-500' : 'text-yellow-500'}`}> ({activity.status})</span>}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">{activity.date}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none w-full">
          <div className="flex justify-between items-center mb-5 md:mb-6">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Inventory Levels</h3>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-6">
            <button 
              onClick={() => setInvFilter('All')} 
              className={`text-xs font-medium px-4 py-1.5 rounded-lg transition-colors ${invFilter === 'All' ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-[#1A1A24] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
            >
              View All
            </button>
            <button 
              onClick={() => setInvFilter('In Stock')} 
              className={`text-xs font-medium px-4 py-1.5 rounded-lg transition-colors ${invFilter === 'In Stock' ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-[#1A1A24] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
            >
              In Stock
            </button>
            <button
              onClick={() => setInvFilter('Low Stock')}
              className={`text-xs font-medium px-4 py-1.5 rounded-lg transition-colors ${invFilter === 'Low Stock' ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-[#1A1A24] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
            >
              Low Stock
            </button>
            <button
              onClick={() => setInvFilter('Out of Stock')}
              className={`text-xs font-medium px-4 py-1.5 rounded-lg transition-colors ${invFilter === 'Out of Stock' ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-[#1A1A24] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
            >
              Out of Stock
            </button>
          </div>
          
          <div className="space-y-3">
            {filteredInventory.map(item => {
              const tone = stockTone(item.status);
              return (
              <div key={item.id} className="bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-[#1F1F2E] p-4 rounded-xl flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full ${tone.dot} shrink-0`}></div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200 line-clamp-1">{item.name}</p>
                    <p className="text-xs text-zinc-500">{item.sku}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap ${tone.pill}`}>
                  {availableOf(item)} available
                </span>
              </div>
              );
            })}
            {filteredInventory.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-4">No items found for this filter.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 md:mt-6 bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none w-full pb-safe pb-8">
        <div className="flex items-center gap-2 mb-6 justify-center text-zinc-900 dark:text-zinc-100 font-semibold text-lg">
          <Truck size={20} className="text-blue-500" /> Delivery Status
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          {[
            { 
              title: 'Not Yet Delivered', 
              count: deliveries.filter(d => d.status === 'Not Yet Delivered').length, 
              color: 'bg-white dark:bg-[#181111] border-red-100 dark:border-red-900/30 shadow-sm dark:shadow-none', 
              dotCountColor: 'text-zinc-900 dark:text-white',
              titleColor: 'text-red-600 dark:text-red-400',
              dotColor: 'bg-red-500',
              subtitle: 'Styro Ball 4 inch...'
            },
            { 
              title: 'Under Production', 
              count: deliveries.filter(d => d.status === 'Under Production').length, 
              color: 'bg-white dark:bg-[#101423] border-blue-100 dark:border-blue-900/30 shadow-sm dark:shadow-none', 
              dotCountColor: 'text-zinc-900 dark:text-white',
              titleColor: 'text-blue-600 dark:text-blue-400',
              dotColor: 'bg-blue-500',
              subtitle: ''
            },
            { 
              title: 'Ready to Deliver', 
              count: deliveries.filter(d => d.status === 'Ready to Deliver').length, 
              color: 'bg-white dark:bg-[#1A150F] border-amber-100 dark:border-amber-900/30 shadow-sm dark:shadow-none', 
              dotCountColor: 'text-zinc-900 dark:text-white',
              titleColor: 'text-amber-600 dark:text-amber-500',
              dotColor: 'bg-amber-500',
              subtitle: ''
            },
            { 
              title: 'On the Way', 
              count: deliveries.filter(d => d.status === 'On The Way').length, 
              color: 'bg-white dark:bg-[#1A180F] border-yellow-100 dark:border-yellow-900/30 shadow-sm dark:shadow-none', 
              dotCountColor: 'text-zinc-900 dark:text-white',
              titleColor: 'text-yellow-600 dark:text-yellow-400',
              dotColor: 'bg-yellow-400',
              subtitle: 'Styro Sheet 1/2...'
            },
            { 
              title: 'Arrived', 
              count: deliveries.filter(d => d.status === 'Delivered').length, 
              color: 'bg-white dark:bg-[#0E1A14] border-emerald-100 dark:border-emerald-900/30 shadow-sm dark:shadow-none', 
              dotCountColor: 'text-zinc-900 dark:text-white',
              titleColor: 'text-emerald-600 dark:text-emerald-400',
              dotColor: 'bg-emerald-400',
              subtitle: ''
            }
          ].map((stat, idx) => (
            <div key={idx} className={`p-4 md:p-5 rounded-2xl border ${stat.color} flex flex-col items-start gap-4 shadow-inner`}>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${stat.dotColor}`}></div>
                <span className={`text-xs font-semibold ${stat.titleColor}`}>{stat.title}</span>
              </div>
              <div className={`text-3xl font-bold ${stat.dotCountColor}`}>{stat.count}</div>
              <div className="text-[10px] text-zinc-500 line-clamp-1 h-3">{stat.subtitle || stat.count > 0 ? '' : ''}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-[#1F1F2E]">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Activity History</h3>
              <button 
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-[#1A1A24] rounded-lg transition-colors"
              >
                <X size={20} className="text-zinc-500" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-3">
              {activityHistory.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-8">No activity history yet.</p>
              ) : (
                activityHistory.map((activity) => (
                  <div key={activity.id} className="flex gap-3 p-3 bg-zinc-50 dark:bg-[#09090B] rounded-xl">
                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                      activity.type === 'Product' ? 'bg-red-500' : 
                      activity.type === 'Delivery' ? 'bg-orange-500' : 'bg-blue-500'
                    }`}></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          activity.type === 'Product' ? 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400' :
                          activity.type === 'Delivery' ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400' :
                          'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                        }`}>
                          {activity.type}
                        </span>
                        <span className="text-xs text-zinc-500">{activity.title || activity.action}</span>
                      </div>
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">{activity.description}</p>
                      <p className="text-xs text-zinc-500 mt-1">{activity.date}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}