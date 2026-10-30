import { createPortal } from "react-dom";

import { letterheadOf } from "../../utils/office";
import { customerFrom, dueTime, orderRefFrom } from "../../utils/deliveries";
import { formatLongDate, formatShortDate } from "../../utils/profileFormat";
import { STAGE_LOOK } from "./stageLook";

/**
 * The printed run sheet -- one page the drivers work off for the day.
 *
 * NOT A DOCUMENT FOR A CUSTOMER, unlike the order and delivery slips. This one
 * stays with the workshop and the drivers, which changes what belongs on it:
 * every stop, grouped by whose truck it is on, with the address and a box to
 * tick as each one is done. It is the sheet on the clipboard by the door.
 *
 * IT PRINTS WHAT IS ON SCREEN, not everything in the database. The board above
 * it already has search, Due, Driver and Area filters, and the person pressing
 * Print has just used them to say what they care about -- "due today",
 * "Marvin's runs". Printing the unfiltered table instead would mean filtering
 * on paper afterwards with a pen. So the filtered list is what arrives here,
 * and the header says in words which filter produced it, because a sheet that
 * does not say what it is a list OF is unreadable an hour later.
 *
 * GROUPED BY DRIVER, with no-driver-yet last. A run sheet sorted by delivery
 * number is a sheet every driver has to read all of to find their own stops;
 * grouped, each one tears off or reads only their block. Inside a group the
 * stops are in promised-date order -- the order they should be driven.
 *
 * Same `.slip` plumbing as OrderSlip and DeliverySlip: a portal to
 * `document.body` beside `#root`, styled by the print stylesheet in index.css.
 */

/** Driver name → their stops, in the order they should be driven. */
function groupByDriver(deliveries) {
  const groups = new Map();
  for (const delivery of deliveries) {
    const driver = String(delivery.driver || "").trim();
    const key = driver || "\u0000"; // sorts last, rendered as "No driver yet"
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(delivery);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, stops]) => ({
      driver: key === "\u0000" ? "No driver yet" : key,
      stops: stops.sort((one, two) => {
        // No promised date sorts after dated stops rather than before them:
        // a run is planned around the deliveries that have been promised.
        const first = dueTime(one);
        const second = dueTime(two);
        if (first === second) return one.id - two.id;
        if (first === null) return 1;
        if (second === null) return -1;
        return first - second;
      }),
    }));
}

export default function RunSheet({ deliveries = [], scope, settings = null }) {
  const head = letterheadOf(settings);
  const groups = groupByDriver(deliveries);
  const stops = deliveries.length;

  return createPortal(
    <article className="slip" aria-hidden="true">
      <header className="slip-head">
        <div>
          <p className="slip-brand">{head.name}</p>
          <p className="slip-trade">{head.trade}</p>
          {head.phone ? <p className="slip-trade">{head.phone}</p> : null}
        </div>
        <div className="slip-head-right">
          <p className="slip-doc">Run sheet</p>
          <p className="slip-number">{stops}</p>
          <p className="slip-written">{stops === 1 ? "stop" : "stops"}</p>
          {/* Which filter produced this list. Without it the sheet is a pile
              of stops with no statement of what it leaves out. */}
          {scope ? <p className="slip-standing">{scope}</p> : null}
        </div>
      </header>

      <div className="slip-rule" />

      {groups.length === 0 ? (
        <p className="slip-line">Nothing matches the filters on the board, so there is nothing to drive.</p>
      ) : (
        groups.map(({ driver, stops: runs }) => (
          <section key={driver} className="sheet-group">
            <div className="sheet-driver">
              <p className="sheet-driver-name">{driver}</p>
              <p className="sheet-driver-count">{runs.length} {runs.length === 1 ? "stop" : "stops"}</p>
            </div>
            <table className="slip-table">
              <thead>
                <tr>
                  <th className="run-th-no">No.</th>
                  <th className="slip-th-item">Customer and where</th>
                  <th className="run-th-items">Items</th>
                  <th className="run-th-due">Promised</th>
                  <th className="run-th-done">Done</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((delivery) => {
                  const manifest = Array.isArray(delivery.itemsManifest) ? delivery.itemsManifest : [];
                  const count = manifest.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
                  const orderRef = orderRefFrom(delivery);
                  return (
                    <tr key={delivery.id}>
                      <td className="run-td-no">
                        #{delivery.id}
                        {orderRef ? <span className="run-order">ord #{orderRef}</span> : null}
                      </td>
                      <td>
                        <span className="run-customer">{customerFrom(delivery) || "No customer named"}</span>
                        <span className="run-where">{delivery.location || "No address recorded"}</span>
                      </td>
                      <td className="run-td-items">{count || "\u2014"}</td>
                      <td className="run-td-due">
                        {delivery.dueOn ? formatShortDate(delivery.dueOn) : "No date"}
                        <span className="run-stage">{STAGE_LOOK[delivery.status]?.label ?? ""}</span>
                      </td>
                      {/* Ticked with a pen in the cab, which is the one thing
                          the screen version of this board cannot offer. */}
                      <td className="run-td-done"><span className="run-tick" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))
      )}

      <footer className="slip-foot">
        <p>
          <strong>Working sheet, not a receipt.</strong> Each stop is signed for on
          its own delivery slip; this page is the round.
        </p>
        <p>Printed {formatLongDate(new Date().toISOString())}</p>
      </footer>
    </article>,
    document.body,
  );
}
