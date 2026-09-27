import { occursOn, type DashboardGroup, type OrganizerStats } from "@turnout/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { formatTime } from "@/lib/format";
import { useTheme, type Theme } from "@/lib/theme";

const DAY = 86_400_000;
const localYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

interface DayGame {
  item: DashboardGroup;
  /** When it starts that day (moved time if changed), for display. */
  startsAt: Date | null;
  cancelled: boolean;
  isCurrent: boolean;
}

/** Games on a local calendar day, using each group's schedule plus known skips and changes. */
function gamesOn(day: Date, groups: DashboardGroup[]): DayGame[] {
  const key = localYmd(day);
  return groups
    .filter((g) => occursOn(key, g.group))
    .map((g) => {
      const week = g.weeks.find((w) => sameDay(new Date(w.scheduledAt), day));
      return {
        item: g,
        startsAt: week ? new Date(week.startsAt) : null,
        cancelled: week?.cancelled ?? false,
        isCurrent: sameDay(new Date(g.session.scheduledAt), day),
      };
    })
    .sort((a, b) => a.item.group.startTime.localeCompare(b.item.group.startTime));
}

const startOfWeek = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay()); // Sunday-first, like most calendars here
  return x;
};

/** Two-week or month calendar of your games, with navigation back and forward. */
export function CalendarView({ groups }: { groups: DashboardGroup[] }) {
  const t = useTheme();
  const s = styles(t);
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const [mode, setMode] = useState<"twoWeeks" | "month">("twoWeeks");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Date | null>(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let days: Date[];
  let title: string;
  let monthIndex = -1;
  if (mode === "twoWeeks") {
    const first = new Date(startOfWeek(today).getTime() + offset * 14 * DAY);
    days = Array.from({ length: 14 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
    const last = days[13]!;
    title = `${first.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${last.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  } else {
    const month = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    monthIndex = month.getMonth();
    const first = startOfWeek(month);
    const weeks = Math.ceil((month.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7);
    days = Array.from({ length: weeks * 7 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
    title = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  const rows = Array.from({ length: days.length / 7 }, (_, r) => days.slice(r * 7, r * 7 + 7));
  const compact = mode === "month" && !wide; // dots, tap a day for details

  const cell = (day: Date) => {
    const games = gamesOn(day, groups);
    const isToday = sameDay(day, today);
    const outside = mode === "month" && day.getMonth() !== monthIndex;
    const past = day < today;
    const isSelected = selected && sameDay(selected, day);
    return (
      <Pressable
        key={day.toISOString()}
        onPress={() => setSelected(isSelected ? null : day)}
        accessibilityRole="button"
        accessibilityLabel={`${day.toDateString()}, ${games.length} ${games.length === 1 ? "game" : "games"}`}
        style={[s.day, { flex: 1, minHeight: compact ? 54 : mode === "month" ? 96 : 92, opacity: outside ? 0.4 : past ? 0.7 : 1 }, isToday && { borderColor: t.accent }, isSelected && { backgroundColor: t.soft }]}
      >
        <Text style={[s.dayNum, { fontSize: compact ? 14 : 18 }, isToday && { color: t.accent }, games.length === 0 && !isToday && { color: t.muted }]}>{day.getDate()}</Text>
        {compact ? (
          <View style={{ flexDirection: "row", gap: 3, flexWrap: "wrap" }}>
            {games.map((g) => (
              <View key={g.item.group.id} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: g.cancelled ? t.danger : t.accent }} />
            ))}
          </View>
        ) : (
          games.slice(0, mode === "month" ? 2 : 3).map((g) => <GamePill key={g.item.group.id} game={g} />)
        )}
        {!compact && games.length > (mode === "month" ? 2 : 3) && <Text style={s.gameMeta}>+{games.length - (mode === "month" ? 2 : 3)} more</Text>}
      </Pressable>
    );
  };

  const selectedGames = selected ? gamesOn(selected, groups) : [];
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Text style={{ color: t.text, fontSize: 16, fontWeight: "800", flex: 1, minWidth: 140 }}>{title}</Text>
        <Seg options={[["twoWeeks", "2 weeks"], ["month", "Month"]]} value={mode} onChange={(m) => { setMode(m as typeof mode); setOffset(0); setSelected(null); }} />
        <NavButton label="‹" onPress={() => setOffset((o) => o - 1)} a11y="Previous" />
        <NavButton label="Today" onPress={() => { setOffset(0); setSelected(null); }} a11y="Today" />
        <NavButton label="›" onPress={() => setOffset((o) => o + 1)} a11y="Next" />
      </View>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <Text key={d} style={[s.dayName, { flex: 1, textAlign: "center" }]}>{compact ? d[0] : d}</Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 6 }}>{r.map(cell)}</View>
      ))}
      {selected && (
        <View style={[s.card, { gap: 8 }]}>
          <Text style={s.cardTitle}>{selected.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</Text>
          {selectedGames.length === 0 && <Text style={s.muted}>No games.</Text>}
          {selectedGames.map((g) => <GamePill key={g.item.group.id} game={g} large />)}
        </View>
      )}
    </View>
  );
}

function GamePill({ game, large }: { game: DayGame; large?: boolean }) {
  const t = useTheme();
  const s = styles(t);
  const { item, cancelled, isCurrent } = game;
  const time = game.startsAt
    ? game.startsAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: item.group.timezone })
    : formatTime(item.group.startTime);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${item.group.name} at ${time}${isCurrent ? `, ${item.confirmed} in` : ""}${cancelled ? ", skipped" : ""}`}
      onPress={() => router.push({ pathname: "/g/[slug]", params: { slug: item.group.slug } })}
      style={({ hovered }: { hovered?: boolean }) => [s.game, large && { paddingVertical: 8 }, hovered && { borderColor: t.accent }, cancelled && { borderLeftColor: t.danger, opacity: 0.6 }]}
    >
      <Text style={[s.gameName, large && { fontSize: 15 }, cancelled && { textDecorationLine: "line-through" }]} numberOfLines={1}>
        {item.group.name}
      </Text>
      <Text style={[s.gameMeta, large && { fontSize: 13 }]} numberOfLines={1}>
        {time}
        {isCurrent && !cancelled ? ` · ${item.confirmed}${item.group.cap ? `/${item.group.cap}` : ""}` : ""}
        {cancelled ? " · skipped" : ""}
      </Text>
    </Pressable>
  );
}

function Seg({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", borderWidth: 1, borderColor: t.border, borderRadius: 10, overflow: "hidden" }}>
      {options.map(([v, label]) => (
        <Pressable key={v} accessibilityRole="button" accessibilityState={{ selected: value === v }} onPress={() => onChange(v)} style={{ paddingVertical: 6, paddingHorizontal: 12, backgroundColor: value === v ? t.soft : t.card }}>
          <Text style={{ color: value === v ? t.accent : t.text, fontWeight: "700", fontSize: 13 }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function NavButton({ label, onPress, a11y }: { label: string; onPress: () => void; a11y: string }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} style={({ hovered }: { hovered?: boolean }) => ({ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: t.border, backgroundColor: hovered ? t.bg : t.card })}>
      <Text style={{ color: t.text, fontWeight: "800" }}>{label}</Text>
    </Pressable>
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
