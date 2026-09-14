import { useRef, useState } from 'react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

/** Persisted list ordering, with equivalent keyboard/touch buttons. */
export default function OrderPriorityBoard({ orders, onReorder, onOpen }) {
  const [optimistic, setOptimistic] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);
  const inFlight = useRef(false);
  const sorted = [...orders].sort((a, b) => (a.priorityPosition || 0) - (b.priorityPosition || 0) || b.id - a.id);
  const rows = optimistic ? optimistic.map((id) => orders.find((row) => row.id === id)).filter(Boolean) : sorted;

  async function move(id, target) {
    if (id === target || inFlight.current) return;
    const ids = rows.map((row) => row.id);
    const from = ids.indexOf(id), to = ids.indexOf(target);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1); ids.splice(to, 0, id);
    inFlight.current = true;
    setOptimistic(ids); setDragging(null); setOver(null);
    try {
      const result = await onReorder(ids);
      if (!result?.ok) throw new Error(result?.message || 'Could not save the order priority.');
      toast.success('Order priority saved.');
    } catch (error) {
      toast.error(error.message, { description: 'The previous order has been restored.' });
    } finally {
      inFlight.current = false;
      setOptimistic(null);
    }
  }

  return <section aria-label="Order priority" aria-busy={!!optimistic} className="rounded-tile2 border border-card bg-surface p-5">
    <p className="pb-4 text-[16px] text-muted">Drag an order onto another to change priority, or use Move up and Move down. Status and stock are managed on the order.</p>
    <ol className="divide-y divide-hair">
      {rows.map((order, index) => <li key={order.id} data-order-id={order.id}
        draggable={!optimistic}
        onDragStart={(event) => {
          event.dataTransfer.setData('text/plain', String(order.id));
          event.dataTransfer.effectAllowed = 'move'; setDragging(order.id);
        }}
        onDragOver={(event) => { if (dragging !== null && !optimistic) { event.preventDefault(); setOver(order.id); } }}
        onDragEnd={() => { setDragging(null); setOver(null); }}
        onDrop={(event) => { event.preventDefault(); if (dragging !== null) move(dragging, order.id); }}
        className={`flex flex-wrap items-center justify-between gap-3 p-4 transition-colors ${over === order.id ? 'bg-tint-cobalt' : ''} ${dragging === order.id ? 'opacity-50' : ''}`}>
        <button type="button" className="text-left text-[16px] font-bold" onClick={() => onOpen(order.id)}>#{order.id} · {order.customerName}</button>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!!optimistic || index === 0} aria-label={`Move order ${order.id} up`} onClick={() => move(order.id, rows[index - 1].id)}>Move up</Button>
          <Button variant="outline" disabled={!!optimistic || index === rows.length - 1} aria-label={`Move order ${order.id} down`} onClick={() => move(order.id, rows[index + 1].id)}>Move down</Button>
        </div>
      </li>)}
    </ol>
    <p role="status" className="sr-only">{optimistic ? 'Saving order priority.' : 'Order priority ready.'}</p>
  </section>;
}
