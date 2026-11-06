import { useEffect, useState } from "react";

import { Trash } from "../icons";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "../shared/ConfirmDialog";
import { localDateIso } from "../../utils/dates";
import { daysUntil, paymentMethodLabel, termLabel } from "../../utils/payments";
import { formatPeso, formatShortDate } from "../../utils/profileFormat";

/**
 * The top of an order's Payments panel: what it comes to, what has been paid
 * and what is still owed, then each payment received.
 *
 * The list is read when the order opens and again whenever `version` changes,
 * which App bumps after a payment is recorded or removed. The three figures
 * come from App (the order_paid view), so they are right even before the
 * list has loaded.
 */
/**
 * `termDays` is the order's term (null for a pick-up), and `dueOn` the day
 * payment falls due once it has been delivered (utils/payments dueDateOf).
 */
export default function OrderPayments({ orderId, netTotal, paid, owed, cancelled = false, termDays = null, dueOn = null, loadPayments, version = 0, onRemove }) {
  const [state, setState] = useState({ for: null, rows: [], failed: false });
  const [removing, setRemoving] = useState(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!loadPayments || orderId == null) return undefined;
    let live = true;
    loadPayments(orderId).then((result) => {
      if (live) setState({ for: `${orderId}:${version}`, rows: result.ok ? result.data : [], failed: !result.ok });
    });
    return () => { live = false; };
  }, [orderId, version, loadPayments]);

  const loaded = state.for === `${orderId}:${version}`;

  async function confirmRemove() {
    if (!removing || working) return;
    setWorking(true);
    try {
      const result = await onRemove(removing);
      if (result?.ok !== false) setRemoving(null);
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <dl className="m-0 grid grid-cols-3 gap-px border-b border-border bg-border text-13">
        {[
          ["Comes to", formatPeso(netTotal)],
          ["Paid", formatPeso(paid)],
          ["Still owed", cancelled ? "—" : owed === 0 ? "Nothing" : formatPeso(owed)],
        ].map(([label, value]) => (
          <div key={label} className="bg-card px-4 py-2.5">
            <dt className="text-xs text-muted-fg">{label}</dt>
            <dd className={label === "Still owed" && owed > 0 && !cancelled ? "m-0 font-semibold text-warning-fg" : "m-0 font-semibold"}>{value}</dd>
          </div>
        ))}
      </dl>
      {!cancelled ? <TermsLine termDays={termDays} dueOn={dueOn} owed={owed} /> : null}
      {!loaded ? (
        <p className="m-0 px-4 py-3 text-13 text-muted-fg">Loading payments…</p>
      ) : state.failed ? (
        <p className="m-0 px-4 py-3 text-13 text-danger-fg">The payments could not be loaded. Refresh to try again.</p>
      ) : state.rows.length === 0 ? (
        <p className="m-0 px-4 py-3 text-13 text-muted-fg">No payment has been recorded on this order.</p>
      ) : (
        <ul className="m-0 list-none p-0" aria-label="Payments received">
          {state.rows.map((payment) => (
            <li key={payment.id} className="flex items-start justify-between gap-2 border-b border-row-divider px-4 py-2.5 text-13 last:border-b-0">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">
                  {formatPeso(payment.amount)} received · {paymentMethodLabel(payment.method)}
                  {payment.reference ? <span className="font-normal text-muted-fg"> · {payment.reference}</span> : null}
                </span>
                <span className="text-muted-fg">
                  {formatShortDate(payment.receivedOn)}{payment.recordedBy ? ` · ${payment.recordedBy}` : ""}
                </span>
              </span>
              {onRemove ? (
                <Button variant="ghost" size="sm" aria-label={`Remove the ${formatPeso(payment.amount)} payment`} onClick={() => setRemoving(payment)}>
                  <Trash aria-hidden="true" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(next) => { if (!next) setRemoving(null); }}
        title="Remove this payment?"
        consequences={removing ? `${formatPeso(removing.amount)} received on ${formatShortDate(removing.receivedOn)} comes off the order, and the order owes that much again. Use this only for a payment entered by mistake; it stays in the activity log.` : ""}
        confirmLabel="Remove payment"
        busy={working}
        onConfirm={confirmRemove}
      />
    </>
  );
}

/** When the money is due: on terms, the day it falls due and how far off; otherwise at pick-up. */
function TermsLine({ termDays, dueOn, owed }) {
  let when = null;
  let late = false;
  if (termDays && !dueOn) when = "due once it is delivered";
  else if (termDays && dueOn) {
    const left = daysUntil(dueOn, localDateIso());
    late = owed > 0 && left < 0;
    when = owed === 0
      ? `was due ${formatShortDate(dueOn)}`
      : left < 0
        ? `due ${formatShortDate(dueOn)}, ${-left === 1 ? "a day" : `${-left} days`} overdue`
        : left === 0 ? "due today" : `due ${formatShortDate(dueOn)}, in ${left === 1 ? "a day" : `${left} days`}`;
  }
  return (
    <p className={late ? "m-0 border-b border-border px-4 py-2 text-13 font-medium text-danger-fg" : "m-0 border-b border-border px-4 py-2 text-13 text-fg-2"}>
      {termLabel(termDays)}{when ? ` · ${when}` : ""}
    </p>
  );
}
