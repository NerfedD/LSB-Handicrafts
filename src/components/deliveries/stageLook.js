import { DELIVERY_STAGE } from "../../utils/constants";

/**
 * How each delivery stage looks and what moving it on is called, from the
 * Deliveries board: a neutral badge for the early stages, warning while it
 * is being made, the inverse dot when it is ready, success once delivered.
 */
export const STAGE_LOOK = {
  [DELIVERY_STAGE.NOT_SENT]: { label: "Not yet sent", verb: "Start making", className: "border-border-subtle bg-card text-fg-2", dot: "bg-muted-2" },
  [DELIVERY_STAGE.BEING_MADE]: { label: "Being made", verb: "Mark ready", className: "border-warning-bd bg-warning-bg text-warning-fg", dot: "bg-warning" },
  [DELIVERY_STAGE.READY]: { label: "Ready to go", verb: "Send out", className: "border-border bg-muted text-ink", dot: "bg-inverse" },
  [DELIVERY_STAGE.ON_THE_WAY]: { label: "On the way", verb: "Mark delivered", className: "border-border-subtle bg-muted text-fg-2", dot: "bg-muted-fg" },
  [DELIVERY_STAGE.ARRIVED]: { label: "Delivered", verb: "", className: "border-success-bd bg-success-bg text-success-fg", dot: "bg-success" },
};
