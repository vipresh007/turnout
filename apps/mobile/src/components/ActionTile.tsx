import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View, type ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { webTransition } from "@/lib/webStyle";
import { useTheme } from "@/lib/theme";

// The organizer's tools as a grid of same-size tiles: a line icon and a one-word label.

type IconName = "edit" | "bell" | "teams" | "calendar" | "people" | "chart" | "clock" | "key" | "refresh" | "cash";

function Icon({ name, color }: { name: IconName; color: ColorValue }) {
  const p = { stroke: color, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  const paths: Record<IconName, ReactNode> = {
    edit: <Path {...p} d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
    bell: <Path {...p} d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />,
    teams: <><Path {...p} d="M4 7h11M4 7l3-3M4 7l3 3" /><Path {...p} d="M20 17H9m11 0-3-3m3 3-3 3" /></>,
    calendar: <><Rect {...p} x="3.5" y="5" width="17" height="15" rx="2.5" /><Path {...p} d="M3.5 10h17M8 3v4M16 3v4" /></>,
    people: <><Circle {...p} cx="9" cy="8" r="3.5" /><Path {...p} d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5" /><Circle {...p} cx="17" cy="9" r="2.5" /><Path {...p} d="M16.5 14.6c2.6.2 4.4 1.9 5 4.9" /></>,
    chart: <Path {...p} d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
    clock: <><Circle {...p} cx="12" cy="12" r="8.5" /><Path {...p} d="M12 7.5V12l3 2" /></>,
    key: <><Circle {...p} cx="8" cy="15" r="4" /><Path {...p} d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2" /></>,
    refresh: <Path {...p} d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5" />,
    cash: <><Rect {...p} x="2.5" y="6" width="19" height="12" rx="2.5" /><Circle {...p} cx="12" cy="12" r="2.5" /></>,
  };
  return <Svg width={22} height={22} viewBox="0 0 24 24">{paths[name]}</Svg>;
}

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
          {loading ? <ActivityIndicator color={t.accent} /> : <Icon name={icon} color={hovered && !disabled ? t.accent : t.text} />}
          <Text numberOfLines={1} style={{ color: hovered && !disabled ? t.accent : t.text, fontSize: 12, fontWeight: "700" }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function ActionGrid({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View>;
}
