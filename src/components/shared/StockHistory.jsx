import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptySlot } from "./PageStates";
import { movementLabel, stockReasonLabel } from "../../utils/copy";
import { whenLabel } from "../../utils/activityLog";

/**
 * Every change to one shelf count, newest first: what happened, who did it,
 * the change, and the count it left. Read from public.stock_movements, which
 * the database writes in the same transaction as the change itself -- so a
 * count that moved always has a line here saying why.
 *
 * UNDOING DAMAGE. A damage record entered wrong is not edited away: the history
 * is append-only, and one that can be rewritten is worth nothing. `onUndoDamage`
 * puts the quantity back as its own entry that names the one it reverses, so
 * both the mistake and the correction stay on the record. The offer is withdrawn
 * once a record has been undone -- the database allows exactly one -- and it is
 * only passed in for the roles that may do it.
 */
export default function StockHistory({ rows = [], isLoaded = true, error = null, onUndoDamage = null, busy = false }) {
  if (error) {
    return <EmptySlot className="py-10 text-[15px]">The stock history could not be loaded. Reopen this screen to try again.</EmptySlot>;
  }
  if (!isLoaded && rows.length === 0) {
    return <EmptySlot className="py-10 text-[15px]">Loading the stock history…</EmptySlot>;
  }
  if (rows.length === 0) {
    return (
      <EmptySlot className="py-10 text-[15px]">
        Nothing has moved yet. Deliveries, sales, returns, damage and corrections show up here.
      </EmptySlot>
    );
  }
  // A damage record that something else already reverses cannot be undone
  // again, so it is read off the history rather than asked of the server.
  const undone = new Set(rows.map((row) => row.reversesMovementId).filter(Boolean));
  return (
    <Table minWidth={640}>
      <TableCaption>Every change to this stock count, newest first</TableCaption>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-48">When</TableHead>
          <TableHead>What happened</TableHead>
          <TableHead className="w-24 text-right">Change</TableHead>
          <TableHead className="w-24 text-right">Left</TableHead>
          {onUndoDamage && <TableHead className="w-36">Entered wrong?</TableHead>}
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
            <TableRow key={row.id}>
              <TableCell className="text-[15px] text-muted">{whenLabel(row.at)}</TableCell>
              <TableCell>
                <p className="text-[15.5px]">
                  <strong className="font-extrabold">{movementLabel(row.kind)}</strong> by {row.actorName}
                </p>
                {why && <p className="pt-0.5 text-[14.5px] text-muted">{why}</p>}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right text-[17px] font-extrabold tabular-nums",
                  up ? "text-green dark:text-dk-green" : "text-red dark:text-dk-red"
                )}
              >
                {up ? "+" : "−"}
                {Math.abs(row.change)}
              </TableCell>
              <TableCell className="text-right text-[16px] tabular-nums">{row.balanceAfter}</TableCell>
              {onUndoDamage && (
                <TableCell>
                  {row.kind === "damage" && !undone.has(row.id) && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => onUndoDamage(row)}
                    >
                      Put this back
                    </Button>
                  )}
                  {row.kind === "damage" && undone.has(row.id) && (
                    <span className="text-[14.5px] text-muted">Already put back</span>
                  )}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
