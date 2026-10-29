import { useState } from "react";

import { CheckCircle, SpinnerGap, Warning } from "../icons";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

/**
 * A yes-or-no before something that is hard to take back, drawn to the
 * "Confirm (destructive) · AlertDialog" board: 440px, a 32px round mark beside
 * a 16/24 title and the consequence in 13/18 --fg-2, then the keep button and
 * the act button on the right.
 *
 * `intent="delete"` paints the mark and the act button --danger; "forward"
 * (putting something back, letting someone in) keeps them neutral and blue.
 * `confirmText` asks for the record's name to be typed before the act button
 * works, for the removals that cannot be undone.
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  consequences,
  confirmLabel,
  keepLabel = "Keep it",
  intent = "delete",
  busy = false,
  confirmText,
  onConfirm,
}) {
  const destructive = intent === "delete";
  const [typed, setTyped] = useState("");
  const blocked = Boolean(confirmText) && typed.trim() !== confirmText;
  const Mark = destructive ? Warning : CheckCircle;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) setTyped("");
        onOpenChange?.(next);
      }}
    >
      <AlertDialogContent>
        <div className="flex gap-3 px-5 pt-5">
          <span
            aria-hidden="true"
            className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", destructive ? "bg-danger-bg text-danger-fg" : "bg-muted text-fg-2")}
          >
            <Mark className="size-4" />
          </span>
          <div className="min-w-0">
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription render={<div />}>{consequences}</AlertDialogDescription>
          </div>
        </div>
        {confirmText ? (
          <div className="flex flex-col gap-1.5 pl-16 pr-5 pt-3.5">
            <label htmlFor="confirm-type" className="text-13 font-medium">
              Type <strong className="font-semibold">{confirmText}</strong> to confirm
            </label>
            <input
              id="confirm-type"
              type="text"
              autoComplete="off"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              className="lsb-field h-8 rounded-md border border-border bg-card px-2.5 text-sm"
            />
          </div>
        ) : null}
        <AlertDialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange?.(false)}>
            {keepLabel}
          </Button>
          <Button variant={destructive ? "destructive" : "default"} disabled={busy || blocked} onClick={onConfirm}>
            {busy ? (
              <>
                <SpinnerGap className="animate-spin" aria-hidden="true" />
                Working…
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
