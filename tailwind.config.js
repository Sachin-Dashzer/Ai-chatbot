/** @type {import('tailwindcss').Config} */
// Every value here points at a CSS custom property in app/globals.css, so the
// light and dark palettes are decided in one place and Tailwind only names them.
export default {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  darkMode: "media",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Archivo", "system-ui", "sans-serif"],
        // One job: the printed furniture of a form.
        narrow: ["var(--font-narrow)", "Archivo Narrow", "var(--font-sans)", "sans-serif"],
      },
      colors: {
        board: "var(--board)",
        ground: "var(--ground)",
        surface: "var(--surface)",
        raised: "var(--raised)",
        active: "var(--active)",
        edge: "var(--border)",
        "sheet-edge": "var(--sheet-edge)",
        rule: "var(--rule)",
        control: "var(--control)",
        ink: "var(--text)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        primary: "var(--primary)",
        "primary-ink": "var(--primary-ink)",
        furniture: "var(--furniture)",
        stamp: "var(--stamp)",
        carbon: "var(--carbon)",
        "carbon-rule": "var(--carbon-rule)",
        hue: "var(--hue)",
        "hue-soft": "var(--hue-soft)",
        positive: "var(--positive)",
        negative: "var(--negative)",
        warning: "var(--warning)",
        "chat-ground": "var(--chat-ground)",
      },
      borderRadius: {
        sheet: "var(--radius-sheet)",
        card: "var(--radius-card)",
        control: "var(--radius-control)",
        chip: "var(--radius-chip)",
      },
      // Six sizes. The study's cleanest scales are 12/14/18/24 and 12/14/16/24;
      // this adds one meta step and one figure step and stops there.
      fontSize: {
        // The one figure that answers the screen, and a size for its siblings.
        kpi: ["36px", { lineHeight: "38px", letterSpacing: "-0.026em" }],
        fig: ["20px", { lineHeight: "24px", letterSpacing: "-0.012em" }],
        title: ["24px", { lineHeight: "30px", letterSpacing: "-0.016em" }],
        section: ["16px", { lineHeight: "22px", letterSpacing: "-0.004em" }],
        body: ["14px", { lineHeight: "20px" }],
        meta: ["13px", { lineHeight: "18px" }],
        small: ["12px", { lineHeight: "16px" }],
      },
      spacing: {
        sheet: "var(--sheet-inset)",
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
