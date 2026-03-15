import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#0891B2", foreground: "#FFFFFF" },
        secondary: { DEFAULT: "#22D3EE", foreground: "#0F172A" },
        accent: { DEFAULT: "#16A34A", foreground: "#FFFFFF" },
        background: "#F0FDFA",
        foreground: "#134E4A",
        card: { DEFAULT: "#FFFFFF", foreground: "#134E4A" },
        muted: { DEFAULT: "#E8F1F6", foreground: "#64748B" },
        border: "#CCFBF1",
        destructive: { DEFAULT: "#DC2626", foreground: "#FFFFFF" },
        ring: "#0891B2",
      },
      fontFamily: {
        heading: ["var(--font-figtree)", "system-ui", "sans-serif"],
        body: ["var(--font-noto-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
