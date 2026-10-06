import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { memberships } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { Icon, type IconName } from "./Icon";
import { Button } from "./ui";
import { StatsLink, YourGames } from "./YourGames";

const points: [IconName, string, string][] = [
  ["link", "One link for your group chat", "Share it once. Everyone taps it each week."],
  ["check", "Players just tap I'm in", "No app, no account. They answer in seconds."],
  ["sparkles", "The busywork handles itself", "Waitlist, reminders, dropouts, teams and payments."],
];

/**
 * What the app shows when you're signed out. Players who opened a group link here see their games;
 * everyone else sees what Turnout is, a demo, and a way in for organizers.
 */
export function AppWelcome() {
  const [player, setPlayer] = useState<boolean | null>(null);
  useEffect(() => {
    memberships.slugs().then((s) => setPlayer(s.length > 0));
  }, []);
  if (player === null) return null;
  return player ? <PlayerHome /> : <Pitch />;
}

function PlayerHome() {
  const t = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 20 }}>
        <View style={{ paddingTop: 12, gap: 4 }}>
          <Text style={{ color: t.text, fontSize: 26, fontWeight: "900", letterSpacing: -1 }}>
            turnout<Text style={{ color: t.accent }}>.</Text>
          </Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 12 }}>
            <Text style={{ color: t.text, fontSize: 30, fontWeight: "900", letterSpacing: -1 }}>Your games</Text>
            <View style={{ paddingBottom: 6 }}><StatsLink /></View>
          </View>
        </View>
        <YourGames />
        <View style={{ flex: 1 }} />
        <View style={{ gap: 4, alignItems: "center" }}>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/sign-in", params: { next: "/stats" } })} style={{ padding: 6 }}>
            <Text style={{ color: t.muted, fontSize: 14, textAlign: "center" }}>
              New phone coming? <Text style={{ color: t.accent, fontWeight: "700" }}>Sign in to keep your games</Text>
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push("/sign-in")} style={{ padding: 6 }}>
            <Text style={{ color: t.muted, fontSize: 14 }}>
              Run your own game? <Text style={{ color: t.accent, fontWeight: "700" }}>Start a group</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Pitch() {
  const t = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 28, justifyContent: "space-between" }}>
        <View style={{ gap: 28, paddingTop: 24 }}>
          <Text style={{ color: t.text, fontSize: 30, fontWeight: "900", letterSpacing: -1.2 }}>
            turnout<Text style={{ color: t.accent }}>.</Text>
          </Text>
          <View style={{ gap: 10 }}>
            <Text style={{ color: t.text, fontSize: 40, fontWeight: "900", letterSpacing: -1.5, lineHeight: 44 }}>
              Stop asking <Text style={{ color: t.accent }}>who's playing.</Text>
            </Text>
            <Text style={{ color: t.muted, fontSize: 17, lineHeight: 24 }}>Run your weekly game from your phone. Your players never need the app.</Text>
          </View>
          <View style={{ gap: 18 }}>
            {points.map(([icon, title, body]) => (
              <View key={title} style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.soft, alignItems: "center", justifyContent: "center" }}>
                  <Icon name={icon} size={22} color={t.accent} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: t.text, fontSize: 16, fontWeight: "800" }}>{title}</Text>
                  <Text style={{ color: t.muted, fontSize: 15, lineHeight: 21 }}>{body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
        <View style={{ gap: 10 }}>
          <Button label="Get started, it's free" big onPress={() => router.push("/sign-in")} />
          <Button label="Try the demo" variant="secondary" onPress={() => router.push("/demo")} />
          <Text style={{ color: t.muted, fontSize: 13, textAlign: "center", lineHeight: 19 }}>
            Got a group link from your organizer? Just open it. Players don't need this app.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
