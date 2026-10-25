import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Neutral design-system greys: soft-neutral light surfaces, deep charcoal in dark mode.
        // Mapping `slate` here restyles every existing component consistently.
        slate: colors.zinc,
        brand: {
          DEFAULT: "hsl(var(--brand) / <alpha-value>)",
          fg: "hsl(var(--brand-fg) / <alpha-value>)",
          soft: "hsl(var(--brand) / 0.12)",
        },
        accent: "hsl(var(--accent) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        // Editorial headline face (marketing pages only).
        serif: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.03)",
        pop: "0 10px 30px -10px rgb(0 0 0 / 0.20), 0 4px 10px -4px rgb(0 0 0 / 0.08)",
      },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(4px)" }, "100%": { opacity: "1", transform: "none" } },
        "scale-in": { "0%": { opacity: "0", transform: "scale(.98)" }, "100%": { opacity: "1", transform: "none" } },
        "slide-in": { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "none" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        // Purposeful motion only: short, transform/opacity-based (disabled by prefers-reduced-motion in globals.css).
        "page-in": { "0%": { opacity: "0", transform: "translateY(6px)" }, "100%": { opacity: "1", transform: "none" } },
        "dropdown-in": { "0%": { opacity: "0", transform: "translateY(-4px) scale(.98)" }, "100%": { opacity: "1", transform: "none" } },
        "dialog-in": { "0%": { opacity: "0", transform: "translateY(8px) scale(.98)" }, "100%": { opacity: "1", transform: "none" } },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        progress: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(300%)" } },
      },
      animation: {
        "fade-up": "fade-up .25s ease-out both",
        "scale-in": "scale-in .15s ease-out both",
        "slide-in": "slide-in .2s ease-out both",
        float: "float 5s ease-in-out infinite",
        "page-in": "page-in .28s cubic-bezier(.2,.7,.2,1) both",
        "dropdown-in": "dropdown-in .14s cubic-bezier(.2,.8,.2,1) both",
        "dialog-in": "dialog-in .18s cubic-bezier(.2,.8,.2,1) both",
        "fade-in": "fade-in .18s ease-out both",
        shimmer: "shimmer 1.4s ease-in-out infinite",
        progress: "progress 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
