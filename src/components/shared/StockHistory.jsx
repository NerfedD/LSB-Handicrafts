import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptySlot } from "./PageStates";
import { movementLabel, stockReasonLabel } from "../../utils/copy";
import { whenLabel } from "../../utils/activityLog";

/**
 * Every change to one stock count, newest first, in the boards' table: When,
 * What happened, In, Out and the balance after. A damage write-off can be put
 * back by a manager, once.
 */
export default function StockHistory({ rows = [], isLoaded = true, error = null, onUndoDamage = null, busy = false, limit = 50 }) {
  if (error) {
    return <EmptySlot>The stock history could not be loaded. Reopen this screen to try again.</EmptySlot>;
  }
  if (!isLoaded && rows.length === 0) {
    return <EmptySlot>Loading the stock history…</EmptySlot>;
  }
  if (rows.length === 0) {
    return (
      <EmptySlot>
        Nothing has moved yet. Every stock in (deliveries received, production, returns) and stock out (sales, production use, damage) shows up here.
      </EmptySlot>
    );
  }
  // A damage record that something else already reverses cannot be undone
  // again, so it is read off the history rather than asked of the server.
  const undone = new Set(rows.map((row) => row.reversesMovementId).filter(Boolean));
  return (
    <>
      <Table minWidth={680} aria-label="Every change to this stock count, newest first">
        <TableHeader>
          <TableRow>
            <TableHead className="w-44">When</TableHead>
            <TableHead>What happened</TableHead>
            <TableHead className="w-20 text-right">In</TableHead>
            <TableHead className="w-20 text-right">Out</TableHead>
            <TableHead className="w-24 text-right">Balance</TableHead>
            {onUndoDamage ? <TableHead className="w-36"><span className="sr-only">Entered wrong?</span></TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const why = [
              row.reason ? stockReasonLabel(row.reason) : null,
              row.orderId ? `order #${row.orderId}` : null,
              row.supplierOrderId ? `supplier order #${row.supplierOrderId}` : null,
              row.note,
            ].filter(Boolean).join(" · ");
            const up = row.change > 0;
            return (
              <TableRow key={row.id} className="h-auto">
                <TableCell className="py-2 text-muted-fg">{whenLabel(row.at)}</TableCell>
                <TableCell className="whitespace-normal py-2">
                  <span className="font-medium">{movementLabel(row.kind)}</span> by {row.actorName}
                  {why ? <span className="block text-xs text-muted-fg">{why}</span> : null}
                </TableCell>
                <TableCell className="py-2 text-right text-success-fg">{up ? `+${row.change}` : <span className="sr-only">none</span>}</TableCell>
                <TableCell className="py-2 text-right text-danger-fg">{up ? <span className="sr-only">none</span> : `−${Math.abs(row.change)}`}</TableCell>
                <TableCell className="py-2 text-right">{row.balanceAfter}</TableCell>
                {onUndoDamage ? (
                  <TableCell className="py-2">
                    {row.kind === "damage" && !undone.has(row.id) ? (
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => onUndoDamage(row)}>Put this back</Button>
                    ) : null}
                    {row.kind === "damage" && undone.has(row.id) ? <span className="text-xs text-muted-fg">Already put back</span> : null}
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {rows.length >= limit ? (
        <p className="m-0 border-t border-border px-4 py-2.5 text-13 text-muted-fg">
          Showing the latest {limit} changes. The balance column is always the true count after each one.
        </p>
      ) : null}
    </>
  );
}
