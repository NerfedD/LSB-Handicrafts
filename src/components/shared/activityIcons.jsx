import {
  Boxes,
  ClipboardList,
  Handshake,
  LogIn,
  Package,
  Tag,
  Truck,
  UserCog,
  UserRound,
} from "../icons";

/**
 * icon NAME -> component, for the activity feed.
 *
 * utils/activityLog.js stores a name rather than a component so it stays free
 * of a `utils -> components` dependency — the same split navigation.js and the
 * sidebar use, and for the same reason: the feed's data shape is also read by
 * the product detail screen and the dashboards, and none of them should be
 * importing lucide through a utils module.
 */
const ICONS = {
  LogIn,
  Boxes,
  Tag,
  UserCog,
  ClipboardList,
  Truck,
  Package,
  UserRound,
  Handshake,
};

export function activityIcon(name, className = "h-4.5 w-4.5") {
  const Icon = ICONS[name] ?? Package;
  return <Icon className={className} />;
}
