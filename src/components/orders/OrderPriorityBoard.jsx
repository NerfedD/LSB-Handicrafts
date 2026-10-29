import { useRef, useState } from 'react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

  return (
    <section aria-label="Order priority" aria-busy={!!optimistic} className="rounded-lg border border-border bg-card shadow-xs">
      <p className="m-0 border-b border-border px-4 py-3 text-13 text-muted-fg">
        Drag an order onto another to change priority, or use Move up and Move down. Status and stock are managed on the order.
      </p>
      <ol className="m-0 list-none p-0">
        {rows.map((order, index) => (
          <li
            key={order.id}
            data-order-id={order.id}
            draggable={!optimistic}
            onDragStart={(event) => {
              event.dataTransfer.setData('text/plain', String(order.id));
              event.dataTransfer.effectAllowed = 'move';
              setDragging(order.id);
            }}
            onDragOver={(event) => { if (dragging !== null && !optimistic) { event.preventDefault(); setOver(order.id); } }}
            onDragEnd={() => { setDragging(null); setOver(null); }}
            onDrop={(event) => { event.preventDefault(); if (dragging !== null) move(dragging, order.id); }}
            className={cn(
              'flex flex-wrap items-center justify-between gap-3 border-b border-row-divider px-4 py-2 last:border-b-0',
              over === order.id && 'bg-muted',
              dragging === order.id && 'opacity-50'
            )}
          >
            <span className="flex min-w-0 items-center gap-3 text-13">
              <span className="w-6 text-right text-muted-fg">{index + 1}</span>
              <button type="button" className="border-0 bg-transparent p-0 text-left font-medium text-foreground hover:underline" onClick={() => onOpen(order.id)}>
                #{order.id} · {order.customerName}
              </button>
            </span>
            <span className="flex gap-1">
              <Button variant="outline" size="sm" disabled={!!optimistic || index === 0} aria-label={`Move order ${order.id} up`} onClick={() => move(order.id, rows[index - 1].id)}>Move up</Button>
              <Button variant="outline" size="sm" disabled={!!optimistic || index === rows.length - 1} aria-label={`Move order ${order.id} down`} onClick={() => move(order.id, rows[index + 1].id)}>Move down</Button>
            </span>
          </li>
        ))}
      </ol>
      <p role="status" className="sr-only">{optimistic ? 'Saving order priority.' : 'Order priority ready.'}</p>
    </section>
  );
}
