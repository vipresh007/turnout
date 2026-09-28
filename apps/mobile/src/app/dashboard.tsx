import { type ActivityItem, type Dashboard, type DashboardGroup } from "@turnout/shared";
import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { CalendarView, Regulars, TurnoutChart } from "@/components/DashboardInsights";
import { GroupTile } from "@/components/GroupTile";
import { Pop, Reveal, RevealScrollView } from "@/components/motion";
import { SignInGate } from "@/components/SignInGate";
import { Button } from "@/components/ui";
import { useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLive } from "@/lib/live";
import { greeting, timeAgo } from "@/lib/format";
import { shareText } from "@/lib/share";
import { storage } from "@/lib/storage";
import { useTheme, type Theme } from "@/lib/theme";


const EXPANDED_KEY = "dashboard:expanded";

export default function DashboardScreen() {
  return (
    <SignInGate reason="Sign in to see and manage your groups.">
      <DashboardView />
    </SignInGate>
  );
}

function DashboardView() {
  const t = useTheme();
  const s = styles(t);
  const api = useApi();
  const { signOut } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Which group tiles are open; remembered on this device.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  useEffect(() => {
    storage.get(EXPANDED_KEY).then((raw) => raw && setExpanded(new Set(JSON.parse(raw) as string[])), () => {});
  }, []);
  const toggle = (slug: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(slug)) next.add(slug);
      storage.set(EXPANDED_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });

  const load = useCallback(() => api.dashboard().then(setData, (e: Error) => setError(e.message)), [api]);

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

  const doSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    router.replace("/");
  };

  if (!data) {
    return (
      <View style={[s.page, { justifyContent: "center", alignItems: "center" }]}>
        {error ? <Text style={{ color: t.danger }}>{error}</Text> : <ActivityIndicator />}
      </View>
    );
  }

  const { organizer, groups, activity } = data;
  const displayName = organizer.name ?? organizer.email?.split("@")[0] ?? null;
  const playersIn = groups.filter((g) => !g.session.cancelled).reduce((n, g) => n + g.confirmed, 0);
  const spots = groups.filter((g) => !g.session.cancelled).reduce((n, g) => n + (g.group.cap ?? 0), 0);
  const next = groups.find((g) => !g.session.cancelled) ?? groups[0];
  const others = groups.filter((g) => g !== next);
  const tile = (g: DashboardGroup) => (
    <GroupTile item={g} isNext={g === next} expanded={expanded.has(g.group.slug)} onToggle={() => toggle(g.group.slug)} onShare={share} onChanged={load} />
  );

  return (
    <RevealScrollView
      style={s.page}
      contentContainerStyle={{ alignItems: "center", paddingBottom: 64 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={s.container}>
        {/* Header */}
        {Platform.OS === "web" && (
          <Link href="/" accessibilityLabel="Turnout home page" style={{ alignSelf: "flex-start" }}>
            <Text style={{ color: t.text, fontSize: 22, fontWeight: "900", letterSpacing: -1 }}>
              turnout<Text style={{ color: t.accent }}>.</Text>
            </Text>
          </Link>
        )}
        <View style={s.header}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.hello}>
              {greeting()}
              {displayName ? `, ${displayName}` : ""} 👋
            </Text>
            <Text style={s.date}>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {wide && <Button label="+ New group" onPress={() => router.push("/new")} />}
            <View>
              <Pressable accessibilityRole="button" accessibilityLabel="Account" onPress={() => setMenuOpen((o) => !o)} style={s.avatar}>
                <Text style={{ color: t.accentText, fontWeight: "900", fontSize: 16 }}>{displayName ? displayName[0]!.toUpperCase() : "👤"}</Text>
              </Pressable>
              {menuOpen && (
                <Pop style={s.menu}>
                  {organizer.email && <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={1}>{organizer.email}</Text>}
                  {Platform.OS === "web" && (
                    <Pressable accessibilityRole="link" onPress={() => router.push("/")} style={({ hovered }: { hovered?: boolean }) => [s.menuItem, hovered && { backgroundColor: t.bg }]}>
                      <Text style={{ color: t.text, fontWeight: "700" }}>Home page</Text>
                    </Pressable>
                  )}
                  <Pressable accessibilityRole="button" onPress={doSignOut} style={({ hovered }: { hovered?: boolean }) => [s.menuItem, hovered && { backgroundColor: t.bg }]}>
                    <Text style={{ color: t.danger, fontWeight: "700" }}>Sign out</Text>
                  </Pressable>
                </Pop>
              )}
            </View>
          </View>
        </View>

        {!wide && (
          <View style={{ flexDirection: "row" }}>
            <Button label="+ New group" onPress={() => router.push("/new")} />
          </View>
        )}

        {groups.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* The next game first: what an organizer needs when they open Turnout. */}
            {next && tile(next)}
            {notice && <Text style={{ color: t.accent, fontWeight: "600" }}>{notice}</Text>}

            {others.length > 0 && (
              <View style={{ gap: 10 }}>
                <Text style={s.sectionTitle}>Your other groups</Text>
                {others.map((g, i) => (
                  <Reveal key={g.group.id} delay={i * 80}>
                    {tile(g)}
                  </Reveal>
                ))}
              </View>
            )}

            <Reveal style={{ gap: 12 }}>
              <Text style={s.sectionTitle}>Calendar</Text>
              <CalendarView groups={groups} />
            </Reveal>

            {/* Insights below the operational stuff. */}
            <View style={{ gap: 12 }}>
              <Text style={s.sectionTitle}>Insights</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <Stat label="Groups" value={String(groups.length)} hint="running" />
                <Stat label="Players in this week" value={String(playersIn)} hint={spots ? `of ${spots} spots` : "across your groups"} />
                <Stat label="Fill rate" value={data.stats.fillRate === null ? "–" : `${Math.round(data.stats.fillRate * 100)}%`} hint="past 8 weeks" />
              </View>
            </View>
            <View style={{ flexDirection: wide ? "row" : "column", gap: 24, alignItems: "flex-start" }}>
              <View style={{ flex: wide ? 1.3 : undefined, width: wide ? undefined : "100%", gap: 12 }}>
                <Reveal>
                  <TurnoutChart stats={data.stats} />
                </Reveal>
                <Reveal delay={80}>
                  <Regulars stats={data.stats} />
                </Reveal>
              </View>
              <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : "100%", gap: 12 }}>
                <Text style={s.sectionTitle}>Recent activity</Text>
                <View style={s.card}>
                  {activity.length === 0 ? (
                    <Text style={s.muted}>No RSVPs yet. Share your group link and responses show up here as they come in.</Text>
                  ) : (
                    activity.map((a, i) => <ActivityRow key={`${a.groupSlug}-${a.name}-${a.at}`} item={a} last={i === activity.length - 1} />)
                  )}
                </View>
              </View>
            </View>
          </>
        )}
        {error && <Text style={{ color: t.danger }}>{error}</Text>}
      </View>
    </RevealScrollView>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: boolean }) {
  const t = useTheme();
  const s = styles(t);
  const wide = useWindowDimensions().width >= 900;
  return (
    <View style={[s.card, { flexGrow: 1, flexBasis: wide ? "30%" : "40%", minWidth: 140, gap: 4 }, accent && { borderColor: t.accent, backgroundColor: t.soft }]}>
      <Text style={s.label}>{label}</Text>
      <Text style={{ color: accent ? t.accent : t.text, fontSize: 30, fontWeight: "900", letterSpacing: -1 }}>{value}</Text>
      <Text style={s.muted} numberOfLines={1}>
        {hint}
      </Text>
    </View>
  );
}

