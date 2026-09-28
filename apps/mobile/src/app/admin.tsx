import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SignInGate } from "@/components/SignInGate";
import { BackLink, Card, Muted, Screen, webTransition } from "@/components/ui";
import { useApi, type ProductMetrics } from "@/lib/api";
import { useTheme } from "@/lib/theme";

export default function AdminScreen() {
  return (
    <SignInGate reason="Sign in to see Turnout's metrics.">
      <Metrics />
    </SignInGate>
  );
}

const percent = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);
const EVENT_LABELS: Record<string, string> = {
  group_created: "Groups created", player_joined: "Players joined", rsvp_in: "Said I'm in", rsvp_out: "Said I'm out",
  waitlisted: "Waitlisted", waitlist_promoted: "Moved up from waitlist", player_dropped: "Dropped out", late_dropout: "Late dropouts",
  reminder_sent: "Reminders sent", reminder_opened: "Reminder links opened", spot_alert_sent: "Spot-open alerts sent",
  spot_alert_claimed: "Spot-open alerts claimed", teams_created: "Teams made", payment_marked: "Payments marked",
  link_shared: "Links shared", invite_asked: "“Ask” taps", forecast_alert_sent: "Autopilot heads-ups", pricing_answer: "Pricing answers",
};

/** Product metrics across all groups. Only admins (ADMIN_EMAILS) get data; the API hides the rest. */
function Metrics() {
  const t = useTheme();
  const api = useApi();
  const [days, setDays] = useState(90);
  const [m, setM] = useState<ProductMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.metrics(days).then(setM, (e: Error) => setError(e.message));
  }, [api, days]);

  if (error) return <Screen><BackLink fallback="/dashboard" /><Text style={{ color: t.danger }}>{error}</Text></Screen>;
  if (!m) return <Screen><ActivityIndicator style={{ marginTop: 48 }} /></Screen>;
  const max = Math.max(1, ...m.northStar.weeks.map((w) => w.games));

  const tiles: [string, string, string?][] = [
    ["Players who answered", `${m.players.responded} / ${m.players.joined}`, "of players who joined in this period"],
    ["Answer before any reminder", percent(m.rates.respondBeforeReminder)],
    ["Games that needed a reminder", percent(m.rates.gamesNeedingReminder)],
    ["Games that used the waitlist", percent(m.rates.gamesUsingWaitlist)],
    ["Late dropouts per game", m.rates.lateDropsPerGame === null ? "–" : m.rates.lateDropsPerGame.toFixed(1)],
    ["Spot alerts claimed", percent(m.rates.spotAlertClaimRate)],
    ["Groups", `${m.groups.active} active / ${m.groups.total}`, `${m.groups.created} created in this period`],
    ["Average players per game", m.games.avgPlayers === null ? "–" : m.games.avgPlayers.toFixed(1), `${m.games.cancelled} of ${m.games.scheduled} games cancelled`],
  ];

  return (
    <Screen>
      <BackLink fallback="/dashboard" />
      <View style={{ gap: 4 }}>
        <Text style={{ color: t.text, fontSize: 24, fontWeight: "900" }}>Turnout metrics</Text>
        <Muted>
          All groups, last {m.days} days.{m.trackingSince ? ` Event-based numbers count from ${new Date(m.trackingSince).toLocaleDateString()}.` : " Event tracking hasn't recorded anything yet."}
        </Muted>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[30, 90, 365].map((d) => (
          <Pressable
            key={d}
            accessibilityRole="button"
            accessibilityState={{ selected: d === days }}
            onPress={() => setDays(d)}
            style={({ hovered }: { hovered?: boolean }) => ({ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: d === days || hovered ? t.accent : t.border, backgroundColor: d === days ? t.soft : t.card, ...webTransition })}
          >
            <Text style={{ color: d === days ? t.accent : t.text, fontWeight: "700" }}>{d === 365 ? "1 year" : `${d} days`}</Text>
          </Pressable>
        ))}
      </View>

      <Card>
        <Text style={{ color: t.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 }}>North Star · games run</Text>
        <Text style={{ color: t.text, fontSize: 44, fontWeight: "900", letterSpacing: -1.5 }}>{m.northStar.gamesRun}</Text>
        <Muted>Past games that weren't cancelled and had at least two players in.</Muted>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 80 }}>
          {m.northStar.weeks.map((w) => (
            <View key={w.start} accessibilityLabel={`Week of ${new Date(w.start).toLocaleDateString()}: ${w.games} games`} style={{ flex: 1, height: `${Math.max(4, (w.games / max) * 100)}%`, backgroundColor: w.games ? t.accent : t.border, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
          ))}
        </View>
        <Muted>Games per week</Muted>
      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {tiles.map(([label, value, hint]) => (
          <View key={label} style={{ flexGrow: 1, flexBasis: "45%", backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 16, padding: 14, gap: 2 }}>
            <Text style={{ color: t.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</Text>
            <Text style={{ color: t.text, fontSize: 22, fontWeight: "900" }}>{value}</Text>
            {hint && <Text style={{ color: t.muted, fontSize: 13 }}>{hint}</Text>}
          </View>
        ))}
      </View>

      <Card>
        <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>Would they pay $49/year?</Text>
        <Muted>
          {m.pricing.filter((p) => p.answer === "yes").length} yes · {m.pricing.filter((p) => p.answer === "maybe").length} maybe · {m.pricing.filter((p) => p.answer === "no").length} no
        </Muted>
        {m.pricing.map((p, i) => (
          <View key={i} style={{ gap: 2, paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderColor: t.border }}>
            <Text style={{ color: t.text, fontWeight: "700" }}>
              {p.answer === "yes" ? "✅" : p.answer === "maybe" ? "🤔" : "❌"} {p.name || p.email || "Organizer"}
              {p.email && p.name ? <Text style={{ color: t.muted, fontWeight: "400" }}> · {p.email}</Text> : null}
            </Text>
            {p.reason && <Text style={{ color: t.muted }}>“{p.reason}”</Text>}
          </View>
        ))}
      </Card>

      <Card>
        <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>Events</Text>
        {Object.keys(EVENT_LABELS).map((k) => (
          <View key={k} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: t.text }}>{EVENT_LABELS[k]}</Text>
            <Text style={{ color: t.muted, fontWeight: "700" }}>{m.events[k] ?? 0}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
