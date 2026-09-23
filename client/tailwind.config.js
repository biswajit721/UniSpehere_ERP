/** @type {import('tailwindcss').Config} */

// Every color is a CSS variable holding "R G B" so Tailwind's opacity modifiers keep working
// (bg-primary/10, border-danger/30 ...). The values live in src/index.css: one set for light and
// one for dark, so a class like `text-text-secondary` is automatically correct in BOTH themes -
// no more per-element `dark:` pairs that were easy to forget (53 places used text-text-primary
// without a dark pair and rendered dark-on-dark).
const rgb = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        // FILL colors: used for backgrounds/borders. White text on every one of them is >= 4.5:1.
        primary: { DEFAULT: rgb("primary"), dark: rgb("primary-strong"), light: rgb("primary-soft") },
        surface: {
          DEFAULT: rgb("bg"), // page background & inset panels
          card: rgb("card"), // cards, header, sidebar
          raised: rgb("raised"), // menus, popovers, modals
          // Legacy names kept so existing markup keeps working; they resolve to the same tokens.
          dark: rgb("bg"),
          "dark-card": rgb("card"),
        },
        text: {
          primary: rgb("ink"),
          secondary: rgb("ink-2"),
          muted: rgb("ink-3"),
          "dark-primary": rgb("ink"),
          "dark-secondary": rgb("ink-2"),
        },
        border: { DEFAULT: rgb("line"), strong: rgb("line-strong"), dark: rgb("line") },
        success: { DEFAULT: rgb("success"), soft: rgb("success-soft") },
        warning: { DEFAULT: rgb("warning"), soft: rgb("warning-soft") },
        danger: { DEFAULT: rgb("danger"), soft: rgb("danger-soft") },
        info: { DEFAULT: rgb("info"), soft: rgb("info-soft") },
        module: {
          dashboard: rgb("m-dashboard"), students: rgb("m-students"), faculty: rgb("m-faculty"),
          academics: rgb("m-academics"), attendance: rgb("m-attendance"), timetable: rgb("m-timetable"),
          examination: rgb("m-examination"), results: rgb("m-results"), assignments: rgb("m-assignments"),
          fees: rgb("m-fees"), library: rgb("m-library"), hostel: rgb("m-hostel"),
          placement: rgb("m-placement"), notices: rgb("m-notices"), notifications: rgb("m-notifications"),
          grievance: rgb("m-grievance"), administration: rgb("m-administration"), settings: rgb("m-settings"),
          analytics: rgb("m-analytics"), reports: rgb("m-reports"), idcard: rgb("m-idcard"),
        },
      },
      // TEXT colors differ from fills: on a dark surface the brand/status hues must be LIGHTER to be
      // readable, while a filled button must stay DARK enough for its white label.
      textColor: {
        primary: { DEFAULT: rgb("primary-fg"), dark: rgb("primary-strong"), light: rgb("primary-soft") },
        success: rgb("success-fg"),
        warning: rgb("warning-fg"),
        danger: rgb("danger-fg"),
        info: rgb("info-fg"),
      },
      borderRadius: {
        card: "14px",
      },
      boxShadow: {
        card: "0 1px 2px rgb(var(--shadow) / 0.06), 0 1px 1px rgb(var(--shadow) / 0.04)",
        pop: "0 12px 32px -8px rgb(var(--shadow) / 0.28), 0 4px 10px rgb(var(--shadow) / 0.10)",
      },
      spacing: {
        "safe-b": "env(safe-area-inset-bottom, 0px)",
        "safe-t": "env(safe-area-inset-top, 0px)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "pop-in": { from: { opacity: "0", transform: "translateY(6px) scale(0.98)" }, to: { opacity: "1", transform: "none" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(24px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "pop-in": "pop-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        "slide-up": "slide-up 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
    },
  },
  plugins: [],
};
