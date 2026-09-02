import { Toaster as Sonner, toast } from "sonner";

/**
 * Toasts.
 *
 * This is the piece the app was missing entirely. Every Supabase write went
 * through syncTable(), whose only failure path was console.error -- so a
 * rejected write showed the user a green "profile saved successfully" panel
 * while nothing had been persisted. See storageManager.js for the write layer
 * that now returns { ok, error } and the callers that surface it here.
 *
 * Styled to the app's own palette rather than sonner's defaults.
 */
function Toaster(props) {
  return (
    <Sonner
      position="top-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "rounded-[10px] border border-[#17263a14] bg-white text-ink shadow-[0_8px_24px_rgba(17,30,50,0.12)]",
          description: "text-muted",
          actionButton: "bg-brand text-white",
          cancelButton: "bg-[#17263a08] text-muted",
          error: "border-[#b5474733]",
          success: "border-[#287a5538]",
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
