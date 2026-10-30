import { cn } from "@/lib/utils";
import { DELIVERY_STAGE } from "../../utils/constants";
import { STAGE_LOOK } from "./stageLook";

/** A delivery's stage: a 20px badge, a 6px dot and the stage's word. */
export default function StageBadge({ status }) {
  const look = STAGE_LOOK[status] ?? STAGE_LOOK[DELIVERY_STAGE.NOT_SENT];
  return (
    <span className={cn("inline-flex h-5 items-center gap-[5px] whitespace-nowrap rounded border px-1.5 text-xs font-medium", look.className)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", look.dot)} />
      {look.label}
    </span>
  );
}
