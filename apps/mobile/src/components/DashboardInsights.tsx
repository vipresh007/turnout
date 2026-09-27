import { occursOn, type DashboardGroup, type OrganizerStats } from "@turnout/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { formatTime } from "@/lib/format";
import { useTheme, type Theme } from "@/lib/theme";

const DAY = 86_400_000;
const localYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** The next 14 days with each day's games. This week's game shows its live headcount. */
export function CalendarStrip({ groups }: { groups: DashboardGroup[] }) {
  const t = useTheme();
  const s = styles(t);
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 14 }, (_, i) => new Date(today.getTime() + i * DAY));

  const cell = (day: Date) => {
    const games = groups
      .filter((g) => occursOn(localYmd(day), g.group))
      .sort((a, b) => a.group.startTime.localeCompare(b.group.startTime));
    const isToday = sameDay(day, today);
    return (
      <View key={day.toISOString()} style={[s.day, wide ? { flex: 1 } : { width: 120 }, isToday && { borderColor: t.accent }]}>
        <Text style={[s.dayName, isToday && { color: t.accent }]}>{isToday ? "Today" : day.toLocaleDateString(undefined, { weekday: "short" })}</Text>
        <Text style={[s.dayNum, games.length === 0 && { color: t.muted }]}>{day.getDate()}</Text>
        {games.map((g) => {
          const isCurrent = sameDay(new Date(g.session.startsAt), day);
          const cancelled = isCurrent && g.session.cancelled;
          return (
            <Pressable
              key={g.group.id}
              accessibilityRole="link"
              accessibilityLabel={`${g.group.name} at ${formatTime(g.group.startTime)}${isCurrent ? `, ${g.confirmed} in` : ""}${cancelled ? ", cancelled" : ""}`}
              onPress={() => router.push({ pathname: "/g/[slug]", params: { slug: g.group.slug } })}
              style={({ hovered }: { hovered?: boolean }) => [s.game, hovered && { borderColor: t.accent }, cancelled && { opacity: 0.55 }]}
            >
              <Text style={[s.gameName, cancelled && { textDecorationLine: "line-through" }]} numberOfLines={1}>
                {g.group.name}
              </Text>
              <Text style={s.gameMeta} numberOfLines={1}>
                {formatTime(g.group.startTime)}
                {isCurrent && !cancelled ? ` · ${g.confirmed}${g.group.cap ? `/${g.group.cap}` : ""}` : ""}
                {cancelled ? " · off" : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  if (wide) {
    return (
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>{days.slice(0, 7).map(cell)}</View>
        <View style={{ flexDirection: "row", gap: 8 }}>{days.slice(7).map(cell)}</View>
      </View>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {days.map(cell)}
    </ScrollView>
  );
}

/** Weekly turnout as bars: one series, so one color and no legend. Hover or tap a bar for its numbers. */
export function TurnoutChart({ stats }: { stats: OrganizerStats }) {
  const t = useTheme();
  const s = styles(t);
  const [active, setActive] = useState<number | null>(null);
  const weeks = stats.weeks;
  const max = Math.max(1, ...weeks.map((w) => Math.max(w.players, w.spots)));
  const last = weeks.length - 1;
  const shown = active ?? last;
  const w = weeks[shown]!;
  const label = (i: number) =>
    i === last ? "Next" : new Date(weeks[i]!.start).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const summary = weeks.map((wk, i) => `${label(i)}: ${wk.players} players`).join(", ");

  return (
    <View style={[s.card, { gap: 14 }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ gap: 2 }}>
          <Text style={s.cardTitle}>Players per week</Text>
          <Text style={s.muted}>Last 8 weeks and the week ahead</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: t.text, fontSize: 22, fontWeight: "900" }}>{w.players}</Text>
          <Text style={s.muted}>
            {label(shown)}
            {w.spots ? ` · ${Math.round((w.players / w.spots) * 100)}% full` : ""}
          </Text>
        </View>
      </View>

      <View accessible accessibilityLabel={`Players per week. ${summary}`} style={s.chart}>
        {weeks.map((wk, i) => {
          const h = (wk.players / max) * 100;
          const cap = wk.spots ? (wk.spots / max) * 100 : 0;
          const isActive = i === shown;
          return (
            <Pressable
              key={wk.start}
              onHoverIn={() => setActive(i)}
              onHoverOut={() => setActive(null)}
              onPress={() => setActive(i === active ? null : i)}
              style={s.barSlot}
              accessibilityLabel={`${label(i)}: ${wk.players} players${wk.spots ? ` of ${wk.spots} spots` : ""}`}
            >
              <View style={s.barArea}>
                {/* Spots offered: a faint outline behind the bar, so "how full" reads at a glance. */}
                {cap > 0 && <View style={[s.capMark, { height: `${cap}%` }]} />}
                <View
                  style={[
                    s.bar,
                    { height: `${Math.max(h, wk.players ? 3 : 0)}%`, backgroundColor: t.chart, opacity: isActive ? 1 : i === last ? 0.55 : 0.8 },
                  ]}
                />
              </View>
              <Text style={[s.axisLabel, isActive && { color: t.text, fontWeight: "700" }]} numberOfLines={1}>
                {label(i)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", gap: 24, flexWrap: "wrap" }}>
        <Metric label="Fill rate" value={stats.fillRate === null ? "–" : `${Math.round(stats.fillRate * 100)}%`} hint="of spots filled, past 8 weeks" />
        <Metric label="Responses" value={String(stats.responses)} hint="in and out taps" />
      </View>
    </View>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  const t = useTheme();
  const s = styles(t);
  return (
    <View style={{ gap: 2 }}>
      <Text style={s.label}>{label}</Text>
      <Text style={{ color: t.text, fontSize: 22, fontWeight: "900" }}>{value}</Text>
      <Text style={[s.muted, { fontSize: 12 }]}>{hint}</Text>
    </View>
  );
}

/** The members who showed up most over the last 8 weeks. */
export function Regulars({ stats }: { stats: OrganizerStats }) {
  const t = useTheme();
  const s = styles(t);
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <View style={[s.card, { gap: 10 }]}>
      <Text style={s.cardTitle}>Your regulars</Text>
      {stats.regulars.length === 0 ? (
        <Text style={s.muted}>Once people start tapping in, your most reliable players show up here.</Text>
      ) : (
        stats.regulars.map((r, i) => (
          <View key={`${r.name}-${r.groupName}`} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ width: 24, fontSize: 18, textAlign: "center", color: t.muted, fontWeight: "800" }}>{medals[i] ?? `${i + 1}`}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: "700", fontSize: 15 }}>{r.name}</Text>
              <Text style={[s.muted, { fontSize: 13 }]} numberOfLines={1}>
                {r.groupName}
              </Text>
            </View>
            <Text style={{ color: t.text, fontWeight: "800" }}>
              {r.games} <Text style={[s.muted, { fontWeight: "400" }]}>{r.games === 1 ? "game" : "games"}</Text>
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    card: { backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 18, padding: 18 },
    cardTitle: { color: t.text, fontSize: 17, fontWeight: "800" },
    label: { color: t.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
    muted: { color: t.muted, fontSize: 14, lineHeight: 20 },
    day: { backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 14, padding: 10, gap: 6, minHeight: 92 },
    dayName: { color: t.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
    dayNum: { color: t.text, fontSize: 20, fontWeight: "900" },
    game: { borderLeftWidth: 3, borderLeftColor: t.accent, borderWidth: 1, borderColor: t.border, backgroundColor: t.soft, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 8 },
    gameName: { color: t.text, fontSize: 12, fontWeight: "800" },
    gameMeta: { color: t.muted, fontSize: 11 },
    chart: { flexDirection: "row", height: 160, alignItems: "flex-end", gap: 2, borderBottomWidth: 1, borderColor: t.border, marginBottom: 22 },
    barSlot: { flex: 1, height: "100%", alignItems: "center", gap: 6 },
    barArea: { flex: 1, width: "100%", justifyContent: "flex-end", alignItems: "center" },
    capMark: { position: "absolute", bottom: 0, width: "70%", borderWidth: 1, borderColor: t.border, borderStyle: "dashed", borderTopLeftRadius: 4, borderTopRightRadius: 4 },
    bar: { width: "70%", borderTopLeftRadius: 4, borderTopRightRadius: 4 },
    axisLabel: { color: t.muted, fontSize: 10, position: "absolute", bottom: -18 },
  });
