import { AlertTriangle } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * The app's one confirmation modal.
 *
 * Replaces DeleteAccountModal (UserAccountsPage) and BlockAccountModal
 * (ManageUserAccountPage), which were the same shell byte for byte — same
 * scrim, radius, padding, shadow, circled warning icon, name chip and pair of
 * equal-width buttons — differing only in their strings and confirm colour.
 * The dead ConfirmModal.jsx was a third.
 *
 * The styling below is theirs, so both screens look unchanged. What is new
 * comes from Radix underneath: focus is trapped and returned to the trigger,
 * Escape closes, and the page behind is hidden from screen readers. None of
 * the hand-rolled versions did any of that.
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  subject,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "destructive",
  busy = false,
  onConfirm,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose={false}>
        <DialogHeader>
          <div
            className={
              variant === "destructive"
                ? "flex size-[72px] items-center justify-center rounded-full border border-[#b5474733] bg-[#b5474714]"
                : "flex size-[72px] items-center justify-center rounded-full border border-[#8a560033] bg-[#8a560014]"
            }
          >
            <AlertTriangle
              className={
                variant === "destructive"
                  ? "h-8 w-8 text-danger"
                  : "h-8 w-8 text-warning"
              }
            />
          </div>
          <DialogTitle>{title}</DialogTitle>
          {subject && (
            <span className="rounded-lg bg-[#17263a0a] px-3 py-1.5 text-sm font-semibold text-ink">
              {subject}
            </span>
          )}
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <DialogFooter className="mt-6">
          <Button
            type="button"
            variant="outline"
            className="h-[52px] flex-1"
            disabled={busy}
            onClick={() => onOpenChange?.(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "navy"}
            className="h-[52px] flex-1"
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
