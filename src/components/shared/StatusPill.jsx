import { Badge } from "@/components/ui/badge";
import { badgeVariant } from "./tones";

/**
 * A status: the boards' small soft badge, a 6px dot and one word. The tone
 * picks success, warning, danger or neutral (shared/tones.js).
 */
export default function StatusPill({ label, tone = "neutral", className }) {
  return (
    <Badge variant={badgeVariant(tone)} dot className={className}>
      {label}
    </Badge>
  );
}

/** A plain count or label badge, neutral unless a tone says otherwise. */
export function InlineBadge({ label, tone = "neutral", className }) {
  return (
    <Badge variant={badgeVariant(tone)} className={className}>
      {label}
    </Badge>
  );
}
