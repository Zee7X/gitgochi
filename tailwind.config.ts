import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        lcd: {
          bg: "#9bbc0f",
          light: "#8bac0f",
          med: "#306230",
          dark: "#0f380f",
        },
        shell: {
          dark: "#33164a",
          purple: "#6c3483",
          light: "#8e44ad",
          accent: "#bb86fc",
        },
      },
      fontFamily: {
        pixel: ["var(--font-pixel)", '"Press Start 2P"', "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
