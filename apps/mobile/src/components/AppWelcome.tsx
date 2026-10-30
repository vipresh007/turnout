import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { memberships, onMembershipsChanged } from "@/lib/api";
import { tint, useTheme } from "@/lib/theme";
import { Icon, type IconName } from "./Icon";
import { Button, Display } from "./ui";
import { PlayHome } from "./PlayHome";

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
    const check = () => memberships.slugs().then((s) => setPlayer(s.length > 0));
    check();
    // Groups can disappear (deleted, or the player left): back to the welcome screen when none are left.
    return onMembershipsChanged(() => void check());
  }, []);
  const showWelcome = useCallback(() => setPlayer(false), []);
  if (player === null) return null;
  // Nothing to show (all gone, or they can't load right now): the welcome screen, which still has sign-in.
  return player ? <PlayHome onEmpty={showWelcome} /> : <Pitch />;
}

function Pitch() {
  const t = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 28, justifyContent: "space-between" }}>
        <View style={{ gap: 28 }}>
          <View style={{ gap: 18, paddingTop: 24 }}>
            <Text style={{ color: t.text, fontSize: 26, fontWeight: "700", letterSpacing: -1 }}>
              turnout<Text style={{ color: t.accent }}>.</Text>
            </Text>
            <Display level="display" style={{ fontSize: 40, lineHeight: 44 }}>
              Stop asking{"\n"}<Text style={{ color: t.accent }}>who's playing.</Text>
            </Display>
            <Text style={{ color: t.muted, fontSize: 17, lineHeight: 24 }}>Run your weekly game from your phone. Your players never need the app.</Text>
          </View>
          <View style={{ gap: 18 }}>
            {points.map(([icon, title, body]) => (
              <View key={title} style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.soft, borderWidth: 1, borderColor: tint(t.accent, 0.3), alignItems: "center", justifyContent: "center" }}>
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
