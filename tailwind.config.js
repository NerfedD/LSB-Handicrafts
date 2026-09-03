import tailwindcssAnimate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // <--- THIS IS THE CRITICAL LINE
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // The 4px grid.
    //
    // This REPLACES Tailwind's rem-based spacing scale rather than extending
    // it, and that is the whole point. src/index.css sets a fluid root
    // (`clamp(14px, 1vw + 12px, 18px)`) which hits its 18px ceiling at a 600px
    // viewport — so on every desktop and tablet the root is pinned at 18px and
    // one rem-based unit is 4.5px, not 4px. `p-4` rendered 18px. Pinning the
    // scale to px decouples spacing from that clamp, so `p-4` is exactly 16px
    // everywhere and the grid is real.
    //
    // Type is deliberately NOT pinned: font sizes across the app are already
    // written as fixed px, so they were never subject to the clamp anyway, and
    // the clamp still does its job on narrow phones.
    //
    // There are NO half-steps (0.5, 1.5, 2.5, 3.5) on purpose. Omitting them
    // means an old `gap-3.5` stops compiling and disappears visibly, instead of
    // silently sitting 2px off the grid forever.
    //
    // `13` (52px) is not in stock Tailwind. It is here because `h-13` was
    // already being used in AssignStaffRolePage, where it silently applied no
    // height at all — this makes that markup mean what it says.
    spacing: {
      0: '0px',   px: '1px',
      1: '4px',   2: '8px',   3: '12px',  4: '16px',  5: '20px',
      6: '24px',  7: '28px',  8: '32px',  9: '36px',  10: '40px',
      11: '44px', 12: '48px', 13: '52px', 14: '56px', 16: '64px',
      18: '72px', 20: '80px', 24: '96px', 28: '112px', 32: '128px',
      36: '144px', 40: '160px', 44: '176px', 48: '192px', 52: '208px',
      56: '224px', 60: '240px', 64: '256px', 72: '288px', 80: '320px',
      96: '384px',
    },
    extend: {
      // Named tokens for the palette this app already uses. Every value here is
      // a colour that was previously written as a hardcoded arbitrary class
      // (`bg-[#17263a]`, ~175 occurrences) somewhere in src/. Naming them does
      // not change any pixel; it gives the shadcn primitives something to
      // reference so they inherit the existing look instead of shadcn's
      // default slate/zinc theme.
      //
      // The two primaries are deliberate, not an oversight: AppShell screens
      // (user management) are built on #1b3a6b, ManagementShell screens
      // (dashboards, profiles) on #1746d1. Unifying them is a design decision
      // nobody has made yet, so both are kept.
      colors: {
        ink:      "#17263a", // primary text / dark chrome
        muted:    "#5f6875", // secondary text
        navy:     "#1b3a6b", // AppShell primary action
        brand:    "#1746d1", // ManagementShell primary action
        danger:   "#b54747",
        success:  "#287a55",
        warning:  "#8a5600",
        canvas:   "#f2efe7", // ManagementShell page background
        parchment:"#f7f4ec", // AppShell page background
        surface:  "#fafaf8", // table footers, subtle strips
        border:   "hsl(var(--border))",
        input:    "hsl(var(--input))",
        ring:     "hsl(var(--ring))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
