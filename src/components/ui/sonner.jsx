import { Toaster as Sonner, toast } from "sonner";

/**
 * Toasts.
 *
 * This is the piece the app was missing entirely. Every Supabase write used to
 * go through a whole-table sync whose only failure path was console.error — so
 * a rejected write showed the user a green "saved successfully" panel while
 * nothing had been persisted. See storageManager.js for the write layer that
 * returns { ok, error } and the callers that surface it here.
 *
 * NAVY, NOT WHITE. The handoff makes the confirmation toast a navy panel with a
 * green check chip, and that is not decoration: a white toast on a paper canvas
 * covered in white cards does not announce itself. The dark panel is the only
 * thing on screen that colour, so it reads as a system message rather than as
 * another card that appeared.
 *
 * A toast says what happened and names the record ("Ana Reyes can sign in
 * again"), so `toast.success("Saved.")` is not enough — pass the subject.
 */
function Toaster(props) {
  return (
    <Sonner
      position="top-right"
      closeButton
      // 5s is sonner's default and too short to read a two-line confirmation
      // that names a record, at the reading speed this system is designed for.
      duration={6000}
      gap={12}
      toastOptions={{
        classNames: {
          toast: [
            "group w-full items-start gap-3 rounded-tile2 border-0 bg-navy p-4.5 text-white shadow-toast",
          ].join(" "),
          title: "text-[16px] font-extrabold leading-[1.35] text-white",
          description: "pt-1 text-[14px] leading-[1.45] text-white/75",
          icon: "mt-0.5",
          // The action is a word with an underline, not a second filled
          // button competing with the primary action on the screen behind it.
          actionButton:
            "!bg-transparent !px-0 !text-[14.5px] !font-bold !text-white !underline !underline-offset-[3px] hover:!text-white/80",
          cancelButton: "!bg-white/[0.14] !text-[14.5px] !font-bold !text-white",
          closeButton:
            "!border-white/20 !bg-navy !text-white hover:!bg-[#0b2547]",
          success: "[&_[data-icon]]:text-[#4dbb8c]",
          error: "[&_[data-icon]]:text-[#f09b8e]",
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
