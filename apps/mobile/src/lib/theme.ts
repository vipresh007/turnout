import { Platform, useColorScheme, type TextStyle } from "react-native";

// Colours. Borders are translucent so they sit on any surface (cards, soft panels, tracks) without looking drawn on.
// `energy` is the warm second colour: the waitlist, "need 2 more", streaks, anything that should feel like game night.
// `surface2` is a lifted level inside a card, so sections can nest without a border.
const light = {
  bg: "#F6F7F5", card: "#FFFFFF", surface2: "#F0F2EE", text: "#111418", muted: "#6B7280", border: "rgba(17,20,24,0.09)",
  accent: "#16A34A", accentText: "#FFFFFF", soft: "#EEF7F1", accentShadow: "rgba(22,163,74,0.35)",
  energy: "#EA580C", energyText: "#FFFFFF", energySoft: "#FFF1E8",
  danger: "#DC2626", waitlist: "#EA580C",
  chart: "#16A34A", // validated for chart marks on both surfaces (dataviz validator)
  glowA: "rgba(34,197,94,0.28)", glowB: "rgba(249,115,22,0.18)", glowC: "rgba(245,158,11,0.16)",
};
const dark: typeof light = {
  bg: "#0E1113", card: "#171B1F", surface2: "#1F2428", text: "#F3F4F6", muted: "#9CA3AF", border: "rgba(255,255,255,0.09)",
  accent: "#22C55E", accentText: "#06240F", soft: "#13251A", accentShadow: "rgba(34,197,94,0.30)",
  energy: "#FB923C", energyText: "#2A1203", energySoft: "#2A1A0F",
  danger: "#F87171", waitlist: "#FB923C",
  chart: "#16A34A",
  glowA: "rgba(34,197,94,0.22)", glowB: "rgba(251,146,60,0.16)", glowC: "rgba(245,158,11,0.10)",
};

/** 4px grid. `space[4]` is the standard gutter. */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

// Archivo for the big moments (names, headcounts, headlines); body text stays the phone's own font (Inter on the web).
// The font files ship with the JS bundle (expo-font + @expo-google-fonts), so this works over the air.
export const fonts = { display: "Archivo_800ExtraBold", displayHeavy: "Archivo_900Black" } as const;

const display = (size: number, lineHeight: number, heavy = false): TextStyle => ({
  fontFamily: heavy ? fonts.displayHeavy : fonts.display,
  fontSize: size,
  lineHeight,
  letterSpacing: -size * 0.03,
  // Archivo's ascenders sit high; nudge so it aligns with body text on the same line.
  ...(Platform.OS === "web" ? {} : { includeFontPadding: false }),
});

/** The type scale. Spread into a Text style: `style={[t.type.h2, { color: t.text }]}`. */
export const type = {
  display: display(40, 44, true),
  h1: display(28, 32),
  h2: { fontSize: 20, lineHeight: 26, fontWeight: "800", letterSpacing: -0.4 } as TextStyle,
  h3: { fontSize: 17, lineHeight: 22, fontWeight: "800", letterSpacing: -0.2 } as TextStyle,
  body: { fontSize: 16, lineHeight: 22 } as TextStyle,
  small: { fontSize: 14, lineHeight: 20 } as TextStyle,
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" } as TextStyle,
  stat: { ...display(56, 56, true), fontVariant: ["tabular-nums"] } as TextStyle,
  statSm: { ...display(28, 32), fontVariant: ["tabular-nums"] } as TextStyle,
};

export type Theme = typeof light & { space: typeof space; radius: typeof radius; type: typeof type; fonts: typeof fonts };

/** A see-through wash of a theme color, for status pills and icon bubbles. */
export const tint = (hex: string, alpha = 0.14) => `${hex}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;

/** A hue per kind of game, for headers and empty states; falls back to the brand green. */
export function sportTone(activity: string | null | undefined, t: Theme): string {
  const a = (activity ?? "").toLowerCase();
  if (/basket/.test(a)) return t.energy;
  if (/hockey|shinny|skat/.test(a)) return "#38BDF8";
  if (/volley|badminton|pickle|tennis|squash/.test(a)) return "#FACC15";
  if (/run|cycl|bike|hik/.test(a)) return "#F472B6";
  if (/poker|board|game night|trivia/.test(a)) return "#A78BFA";
  return t.accent;
}

const lightTheme: Theme = { ...light, space, radius, type, fonts };
const darkTheme: Theme = { ...dark, space, radius, type, fonts };
export const useTheme = (): Theme => (useColorScheme() === "dark" ? darkTheme : lightTheme);
