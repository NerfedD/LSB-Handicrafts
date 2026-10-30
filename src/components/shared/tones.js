/**
 * Status tones, mapped onto the design's four: success, warning, danger and
 * neutral zinc. Status colour appears only in small soft badges and notes;
 * everything else is neutral (design/admin-dashboard/Tokens.dc.html).
 *
 * The app's data names a tone per state (utils/copy.js, utils/dashboard.js);
 * this is the one place that turns those names into the design's tokens.
 */
const STATUS = {
  success: {
    variant: "success",
    text: "text-success-fg",
    pillText: "text-success-fg",
    tint: "bg-success-bg",
    border: "border-success-bd",
    fill: "bg-success",
    dot: "bg-success-fg",
  },
  warning: {
    variant: "warning",
    text: "text-warning-fg",
    pillText: "text-warning-fg",
    tint: "bg-warning-bg",
    border: "border-warning-bd",
    fill: "bg-warning",
    dot: "bg-warning-fg",
  },
  danger: {
    variant: "destructive",
    text: "text-danger-fg",
    pillText: "text-danger-fg",
    tint: "bg-danger-bg",
    border: "border-danger-bd",
    fill: "bg-danger",
    dot: "bg-danger-fg",
  },
  neutral: {
    variant: "secondary",
    text: "text-fg-2",
    pillText: "text-fg-2",
    tint: "bg-muted",
    border: "border-border",
    fill: "bg-strong-bg",
    dot: "bg-muted-fg",
  },
};

/** The app's tone names (and the design's own) -> one of the four. */
const KIND = {
  green: "success",
  success: "success",
  amber: "warning",
  warning: "warning",
  accent: "warning",
  red: "danger",
  danger: "danger",
  destructive: "danger",
  // "info" and "progress" (a stage under way) are neutral on purpose: the
  // design keeps blue for the one primary action, never for a status.
  info: "neutral",
  progress: "neutral",
};

const statusKind = (name) => KIND[name] ?? "neutral";

/** Falls back to neutral rather than throwing on an unmapped tone. */
export const tone = (name) => STATUS[statusKind(name)];

/** The Badge variant for a tone name. */
export const badgeVariant = (name) => tone(name).variant;