function ActivityRow({ item, last }: { item: ActivityItem; last: boolean }) {
  const t = useTheme();
  const s = styles(t);
  const isIn = item.status === "in";
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push({ pathname: "/g/[slug]", params: { slug: item.groupSlug } })}
      style={[{ flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 10 }, !last && { borderBottomWidth: 1, borderColor: t.border }]}
    >
      <View style={[s.dot, { backgroundColor: isIn ? t.accent : t.border }]} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 15 }}>
          <Text style={{ fontWeight: "800" }}>{item.name}</Text> {isIn ? "is in" : "is out"}
        </Text>
        <Text style={[s.muted, { fontSize: 13 }]} numberOfLines={1}>
          {item.groupName}
        </Text>
      </View>
      <Text style={[s.muted, { fontSize: 13 }]}>{timeAgo(item.at)}</Text>
    </Pressable>
  );
}

function EmptyState() {
  const t = useTheme();
  const s = styles(t);
  const steps: [string, ReactNode][] = [
    ["1", "Describe your game in one sentence"],
    ["2", "Share the link in your group chat"],
    ["3", "Watch the headcount fill up live"],
  ];
  return (
    <Reveal>
      <View style={[s.card, { gap: 18, padding: 28, alignItems: "flex-start" }]}>
        <Text style={{ fontSize: 40 }}>🏐</Text>
        <Text style={{ color: t.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.8 }}>Start your first group</Text>
        <Text style={[s.muted, { fontSize: 16 }]}>It takes about a minute. Your players won't need an account or an app.</Text>
        <View style={{ gap: 10 }}>
          {steps.map(([n, text]) => (
            <View key={n} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View style={[s.avatar, { width: 28, height: 28, borderRadius: 14 }]}>
                <Text style={{ color: t.accentText, fontWeight: "900", fontSize: 13 }}>{n}</Text>
              </View>
              <Text style={{ color: t.text, fontSize: 16 }}>{text}</Text>
            </View>
          ))}
        </View>
        <View style={[s.chip, { borderColor: t.border, paddingVertical: 10, paddingHorizontal: 14 }]}>
          <Text style={[s.muted, { fontStyle: "italic" }]}>“Tuesday soccer at Riverside Park, 7:30pm, 14 players”</Text>
        </View>
        <View style={{ flexDirection: "row" }}>
          <Button label="Create a group" onPress={() => router.push("/new")} big />
        </View>
      </View>
    </Reveal>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: t.bg },
    container: { width: "100%", maxWidth: 1100, paddingHorizontal: 16, paddingTop: 20, gap: 20 },
    header: { flexDirection: "row", alignItems: "center", gap: 16, zIndex: 10 },
    hello: { color: t.text, fontSize: 28, fontWeight: "900", letterSpacing: -0.8 },
    date: { color: t.muted, fontSize: 15 },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" },
    menu: {
      position: "absolute", top: 48, right: 0, width: 220, backgroundColor: t.card, borderColor: t.border, borderWidth: 1,
      borderRadius: 14, padding: 12, gap: 8, zIndex: 20, boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
    },
    menuItem: { paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8 },
    sectionTitle: { color: t.text, fontSize: 18, fontWeight: "800" },
    card: { backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 18, padding: 18 },
    label: { color: t.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
    muted: { color: t.muted, fontSize: 14, lineHeight: 20 },
    chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
    track: { height: 8, borderRadius: 4, backgroundColor: t.border, overflow: "hidden" },
    fill: { height: "100%", borderRadius: 4 },
    dot: { width: 10, height: 10, borderRadius: 5 },
  });
