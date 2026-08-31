import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ShoppingCart, Calculator, Truck, Edit2, Eye } from '../icons';
import EmptyState from '../shared/EmptyState';
import ListHeaderBar from '../shared/ListHeaderBar';
import { ORDER_STATUS } from '../../utils/constants';
import { commitOrder, uncommitOrder } from '../../utils/stockLedger';

/**
 * Matches only this order's deliveries. The trailing " - " matters: without it
 * `includes('Order #12')` also matches order #1234's deliveries, and deleting
 * one order would take another's with it. DeliveryList writes the linking
 * string as `Order #{id} - {customer}`.
 */
const deliveryBelongsToOrder = (delivery, orderId) =>
  String(delivery.product || '').startsWith(`Order #${orderId} - `);

export function OrdersList({ orders, setOrders, deliveries, setDeliveries, inventory, setInventory, navigateTo, showModal, addActivity }) {
  const [statusFilter, setStatusFilter] = useState('All Orders');
  const [sortOption, setSortOption] = useState('date-newest');

  const sortOrders = (items) => {
    return [...items].sort((a, b) => {
      switch (sortOption) {
        case 'name-az':
          return a.customerName.localeCompare(b.customerName);
        case 'name-za':
          return b.customerName.localeCompare(a.customerName);
        case 'amount-low-high':
          return a.totalAmount - b.totalAmount;
        case 'amount-high-low':
          return b.totalAmount - a.totalAmount;
        case 'date-newest':
          return Date.parse(b.createdAt) - Date.parse(a.createdAt);
        case 'date-oldest':
          return Date.parse(a.createdAt) - Date.parse(b.createdAt);
        case 'status-priority': {
          const statusOrder = { 'Pending': 0, 'Completed': 1, 'Cancelled': 2 };
          return (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3);
        }
        default:
          return 0;
      }
    });
  };

  const handleDelete = (id) => {
    const deletedOrder = orders.find(o => o.id === id);
    // A completed order's stock has physically left, so deleting the record
    // doesn't put it back. A pending one only held a reservation, which is
    // derived from the orders array and evaporates on its own.
    const wasCommitted = Boolean(deletedOrder?.stockCommittedAt);
    showModal(
      "Delete Order",
      wasCommitted
        ? "Are you sure you want to remove this order record? Associated deliveries will also be deleted. Stock already deducted for it will NOT be restored."
        : "Are you sure you want to remove this order record? Associated deliveries will also be deleted.",
      () => {
        // Delete the order
        setOrders(orders.filter(o => o.id !== id));

        // Delete associated deliveries for this order
        if (deliveries && setDeliveries) {
          const updatedDeliveries = deliveries.filter(d => !deliveryBelongsToOrder(d, id));
          setDeliveries(updatedDeliveries);
        }

        if (deletedOrder) {
          addActivity?.({
            type: 'Order',
            title: 'Order Deleted',
            description: `Deleted order #${deletedOrder.id} for ${deletedOrder.customerName}`,
            amount: deletedOrder.totalAmount,
            color: 'bg-red-500'
          });
        }
      }
    );
  };

  /**
   * Moving an order to Completed is what actually deducts stock; moving it back
   * out puts it back. Both go through the ledger, which no-ops unless the
   * order's commit stamp says the move is real — so flipping Completed ->
   * Pending -> Completed lands on the same numbers rather than deducting twice.
   */
  const handleStatusChange = (id, newStatus) => {
    const order = orders.find(o => o.id === id);
    if (!order || order.status === newStatus) return;

    let stockCommittedAt = order.stockCommittedAt || null;

    if (newStatus === ORDER_STATUS.COMPLETED) {
      const result = commitOrder(inventory, order);
      setInventory?.(result.inventory);
      stockCommittedAt = result.stockCommittedAt;
    } else if (order.stockCommittedAt) {
      const result = uncommitOrder(inventory, order);
      setInventory?.(result.inventory);
      stockCommittedAt = result.stockCommittedAt;
    }

    setOrders(orders.map(o => (o.id === id ? { ...o, status: newStatus, stockCommittedAt } : o)));

    addActivity?.({
      type: 'Order',
      title: `Order ${newStatus}`,
      description: `Order #${order.id} for ${order.customerName} marked ${newStatus}`,
      amount: order.totalAmount,
      color: newStatus === ORDER_STATUS.CANCELLED ? 'bg-red-500' : 'bg-green-500',
    });
  };

  const filteredOrders = statusFilter === 'All Orders' 
    ? orders 
    : orders.filter(order => order.status === statusFilter);

  const sortedOrders = sortOrders(filteredOrders);

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
            <div className="relative w-full sm:w-auto">
              <select 
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="appearance-none bg-zinc-50 dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl pl-4 pr-10 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-blue-500/50 cursor-pointer w-full"
              >
                <option value="date-newest" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Creation Date (Newest → Oldest)</option>
                <option value="date-oldest" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Creation Date (Oldest → Newest)</option>
                <option value="name-az" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Customer Name (A → Z)</option>
                <option value="name-za" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Customer Name (Z → A)</option>
                <option value="amount-low-high" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Total Amount (Low → High)</option>
                <option value="amount-high-low" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Total Amount (High → Low)</option>
                <option value="status-priority" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Status (Pending → Completed → Cancelled)</option>
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
              {sortedOrders.length === 0 ? (
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
                sortedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-zinc-50 dark:hover:bg-[#1A1A24]/30 transition-colors">
                    <td className="px-4 md:px-6 py-5">
                      <span className="text-zinc-900 dark:text-zinc-100 font-medium">#{order.id}</span>
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
                        onClick={() => {
                          console.log('1. EYE BUTTON CLICKED');
                          console.log('2. navigateTo is:', typeof navigateTo, navigateTo);
                          console.log('3. About to call navigateTo');
                          try {
                            navigateTo('order-detail', order);
                            console.log('4. navigateTo call completed');
                          } catch (e) {
                            console.error('5. navigateTo ERROR:', e);
                          }
                        }}
                        title="View Order"
                        className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors inline-block p-2"
                      >
                        <Eye size={16} />
                      </button>
                      <button 
                        onClick={() => navigateTo('edit-order', order)}
                        title="Edit Order"
                        className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors inline-block p-2"
                      >
                        <Edit2 size={16} />
                      </button>
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
