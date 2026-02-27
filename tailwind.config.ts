import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#F5F5F7",
        surface: "#FFFFFF",
        border: "#E2E2E8",
        "text-primary": "#0A0A0F",
        "text-secondary": "#7C7C8A",
        accent: "#1C1C1E",
      },
      borderRadius: {
        card: "14px",
      },
      fontFamily: {
        display: ["Syne", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
      maxWidth: {
        app: "430px",
      },
    },
  },
  plugins: [],
};

export default config;
