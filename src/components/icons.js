// Central icon re-exports.
//
// Deep imports, deliberately — NOT `from "lucide-react"`. The package is a
// barrel of ~1900 icons with no `exports` map, so Vite pre-bundles the entire
// thing into a ~1MB dep chunk in dev, even for a file that uses three icons.
// These paths pull only what's actually used. Production tree-shakes either
// way; this is about dev-server load time.
//
// CAUTION: these are internal paths into the package's dist/, not a public
// API, so they are tied to the exact installed version — 1.8.0 shipped ESM as
// .js, 1.33.0 ships .mjs, and that rename alone broke a production build.
// lucide-react is therefore pinned exactly in package.json. If you bump it,
// check the file extension under node_modules/lucide-react/dist/esm/icons/
// and run `npm run build` before pushing.
//
// Adding an icon: find its kebab-case file in that directory and add a line.
export { default as AlertCircle }     from "lucide-react/dist/esm/icons/alert-circle.mjs";
export { default as AlertTriangle }   from "lucide-react/dist/esm/icons/alert-triangle.mjs";
export { default as ArrowLeft }       from "lucide-react/dist/esm/icons/arrow-left.mjs";
export { default as Bell }            from "lucide-react/dist/esm/icons/bell.mjs";
export { default as BookUser }        from "lucide-react/dist/esm/icons/book-user.mjs";
export { default as Box }             from "lucide-react/dist/esm/icons/box.mjs";
export { default as Calculator }      from "lucide-react/dist/esm/icons/calculator.mjs";
export { default as Calendar }        from "lucide-react/dist/esm/icons/calendar.mjs";
export { default as CheckCircle2 }    from "lucide-react/dist/esm/icons/check-circle-2.mjs";
export { default as ChevronDown }     from "lucide-react/dist/esm/icons/chevron-down.mjs";
export { default as ChevronLeft }     from "lucide-react/dist/esm/icons/chevron-left.mjs";
export { default as CircleSlash }     from "lucide-react/dist/esm/icons/circle-slash.mjs";
export { default as Clock }           from "lucide-react/dist/esm/icons/clock.mjs";
export { default as Edit2 }           from "lucide-react/dist/esm/icons/edit-2.mjs";
export { default as Eye }             from "lucide-react/dist/esm/icons/eye.mjs";
export { default as EyeOff }          from "lucide-react/dist/esm/icons/eye-off.mjs";
export { default as FileText }        from "lucide-react/dist/esm/icons/file-text.mjs";
export { default as History }         from "lucide-react/dist/esm/icons/history.mjs";
export { default as Info }            from "lucide-react/dist/esm/icons/info.mjs";
export { default as LayoutDashboard } from "lucide-react/dist/esm/icons/layout-dashboard.mjs";
export { default as Lightbulb }       from "lucide-react/dist/esm/icons/lightbulb.mjs";
export { default as LogOut }          from "lucide-react/dist/esm/icons/log-out.mjs";
export { default as Mail }            from "lucide-react/dist/esm/icons/mail.mjs";
export { default as MapPin }          from "lucide-react/dist/esm/icons/map-pin.mjs";
export { default as Menu }            from "lucide-react/dist/esm/icons/menu.mjs";
export { default as Moon }            from "lucide-react/dist/esm/icons/moon.mjs";
export { default as MoreHorizontal }  from "lucide-react/dist/esm/icons/more-horizontal.mjs";
export { default as MoreVertical }    from "lucide-react/dist/esm/icons/more-vertical.mjs";
export { default as Package }         from "lucide-react/dist/esm/icons/package.mjs";
export { default as Phone }           from "lucide-react/dist/esm/icons/phone.mjs";
export { default as Plus }            from "lucide-react/dist/esm/icons/plus.mjs";
export { default as Save }            from "lucide-react/dist/esm/icons/save.mjs";
export { default as Search }          from "lucide-react/dist/esm/icons/search.mjs";
export { default as ShoppingCart }    from "lucide-react/dist/esm/icons/shopping-cart.mjs";
export { default as Sun }             from "lucide-react/dist/esm/icons/sun.mjs";
export { default as Trash2 }          from "lucide-react/dist/esm/icons/trash-2.mjs";
export { default as Truck }           from "lucide-react/dist/esm/icons/truck.mjs";
export { default as UserPlus }        from "lucide-react/dist/esm/icons/user-plus.mjs";
export { default as UserRound }       from "lucide-react/dist/esm/icons/user-round.mjs";
export { default as Users }           from "lucide-react/dist/esm/icons/users.mjs";
export { default as X }               from "lucide-react/dist/esm/icons/x.mjs";
