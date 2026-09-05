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
//
// NAMES FOLLOW LUCIDE'S CURRENT ONES. The list below is the set named in the
// UI overhaul handoff. Where lucide renamed an icon (alert-circle ->
// circle-alert, check-circle-2 -> circle-check, edit-2 -> pencil), the new
// name is what's exported and the old alias is kept at the bottom of the file
// so nothing has to be renamed in one commit.

// ---- navigation & sections ----
export { default as LayoutDashboard } from "lucide-react/dist/esm/icons/layout-dashboard.mjs";
export { default as Package }         from "lucide-react/dist/esm/icons/package.mjs";
export { default as PackagePlus }     from "lucide-react/dist/esm/icons/package-plus.mjs";
export { default as PackageCheck }    from "lucide-react/dist/esm/icons/package-check.mjs";
export { default as PackageOpen }     from "lucide-react/dist/esm/icons/package-open.mjs";
export { default as ShoppingCart }    from "lucide-react/dist/esm/icons/shopping-cart.mjs";
export { default as Truck }           from "lucide-react/dist/esm/icons/truck.mjs";
export { default as Users }           from "lucide-react/dist/esm/icons/users.mjs";
export { default as UserRound }       from "lucide-react/dist/esm/icons/user-round.mjs";
export { default as UserPlus }        from "lucide-react/dist/esm/icons/user-plus.mjs";
export { default as UserCheck }       from "lucide-react/dist/esm/icons/user-check.mjs";
export { default as UserX }           from "lucide-react/dist/esm/icons/user-x.mjs";
export { default as UserCog }         from "lucide-react/dist/esm/icons/user-cog.mjs";
export { default as Handshake }       from "lucide-react/dist/esm/icons/handshake.mjs";
export { default as BookUser }        from "lucide-react/dist/esm/icons/book-user.mjs";

// ---- work & product shapes ----
export { default as ClipboardList }   from "lucide-react/dist/esm/icons/clipboard-list.mjs";
export { default as ClipboardCheck }  from "lucide-react/dist/esm/icons/clipboard-check.mjs";
export { default as Hammer }          from "lucide-react/dist/esm/icons/hammer.mjs";
export { default as Boxes }           from "lucide-react/dist/esm/icons/boxes.mjs";
export { default as Box }             from "lucide-react/dist/esm/icons/box.mjs";
export { default as Square }          from "lucide-react/dist/esm/icons/square.mjs";
export { default as Circle }          from "lucide-react/dist/esm/icons/circle.mjs";
export { default as Shapes }          from "lucide-react/dist/esm/icons/shapes.mjs";
export { default as Scissors }        from "lucide-react/dist/esm/icons/scissors.mjs";
export { default as Ruler }           from "lucide-react/dist/esm/icons/ruler.mjs";

// ---- controls ----
export { default as Search }          from "lucide-react/dist/esm/icons/search.mjs";
export { default as Filter }          from "lucide-react/dist/esm/icons/filter.mjs";
export { default as ChevronDown }     from "lucide-react/dist/esm/icons/chevron-down.mjs";
export { default as ChevronLeft }     from "lucide-react/dist/esm/icons/chevron-left.mjs";
export { default as ChevronRight }    from "lucide-react/dist/esm/icons/chevron-right.mjs";
export { default as ChevronUp }       from "lucide-react/dist/esm/icons/chevron-up.mjs";
export { default as ArrowLeft }       from "lucide-react/dist/esm/icons/arrow-left.mjs";
export { default as ArrowRight }      from "lucide-react/dist/esm/icons/arrow-right.mjs";
export { default as Eye }             from "lucide-react/dist/esm/icons/eye.mjs";
export { default as EyeOff }          from "lucide-react/dist/esm/icons/eye-off.mjs";
export { default as Pencil }          from "lucide-react/dist/esm/icons/pencil.mjs";
export { default as Trash2 }          from "lucide-react/dist/esm/icons/trash-2.mjs";
export { default as Plus }            from "lucide-react/dist/esm/icons/plus.mjs";
export { default as Minus }           from "lucide-react/dist/esm/icons/minus.mjs";
export { default as X }               from "lucide-react/dist/esm/icons/x.mjs";
export { default as Check }           from "lucide-react/dist/esm/icons/check.mjs";
export { default as Menu }            from "lucide-react/dist/esm/icons/menu.mjs";
export { default as MoreVertical }    from "lucide-react/dist/esm/icons/more-vertical.mjs";
export { default as MoreHorizontal }  from "lucide-react/dist/esm/icons/more-horizontal.mjs";

