import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/lib/theme";

/**
 * The organizer's 1–5 rating for one player, used to balance teams. Saved on the player, so it carries over every week.
 * `value` null means not rated yet (teams count them as the middle).
 */
export function SkillDots({ name, value, onChange }: { name: string; value: number | null; onChange: (skill: number) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = value !== null && n <= value;
        return (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${name} ${n} of 5`}
            accessibilityState={{ selected: value === n }}
            onPress={() => onChange(n)}
            hitSlop={4}
            style={({ hovered }: { hovered?: boolean }) => ({
              width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center",
              backgroundColor: on ? t.accent : hovered ? t.soft : t.bg, borderWidth: 1, borderColor: on || hovered ? t.accent : t.border,
            })}
          >
            <Text style={{ color: on ? t.accentText : t.muted, fontSize: 11, fontWeight: "800" }}>{n}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
