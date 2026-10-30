---
name: LSB Handicrafts — Management System
description: A calm, neutral-first admin dashboard for a styrofoam decor workshop. Zinc greys carry about 80% of the interface; one blue is spent on the primary action and focus.
colors:
  background: "#EDF2FB"
  card: "#ffffff"
  surface-2: "#fafafa"
  muted: "#f4f4f5"
  border: "#d4d4d8"
  border-subtle: "#e4e4e7"
  foreground: "#09090b"
  muted-fg: "#71717a"
  primary: "#004E89"
  primary-hover: "#003a66"
  success: "#15803d"
  warning: "#b45309"
  danger: "#b91c1c"
typography:
  fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
  body: { fontSize: "14px", lineHeight: "20px" }
  table: { fontSize: "13px", lineHeight: "18px" }
  caption: { fontSize: "12px", lineHeight: "16px" }
  micro: { fontSize: "11px", lineHeight: "16px" }
  title: { fontSize: "20px", lineHeight: "28px" }
  display: { fontSize: "24px", lineHeight: "32px" }
rounded:
  control: "6px"
  card: "8px"
spacing:
  grid: "4px"
---

# Design System: LSB Handicrafts — Management System

The source of truth is the set of boards in [`design/admin-dashboard/`](design/admin-dashboard/) (open the `*.dc.html` files; `Tokens.dc.html` and `Motion.dc.html` are the reference sheets). The app implements them in `tailwind.config.js` and `src/index.css`. This file records the rules those two files encode so a new screen does not have to rediscover them.

## Overview

A working tool for staff on a shop floor and at a desk: dense enough to scan a list of orders, quiet enough that status and the one primary action stand out. Light and dark are both first-class. The whole dark theme is the `html.dark` block in `src/index.css`; no screen writes `dark:` classes.

## Colors

Every colour is a CSS variable defined for light and dark in `src/index.css`, ported one for one from `design/admin-dashboard/theme.css`. `tailwind.config.js` maps each to a role name (`bg-card`, `text-muted-fg`, `border-border-subtle`). **Components never carry a raw hex.**

| Role | Light | Use |
| --- | --- | --- |
| `background` | `#EDF2FB` | The page behind cards and the kanban columns. |
| `card` / `surface-2` / `muted` | `#fff` / `#fafafa` / `#f4f4f5` | Cards and popovers; sidebar and table headers; quiet fills and hovered rows. |
| `border` / `border-subtle` | `#d4d4d8` / `#e4e4e7` | Controls and dividers; card edges and section rules. |
| `foreground`, `fg-2`, `fg-3`, `muted-fg`, `muted-2` | zinc 950 → 400 | Text, strongest to faintest. |
| `primary` | `#004E89` | Brand blue. See the rule below. |
| `success`, `warning`, `danger` | green 700, amber 700, red 700 | Each has `-bg`, `-fg`, `-bd` for its soft badge. |

**The One Blue Rule.** `primary` is spent only on the one primary button per view, the active nav item, the focus ring, text links, and selected checkboxes, radios and switches. Status colours appear only inside small soft badges, never as large fills.

**State is never told by colour alone.** A status has a label as well as a tone (`StatusPill`, `src/components/shared/tones.js`), and the words come from `src/utils/copy.js`.

## Typography

Inter Variable (`@fontsource-variable/inter`), 14px base. Figures use tabular numerals globally, because stock counts, prices and order ids are compared down a column.

| Class | Size / line | Use |
| --- | --- | --- |
| `text-2xs` | 11 / 16 | Sidebar group labels, tiny counters. |
| `text-xs` | 12 / 16 | Captions, field hints and errors. |
| `text-13` | 13 / 18 | Table cells, dense lists. |
| `text-sm` | 14 / 20 | Body, controls, labels. |
| `text-xl` | 20 / 28 | Page and dialog titles. |
| `text-2xl` | 24 / 32 | Dashboard figures. |

Nothing is set below 11px. Only signposts (sidebar group labels) are that small.

## Layout

Spacing is Tailwind's 4px scale. The boards use: **h-12** top bar, **h-8** controls, **h-9** table rows, **p-4** cards, **gap-4** between sections. The sidebar is `15rem` expanded and `3rem` as an icon rail; below `md` (768px) it becomes a sheet opened from the top bar. Page sections rise in once per visit (`.lsb-page`).

## Shapes and elevation

6px radius on controls (`rounded-md`), 8px on cards and dialogs (`rounded-lg`). Elevation is almost flat: `shadow-xs` on cards, `shadow-menu` on popovers, `shadow-dialog` on dialogs. Depth otherwise comes from borders and the `background` / `card` contrast.

## Motion

Three durations: `--dur-fast` 120ms (hover, press, colour), `--dur-base` 180ms (dialogs, menus), `--dur-slow` 320ms (page sections). Easing is `--ease-out`, with `--ease-spring` for the radio dot, switch thumb and theme icon. Motion is opacity and transform only, nothing loops, and `prefers-reduced-motion` cuts all of it.

## Components

`src/components/ui/` holds the primitives (shadcn-style, built on `@base-ui/react`); `src/components/shared/` holds the app's own parts. Prefer these over new markup:

- **Buttons**: one primary per view; secondary and ghost for the rest; a destructive button names the verb ("Remove product").
- **Status**: `StatusPill` for a state, `InlineBadge` for a plain label.
- **Forms and dialogs**: `Field` (label, control, hint/error) from `shared/forms.jsx`. Add product and New order are dialogs over their list screens (`/products/new` and `/orders/new` open the list with the dialog up); editing a product or order is a full page. Errors go through `reportFormError` / `guardForm` in `src/utils/formErrors.js`, which focus the first invalid field.
- **Confirm dialogs**: name the record, say what happens and what survives, and put the verb on the button.
- **Command menu**: `CommandMenu` jumps between screens and records from anywhere.

## Do's and Don'ts

**Do**
- Use role tokens (`text-muted-fg`, `bg-warning-bg`) so both themes work with no extra code.
- Keep one primary button per view and let neutrals carry the rest.
- Give every state a word and a tone together.
- Check a new screen in both themes and at phone width.

**Don't**
- Don't write hex values, `dark:` variants or font sizes outside the scale above.
- Don't colour large areas with a status colour.
- Don't add a second brand colour, a gradient, or looping motion.
- Don't print a stored database value on screen; map it through `src/utils/copy.js`.
