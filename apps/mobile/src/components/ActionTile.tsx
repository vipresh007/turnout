import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { webTransition } from "@/lib/webStyle";
import { useTheme } from "@/lib/theme";
import { Icon, type IconName } from "./Icon";

// The organizer's tools as a grid of same-size tiles: a line icon and a one-word label.

export function ActionTile({ icon, label, onPress, disabled, loading }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => ({
        flexGrow: 1, flexBasis: "22%", minWidth: 72, height: 76, alignItems: "center", justifyContent: "center", gap: 6,
        borderRadius: 14, borderWidth: 1, borderColor: hovered && !disabled ? t.accent : t.border, backgroundColor: hovered && !disabled ? t.soft : t.bg,
        opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.96 : 1 }], ...webTransition,
      })}
    >
      {({ hovered }: { hovered?: boolean }) => (
        <>
          {loading ? <ActivityIndicator color={t.accent} /> : <Icon name={icon} size={22} color={hovered && !disabled ? t.accent : t.text} />}
          <Text numberOfLines={1} style={{ color: hovered && !disabled ? t.accent : t.text, fontSize: 12, fontWeight: "700" }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function ActionGrid({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View>;
}
