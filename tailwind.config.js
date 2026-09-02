import tailwindcssAnimate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // <--- THIS IS THE CRITICAL LINE
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
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
