import { Platform, type TextStyle } from "react-native";

// "Midnight": one dark skin for both colour schemes. Deep charcoal with a faint green glow, cards as translucent
// glass with a hairline, green for the one primary action and good news, orange for anything short or waiting.
const midnight = {
  bg: "#0F1216",
  card: "rgba(255,255,255,0.045)",
  cardSolid: "#171B21",
  surface2: "rgba(255,255,255,0.06)",
  text: "#F2F4F6",
  muted: "#8B93A1",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  accent: "#22C55E",
  accentDeep: "#16A34A",
  accentText: "#06240F",
  soft: "rgba(34,197,94,0.12)",
  accentShadow: "rgba(34,197,94,0.30)",
  energy: "#FB923C",
  energyText: "#2A1203",
  energySoft: "rgba(251,146,60,0.14)",
  ink: "#07210F",
  paper: "#F7FDF9",
  danger: "#F87171",
  waitlist: "#FB923C",
  chart: "#22C55E",
  glowA: "rgba(34,197,94,0.16)",
  glowB: "rgba(251,146,60,0.10)",
  glowC: "rgba(56,189,248,0.08)",
};

/** 4px grid. `space[4]` is the standard gutter. */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 } as const;
export const radius = { sm: 12, md: 16, lg: 22, pill: 999 } as const;

// One family (the phone's own; Inter on the web). Headlines are semibold with tight tracking, not shouty.
export const fonts = { display: undefined as string | undefined, displayHeavy: undefined as string | undefined } as const;

const display = (size: number, lineHeight: number, weight: TextStyle["fontWeight"] = "600"): TextStyle => ({
  fontSize: size,
  lineHeight,
  fontWeight: weight,
  letterSpacing: -size * 0.03,
  ...(Platform.OS === "web" ? {} : { includeFontPadding: false }),
});

/** The type scale. Spread into a Text style: `style={[t.type.h2, { color: t.text }]}`. */
export const type = {
  display: display(34, 38),
  h1: display(28, 32),
  h2: { fontSize: 20, lineHeight: 26, fontWeight: "600", letterSpacing: -0.4 } as TextStyle,
  h3: { fontSize: 16, lineHeight: 22, fontWeight: "600", letterSpacing: -0.2 } as TextStyle,
  body: { fontSize: 16, lineHeight: 22 } as TextStyle,
  small: { fontSize: 14, lineHeight: 20 } as TextStyle,
  caption: { fontSize: 11, lineHeight: 14, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase" } as TextStyle,
  stat: { ...display(56, 56, "700"), fontVariant: ["tabular-nums"] } as TextStyle,
  statSm: { ...display(26, 30, "700"), fontVariant: ["tabular-nums"] } as TextStyle,
};

/** Soft layered shadow for floating glass (cards, the manage bar). */
export const shadow = { card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 16px 40px rgba(0,0,0,0.35)", float: "0 20px 50px rgba(0,0,0,0.5)" } as const;

export type Theme = typeof midnight & { space: typeof space; radius: typeof radius; type: typeof type; fonts: typeof fonts; shadow: typeof shadow };

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

const theme: Theme = { ...midnight, space, radius, type, fonts, shadow };
export const useTheme = (): Theme => theme;
