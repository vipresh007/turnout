import { formatMoney, teamNames, type GameRecord } from "@turnout/shared";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { SignInGate } from "@/components/SignInGate";
import { BackLink, Muted, Pill, Screen, webTransition } from "@/components/ui";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";

export default function HistoryScreen() {
  return (
    <SignInGate reason="Sign in to see your group's past games.">
      <History />
    </SignInGate>
  );
}

function History() {
  const t = useTheme();
  const api = useApi();
  // `at` (YYYY-MM-DD, local) opens that game, e.g. from a past day in the dashboard calendar.
  const { slug, at } = useLocalSearchParams<{ slug: string; at?: string }>();
  const scroll = useRef<ScrollView>(null);
  const scrolledTo = useRef<string | null>(null);
  const [games, setGames] = useState<GameRecord[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.history(slug).then((r) => {
      setGames(r.games);
      const asked = at ? r.games.find((g) => localDay(g.startsAt) === at) : undefined;
      setOpen(asked?.startsAt ?? r.games.find((g) => !g.cancelled)?.startsAt ?? null); // otherwise the latest game starts open
    }, (e: Error) => setError(e.message));
  }, [api, slug, at]);

  if (!games) return <Screen>{error ? <Text style={{ color: t.danger }}>{error}</Text> : <ActivityIndicator style={{ marginTop: 48 }} />}</Screen>;

  return (
    <Screen scrollRef={scroll}>
      <BackLink fallback={{ pathname: "/g/[slug]", params: { slug } }} label="Back to group" />
      <View style={{ gap: 4 }}>
        <Text style={{ color: t.text, fontSize: 24, fontWeight: "900" }}>Past games</Text>
        <Muted>{games.length ? "What happened each week. Tap a game for the details." : "Nothing yet. After your first game, it shows up here."}</Muted>
      </View>
      {at && !games.some((g) => localDay(g.startsAt) === at) && <Muted>No game was recorded for that day.</Muted>}
      {games.map((g) => (
        <View
          key={g.startsAt}
          onLayout={(e) => {
            // Bring the game asked for into view once it's laid out.
            if (at && localDay(g.startsAt) === at && scrolledTo.current !== at) {
              scrolledTo.current = at;
              setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, e.nativeEvent.layout.y - 16), animated: true }), 50);
            }
          }}
        >
          <GameRow game={g} open={open === g.startsAt} onToggle={() => setOpen(open === g.startsAt ? null : g.startsAt)} />
        </View>
      ))}
    </Screen>
  );
}

const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

function GameRow({ game: g, open, onToggle }: { game: GameRecord; open: boolean; onToggle: () => void }) {
  const t = useTheme();
  const summary = g.cancelled ? "Cancelled" : `${g.played}${g.cap ? ` / ${g.cap}` : ""} played`;
  const full = !g.cancelled && g.cap !== null && g.played >= g.cap;
  return (
    <View style={{ backgroundColor: t.card, borderColor: open ? t.accent : t.border, borderWidth: 1, borderRadius: 16, overflow: "hidden" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={({ hovered }: { hovered?: boolean }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: hovered ? t.bg : "transparent", ...webTransition })}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>{dateLabel(g.startsAt)}</Text>
          {(g.note || g.location) && <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={1}>{[g.location, g.note].filter(Boolean).join(" · ")}</Text>}
        </View>
        <Text style={{ color: g.cancelled ? t.danger : full ? t.accent : t.text, fontWeight: "800" }}>{summary}</Text>
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}><Icon name="chevronDown" size={18} color={t.muted} /></View>
      </Pressable>
      {open && !g.cancelled && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 12 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Stat label="Played" value={String(g.played)} />
            <Stat label="Out" value={String(g.out)} />
            {g.lateDrops > 0 && <Stat label="Late drops" value={String(g.lateDrops)} />}
            {g.waitlist > 0 && <Stat label="Waitlist" value={String(g.waitlist)} />}
            {g.expectedCents !== null && <Stat label="Collected" value={`${formatMoney(g.collectedCents!)} / ${formatMoney(g.expectedCents)}`} />}
          </View>
          {g.teams && (
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {g.teams.map((team, i) => (
                <View key={i} style={{ flexGrow: 1, flexBasis: "45%", backgroundColor: t.bg, borderRadius: 12, padding: 10, gap: 2 }}>
                  <Text style={{ color: t.accent, fontWeight: "900" }}>{teamNames[i]}</Text>
                  <Text style={{ color: t.text }}>{team.join(" · ")}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={{ gap: 4 }}>
            {g.players.map((p) => (
              <View key={p.name + p.status} style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <Text style={{ color: p.status === "out" ? t.muted : t.text }}>{p.name}</Text>
                {p.status === "in" ? (
                  <Pill label={p.paid ? "played · paid" : "played"} color={t.accent} icon="check" />
                ) : p.status === "waitlist" ? (
                  <Pill label="waitlist" color={t.waitlist} icon="hourglass" />
                ) : (
                  <Pill label={p.lateDrop ? "dropped late" : "out"} color={p.lateDrop ? t.waitlist : t.muted} icon="x" />
                )}
              </View>
            ))}
          </View>
          {g.expectedCents !== null && <Muted>Amounts use the group's current cost setting.</Muted>}
        </View>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 }}>
      <Text style={{ color: t.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</Text>
      <Text style={{ color: t.text, fontWeight: "900", fontSize: 17 }}>{value}</Text>
    </View>
  );
}
