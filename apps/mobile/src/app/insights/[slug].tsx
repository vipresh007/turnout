import { describeLead, type GroupInsights, type PlayerReliability } from "@turnout/shared";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { SignInGate } from "@/components/SignInGate";
import { Card, Muted, Screen } from "@/components/ui";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";

export default function InsightsScreen() {
  return (
    <SignInGate reason="Sign in to see how your group is doing.">
      <Insights />
    </SignInGate>
  );
}

const one = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function Insights() {
  const t = useTheme();
  const api = useApi();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [data, setData] = useState<GroupInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.insights(slug).then(setData, (e: Error) => setError(e.message));
  }, [api, slug]);

  if (!data) return <Screen>{error ? <Text style={{ color: t.danger }}>{error}</Text> : <ActivityIndicator style={{ marginTop: 48 }} />}</Screen>;
  const { health, players, timeSlots } = data;
  const playedGames = health.games - health.cancelled;

  if (playedGames < 2) {
    return (
      <Screen>
        <Text style={{ color: t.text, fontSize: 24, fontWeight: "900" }}>Insights</Text>
        <Card>
          <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>Check back after a couple of games</Text>
          <Muted>Once your group has played a few times, you'll see who's dependable, how fast games fill, and when people drop out.</Muted>
        </Card>
      </Screen>
    );
  }

  const tiles: { label: string; value: string; hint?: string }[] = [
    { label: "Average turnout", value: health.avgPlayers === null ? "–" : `${one(health.avgPlayers)}${health.cap ? ` / ${health.cap}` : ""}`, hint: health.fillRate !== null ? `${Math.round(health.fillRate * 100)}% of spots filled` : undefined },
    ...(health.cap ? [{ label: "Games that filled", value: `${health.filledGames} / ${playedGames}`, hint: health.fullLeadHours !== null ? `usually full ${describeLead(health.fullLeadHours)} before` : undefined }] : []),
    { label: "Answers come in", value: health.answerLeadHours === null ? "–" : describeLead(health.answerLeadHours), hint: "before the game, typically" },
    { label: "Late dropouts", value: health.avgLateDrops === null ? "–" : `${one(health.avgLateDrops)} a game`, hint: "said out in the last 12 hours" },
    ...(health.cap ? [{ label: "Average waitlist", value: health.avgWaitlist === null ? "–" : one(health.avgWaitlist) }] : []),
    { label: "Cancelled", value: `${health.cancelled} / ${health.games}` },
  ];

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Text style={{ color: t.text, fontSize: 24, fontWeight: "900" }}>Insights</Text>
        <Muted>From your last {health.games} {health.games === 1 ? "game" : "games"}.</Muted>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {tiles.map((tile) => (
          <View key={tile.label} style={{ flexGrow: 1, flexBasis: "45%", backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 16, padding: 14, gap: 2 }}>
            <Text style={{ color: t.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 }}>{tile.label}</Text>
            <Text style={{ color: t.text, fontSize: 24, fontWeight: "900", letterSpacing: -0.5 }}>{tile.value}</Text>
            {tile.hint && <Text style={{ color: t.muted, fontSize: 13 }}>{tile.hint}</Text>}
          </View>
        ))}
      </View>

      {timeSlots.length > 1 && (
        <Card>
          <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>Best times</Text>
          {timeSlots.map((s, i) => (
            <View key={s.label} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: t.text, fontWeight: i === 0 ? "800" : "400" }}>{i === 0 ? "🏆 " : ""}{s.label}</Text>
              <Text style={{ color: t.muted }}>{one(s.avgPlayers)} players avg · {s.games} {s.games === 1 ? "game" : "games"}</Text>
            </View>
          ))}
        </Card>
      )}

      <Card>
        <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>Players</Text>
        <Muted>Games they played out of the games since they joined, most dependable first.</Muted>
        {players.filter((p) => p.games > 0).map((p, i) => <PlayerRow key={p.memberId} p={p} first={i === 0} />)}
      </Card>
    </Screen>
  );
}

function PlayerRow({ p, first }: { p: PlayerReliability; first: boolean }) {
  const t = useTheme();
  const rate = p.games ? p.played / p.games : 0;
  const details = [
    `${p.out} out`,
    p.noAnswer ? `${p.noAnswer} no answer` : null,
    p.lateDrops ? `${p.lateDrops} late ${p.lateDrops === 1 ? "drop" : "drops"}` : null,
    p.answerLeadHours !== null ? `answers ${describeLead(p.answerLeadHours)} ahead` : null,
  ].filter(Boolean).join(" · ");
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }, !first && { borderTopWidth: 1, borderColor: t.border }]}>
      <Avatar name={p.name} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ color: t.text, fontSize: 16, fontWeight: "600", flexShrink: 1 }} numberOfLines={1}>{p.name}</Text>
          <Text style={{ color: t.text, fontWeight: "800" }}>{p.played}/{p.games}</Text>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: t.border, overflow: "hidden" }}>
          <View style={{ height: "100%", width: `${rate * 100}%`, borderRadius: 3, backgroundColor: p.lateDrops > 1 ? t.waitlist : t.accent }} />
        </View>
        <Text style={{ color: t.muted, fontSize: 13 }}>{details}</Text>
      </View>
    </View>
  );
}
