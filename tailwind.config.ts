import type { Config } from "tailwindcss";

// Tokens de la marca apalabra. Cada color tiene un solo trabajo:
// tinta = dinero y texto, rosa = marca (nunca estado), mandarina = acción
// principal, patio = logro; entra/sale/aten = estados (semáforo).
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#FFF4F9",
        surface: "#FFFFFF",
        border: "#EFDFE7",
        "text-primary": "#1C0B14",
        "text-secondary": "#7A5F6E",
        accent: "#D9007A",
        gold: "#FFC83D",
        rosa: "#D9007A",
        rubor: "#FFE3F0",
        tinta: "#1C0B14",
        mandarina: "#FF7A1A",
        patio: "#FFC83D",
        "patio-soft": "#FFF8E6",
        entra: "#0E8A5F",
        "entra-soft": "#DDF3EA",
        sale: "#B3261E",
        "sale-soft": "#FBE4E1",
        aten: "#9A4A00",
        "aten-soft": "#FFF0DD",
      },
      borderRadius: {
        card: "20px",
      },
      fontFamily: {
        display: ["var(--font-figtree)", "ui-sans-serif", "system-ui", "sans-serif"],
        brand: ["var(--font-gabarito)", "var(--font-figtree)", "ui-sans-serif", "sans-serif"],
        mono: ["var(--font-figtree)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      maxWidth: {
        app: "430px",
      },
    },
  },
  plugins: [],
};

export default config;
