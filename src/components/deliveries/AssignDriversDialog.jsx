import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "../shared/Chip";
import { STAGE_LOOK } from "./stageLook";
import { cn } from "@/lib/utils";
import { DELIVERY_STAGE } from "../../utils/constants";
import { areaOf, customerFrom, dueLabel, hasNoDriver } from "../../utils/deliveries";

/**
 * Assign drivers, drawn to the "Assign drivers · Dialog" board: the drivers
 * with how many runs each already has, then every delivery nobody is taking,
 * each with one radio chip per driver. Saving gives each chosen delivery to
 * its driver through the same handler the single-delivery dialog uses.
 *
 * Drivers are the active Delivery Staff. The board's "Text each driver their
 * run" is left out: the app sends no text messages.
 */
export default function AssignDriversDialog({ open, onOpenChange, deliveries = [], staff = [], onAssign }) {
  const [choices, setChoices] = useState({});
  const [saving, setSaving] = useState(false);

  const waiting = useMemo(
    () => deliveries.filter((d) => d.status !== DELIVERY_STAGE.ARRIVED && hasNoDriver(d)),
    [deliveries]
  );
  const drivers = useMemo(
    () => staff.filter((person) => person.role === "Delivery Staff" && person.status !== "Blocked"),
    [staff]
  );
  const loadOf = (name) => deliveries.filter((d) => d.status !== DELIVERY_STAGE.ARRIVED && d.driver === name).length;
  const assigned = Object.values(choices).filter(Boolean).length;

  const close = (next) => {
    if (saving) return;
    if (!next) setChoices({});
    onOpenChange?.(next);
  };

  async function save() {
    setSaving(true);
    for (const delivery of waiting) {
      const name = choices[delivery.id];
      if (name) await onAssign(delivery, name);
    }
    setSaving(false);
    setChoices({});
    onOpenChange?.(false);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Assign drivers</DialogTitle>
          <DialogDescription>
            {waiting.length === 0
              ? "Every delivery has somebody taking it."
              : `${waiting.length} ${waiting.length === 1 ? "delivery has" : "deliveries have"} nobody to take ${waiting.length === 1 ? "it" : "them"}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3.5 px-5 py-4">
          {drivers.length === 0 ? (
            <p className="m-0 text-13 text-muted-fg">There is no active Delivery Staff account to give runs to. A delivery can still be given to anyone by name from its own screen.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {drivers.map((driver) => (
                <div key={driver.id} className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2">
                  <Avatar name={driver.name} size="sm" />
                  <div className="min-w-0 text-13">
                    <div className="truncate font-medium">{driver.name}</div>
                    <div className="text-muted-fg">{loadOf(driver.name)} {loadOf(driver.name) === 1 ? "run" : "runs"} already</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {waiting.length > 0 && drivers.length > 0 ? (
            <div role="table" aria-label="Deliveries without a driver" className="overflow-hidden rounded-md border border-border">
              {waiting.map((delivery) => (
                <div role="row" key={delivery.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-row-divider px-3 py-2 last:border-b-0">
                  <div role="cell" className="min-w-0 text-13">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-fg-2">#{delivery.id}</span>
                      <span className="truncate font-medium">{customerFrom(delivery) || "No customer named"}</span>
                    </div>
                    <div className="text-xs text-muted-fg">
                      {[areaOf(delivery), dueLabel(delivery), STAGE_LOOK[delivery.status]?.label].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div role="cell">
                    <div role="radiogroup" aria-label={`Driver for delivery ${delivery.id}`} className="flex flex-wrap gap-1">
                      {drivers.map((driver) => {
                        const on = choices[delivery.id] === driver.name;
                        return (
                          <button
                            key={driver.id}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => setChoices((prev) => ({ ...prev, [delivery.id]: on ? undefined : driver.name }))}
                            className={cn(
                              "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-13 font-medium",
                              on ? "border-primary-text bg-card shadow-[0_0_0_1px_var(--primary-text)]" : "border-border bg-card hover:bg-surface-2"
                            )}
                          >
                            <Avatar name={driver.name} className="size-5 text-[9px]" />
                            {driver.name.split(" ")[0]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <DialogFooter className="items-center justify-between">
          <span className="text-13 text-muted-fg">{assigned} of {waiting.length} assigned</span>
          <span className="flex gap-2">
            <Button variant="outline" onClick={() => close(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving || assigned === 0}>
              {saving ? "Saving…" : assigned ? `Assign ${assigned} ${assigned === 1 ? "delivery" : "deliveries"}` : "Assign"}
            </Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
