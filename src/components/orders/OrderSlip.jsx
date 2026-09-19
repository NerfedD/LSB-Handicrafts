import { createPortal } from "react-dom";

import { normalizeItems } from "../../utils/orderItems";
import { orderTotals, lastPriceAdjustment } from "../../utils/orders";
import { formatPeso, formatLongDate } from "../../utils/profileFormat";
import { OFFICE_PHONE, OFFICE_PHONE_IS_PLACEHOLDER } from "../../utils/office";
import { orderLabel, priceReasonLabel, refundReasonLabel } from "../../utils/copy";
import { ORDER_STATUS } from "../../utils/constants";

/**
 * The printed order slip.
 *
 * THE ONLY THING A CUSTOMER EVER SEES. Every other screen in this system is
 * internal — staff, stock, margins, who owes what. This one piece of paper
 * leaves the building, so it is the business's face rather than a view of the
 * app, and it is designed as a document rather than as the order screen with
 * its furniture hidden.
 *
 * WHAT IT REPLACED. `onPrint` was `window.print()` against a page with no print
 * stylesheet at all, so Ctrl+P rendered the whole application: the navy
 * sidebar, the header, the account menu, "Call off order #1042", the red block
 * offering to delete the record. A customer was being handed a screenshot of
 * somebody's admin panel, in colour, using most of a cartridge on a sidebar.
 *
 * IT IS NOT AN OFFICIAL RECEIPT and says so at the foot. LSB is not registered
 * in this system — there is no TIN and no registered address on record — and
 * inventing either onto a document that goes to a customer would be forgery
 * rather than design. What this can honestly be is an acknowledgement: here is
 * what you ordered, here is what it costs, here is where it is going.
 *
 * A PORTAL, NOT A HIDDEN BRANCH. It renders to `document.body`, beside `#root`
 * rather than inside it, which is what lets the print stylesheet in index.css
 * say `#root { display: none }` and be done. Hiding the app from inside itself
 * means walking up every ancestor of the slip and un-hiding each one, and the
 * usual `visibility: hidden` trick leaves all that collapsed furniture still
 * occupying boxes — which is where phantom blank first pages come from.
 */

/** A labelled block in the two-column party band. */
function Party({ title, children }) {
  return (
    <div className="slip-party">
      <p className="slip-party-title">{title}</p>
      {children}
    </div>
  );
}

/** One line of a party block; renders nothing at all when there is no value. */
function Line({ children }) {
  if (!children) return null;
  return <p className="slip-line">{children}</p>;
}

