import { type ActivityItem, type Dashboard, type DashboardGroup } from "@turnout/shared";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Platform, RefreshControl, Text, useWindowDimensions, View } from "react-native";
import { CalendarView, Regulars, StatRow, TurnoutChart } from "@/components/DashboardInsights";
import { GroupTile } from "@/components/GroupTile";
import { PageGlow, SITE_GUTTER, SITE_WIDTH, SiteHeader } from "@/components/SiteHeader";
import { FeedbackAsk } from "@/components/FeedbackAsk";
import { PricingAsk } from "@/components/PricingAsk";
import { YourGames } from "@/components/YourGames";
import { maybeAskForReview } from "@/lib/review";
import { Reveal, RevealScrollView } from "@/components/motion";
import { SignInGate } from "@/components/SignInGate";
import { Button, Display, EmptyState, ListRow, ProgressBar, RowGroup, SectionHeader, StepBadge } from "@/components/ui";
import { useApi } from "@/lib/api";
import { useLive } from "@/lib/live";
import { greeting, sessionWhen, timeAgo } from "@/lib/format";
import { shareText } from "@/lib/share";
import { sportTone, useTheme } from "@/lib/theme";

export default function DashboardScreen() {
  return (
    <SignInGate reason="Sign in to see and manage your groups.">
      <DashboardView />
    </SignInGate>
  );
}

/** Home: the next game, then every other group as a row, then the calendar. Insights have their own tab in the app. */
function DashboardView() {
  const t = useTheme();
  const api = useApi();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const web = Platform.OS === "web";
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(
    () => api.dashboard().then((d) => {
      setData(d);
      setError(null);
      void maybeAskForReview(d.stats).catch(() => {});
    }, (e: Error) => setError(e.message)),
    [api],
  );

  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      load();
      return () => setFocused(false);
    }, [load]),
  );
  // Live: anyone tapping in or out in any of your groups updates the dashboard right away.
  useLive(api.dashboardLive, "dashboard", focused, load);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const share = async (message: string) => {
    if (await shareText(message)) {
      setNotice("Copied to clipboard");
      setTimeout(() => setNotice(null), 2000);
    }
  };

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, justifyContent: "center", alignItems: "center" }}>
        {error ? <Text style={{ color: t.danger }}>{error}</Text> : <ActivityIndicator />}
      </View>
    );
  }

  const { organizer, groups, activity } = data;
  const displayName = organizer.name?.split(" ")[0] ?? organizer.email?.split("@")[0] ?? null;
  const next = groups.find((g) => !g.session.cancelled) ?? groups[0];
  const others = groups.filter((g) => g !== next);

  return (
    <RevealScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ alignItems: "center", paddingBottom: 64 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
    >
      {web && <PageGlow />}
      {web && <SiteHeader />}
      <View style={{ width: "100%", maxWidth: SITE_WIDTH, paddingHorizontal: SITE_GUTTER, paddingTop: web ? 4 : 12, gap: 20 }}>
        {/* Greeting. On the web the site header has the account menu and New group; the app keeps them here. */}
        <View style={{ gap: 4, paddingHorizontal: 2 }}>
          <Text style={{ color: t.muted, fontSize: 13, fontWeight: "500" }}>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</Text>
          <Display level="display" style={{ fontSize: 30, lineHeight: 34 }}>
            {greeting()}
            {displayName ? `,\n${displayName}` : ""}
          </Display>
        </View>

        {groups.length === 0 ? (
          <>
            {/* Signed in as a player who doesn't run a group (yet): their games first. */}
            <YourGames title="Your games" />
            <FirstGroup />
          </>
        ) : (
          <>
            {/* The next game first: what an organizer needs when they open Turnout. */}
            {next && <GroupTile item={next} isNext expanded={expanded} onToggle={() => setExpanded((e) => !e)} onShare={share} onChanged={load} />}
            {notice && <Text style={{ color: t.accent, fontWeight: "600" }}>{notice}</Text>}

            {others.length > 0 && (
              <View style={{ gap: 10 }}>
                <SectionHeader title="Your groups" />
                <RowGroup>
                  {others.map((g, i) => <GroupRow key={g.group.id} item={g} first={i === 0} last={i === others.length - 1} />)}
                </RowGroup>
              </View>
            )}

            <Reveal style={{ gap: 10 }}>
              <SectionHeader title="Calendar" />
              <CalendarView groups={groups} />
            </Reveal>

            {/* Insights below the operational stuff. The app has them in their own tab. */}
            {web && (
              <>
                <View style={{ gap: 10 }}>
                  <SectionHeader title="Insights" />
                  <StatRow groups={groups} stats={data.stats} />
                </View>
                <View style={{ flexDirection: wide ? "row" : "column", gap: 24, alignItems: "flex-start" }}>
                  <View style={{ flex: wide ? 1.3 : undefined, width: wide ? undefined : "100%", gap: 12 }}>
                    <Reveal><TurnoutChart stats={data.stats} /></Reveal>
                    <Reveal delay={80}><Regulars stats={data.stats} /></Reveal>
                  </View>
                  <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : "100%", gap: 10 }}>
                    <SectionHeader title="Recent activity" />
                    {activity.length === 0 ? (
                      <Text style={{ color: t.muted, fontSize: 14, lineHeight: 20 }}>No RSVPs yet. Share your group link and responses show up here as they come in.</Text>
                    ) : (
                      <RowGroup>
                        {activity.map((a, i) => <ActivityRow key={`${a.groupSlug}-${a.name}-${a.at}`} item={a} first={i === 0} last={i === activity.length - 1} />)}
                      </RowGroup>
                    )}
                  </View>
                </View>
              </>
            )}
            <YourGames title="Games you play in" exclude={data.groups.map((g) => g.group.slug)} />
            {/* Asks come last, so the games stay on top. */}
            {organizer.askFeedback && <FeedbackAsk />}
            {organizer.askPricing && <PricingAsk />}
          </>
        )}
        {/* A failed background refresh keeps showing the last good data; errors only show when there's nothing to show. */}
      </View>
    </RevealScrollView>
  );
}

