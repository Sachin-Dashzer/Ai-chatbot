/** @type {import('tailwindcss').Config} */
// Every value here points at a CSS custom property in app/globals.css, so the
// light and dark palettes are decided in one place and Tailwind only names them.
export default {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  darkMode: "media",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
      colors: {
        ground: "var(--ground)",
        surface: "var(--surface)",
        raised: "var(--raised)",
        active: "var(--active)",
        edge: "var(--border)",
        "chat-ground": "var(--chat-ground)",
        rule: "var(--rule)",
        control: "var(--control)",
        ink: "var(--text)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        primary: "var(--primary)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        positive: "var(--positive)",
        negative: "var(--negative)",
        warning: "var(--warning)",
      },
      borderRadius: {
        bubble: "var(--radius-bubble)",
        card: "var(--radius-card)",
        control: "var(--radius-control)",
        chip: "var(--radius-chip)",
      },
      fontSize: {
        title: ["22px", { lineHeight: "28px", letterSpacing: "-0.012em" }],
        kpi: ["28px", { lineHeight: "32px", letterSpacing: "-0.02em" }],
        section: ["16px", { lineHeight: "22px" }],
        body: ["14px", { lineHeight: "20px" }],
        meta: ["13px", { lineHeight: "18px" }],
        small: ["12px", { lineHeight: "16px" }],
      },
      spacing: {
        sidebar: "var(--sidebar)",
        topbar: "var(--topbar)",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
        drawer: "var(--ease-drawer)",
      },
    },
  },
  plugins: [],
};
