import { combinePlayerStats, type PlayerStats } from "@turnout/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { BadgeRow } from "./Badges";
import { StatsStrip } from "./PlayerStats";
import { Card, Display, Eyebrow, Texture } from "./ui";
import { YourGames } from "./YourGames";

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
      <View style={{ backgroundColor: t.accent, borderRadius: 20, padding: 18, paddingTop: tab ? 18 : 22, gap: 6, overflow: "hidden" }}>
        <Texture color={t.ink} opacity={0.14} />
        {!tab && (
          <Text style={{ color: t.ink, fontSize: 22, fontWeight: "900", letterSpacing: -1 }}>
            turnout<Text style={{ color: t.paper }}>.</Text>
          </Text>
        )}
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <Display level="display" style={{ fontSize: 34, lineHeight: 36, color: t.ink, textTransform: "uppercase" }}>Your games</Display>
          <Pressable accessibilityRole="link" onPress={() => router.push("/stats")} hitSlop={8} style={{ paddingBottom: 4 }}>
            <Text style={{ color: t.ink, fontWeight: "800" }}>Your stats →</Text>
          </Pressable>
        </View>
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
