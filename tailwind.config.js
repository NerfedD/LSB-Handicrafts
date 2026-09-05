import tailwindcssAnimate from 'tailwindcss-animate'

/**
 * A theme-aware colour: the channels live in a CSS variable so `html.dark` can
 * swap them, and `<alpha-value>` keeps Tailwind's `/40` opacity modifier
 * working. See the note on `colors` below for which tokens get this and why.
 */
const withAlpha = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

/** Same, for the border alphas — those are pre-mixed rgba, so no modifier. */
const raw = (name) => `var(--c-${name})`

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // The spacing grid.
    //
    // This REPLACES Tailwind's rem-based spacing scale rather than extending
    // it, and that is the whole point. src/index.css used to set a fluid root
    // (`clamp(14px, 1vw + 12px, 18px)`) which pinned one rem-based unit at
    // 4.5px on every desktop; pinning the scale to px decoupled spacing from
    // that clamp. The clamp is gone now — the overhaul fixes type in px — but
    // px-pinned spacing stays, because every value in the design handoff is a
    // px measurement and translating them through rem is pure friction.
    //
    // HALF-STEPS ARE BACK, on purpose. They were removed when the app was on a
    // strict 4px grid. The overhaul's density grid is 2px-based (18px card
    // padding, 22px table gutters, 15px row padding, 14px gaps, a 46px row
    // action), so omitting them would mean writing a third of the layout as
    // arbitrary bracket values — worse than naming them.
    spacing: {
      0: '0px',     px: '1px',
      0.5: '2px',   1: '4px',     1.5: '6px',   2: '8px',
      2.5: '10px',  3: '12px',    3.5: '14px',  4: '16px',
      4.5: '18px',  5: '20px',    5.5: '22px',  6: '24px',
      6.5: '26px',  7: '28px',    7.5: '30px',  8: '32px',
      9: '36px',    9.5: '38px',  10: '40px',   10.5: '42px',
      11: '44px',   11.5: '46px', 12: '48px',   12.5: '50px',
      13: '52px',   13.5: '54px', 14: '56px',   15: '60px',
      15.5: '62px', 16: '64px',   17: '68px',   18: '72px',
      19: '76px',   20: '80px',   21: '84px',   22: '88px',
      24: '96px',   26: '104px',  28: '112px',  30: '120px',
      32: '128px',  36: '144px',  40: '160px',  42: '170px',
      44: '176px',  48: '192px',  52: '208px',  56: '224px',
      60: '240px',  64: '256px',  65: '260px',  72: '288px',
      75: '300px',  80: '320px',  95: '380px',  96: '384px',
    },
    // The handoff's three layouts, named after what they are rather than after
    // a size: `tab` is where the sidebar becomes an 84px icon rail, `desk` is
    // where the full 260px sidebar returns. Below `tab` the nav is a bottom tab
    // bar, tables become cards and the primary action becomes a sticky bar.
    //
    // Tailwind's own sm/md/lg/xl are kept for ordinary content reflow; these
    // two are specifically the chrome breakpoints, and giving them names stops
    // `xl:` meaning "the sidebar comes back" in some files and "three columns
    // instead of two" in others.
    screens: {
      sm: '640px',
      md: '768px',
      tab: '834px',
      lg: '1024px',
      desk: '1280px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      // ONE palette, replacing the two the app used to carry.
      //
      // This file used to define two primaries — #1b3a6b for the
      // user-management screens and #2196f3 for the dashboards — with a
      // comment saying that unifying them was a design decision nobody had
      // made. The UI overhaul in design_handoff_lsb_ui_overhaul IS that
      // decision: navy is chrome, cobalt is action, clay is the third accent
      // that stops the palette reading as generic dashboard blue.
      //
      // Every value here comes from the handoff's token table. A tint is the
      // surface behind a status or an icon; each pairs with the tone of the
      // same name, plus a `-text` value wherever text on the tint has to go
      // darker than the tone itself to hold contrast.
      // WHICH TOKENS FLIP WITH THE THEME, AND WHY THAT IS THE WHOLE FIX.
      //
      // Dark mode used to be hand-written per screen: a `dark:` class beside
      // each light one. Four screens got it and twenty-five did not, and the
      // failure was not "those screens stay light" — the shared primitives
      // (Card, Table, Input, Dialog) DID flip, so a migrated card painted its
      // dark surface underneath page markup still asking for `text-ink`. That
      // is near-black on near-black. `shared/forms.jsx` alone backs every form
      // in the app and had four unpaired `text-ink`.
      //
      // So the neutral roles resolve through CSS variables instead (values in
      // src/index.css, swapped under `html.dark`). `text-ink` means "primary
      // text", not "#111d2b", and every screen inherits dark mode whether or
      // not anybody remembered to write a `dark:` beside it. The ~315 neutral
      // usages stop being 315 chances to forget.
      //
      // THE LINE IS DUAL USE. A token flips only if it means one role in both
      // themes. `ink` is always "text on the canvas" and `paper-2` is always
      // "the recessed band", so both flip. `cobalt`, `green`, `red` and `clay`
      // are foreground AND fill — `bg-cobalt text-white` has to stay a
      // saturated button — so the base hues hold still and their
      // foreground-only relatives (`cobalt-deep`, `red-text`, `amber-text`)
      // flip in their place. Where a base hue is genuinely needed as text on a
      // dark surface, tones.js pairs it with a `dk-` value explicitly.
      //
      // rgb(var(--x) / <alpha-value>) rather than a bare var() so the opacity
      // modifier survives — `bg-tint-cobalt/40` is real usage.
      colors: {
        navy:          "#0e2f5c", // sidebar, section fills, primary avatars
        cobalt:        "#1462c8", // primary buttons, links, active nav, focus
        clay:          "#b4531f", // craft / production accent
        green:         "#0f6b46",
        amber:         "#c07800",
        red:           "#a8332f",
        purple:        "#6b3fa0",

        // Foreground-only relatives of the hues above. These flip.
        "cobalt-deep": withAlpha("cobalt-deep"), // link hover, text on a cobalt tint
        "clay-deep":   withAlpha("clay-deep"),   // text on a clay tint
        "amber-icon":  withAlpha("amber-icon"),
        "amber-text":  withAlpha("amber-text"),
        "red-text":    withAlpha("red-text"),

        // Surfaces and text. All flip.
        paper:      withAlpha("paper"),    // app canvas
        "paper-2":  withAlpha("paper-2"),  // table headers, card footers, form bands
        surface:    withAlpha("surface"),  // the card / dialog / field fill
        ink:        withAlpha("ink"),      // primary text, selected chip fill
        "ink-2":    withAlpha("ink-2"),    // body text inside tinted callouts
        muted:      withAlpha("muted"),    // secondary text, icon default
        "muted-2":  withAlpha("muted-2"),  // placeholder, disabled

        // Overlays: a wash of ink over whatever is underneath, which is how
        // every hover state and every hairline FILL in the app was written —
        // `hover:bg-[#111d2b08]`, `bg-[#111d2b14]`, `bg-[#111d2b0f]`, about
        // twenty times, each one a hex that had to be paired with a
        // `dark:bg-white/[...]` by hand and mostly wasn't. Named, they flip.
        wash:   raw("wash"),   // control hover  (was #111d2b08)
        "wash-2": raw("wash-2"), // row hover     (was #111d2b05)
        rule:   raw("rule"),   // separator fills, progress tracks, skeletons

        tint: {
          cobalt:  withAlpha("tint-cobalt"),
          clay:    withAlpha("tint-clay"),
          green:   withAlpha("tint-green"),
          amber:   withAlpha("tint-amber"),
          red:     withAlpha("tint-red"),
          purple:  withAlpha("tint-purple"),
          neutral: withAlpha("tint-neutral"),
        },

        // The sidebar's attention-count badge. Lighter than `clay`, which goes
        // muddy on navy.
        "nav-badge":     "#e0873f",
        "nav-badge-ink": "#2b1405",

        // Dark mode. Warm-neutral darks, never pure black.
        dk: {
          canvas:       "#12161c",
          surface:      "#1a2029",
          header:       "#20272f",
          chip:         "#252c35",
          text:         "#eef1f5",
          "text-2":     "#c9d1da",
          "text-3":     "#a3adba",
          cobalt:       "#3b8ae5",
          "on-cobalt":  "#08131f",
          green:        "#4dbb8c",
          amber:        "#e0a04a",
          "amber-tint": "#2a2113",
          "amber-text": "#f0be74",
          red:          "#e0705f",
          "red-tint":   "#2b1717",
          "red-text":   "#f09b8e",
          // The three hues that had no dark counterpart at all, which is why a
          // clay supplier chip and a purple activity chip went muddy on the
          // dark chip surface. tones.js pairs them now.
          clay:         "#e08a52",
          purple:       "#a98ad6",
          navy:         "#7fa9e0",
        },

        border: "hsl(var(--border))",
        input:  "hsl(var(--input))",
        ring:   "hsl(var(--ring))",
      },

      // Borders are alpha on ink, so one value reads correctly on paper, on
      // white and on a tint. Named because the raw hexes appeared ~175 times.
      //
      // These flip too, and they have to: an ink-alpha hairline is invisible on
      // a dark surface, which is what turned every migrated card into an
      // edgeless block. In dark they become white-alpha at the matching weight.
      // Pre-mixed rather than `<alpha-value>` because the alpha IS the token —
      // nothing writes `border-hair/50`.
      borderColor: {
        hair:   raw("hair"),   // row dividers, internal section rules
        hair2:  raw("hair2"),
        card:   raw("card"),   // the default card border
        chip:   raw("chip"),   // secondary button / chip, at 1.5px
        chip2:  raw("chip2"),
        field:  raw("field"),  // input, at 1.5px
        // NOT called `dashed`: that would generate a `border-dashed` class
        // colliding with Tailwind's own border-STYLE utility of the same name,
        // and the loser of that collision is decided by rule order.
        sketch: raw("sketch"), // image placeholder outline
      },

      fontFamily: {
        // Manrope is loaded in index.html. The fallback stack matters: the
        // handoff's sizes are tuned to Manrope's metrics, and a fallback with a
        // much larger x-height reflows the 62px table rows.
        sans: ['Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },

      borderRadius: {
        // The handoff's ladder: buttons, inputs/nav/chips, inner tiles, cards,
        // modals, large feature cards.
        btn:     "10px",
        field:   "11px",
        tile:    "12px",
        tile2:   "13px",
        card:    "14px",
        modal:   "16px",
        modal2:  "18px",
        feature: "20px",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      boxShadow: {
        card:        "0 1px 2px rgba(17,29,43,.05)",
        // The "needs your attention" card, and anything else deliberately
        // lifted off the canvas.
        lift:        "0 1px 2px rgba(17,29,43,.05), 0 12px 32px -22px rgba(17,29,43,.4)",
        cobalt:      "0 2px 8px rgba(20,98,200,.28)",
        "cobalt-lg": "0 3px 12px rgba(20,98,200,.32)",
        nav:         "0 2px 8px rgba(0,0,0,.22)",
        modal:       "0 20px 50px -18px rgba(17,29,43,.55)",
        toast:       "0 12px 32px -14px rgba(17,29,43,.6)",
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
