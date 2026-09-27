import { Text, View } from "react-native";

// Muted hues that read on both light and dark cards, with dark text for contrast.
const palette = ["#86EFAC", "#93C5FD", "#FCD34D", "#F9A8D4", "#C4B5FD", "#FDBA74", "#67E8F9"];

/** Initials in a colored circle; the color stays the same for a given name. */
export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: palette[hash % palette.length], alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#111418", fontWeight: "800", fontSize: size * 0.42 }}>{initials || "?"}</Text>
    </View>
  );
}
