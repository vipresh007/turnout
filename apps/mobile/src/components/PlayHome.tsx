import { combinePlayerStats, type PlayerStats } from "@turnout/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { BadgeRow } from "./Badges";
import { StatsStrip } from "./PlayerStats";
import { Card, Display, Eyebrow } from "./ui";
import { StatsLink, YourGames } from "./YourGames";

/**
 * A player's home: this week's games with your answer, then your record across all of them. Shown signed out
 * (instead of the pitch) and as the Play tab for anyone signed in who also plays.
 */
export function PlayHome({ onEmpty, tab }: { onEmpty?: () => void; tab?: boolean }) {
  const t = useTheme();
  const { status } = useAuth();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const body = (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 20 }}>
      {!tab && (
        <View style={{ paddingTop: 12, gap: 4 }}>
          <Text style={{ color: t.text, fontSize: 24, fontWeight: "900", letterSpacing: -1 }}>
            turnout<Text style={{ color: t.accent }}>.</Text>
          </Text>
        </View>
      )}
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <Display level="display" style={{ fontSize: 32, lineHeight: 36 }}>Your games</Display>
        <View style={{ paddingBottom: 4 }}><StatsLink /></View>
      </View>
      <YourGames onEmpty={onEmpty} onLoaded={(all) => setStats(all.length ? combinePlayerStats(all) : null)} />
      {stats && stats.games > 0 && (
        <Card>
          <Eyebrow>Your record</Eyebrow>
          <StatsStrip stats={stats} />
          <BadgeRow stats={stats} />
        </Card>
      )}
      <View style={{ flex: 1 }} />
      {status !== "signedIn" && (
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
      )}
    </ScrollView>
  );
  if (tab || Platform.OS === "web") return <View style={{ flex: 1, backgroundColor: t.bg }}>{body}</View>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>{body}</SafeAreaView>;
}
