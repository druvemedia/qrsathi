import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "hsl(var(--brand) / <alpha-value>)",
          fg: "hsl(var(--brand-fg) / <alpha-value>)",
          soft: "hsl(var(--brand) / 0.12)",
        },
        accent: "hsl(var(--accent) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "none" } },
        "scale-in": { "0%": { opacity: "0", transform: "scale(.96)" }, "100%": { opacity: "1", transform: "none" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
      },
      animation: {
        "fade-up": "fade-up .4s ease-out both",
        "scale-in": "scale-in .2s ease-out both",
        float: "float 5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
