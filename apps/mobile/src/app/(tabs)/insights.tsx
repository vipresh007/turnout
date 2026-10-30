import type { ActivityItem, Dashboard } from "@turnout/shared";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { Regulars, StatRow, TurnoutChart } from "@/components/DashboardInsights";
import { MyStatsCard } from "@/components/MyStatsCard";
import { SignInGate } from "@/components/SignInGate";
import { Button, EmptyState, ListRow, RowGroup, SectionHeader } from "@/components/ui";
import { useApi } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { useTheme } from "@/lib/theme";

export default function InsightsScreen() {
  return (
    <SignInGate reason="Sign in to see how your groups are doing.">
      <Insights />
    </SignInGate>
  );
}

/** The app's Insights tab: headline numbers, turnout over time, your regulars, then who said in or out lately. */
function Insights() {
  const t = useTheme();
  const api = useApi();
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(
    () => Promise.all([api.activity(), api.dashboard()]).then(([a, d]) => {
      setItems(a.activity);
      setDash(d);
    }, (e: Error) => setError(e.message)),
    [api],
  );
  useFocusEffect(useCallback(() => void load(), [load]));

  const noGroups = dash && dash.groups.length === 0;
  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      {!items && !error && <ActivityIndicator style={{ marginTop: 32 }} />}
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
      <MyStatsCard />
      {noGroups && (
        <EmptyState
          illustration="noStats"
          title="Nothing to count yet"
          body="Run a group for a couple of weeks and this fills up with turnout, your best days and your regulars."
          action={<Button label="Start a group" onPress={() => router.push("/new")} />}
        />
      )}
      {dash && dash.groups.length > 0 && (
        <>
          <StatRow groups={dash.groups} stats={dash.stats} />
          <TurnoutChart stats={dash.stats} />
          <Regulars stats={dash.stats} />
        </>
      )}
      {items && items.length > 0 && (
        <View style={{ gap: 10 }}>
          <SectionHeader title="Recent activity" />
          <RowGroup>
            {items.map((a, i) => (
              <ListRow
                key={`${a.groupSlug}-${a.name}-${a.at}`}
                first={i === 0}
                last={i === items.length - 1}
                icon={a.status === "in" ? "check" : "x"}
                tone={a.status === "in" ? t.accent : t.muted}
                title={`${a.name} is ${a.status === "in" ? "in" : "out"}`}
                subtitle={a.groupName}
                right={<Text style={{ color: t.muted, fontSize: 12 }}>{timeAgo(a.at)}</Text>}
                onPress={() => router.push({ pathname: "/g/[slug]", params: { slug: a.groupSlug } })}
              />
            ))}
          </RowGroup>
        </View>
      )}
    </ScrollView>
  );
}
