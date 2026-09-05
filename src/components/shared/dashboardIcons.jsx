import {
  ArrowRight,
  Boxes,
  ClipboardList,
  Hammer,
  PackageOpen,
  PackagePlus,
  Phone,
  Truck,
  UserCog,
  UserPlus,
  UserX,
} from "../icons";

/**
 * icon NAME -> component, for the attention card.
 *
 * utils/dashboard.js builds the attention items as plain data — the same split
 * navigation.js and the activity feed use — so the sentences and their
 * priority order stay testable and free of a `utils -> components` import.
 */
const ICONS = {
  PackageOpen,
  Truck,
  ClipboardList,
  Boxes,
  UserX,
  UserCog,
  PackagePlus,
  ArrowRight,
  Hammer,
  Phone,
  UserPlus,
};

export function dashIcon(name, className = "h-5.5 w-5.5") {
  const Icon = ICONS[name] ?? ArrowRight;
  return <Icon className={className} />;
}
