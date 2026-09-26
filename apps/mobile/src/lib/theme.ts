import { useColorScheme } from "react-native";

const light = {
  bg: "#F7F7F5", card: "#FFFFFF", text: "#111418", muted: "#6B7280", border: "#E5E7EB",
  accent: "#16A34A", accentText: "#FFFFFF", danger: "#DC2626", waitlist: "#D97706", soft: "#EEF7F1",
  accentShadow: "rgba(22,163,74,0.35)",
  glowA: "rgba(34,197,94,0.28)", glowB: "rgba(59,130,246,0.20)", glowC: "rgba(245,158,11,0.16)",
};
const dark: typeof light = {
  bg: "#0E1113", card: "#171B1F", text: "#F3F4F6", muted: "#9CA3AF", border: "#262B31",
  accent: "#22C55E", accentText: "#06240F", danger: "#F87171", waitlist: "#FBBF24", soft: "#13251A",
  accentShadow: "rgba(34,197,94,0.30)",
  glowA: "rgba(34,197,94,0.22)", glowB: "rgba(59,130,246,0.18)", glowC: "rgba(245,158,11,0.10)",
};
export type Theme = typeof light;
export const useTheme = (): Theme => (useColorScheme() === "dark" ? dark : light);