/** One of the other groups: name and when on the left, how full on the right. */
function GroupRow({ item, first, last }: { item: DashboardGroup; first: boolean; last: boolean }) {
  const t = useTheme();
  const { group, session } = item;
  const goal = group.cap ?? group.targetPlayers ?? null;
  const tone = session.cancelled ? t.muted : goal && item.confirmed >= goal ? t.accent : t.energy;
  return (
    <ListRow
      first={first}
      last={last}
      title={group.name}
      subtitle={session.cancelled ? "Cancelled this week" : `${sessionWhen(session.startsAt, group.durationMinutes, group.timezone)}${item.role === "admin" ? " · co-organizer" : ""}`}
      tone={sportTone(group.activity, t)}
      onPress={() => router.push({ pathname: "/g/[slug]", params: { slug: group.slug } })}
      right={
        <View style={{ alignItems: "flex-end", gap: 5, width: 72 }}>
          <Text style={{ color: t.text, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
            {item.confirmed}
            <Text style={{ color: t.muted, fontWeight: "600" }}>{goal ? ` / ${goal}` : " in"}</Text>
          </Text>
          {goal ? <ProgressBar value={item.confirmed} max={goal} height={5} tone={tone} /> : null}
        </View>
      }
    />
  );
}

function ActivityRow({ item, first, last }: { item: ActivityItem; first: boolean; last: boolean }) {
  const t = useTheme();
  const isIn = item.status === "in";
  return (
    <ListRow
      first={first}
      last={last}
      icon={isIn ? "check" : "x"}
      tone={isIn ? t.accent : t.muted}
      title={`${item.name} is ${isIn ? "in" : "out"}`}
      subtitle={item.groupName}
      right={<Text style={{ color: t.muted, fontSize: 13 }}>{timeAgo(item.at)}</Text>}
      onPress={() => router.push({ pathname: "/g/[slug]", params: { slug: item.groupSlug } })}
    />
  );
}

/** No groups yet: what to do, in three steps. */
function FirstGroup() {
  const t = useTheme();
  const steps = ["Describe your game in one sentence", "Share the link in your group chat", "Watch the headcount fill up live"];
  return (
    <Reveal>
      <View style={{ backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 22, padding: 20, gap: 16, boxShadow: t.shadow.card }}>
        <EmptyState illustration="noGroups" title="Start your first group" body="Takes a minute. Players don't need the app." />
        <View style={{ gap: 10 }}>
          {steps.map((text, i) => (
            <View key={text} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <StepBadge n={i + 1} />
              <Text style={{ color: t.text, fontSize: 16 }}>{text}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row" }}>
          <Button label="Create a group" onPress={() => router.push("/new")} size="lg" />
        </View>
      </View>
    </Reveal>
  );
}
