import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#F8F3ED",
        surface: "#FFFFFF",
        border: "#ECE3D8",
        "text-primary": "#1A1410",
        "text-secondary": "#6B5D50",
        accent: "#7B4F2E",
        gold: "#C8963C",
      },
      borderRadius: {
        card: "18px",
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
