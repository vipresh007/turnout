import { router } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { Button } from "./ui";

const points: [string, string, string][] = [
  ["🔗", "One link for your group chat", "Share it once. Everyone taps it each week."],
  ["👋", "Players just tap I'm in", "No app, no account. They answer in seconds."],
  ["✨", "The busywork handles itself", "Waitlist, reminders, dropouts, teams and payments."],
];

/** What the app shows when you're signed out: what Turnout is, a demo, and a way in. */
export function AppWelcome() {
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
                  <Text style={{ fontSize: 20 }}>{icon}</Text>
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
