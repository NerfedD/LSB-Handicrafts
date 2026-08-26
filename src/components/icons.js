// Central icon re-exports.
//
// Deep imports, deliberately — NOT `from "lucide-react"`. The package is a
// ~1900-icon barrel with no `exports` map, so Vite pre-bundles the entire
// thing into a single 1.07 MB dep chunk in dev, even for a file that uses
// three icons. These paths pull only what's actually used. Production builds
// tree-shake either way; this is about dev-server load time.
//
// Adding an icon: find its kebab-case file under
// node_modules/lucide-react/dist/esm/icons/ and add a line here.
export { default as AlertCircle } from "lucide-react/dist/esm/icons/alert-circle.js";
export { default as AlertTriangle } from "lucide-react/dist/esm/icons/alert-triangle.js";
export { default as ArrowLeft } from "lucide-react/dist/esm/icons/arrow-left.js";
export { default as Calculator } from "lucide-react/dist/esm/icons/calculator.js";
export { default as CheckCircle2 } from "lucide-react/dist/esm/icons/check-circle-2.js";
export { default as ChevronDown } from "lucide-react/dist/esm/icons/chevron-down.js";
export { default as ChevronLeft } from "lucide-react/dist/esm/icons/chevron-left.js";
export { default as Clock } from "lucide-react/dist/esm/icons/clock.js";
export { default as Edit2 } from "lucide-react/dist/esm/icons/edit-2.js";
export { default as Eye } from "lucide-react/dist/esm/icons/eye.js";
export { default as EyeOff } from "lucide-react/dist/esm/icons/eye-off.js";
export { default as History } from "lucide-react/dist/esm/icons/history.js";
export { default as Info } from "lucide-react/dist/esm/icons/info.js";
export { default as LayoutDashboard } from "lucide-react/dist/esm/icons/layout-dashboard.js";
export { default as Lightbulb } from "lucide-react/dist/esm/icons/lightbulb.js";
export { default as LogOut } from "lucide-react/dist/esm/icons/log-out.js";
export { default as MapPin } from "lucide-react/dist/esm/icons/map-pin.js";
export { default as Menu } from "lucide-react/dist/esm/icons/menu.js";
export { default as Moon } from "lucide-react/dist/esm/icons/moon.js";
export { default as MoreHorizontal } from "lucide-react/dist/esm/icons/more-horizontal.js";
export { default as MoreVertical } from "lucide-react/dist/esm/icons/more-vertical.js";
export { default as Package } from "lucide-react/dist/esm/icons/package.js";
export { default as Plus } from "lucide-react/dist/esm/icons/plus.js";
export { default as Save } from "lucide-react/dist/esm/icons/save.js";
export { default as Search } from "lucide-react/dist/esm/icons/search.js";
export { default as ShoppingCart } from "lucide-react/dist/esm/icons/shopping-cart.js";
export { default as Sun } from "lucide-react/dist/esm/icons/sun.js";
export { default as Trash2 } from "lucide-react/dist/esm/icons/trash-2.js";
export { default as Truck } from "lucide-react/dist/esm/icons/truck.js";
export { default as Users } from "lucide-react/dist/esm/icons/users.js";
export { default as X } from "lucide-react/dist/esm/icons/x.js";
