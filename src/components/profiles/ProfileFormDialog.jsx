import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * The chrome the Customer / Supplier / Product add-and-edit dialogs share.
 *
 * Geometry deliberately matches CreateUserAccountDialog — max-w-[720px],
 * max-h-[90vh], cream header band, scrolling body — so the two kinds of record
 * modal read as one thing rather than two conventions.
 *
 * The scrolling body is load-bearing, not decorative: the product form has
 * twelve-plus fields and will not fit a viewport otherwise.
 *
 * `p-0 text-left` overrides DialogContent's centred `px-12 py-11 text-center`
 * default, which works because cn() is tailwind-merge.
 *
 * A dismissal mid-write is refused, the same rule CreateUserAccountDialog uses:
 * the row is already in flight and closing would leave nowhere to report the
 * result.
 */
export default function ProfileFormDialog({
  open,
  onOpenChange,
  saving = false,
  icon,
  title,
  description,
  children,
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        onOpenChange?.(next);
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-[720px] flex-col p-0 text-left">
        <div className="flex shrink-0 items-center gap-4 rounded-t-2xl border-b border-[#17263a12] bg-[#f7f4ec] px-8 py-6">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-[#1746d114] text-[#1746d1]">
            {icon}
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-[19px] font-bold tracking-[-0.19px] text-[#17263a]">
              {title}
            </DialogTitle>
            <DialogDescription className="text-[12.5px] text-[#5f6875]">
              {description}
            </DialogDescription>
          </div>
        </div>

        {children}
      </DialogContent>
    </Dialog>
  );
}
