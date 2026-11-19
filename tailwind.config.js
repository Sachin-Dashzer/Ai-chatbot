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
        rule: "var(--rule)",
        control: "var(--control)",
        ink: "var(--text)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        primary: "var(--primary)",
        "primary-ink": "var(--primary-ink)",
        hue: "var(--hue)",
        "hue-soft": "var(--hue-soft)",
        positive: "var(--positive)",
        negative: "var(--negative)",
        warning: "var(--warning)",
        "chat-ground": "var(--chat-ground)",
      },
      borderRadius: {
        card: "var(--radius-card)",
        control: "var(--radius-control)",
        chip: "var(--radius-chip)",
      },
      // Six sizes. The study's cleanest scales are 12/14/18/24 and 12/14/16/24;
      // this adds one meta step and one figure step and stops there.
      fontSize: {
        kpi: ["30px", { lineHeight: "34px", letterSpacing: "-0.022em" }],
        title: ["24px", { lineHeight: "30px", letterSpacing: "-0.016em" }],
        section: ["16px", { lineHeight: "22px", letterSpacing: "-0.004em" }],
        body: ["14px", { lineHeight: "20px" }],
        meta: ["13px", { lineHeight: "18px" }],
        small: ["12px", { lineHeight: "16px" }],
      },
      spacing: {
        sidebar: "var(--sidebar)",
        topbar: "var(--topbar)",
        gutter: "var(--pad)",
        card: "var(--card-pad)",
        row: "var(--row-height)",
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
