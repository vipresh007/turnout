import type { PlayerGame, PlayerStats } from "@turnout/shared";
import { Text, View } from "react-native";
import { useTheme } from "@/lib/theme";

// A player's own numbers: big figures for played, attendance and streak, and a row of dots for recent games.

export const attendanceText = (s: PlayerStats) => (s.attendance === null ? "–" : `${Math.round(s.attendance * 100)}%`);

/** "Played 9 of 11 · 4 in a row", for cards with no room for the full strip. */
export function statsLine(s: PlayerStats): string | null {
  if (!s.games) return null;
  return [`Played ${s.played} of ${s.games}`, s.streak >= 2 ? `${s.streak} in a row` : null].filter(Boolean).join(" · ");
}

export function StatsStrip({ stats }: { stats: PlayerStats }) {
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Figure label="Played" value={String(stats.played)} hint={stats.games ? `of ${stats.games} games` : "no games yet"} />
      <Figure label="Shows up" value={attendanceText(stats)} hint="of games" />
      <Figure label="Streak" value={String(stats.streak)} hint={stats.bestStreak > stats.streak ? `best ${stats.bestStreak}` : "in a row"} accent={stats.streak >= 3} />
    </View>
  );
}

function Figure({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: accent ? t.soft : t.bg, borderRadius: 14, padding: 12, gap: 2 }}>
      <Text style={{ color: t.muted, fontSize: 11, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ color: accent ? t.accent : t.text, fontSize: 24, fontWeight: "900", letterSpacing: -0.8, fontVariant: ["tabular-nums"] }}>{value}</Text>
      <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>{hint}</Text>
    </View>
  );
}

/** Recent games, oldest on the left: filled green for played, amber for waitlist, hollow for out or no answer. */
export function GameDots({ games }: { games: PlayerGame[] }) {
  const t = useTheme();
  if (!games.length) return null;
  const color = (g: PlayerGame) => (g.status === "played" ? t.accent : g.status === "waitlist" ? t.waitlist : "transparent");
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }} accessibilityLabel={`Last ${games.length} games: ${games.filter((g) => g.status === "played").length} played`}>
        {[...games].reverse().map((g) => (
          <View
            key={g.startsAt}
            style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: color(g), borderWidth: g.status === "played" || g.status === "waitlist" ? 0 : 1.5, borderColor: g.lateDrop ? t.danger : t.border }}
          />
        ))}
      </View>
    </View>
  );
}
