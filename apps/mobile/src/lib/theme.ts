import { useColorScheme } from "react-native";

const light = {
  bg: "#F7F7F5", card: "#FFFFFF", text: "#111418", muted: "#6B7280", border: "#E5E7EB",
  accent: "#16A34A", accentText: "#FFFFFF", danger: "#DC2626", waitlist: "#D97706", soft: "#EEF7F1",
};
const dark: typeof light = {
  bg: "#0E1113", card: "#171B1F", text: "#F3F4F6", muted: "#9CA3AF", border: "#262B31",
  accent: "#22C55E", accentText: "#06240F", danger: "#F87171", waitlist: "#FBBF24", soft: "#13251A",
};
export type Theme = typeof light;
export const useTheme = (): Theme => (useColorScheme() === "dark" ? dark : light);
