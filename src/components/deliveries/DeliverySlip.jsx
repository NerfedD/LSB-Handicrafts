import { createPortal } from "react-dom";

import { letterheadOf } from "../../utils/office";
import { customerFrom, orderRefFrom } from "../../utils/deliveries";
import { formatPeso, formatLongDate, formatShortDate } from "../../utils/profileFormat";
import { DELIVERY_STAGE } from "../../utils/constants";
import { STAGE_LOOK } from "./stageLook";

/**
 * The printed delivery slip -- the sheet that rides on the truck.
 *
 * THE SECOND DOCUMENT THAT LEAVES THE BUILDING, after the order slip, and a
 * different job from it. The order slip is about money: what was bought and
 * what is owed. This one is about custody: these items, to this address, on
 * this day, handed over by this driver and signed for by whoever receives
 * them. So there are no line prices on it at all -- a driver does not need to
 * know the margin, and a slip left at a customer's gate should not publish it.
 * The only money here is the delivery charge, and only when there is one,
 * because that is the one amount a driver may be asked to collect.
 *
 * IT CARRIES THE SIGNATURE BLOCK. That is the entire reason it is printed
 * rather than read off a phone: "Received by" and the date are the proof the
 * workshop keeps when a customer later says nothing arrived.
 *
 * BUILT ON THE ORDER SLIP'S PLUMBING, deliberately. Same `.slip` class, same
 * portal to `document.body` beside `#root`, same print stylesheet in
 * index.css -- which already says `#root { display: none }` and styles every
 * `.slip-*` class used below. A second print path with its own stylesheet is
 * how two documents drift apart until one of them starts printing the navy
 * sidebar again. See OrderSlip for why the portal matters.
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

/**
 * `toCollect` is what the order still owes (utils/payments), or null when the
 * delivery carries no order. `termDays` is the order's payment term: an order
 * on terms is paid later, so the driver collects nothing on the doorstep.
 */
export default function DeliverySlip({ delivery, settings = null, toCollect = null, termDays = null }) {
  if (!delivery) return null;

  const manifest = Array.isArray(delivery.itemsManifest) ? delivery.itemsManifest : [];
  const itemCount = manifest.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
  const orderRef = orderRefFrom(delivery);
  const customer = customerFrom(delivery);
  const charge = Number(delivery.amount) || 0;
  const arrived = delivery.status === DELIVERY_STAGE.ARRIVED;
  const standing = STAGE_LOOK[delivery.status]?.label ?? "";
  const head = letterheadOf(settings);
  const collect = toCollect == null ? null : Number(toCollect) || 0;

  return createPortal(
    <article className="slip" aria-hidden="true">
      <header className="slip-head">
        <div>
          <p className="slip-brand">{head.name}</p>
          <p className="slip-trade">{head.trade}</p>
          {head.phone ? <p className="slip-trade">{head.phone}</p> : null}
        </div>
        <div className="slip-head-right">
          <p className="slip-doc">Delivery slip</p>
          <p className="slip-number">#{delivery.id}</p>
          <p className="slip-written">
            {orderRef ? `For order #${orderRef}` : "No order on record"}
          </p>
          {/* Where the run stands. A slip printed before the truck leaves and
              one printed after it is back are the same sheet otherwise, and
              the difference is the whole point of signing it. */}
          <p className="slip-standing">{standing}</p>
        </div>
      </header>

      <div className="slip-rule" />

      <section className="slip-parties">
        <Party title="For">
          <Line><strong>{customer || "No customer named"}</strong></Line>
          <Line>{delivery.location || "No address recorded"}</Line>
        </Party>

        <Party title="Run">
          <Line>{delivery.driver ? `Driver: ${delivery.driver}` : "No driver assigned yet"}</Line>
          <Line>{delivery.dueOn ? `Promised ${formatShortDate(delivery.dueOn)}` : "No date promised"}</Line>
          <Line>{delivery.createdAt ? `Raised ${formatShortDate(delivery.createdAt)}` : null}</Line>
        </Party>
      </section>

      {/* `thead` repeats on a second sheet, the one thing a printed table must
          do. No money columns -- see the note at the top of this file. */}
      <table className="slip-table">
        <thead>
          <tr>
            <th className="slip-th-item">Item</th>
            <th className="slip-th-qty">How many</th>
          </tr>
        </thead>
        <tbody>
          {manifest.length === 0 ? (
            <tr>
              <td colSpan={2}>
                {delivery.size
                  ? delivery.size
                  : "What goes on the truck is written down when it is sent out."}
              </td>
            </tr>
          ) : (
            manifest.map((line, index) => (
              <tr key={`${line.name}-${index}`}>
                <td>{line.name}</td>
                <td className="slip-td-qty">{line.quantity}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {(itemCount > 0 || charge > 0 || (collect !== null && !arrived)) && (
        <section className="slip-totals">
          <dl>
            {itemCount > 0 && (
              <div>
                <dt>Items on the truck</dt>
                <dd>{itemCount}</dd>
              </div>
            )}
            {charge > 0 && (
              <div className={collect === null ? "slip-total-row" : undefined}>
                <dt>Delivery charge</dt>
                <dd>{formatPeso(charge)}</dd>
              </div>
            )}
            {/* The one figure a driver must not get wrong: what the order still
                owes after every payment already recorded against it. */}
            {collect !== null && !arrived && (
              <div className="slip-total-row">
                <dt>{termDays ? "Payment" : "To collect"}</dt>
                <dd>
                  {termDays
                    ? `Due ${termDays} days after delivery. Nothing to collect.`
                    : collect > 0 ? formatPeso(collect) : "Nothing. Paid in full."}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {/* The signature block is why this is printed. Once it has arrived the
          sheet is a record rather than a form, so it says so instead of
          asking for a signature that was already given. */}
      {arrived ? (
        <section className="slip-notes">
          <p>Marked arrived in the system. What went out is recorded on the order.</p>
        </section>
      ) : (
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
      )}

      <footer className="slip-foot">
        <p>
          <strong>This is not an official receipt.</strong> It is a record of what
          was loaded and where it went, so the workshop and the customer are
          working from the same sheet.
        </p>
        <p>Printed {formatLongDate(new Date().toISOString())}</p>
      </footer>
    </article>,
    document.body,
  );
}
