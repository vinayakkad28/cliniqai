/**
 * CliniqAI Mobile Theme
 * React Native compatible theme object.
 * Import this in every mobile screen instead of hardcoding colors.
 */

export const colors = {
  // ── Primary: Medical Teal ──
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
  },

  // ── Secondary: Warm Indigo (AI features) ──
  secondary: {
    50: "#eef2ff",
    100: "#e0e7ff",
    200: "#c7d2fe",
    400: "#818cf8",
    500: "#6366f1",
    600: "#4f46e5",
    700: "#4338ca",
  },

  // ── Accent: Warm Amber ──
  accent: {
    50: "#fffbeb",
    100: "#fef3c7",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
  },

  // ── Neutrals ──
  white: "#ffffff",
  bg: "#f8fafc",
  surface: "#ffffff",
  border: "#e2e8f0",
  borderLight: "#f1f5f9",
  text: {
    primary: "#0f172a",
    secondary: "#475569",
    tertiary: "#64748b",
    disabled: "#94a3b8",
    inverse: "#ffffff",
    placeholder: "#94a3b8",
  },

  // ── Clinical Semantics ──
  critical: { bg: "#fef2f2", text: "#b91c1c", icon: "#ef4444", border: "#fecaca" },
  warning: { bg: "#fff7ed", text: "#c2410c", icon: "#f97316", border: "#fed7aa" },
  success: { bg: "#f0fdf4", text: "#15803d", icon: "#22c55e", border: "#bbf7d0" },
  info: { bg: "#eff6ff", text: "#1d4ed8", icon: "#3b82f6", border: "#bfdbfe" },

  // ── Vitals ──
  vitals: {
    heartRate: "#ef4444",
    bloodPressure: "#8b5cf6",
    spO2: "#3b82f6",
    temperature: "#f97316",
    respiration: "#06b6d4",
    glucose: "#eab308",
  },

  // ── Appointment Status ──
  status: {
    scheduled: "#94a3b8",
    confirmed: "#3b82f6",
    checkedIn: "#1fa5ab",
    inProgress: "#6366f1",
    completed: "#16a34a",
    noShow: "#ef4444",
    cancelled: "#64748b",
    waiting: "#f59e0b",
    called: "#22c55e",
  },

  // ── Pharmacy ──
  pharmacy: {
    inStock: "#16a34a",
    lowStock: "#f97316",
    outOfStock: "#dc2626",
    expiringSoon: "#ea580c",
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 20,
  full: 9999,
} as const;

export const font = {
  size: {
    "2xs": 10,
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    "2xl": 24,
    "3xl": 30,
    "4xl": 36,
  },
  weight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    extrabold: "800" as const,
  },
} as const;

export const shadow = {
  sm: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  md: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  lg: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
} as const;

const mobileTheme = { colors, spacing, radius, font, shadow } as const;
export default mobileTheme;
