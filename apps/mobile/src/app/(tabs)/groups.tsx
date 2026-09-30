import { describeRecurrence, playerGoal, type DashboardGroup } from "@turnout/shared";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { SignInGate } from "@/components/SignInGate";
import { Button, Muted, webTransition } from "@/components/ui";
import { useApi } from "@/lib/api";
import { relativeDay, sessionWhen } from "@/lib/format";
import { useTheme } from "@/lib/theme";

export default function GroupsScreen() {
  return (
    <SignInGate reason="Sign in to see your groups.">
      <Groups />
    </SignInGate>
  );
}

/** Every group you run, next game first. Tap one to open it. */
function Groups() {
  const t = useTheme();
  const api = useApi();
  const [groups, setGroups] = useState<DashboardGroup[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api.dashboard().then((d) => setGroups(d.groups), (e: Error) => setError(e.message)), [api]);
  useFocusEffect(useCallback(() => void load(), [load]));

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <View style={{ flexDirection: "row" }}>
        <Button label="+ New group" onPress={() => router.push("/new")} />
      </View>
      {!groups && !error && <ActivityIndicator style={{ marginTop: 32 }} />}
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
      {groups?.length === 0 && <Muted>No groups yet. Create one and share the link in your group chat.</Muted>}
      {groups?.map((g) => <GroupRow key={g.group.id} item={g} />)}
    </ScrollView>
  );
}

function GroupRow({ item }: { item: DashboardGroup }) {
  const t = useTheme();
  const { group, session, confirmed } = item;
  const goal = playerGoal(group);
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push({ pathname: "/g/[slug]", params: { slug: group.slug } })}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.card, borderColor: hovered ? t.accent : t.border, borderWidth: 1,
        borderRadius: 16, padding: 14, opacity: pressed ? 0.8 : 1, ...webTransition,
      })}
    >
      <Avatar name={group.name} size={40} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: t.text, fontSize: 16, fontWeight: "800" }} numberOfLines={1}>{group.name}</Text>
        <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={1}>
          {session.cancelled ? "Cancelled this week" : `${relativeDay(session.startsAt, group.timezone)} · ${sessionWhen(session.startsAt, group.durationMinutes, group.timezone)}`}
        </Text>
        <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>{describeRecurrence(group)}{item.role === "admin" ? " · co-organizer" : ""}</Text>
      </View>
      {!session.cancelled && (
        <Text style={{ color: t.text, fontWeight: "900", fontSize: 18 }}>
          {confirmed}
          <Text style={{ color: t.muted, fontSize: 13, fontWeight: "700" }}>{goal ? `/${goal}` : " in"}</Text>
        </Text>
      )}
    </Pressable>
  );
}
