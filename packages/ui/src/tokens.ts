/**
 * CliniqAI Design Tokens
 * ─────────────────────────────────────────────────────
 * Medical-grade design system for doctors, clinics & hospitals.
 *
 * Philosophy:
 *   - Teal/Cyan primary: clinical trust, sterile precision, medical instruments
 *   - Warm accents: approachable, humane — balances clinical coldness
 *   - High contrast: readability in bright clinic lighting
 *   - Semantic colors: critical/warning/success map to clinical severity
 */

// ── Primary: Medical Teal ──────────────────────────────
// Inspired by surgical scrubs, medical equipment, hospital branding.
// Teal conveys trust, cleanliness, and professionalism.
export const primary = {
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
} as const;

// ── Secondary: Warm Indigo ─────────────────────────────
// For AI features, insights, and premium actions.
export const secondary = {
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
} as const;

// ── Accent: Warm Amber ─────────────────────────────────
// For highlights, CTAs, and warm touches that humanize the UI.
export const accent = {
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
  950: "#451a03",
} as const;

// ── Neutral: Cool Gray ─────────────────────────────────
// Slightly cool-toned to complement the teal primary.
export const neutral = {
  0: "#ffffff",
  25: "#fcfcfd",
  50: "#f8fafc",
  100: "#f1f5f9",
  200: "#e2e8f0",
  300: "#cbd5e1",
  400: "#94a3b8",
  500: "#64748b",
  600: "#475569",
  700: "#334155",
  800: "#1e293b",
  900: "#0f172a",
  950: "#020617",
} as const;

// ── Clinical Semantic Colors ───────────────────────────
// Maps directly to medical severity classifications.

/** Critical / Emergency — immediate attention required */
export const critical = {
  50: "#fef2f2",
  100: "#fee2e2",
  200: "#fecaca",
  300: "#fca5a5",
  400: "#f87171",
  500: "#ef4444",
  600: "#dc2626",
  700: "#b91c1c",
  800: "#991b1b",
  900: "#7f1d1d",
} as const;

/** Warning / Abnormal — needs attention but not urgent */
export const warning = {
  50: "#fff7ed",
  100: "#ffedd5",
  200: "#fed7aa",
  300: "#fdba74",
  400: "#fb923c",
  500: "#f97316",
  600: "#ea580c",
  700: "#c2410c",
  800: "#9a3412",
  900: "#7c2d12",
} as const;

/** Success / Normal — within healthy range */
export const success = {
  50: "#f0fdf4",
  100: "#dcfce7",
  200: "#bbf7d0",
  300: "#86efac",
  400: "#4ade80",
  500: "#22c55e",
  600: "#16a34a",
  700: "#15803d",
  800: "#166534",
  900: "#14532d",
} as const;

/** Info / Educational — informational, non-urgent */
export const info = {
  50: "#eff6ff",
  100: "#dbeafe",
  200: "#bfdbfe",
  300: "#93c5fd",
  400: "#60a5fa",
  500: "#3b82f6",
  600: "#2563eb",
  700: "#1d4ed8",
  800: "#1e40af",
  900: "#1e3a8a",
} as const;

// ── Typography ─────────────────────────────────────────
export const fontFamily = {
  /** Primary: clean, medical, professional */
  sans: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  /** Monospace: for medical codes, lab values, vitals */
  mono: '"JetBrains Mono", "SF Mono", "Fira Code", "Cascadia Code", monospace',
} as const;

export const fontSize = {
  "2xs": ["0.625rem", { lineHeight: "0.875rem" }],  // 10px — badges, micro labels
  xs: ["0.75rem", { lineHeight: "1rem" }],           // 12px — captions
  sm: ["0.875rem", { lineHeight: "1.25rem" }],       // 14px — body small
  base: ["1rem", { lineHeight: "1.5rem" }],          // 16px — body
  lg: ["1.125rem", { lineHeight: "1.75rem" }],       // 18px — body large
  xl: ["1.25rem", { lineHeight: "1.75rem" }],        // 20px — h4
  "2xl": ["1.5rem", { lineHeight: "2rem" }],         // 24px — h3
  "3xl": ["1.875rem", { lineHeight: "2.25rem" }],    // 30px — h2
  "4xl": ["2.25rem", { lineHeight: "2.5rem" }],      // 36px — h1
  "5xl": ["3rem", { lineHeight: "1" }],              // 48px — display
} as const;

// ── Spacing & Sizing ───────────────────────────────────
export const borderRadius = {
  none: "0",
  sm: "0.25rem",    // 4px
  md: "0.5rem",     // 8px
  lg: "0.75rem",    // 12px
  xl: "1rem",       // 16px
  "2xl": "1.25rem", // 20px
  "3xl": "1.5rem",  // 24px
  full: "9999px",
} as const;

export const shadow = {
  xs: "0 1px 2px 0 rgb(0 0 0 / 0.03)",
  sm: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.04)",
  glow: "0 0 20px -4px rgb(23 133 144 / 0.25)", // primary glow for focused states
} as const;

// ── Medical-Specific Tokens ────────────────────────────

/** Colors for clinical data visualization */
export const vitals = {
  heartRate: "#ef4444",
  bloodPressure: "#8b5cf6",
  spO2: "#3b82f6",
  temperature: "#f97316",
  respiration: "#06b6d4",
  glucose: "#eab308",
} as const;

/** Colors for appointment/queue status */
export const appointmentStatus = {
  scheduled: neutral[400],
  confirmed: info[500],
  checkedIn: primary[500],
  inProgress: secondary[500],
  completed: success[600],
  noShow: critical[500],
  cancelled: neutral[500],
} as const;

/** Colors for prescription/pharmacy */
export const pharmacy = {
  inStock: success[600],
  lowStock: warning[500],
  outOfStock: critical[600],
  expiringSoon: warning[600],
  controlled: secondary[600],
} as const;

/** Severity levels for clinical alerts */
export const severity = {
  critical: { bg: critical[50], border: critical[200], text: critical[700], icon: critical[500] },
  high: { bg: warning[50], border: warning[200], text: warning[700], icon: warning[500] },
  medium: { bg: accent[50], border: accent[200], text: accent[700], icon: accent[500] },
  low: { bg: info[50], border: info[200], text: info[700], icon: info[500] },
  info: { bg: neutral[50], border: neutral[200], text: neutral[700], icon: neutral[500] },
} as const;

/** AI feature colors */
export const ai = {
  primary: secondary[600],
  bg: secondary[50],
  border: secondary[200],
  glow: "rgb(99 102 241 / 0.2)",
  gradient: { from: secondary[500], to: primary[500] },
} as const;

// ── Exported Theme Object ──────────────────────────────
export const theme = {
  colors: {
    primary,
    secondary,
    accent,
    neutral,
    critical,
    warning,
    success,
    info,
    vitals,
    appointmentStatus,
    pharmacy,
    severity,
    ai,
  },
  fontFamily,
  fontSize,
  borderRadius,
  shadow,
} as const;

export type Theme = typeof theme;
export default theme;