export default function OrderSlip({ order, customer, delivery, deliveries = [] }) {
  if (!order) return null;

  const items = normalizeItems(order.items);
  const totals = orderTotals(order, deliveries);
  const correction = lastPriceAdjustment(order);
  const refunds = Array.isArray(order.refundHistory) ? order.refundHistory : [];
  const refunded = Number(totals.refunded) || 0;
  const showBreakdown = totals.delivery > 0 || totals.items !== totals.total;
  const cancelled = order.status === ORDER_STATUS.CANCELLED;

  return createPortal(
    <article className="slip" aria-hidden="true">
      {/* Letterhead. The name and the phone are the only two things about this
          business the system actually knows; nothing else is asserted. */}
      <header className="slip-head">
        <div>
          <p className="slip-brand">LSB Handicrafts</p>
          <p className="slip-trade">Styrofoam decor · Davao City</p>
          {/* The office number is a mockup placeholder until somebody sets
              VITE_OFFICE_PHONE. On an internal screen that is a harmless
              stand-in; on a page handed to a customer it is a wrong number, so
              the line is simply absent until the real one exists. */}
          {OFFICE_PHONE_IS_PLACEHOLDER ? null : (
            <p className="slip-trade">{OFFICE_PHONE}</p>
          )}
        </div>
        {/* Number and date together, top right, which is where anybody who has
            handled an invoice looks for them. They were a third column down in
            the party band, which cost the addresses a third of the page and
            broke one over three lines. */}
        <div className="slip-head-right">
          <p className="slip-doc">Order slip</p>
          <p className="slip-number">#{order.id}</p>
          <p className="slip-written">
            Written {order.createdAt ? formatLongDate(order.createdAt) : "—"}
          </p>
          {/* WHERE THE ORDER STANDS, and a cancelled one says so loudly.
              This document printed identically whether the order was live or
              called off, which on a cancelled order makes the single most
              important fact about it the one fact missing -- somebody could be
              handed a slip for goods that are never coming and nothing on the
              page would contradict them. */}
          <p className={cancelled ? "slip-standing slip-standing-off" : "slip-standing"}>
            {cancelled ? "Called off" : orderLabel(order.status)}
          </p>
        </div>
      </header>

      <div className="slip-rule" />

      <section className="slip-parties">
        <Party title="For">
          <Line>
            <strong>{order.customerName || "No customer named"}</strong>
          </Line>
          <Line>{customer?.contactNumber}</Line>
          <Line>{customer?.address}</Line>
        </Party>

        <Party title="Delivering to">
          <Line>{delivery?.location || customer?.address || "To be arranged"}</Line>
          <Line>{delivery?.driver ? `Driver: ${delivery.driver}` : null}</Line>
        </Party>
      </section>

      {/* `thead` repeats itself on a second sheet, which is the one thing a
          printed table must do and no screen table ever needs to. */}
      <table className="slip-table">
        <thead>
          <tr>
            <th className="slip-th-item">Item</th>
            <th className="slip-th-qty">How many</th>
            <th className="slip-th-money">Each</th>
            <th className="slip-th-money">Line total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.name}-${index}`}>
              <td>{item.name}</td>
              <td className="slip-td-qty">{item.quantity}</td>
              <td className="slip-td-money">{formatPeso(item.unitPrice)}</td>
              <td className="slip-td-money">{formatPeso(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Kept off a page break as one block: a total separated from the lines
          it totals is the one split that makes a document unreadable. */}
      <section className="slip-totals">
        <dl>
          {/* A subtotal is only worth printing when something is added to it.
              On an order with no delivery charge it is the same number as the
              total, one line above it, under a different word -- which reads
              like an arithmetic slip rather than a breakdown. */}
          {showBreakdown && (
            <div>
              <dt>Items</dt>
              <dd>{formatPeso(totals.items)}</dd>
            </div>
          )}
          {totals.delivery > 0 && (
            <div>
              <dt>Delivery</dt>
              <dd>{formatPeso(totals.delivery)}</dd>
            </div>
          )}
          <div className="slip-total-row">
            <dt>Total to pay</dt>
            <dd>{formatPeso(totals.total)}</dd>
          </div>
          {refunded > 0 && (
            <>
              <div>
                <dt>Given back</dt>
                <dd>−{formatPeso(refunded)}</dd>
              </div>
              <div className="slip-total-row">
                <dt>What they still owe</dt>
                <dd>{formatPeso(totals.net)}</dd>
              </div>
            </>
          )}
        </dl>
      </section>

      {/* A slip that quietly omits a refund or a corrected price is the version
          of this document that causes an argument at the counter. */}
      {(correction || refunds.length > 0) && (
        <section className="slip-notes">
          {correction && (
            <p>
              The price was corrected on {formatLongDate(correction.changedAt)} from{" "}
              {formatPeso(correction.oldTotal)} to {formatPeso(correction.newTotal)} —{" "}
              {priceReasonLabel(correction.reason).toLowerCase()}.
            </p>
          )}
          {refunds.map((refund, index) => (
            <p key={refund.id ?? index}>
              {formatPeso(refund.amount)} was given back on{" "}
              {formatLongDate(refund.refundedAt)} — {refundReasonLabel(refund.reason).toLowerCase()}.
            </p>
          ))}
        </section>
      )}

      <section className="slip-sign">
        <div>
          <div className="slip-sign-line" />
          <p>Received by</p>
        </div>
        <div>
          <div className="slip-sign-line" />
          <p>Date received</p>
        </div>
      </section>

      <footer className="slip-foot">
        <p>
          <strong>This is not an official receipt.</strong> It is a record of what
          was ordered, so both sides are working from the same paper.
        </p>
        <p>Printed {formatLongDate(new Date().toISOString())}</p>
      </footer>
    </article>,
    document.body,
  );
}
