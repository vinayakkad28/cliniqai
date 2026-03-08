import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // ── Medical Teal Primary ──
      colors: {
        primary: {
          50: "#eefbfb",
          100: "#d4f4f4",
          200: "#ade9ea",
          300: "#74d7da",
          400: "#3bbfc4",
          500: "#1fa5ab",
          600: "#178590",
          700: "#176b76",
          800: "#195762",
          900: "#194953",
          950: "#092f37",
        },
        secondary: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        accent: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
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
        sans: [
          "Inter",
          "SF Pro Display",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "SF Mono",
          "Fira Code",
          "monospace",
        ],
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
