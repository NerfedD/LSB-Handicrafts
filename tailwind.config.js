import tailwindcssAnimate from 'tailwindcss-animate'

/**
 * The admin dashboard design system (design/admin-dashboard).
 *
 * Every colour is a token from theme.css, defined for light and dark in
 * src/index.css, so a class names a role ("muted-fg", "border-subtle") and the
 * theme decides the value. Components never carry a raw hex.
 *
 * Spacing, radius and breakpoints are Tailwind's defaults: the boards are drawn
 * on the same 4px grid (h-8 controls, h-9 rows, h-12 top bar, p-4 cards, gap-4
 * between sections) with 6px control and 8px card radii (rounded-md and
 * rounded-lg). Type is Inter at 14px with 13px tables and 12px captions.
 */
const token = (name) => `var(--${name})`

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: token('background'),
        card: token('card'),
        popover: token('card'),
        'surface-2': token('surface-2'),
        sidebar: token('surface-2'),
        muted: token('muted'),
        accent: token('muted'),
        'muted-strong': token('muted-strong'),
        border: token('border'),
        input: token('border'),
        'border-subtle': token('border-subtle'),
        'row-divider': token('row-divider'),
        'input-strong': token('input-strong'),
        column: token('column'),
        inverse: token('inverse'),
        'inverse-fg': token('inverse-fg'),
        'inverse-strong': token('inverse-strong'),
        'strong-bg': token('strong-bg'),

        foreground: token('foreground'),
        ink: token('ink'),
        'fg-2': token('fg-2'),
        'fg-3': token('fg-3'),
        'muted-fg': token('muted-fg'),
        'muted-2': token('muted-2'),

        primary: token('primary'),
        'on-primary': token('on-primary'),
        'primary-text': token('primary-text'),
        'primary-hover': token('primary-hover'),
        'primary-press': token('primary-press'),
        ring: token('primary'),

        success: token('success'),
        'success-bg': token('success-bg'),
        'success-fg': token('success-fg'),
        'success-bd': token('success-bd'),
        warning: token('warning'),
        'warning-bg': token('warning-bg'),
        'warning-fg': token('warning-fg'),
        'warning-bd': token('warning-bd'),
        danger: token('danger'),
        'danger-bg': token('danger-bg'),
        'danger-fg': token('danger-fg'),
        'danger-bd': token('danger-bd'),
        'danger-bd-strong': token('danger-bd-strong'),
        destructive: token('danger'),

        'row-hover': token('row-hover'),
        thumb: token('thumb'),
        overlay: token('overlay'),
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', '16px'],
        xs: ['12px', '16px'],
        13: ['13px', '18px'],
        sm: ['14px', '20px'],
        xl: ['20px', '28px'],
        '2xl': ['24px', '32px'],
      },
      boxShadow: {
        xs: '0 1px 2px rgba(0, 0, 0, 0.05)',
        menu: '0 4px 12px rgba(0, 0, 0, 0.08)',
        dialog: '0 4px 16px rgba(0, 0, 0, 0.08)',
        seg: '0 1px 2px rgba(0, 0, 0, 0.06)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      width: { sidebar: '15rem', 'sidebar-icon': '3rem' },
    },
  },
  plugins: [tailwindcssAnimate],
}
