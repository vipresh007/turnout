import { useColorScheme } from "react-native";

// Borders are translucent so they sit on any surface (cards, soft panels, tracks) without looking drawn on.
const light = {
  bg: "#F6F7F5", card: "#FFFFFF", text: "#111418", muted: "#6B7280", border: "rgba(17,20,24,0.09)",
  accent: "#16A34A", accentText: "#FFFFFF", danger: "#DC2626", waitlist: "#D97706", soft: "#EEF7F1",
  accentShadow: "rgba(22,163,74,0.35)",
  chart: "#16A34A", // validated for chart marks on both surfaces (dataviz validator)
  glowA: "rgba(34,197,94,0.28)", glowB: "rgba(59,130,246,0.20)", glowC: "rgba(245,158,11,0.16)",
};
const dark: typeof light = {
  bg: "#0E1113", card: "#171B1F", text: "#F3F4F6", muted: "#9CA3AF", border: "rgba(255,255,255,0.09)",
  accent: "#22C55E", accentText: "#06240F", danger: "#F87171", waitlist: "#FBBF24", soft: "#13251A",
  accentShadow: "rgba(34,197,94,0.30)",
  chart: "#16A34A",
  glowA: "rgba(34,197,94,0.22)", glowB: "rgba(59,130,246,0.18)", glowC: "rgba(245,158,11,0.10)",
};
export type Theme = typeof light;

/** A see-through wash of a theme color, for status pills and icon bubbles. */
export const tint = (hex: string, alpha = 0.14) => `${hex}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
export const useTheme = (): Theme => (useColorScheme() === "dark" ? dark : light);
