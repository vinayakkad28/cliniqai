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
        surface: {
          DEFAULT: "#ffffff",
          secondary: "#f8fafc",
          tertiary: "#f1f5f9",
        },
        clinical: {
          critical: "#dc2626",
          warning: "#ea580c",
          success: "#16a34a",
          info: "#2563eb",
        },
        vitals: {
          hr: "#ef4444",
          bp: "#8b5cf6",
          spo2: "#3b82f6",
          temp: "#f97316",
          rr: "#06b6d4",
          glucose: "#eab308",
        },
      },
      fontFamily: {
        heading: ["var(--font-figtree)", "system-ui", "sans-serif"],
        body: ["var(--font-noto-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.03)",
        glow: "0 0 20px -4px rgb(23 133 144 / 0.25)",
        "glow-sm": "0 0 10px -2px rgb(23 133 144 / 0.15)",
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #178590, #1fa5ab)",
        "gradient-ai": "linear-gradient(135deg, #6366f1, #1fa5ab)",
        "gradient-surface": "linear-gradient(180deg, #f8fafc, #ffffff)",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgb(31 165 171 / 0.4)" },
          "50%": { boxShadow: "0 0 0 8px rgb(31 165 171 / 0)" },
        },
        "slide-up": {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "slide-up": "slide-up 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
