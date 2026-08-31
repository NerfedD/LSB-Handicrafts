import React, { useState } from 'react';
import { ArrowLeft, ShoppingCart, Calculator, Save } from '../icons';
import OrderItemsEditor from './OrderItemsEditor';
import { ORDER_STATUS } from '../../utils/constants';
import { normalizeItems, orderTotal } from '../../utils/orderItems';
import { stockIssuesForOrder } from '../../utils/stockLedger';

/**
 * Add / edit an order. One component for both, following ProductForm's
 * mode="add"|"edit" convention.
 *
 * These were two separate screens with two separate item editors. The edit one
 * rebuilt every line as { name, quantity, price } on save, which silently threw
 * away productId — so the first edit to any order cut it loose from inventory
 * and no stock could ever be traced back to it. Sharing one form and one editor
 * is what stops that from happening again.
 *
 * Items are locked on a Completed or Cancelled order: its stock has already
 * been settled, and re-deriving that from an edit is a lot of machinery for a
 * case that should not arise. Move it back to Pending to change it.
 */
export default function OrderForm({
  mode = 'add',
  record,
  navigateTo,
  inventory = [],
  orders = [],
  setOrders,
  showModal,
  addActivity,
}) {
  const [customerName, setCustomerName] = useState(record?.customerName || '');
  const [items, setItems] = useState(normalizeItems(record?.items));

  const isEdit = mode === 'edit';
  const locked =
    isEdit && (record?.status === ORDER_STATUS.COMPLETED || record?.status === ORDER_STATUS.CANCELLED);

  const total = orderTotal(items);

  const handleSubmit = () => {
    if (items.length === 0) return;

    const finalCustomerName = customerName.trim() || 'Walk-in Customer';

    // Everything except the id and timestamp, which are only minted once the
    // order is actually confirmed.
    const base = {
      customerName: finalCustomerName,
      items,
      totalAmount: total,
      status: isEdit ? record.status || ORDER_STATUS.PENDING : ORDER_STATUS.PENDING,
      stockCommittedAt: isEdit ? record.stockCommittedAt || null : null,
    };

    // Warn but don't block: a shop can legitimately promise stock it is about
    // to restock. Staff decide.
    const issues = stockIssuesForOrder(inventory, base, {
      orders,
      ignoreOrderId: isEdit ? record.id : undefined,
    });

    const message = issues.length
      ? `${issues.join('\n')}\n\nPlace this order anyway for ${finalCustomerName}? Total PHP ${total.toLocaleString()}.`
      : `${isEdit ? 'Save changes to' : 'Create'} this order for ${finalCustomerName} with a total of PHP ${total.toLocaleString()}?`;

    showModal(isEdit ? 'Save Changes' : 'Confirm Order', message, () => {
      if (isEdit) {
        const draft = { ...base, id: record.id, createdAt: record.createdAt };
        setOrders(orders.map((o) => (o.id === draft.id ? draft : o)));
        addActivity?.({
          type: 'Order',
          title: 'Order Updated',
          description: `Updated order #${draft.id} for ${finalCustomerName}`,
          amount: total,
          color: 'bg-blue-500',
        });
      } else {
        const draft = {
          ...base,
          id: Date.now(),
          createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        };
        setOrders([draft, ...orders]);
        addActivity?.({
          type: 'Order',
          title: 'Order Created',
          description: `New order #${draft.id} for ${finalCustomerName}`,
          amount: total,
          color: 'bg-green-500',
        });
      }
      navigateTo('orders');
    });
  };

  return (
    <div className="animate-in fade-in duration-300 w-full">
      <button onClick={() => navigateTo('orders')} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 flex items-center gap-2 mb-6 text-sm font-medium transition-colors w-fit">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Customer Information</h3>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Walk-in Customer"
                className="w-full bg-white dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
              />
            </div>
          </div>

          <OrderItemsEditor
            items={items}
            setItems={setItems}
            inventory={inventory}
            disabled={locked}
          />
        </div>

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
                <span>PHP {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-blue-800/70 dark:text-zinc-400 text-sm font-medium">
                <span>Tax (0%)</span>
                <span>PHP 0.00</span>
              </div>
              <div className="border-t border-blue-900/10 dark:border-white/10 pt-4 flex justify-between items-end">
                <span className="text-sm font-bold text-blue-900 dark:text-white">Total Cost</span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">PHP {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleSubmit}
                disabled={items.length === 0}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all ${
                  items.length === 0
                    ? 'bg-blue-900/5 text-blue-900/20 dark:bg-white/5 dark:text-white/20 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 active:scale-[0.98]'
                }`}
              >
                {isEdit ? <><Save size={18} /> Save Changes</> : <><ShoppingCart size={18} /> Place Order</>}
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
