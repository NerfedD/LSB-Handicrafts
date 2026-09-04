import { TriangleAlert } from "../icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import IconChip from "./Chip";

/**
 * The app's one confirmation dialog, and rule 6 in component form.
 *
 * WHAT THE HANDOFF REQUIRES OF EVERY DESTRUCTIVE CONFIRM:
 *
 *   1. NAME THE RECORD in the heading. Not "Are you sure?" but
 *      'Delete "Styro Ball 6 inch"?'. "Are you sure? This cannot be undone."
 *      is a question about a thing the dialog has declined to identify, and
 *      the honest answer to it is "sure about what?".
 *   2. STATE THE CONSEQUENCES, and state what SURVIVES. Somebody removing a
 *      staff account needs to know the orders that person wrote stay exactly
 *      as they are — without that, the safe-looking choice is to leave a
 *      leaver's account active forever.
 *   3. THE BUTTON SAYS THE VERB. "Yes, delete it", not "OK" or "Confirm". A
 *      button labelled "Confirm" tells you nothing about which of the two
 *      options you are picking, which is exactly when it gets clicked by
 *      mistake.
 *   4. THE DISMISSING BUTTON IS POSITIVE. "Keep it", not "Cancel" — cancelling
 *      is ambiguous next to a destructive verb ("cancel the deletion" or
 *      "cancel the record"?).
 *
 * `subject` and `consequences` are required for that reason: a confirm that
 * can be constructed without them is a confirm that will be.
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  /** The heading, which must contain the record's name. */
  title,
  /** What happens, and what survives. */
  consequences,
  confirmLabel,
  keepLabel = "Keep it",
  /** "delete" paints the confirm button red; "forward" paints it green. */
  intent = "delete",
  busy = false,
  onConfirm,
}) {
  const destructive = intent === "delete";

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent showClose={false} className="max-w-[520px]">
        <DialogHeader className="flex items-start gap-4 pr-6.5">
          <IconChip
            icon={<TriangleAlert />}
            tone={destructive ? "red" : "green"}
            size="xl"
          />
          <div className="min-w-0">
            <DialogTitle>{title}</DialogTitle>
          </div>
        </DialogHeader>

        <DialogBody>
          <DialogDescription className="pt-0 text-[16px] text-ink-2">
            {consequences}
          </DialogDescription>
        </DialogBody>

        <DialogFooter className="justify-between">
          <Button variant="outline" size="lg" disabled={busy} onClick={() => onOpenChange?.(false)}>
            {keepLabel}
          </Button>
          <Button
            variant={destructive ? "danger-solid" : "green"}
            size="lg"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
