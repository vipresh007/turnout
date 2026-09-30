import { type DashboardGroup, type DashboardPlayer } from "@turnout/shared";
import { router } from "expo-router";
import Head from "expo-router/head";
import { useState } from "react";
import { Text, View } from "react-native";
import { GroupTile } from "@/components/GroupTile";
import { Button, Card, Muted, Screen } from "@/components/ui";
import { shareText } from "@/lib/share";
import { useTheme } from "@/lib/theme";

const names = ["Mike", "Raj", "Sam", "John", "Priya", "Leo", "Ana", "Chris", "Dev", "Omar", "Tariq", "Jess", "Kevin", "Maya", "Luis", "Nina", "Ben", "Zoe"];

/** A believable basketball group, built fresh so its next game is always tomorrow at 7:30 PM. */
function demoGroup(): DashboardGroup {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(19, 30, 0, 0);
  const day = start.toLocaleDateString("en-US", { weekday: "long" });
  const id = (i: number) => `demo-${i}`;
  const player = (i: number, status: DashboardPlayer["status"], paid: boolean): DashboardPlayer => ({ memberId: id(i), name: names[i]!, status, paid });
  const players = [
    ...[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((i, k) => player(i, "in", k % 3 !== 2)),
    player(16, "waitlist", false),
    player(17, "waitlist", false),
    player(3, "out", false),
  ];
  const weeks = Array.from({ length: 12 }, (_, w) => {
    const d = new Date(start.getTime() + w * 7 * 86_400_000).toISOString();
    return { scheduledAt: d, startsAt: d, cancelled: w === 5, location: null, note: w === 5 ? "Gym closed for a tournament" : null };
  });
  return {
    role: "owner",
    group: {
      id: "demo", slug: "demo", name: `${day} Basketball`, activity: "basketball", location: "Riverside Community Centre",
      weekdays: [start.getDay()], intervalWeeks: 1, startsOn: "2026-09-01", endsOn: null, startTime: "19:30", durationMinutes: 120,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, cap: 12, feeCents: 15000, feeSplit: true, payNote: "e-Transfer to the organizer",
      seasonFeeCents: null, targetPlayers: null, reminders: { dayBefore: true, hoursBefore: 2, first: "24h", nudgeAgain: true },
    },
    session: {
      id: "demo-session", groupId: "demo", startsAt: start.toISOString(), scheduledAt: start.toISOString(), cancelled: false, location: null, note: null,
      teams: { teams: [[id(4), id(6), id(8), id(10), id(12), id(14)], [id(5), id(7), id(9), id(11), id(13), id(15)]], savedAt: new Date().toISOString() },
    },
    confirmed: 12, waitlist: 2, out: 1, spotsLeft: 0, players, weeks,
    suggestions: {
      invite: [{ memberId: id(0), name: "Mike", played: 11, games: 11 }, { memberId: id(1), name: "Raj", played: 10, games: 11 }],
      expectedLateDrops: 1,
      games: 11,
      forecast: { status: "full", projected: 12, short: 0, unanswered: 3, expectedLateDrops: 1, likely: [] },
    },
  };
}

/** Try Turnout without signing up: an organizer's view of a busy group. Nothing here is saved or sent. */
export default function Demo() {
  const t = useTheme();
  const [item] = useState(demoGroup);
  const [expanded, setExpanded] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const insights = [
    ["Average turnout", "10.8 / 12", "90% of spots filled"],
    ["Games that filled", "7 / 11", "usually full about 20h before"],
    ["Late dropouts", "0.8 a game", "said out in the last 12 hours"],
    ["Most dependable", "Mike · 11/11", "Raj 10/11 · Priya 10/11"],
  ];
  return (
    <Screen>
      <Head>
        <title>Try the Turnout demo</title>
      </Head>
      <View style={{ gap: 6 }}>
        <Text style={{ color: t.accent, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>Demo · no sign-up</Text>
        <Text style={{ color: t.text, fontSize: 28, fontWeight: "900", letterSpacing: -0.8 }}>This is what running your game looks like</Text>
        <Muted>A made-up basketball group: 12 spots, 2 on the waitlist, a split court fee, teams, and autopilot keeping an eye on dropouts. Tap around; nothing is sent.</Muted>
      </View>

      <GroupTile
        item={item}
        isNext
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
        onShare={async (text) => setNotice((await shareText(text)) ? "Copied. In your own group you'd paste this into the group chat." : null)}
        onChanged={() => {}}
        demo
      />
      {notice && <Text style={{ color: t.accent, fontWeight: "600" }}>{notice}</Text>}

      <Card>
        <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>📊 Insights after a few weeks</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {insights.map(([label, value, hint]) => (
            <View key={label} style={{ flexGrow: 1, flexBasis: "45%", backgroundColor: t.bg, borderRadius: 14, padding: 12, gap: 2 }}>
              <Text style={{ color: t.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</Text>
              <Text style={{ color: t.text, fontSize: 20, fontWeight: "900" }}>{value}</Text>
              <Text style={{ color: t.muted, fontSize: 13 }}>{hint}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>Your players don't need any of this</Text>
        <Muted>They get one link, type their name once and tap I'm in or I'm out. Reminders come by email or notification, with no app or account.</Muted>
      </Card>

      <View style={{ gap: 8 }}>
        <Button label="Start your own group, it's free" big onPress={() => router.push("/new")} />
        <Button label="Back to home" variant="secondary" onPress={() => router.push("/")} />
      </View>
    </Screen>
  );
}
