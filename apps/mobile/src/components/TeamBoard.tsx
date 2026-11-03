import { teamNames } from "@turnout/shared";
import { Pressable, Text, View } from "react-native";
import { tint, useTheme } from "@/lib/theme";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

/** Team colours, in the same order as the markers in the shared chat post (🟢 🔵 🟠 🟣). */
export const TEAM_COLORS = ["#22C55E", "#60A5FA", "#FB923C", "#A78BFA"];

export interface BoardPlayer {
  key: string;
  name: string;
}

/**
 * Teams as a matchup: one column per team with its colour, a count and a name per row. Two teams sit side by side
 * with "vs" between them; three or four wrap two to a row. `onPress` makes names tappable (the team maker moves them).
 */
export function TeamBoard({ teams, totals, onPress, size = "md" }: {
  teams: BoardPlayer[][];
  /** Strength per team, shown to the organizer in the team maker. */
  totals?: number[];
  onPress?: (team: number, key: string) => void;
  size?: "sm" | "md";
}) {
  const t = useTheme();
  const pair = teams.length === 2;
  const avatar = size === "sm" ? 20 : 24;
  const column = (players: BoardPlayer[], i: number) => {
    const color = TEAM_COLORS[i] ?? t.muted;
    return (
      <View key={i} style={{ flex: pair ? 1 : undefined, flexGrow: 1, flexBasis: pair ? 0 : "45%", minWidth: 0, backgroundColor: tint(color, 0.07), borderRadius: 14, borderWidth: 1, borderColor: tint(color, 0.22), overflow: "hidden" }}>
        <View style={{ height: 3, backgroundColor: color }} />
        <View style={{ padding: size === "sm" ? 10 : 12, gap: size === "sm" ? 6 : 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
            <Text style={{ color: t.text, fontWeight: "700", fontSize: 15, flexShrink: 1 }} numberOfLines={1}>{teamNames[i]}</Text>
            <Text style={{ color: t.muted, fontSize: 13, fontVariant: ["tabular-nums"] }}>{players.length}</Text>
            {totals && <Text style={{ color: t.muted, fontSize: 12, marginLeft: "auto" }}>str {totals[i]}</Text>}
          </View>
          {players.map((p) => {
            const row = (
              <>
                <Avatar name={p.name} size={avatar} />
                <Text style={{ color: t.text, fontSize: size === "sm" ? 14 : 15, flex: 1 }} numberOfLines={1}>{p.name}</Text>
                {onPress && <Icon name="arrowRight" size={13} color={t.muted} />}
              </>
            );
            return onPress ? (
              <Pressable
                key={p.key}
                accessibilityRole="button"
                accessibilityLabel={`Move ${p.name} to ${teamNames[(i + 1) % teams.length]}`}
                onPress={() => onPress(i, p.key)}
                hitSlop={3}
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({ flexDirection: "row", alignItems: "center", gap: 8, opacity: pressed ? 0.6 : 1, backgroundColor: hovered ? t.surface2 : "transparent", borderRadius: 8 })}
              >
                {row}
              </Pressable>
            ) : (
              <View key={p.key} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>{row}</View>
            );
          })}
          {players.length === 0 && <Text style={{ color: t.muted, fontSize: 13 }}>Nobody yet</Text>}
        </View>
      </View>
    );
  };
  if (!pair) return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{teams.map(column)}</View>;
  return (
    <View style={{ flexDirection: "row", alignItems: "stretch", gap: 6 }}>
      {column(teams[0]!, 0)}
      <View style={{ justifyContent: "center" }}>
        <Text style={{ color: t.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}>vs</Text>
      </View>
      {column(teams[1]!, 1)}
    </View>
  );
}