// ---- status & feedback ----
export { default as CircleCheck }     from "lucide-react/dist/esm/icons/circle-check.mjs";
export { default as CircleX }         from "lucide-react/dist/esm/icons/circle-x.mjs";
export { default as CircleMinus }     from "lucide-react/dist/esm/icons/circle-minus.mjs";
export { default as CircleAlert }     from "lucide-react/dist/esm/icons/circle-alert.mjs";
export { default as CircleHelp }      from "lucide-react/dist/esm/icons/circle-help.mjs";
export { default as TriangleAlert }   from "lucide-react/dist/esm/icons/triangle-alert.mjs";
export { default as Shield }          from "lucide-react/dist/esm/icons/shield.mjs";
export { default as ShieldAlert }     from "lucide-react/dist/esm/icons/shield-alert.mjs";
export { default as BadgeCheck }      from "lucide-react/dist/esm/icons/badge-check.mjs";
export { default as Bell }            from "lucide-react/dist/esm/icons/bell.mjs";
export { default as Info }            from "lucide-react/dist/esm/icons/info.mjs";
export { default as CloudOff }        from "lucide-react/dist/esm/icons/cloud-off.mjs";
export { default as LoaderCircle }    from "lucide-react/dist/esm/icons/loader-circle.mjs";
export { default as Lightbulb }       from "lucide-react/dist/esm/icons/lightbulb.mjs";

// ---- contact & identity ----
export { default as Mail }            from "lucide-react/dist/esm/icons/mail.mjs";
export { default as Phone }           from "lucide-react/dist/esm/icons/phone.mjs";
export { default as MapPin }          from "lucide-react/dist/esm/icons/map-pin.mjs";
export { default as AtSign }          from "lucide-react/dist/esm/icons/at-sign.mjs";
export { default as Lock }            from "lucide-react/dist/esm/icons/lock.mjs";
export { default as KeyRound }        from "lucide-react/dist/esm/icons/key-round.mjs";
export { default as LogIn }           from "lucide-react/dist/esm/icons/log-in.mjs";
export { default as LogOut }          from "lucide-react/dist/esm/icons/log-out.mjs";
export { default as Building2 }       from "lucide-react/dist/esm/icons/building-2.mjs";

// ---- time ----
export { default as Calendar }        from "lucide-react/dist/esm/icons/calendar.mjs";
export { default as CalendarDays }    from "lucide-react/dist/esm/icons/calendar-days.mjs";
export { default as CalendarClock }   from "lucide-react/dist/esm/icons/calendar-clock.mjs";
export { default as Clock }           from "lucide-react/dist/esm/icons/clock.mjs";
export { default as History }         from "lucide-react/dist/esm/icons/history.mjs";

// ---- money & records ----
export { default as Tag }             from "lucide-react/dist/esm/icons/tag.mjs";
export { default as Wallet }          from "lucide-react/dist/esm/icons/wallet.mjs";
export { default as Banknote }        from "lucide-react/dist/esm/icons/banknote.mjs";
export { default as Save }            from "lucide-react/dist/esm/icons/save.mjs";
export { default as Printer }         from "lucide-react/dist/esm/icons/printer.mjs";
export { default as Download }        from "lucide-react/dist/esm/icons/download.mjs";
export { default as Undo2 }           from "lucide-react/dist/esm/icons/undo-2.mjs";
export { default as RotateCw }        from "lucide-react/dist/esm/icons/rotate-cw.mjs";
export { default as ImagePlus }       from "lucide-react/dist/esm/icons/image-plus.mjs";
export { default as NotebookPen }     from "lucide-react/dist/esm/icons/notebook-pen.mjs";
export { default as Settings }        from "lucide-react/dist/esm/icons/settings.mjs";
export { default as List }            from "lucide-react/dist/esm/icons/list.mjs";
export { default as ListChecks }      from "lucide-react/dist/esm/icons/list-checks.mjs";
export { default as Inbox }           from "lucide-react/dist/esm/icons/inbox.mjs";
export { default as Send }            from "lucide-react/dist/esm/icons/send.mjs";
export { default as Repeat }          from "lucide-react/dist/esm/icons/repeat.mjs";
export { default as FileText }        from "lucide-react/dist/esm/icons/file-text.mjs";

// ---- view preference ----
export { default as Moon }            from "lucide-react/dist/esm/icons/moon.mjs";
export { default as Sun }             from "lucide-react/dist/esm/icons/sun.mjs";
export { default as ALargeSmall }     from "lucide-react/dist/esm/icons/a-large-small.mjs";

// ---- aliases for lucide's older names ----
//
// Kept so a rename in the icon library isn't a rename across forty files. New
// code should use the current name above.
export { default as AlertCircle }   from "lucide-react/dist/esm/icons/circle-alert.mjs";
export { default as AlertTriangle } from "lucide-react/dist/esm/icons/triangle-alert.mjs";
export { default as CheckCircle2 }  from "lucide-react/dist/esm/icons/circle-check.mjs";
export { default as CircleSlash }   from "lucide-react/dist/esm/icons/circle-x.mjs";
export { default as MinusCircle }   from "lucide-react/dist/esm/icons/circle-minus.mjs";
export { default as Edit2 }         from "lucide-react/dist/esm/icons/pencil.mjs";
export { default as Loader2 }       from "lucide-react/dist/esm/icons/loader-circle.mjs";
export { default as Activity }      from "lucide-react/dist/esm/icons/activity.mjs";
