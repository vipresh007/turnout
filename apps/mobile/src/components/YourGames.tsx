import { placeOf, type GroupPage, type PlayerStats } from "@turnout/shared";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ApiError, memberships, onMembershipsChanged, useApi } from "@/lib/api";
import { relativeDay, sessionWhen } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { Icon } from "./Icon";
import { statsLine } from "./PlayerStats";
import { Pill } from "./ui";

type Game = { slug: string; page: GroupPage; memberId: string; stats: PlayerStats | null };

/**
 * Groups this phone has joined (players have no account), each with this week's game and your answer.
 * With a `title` (organizer Home), groups in `exclude` are left out and nothing renders when none are left.
 */
export function YourGames({ title, exclude = [] }: { title?: string; exclude?: string[] } = {}) {
  const t = useTheme();
  const api = useApi();
  const [games, setGames] = useState<Game[] | null>(null);
  const load = useCallback(async () => {
    const found = await Promise.all(
      (await memberships.slugs()).map(async (slug): Promise<Game | null> => {
        const me = await memberships.get(slug);
        if (!me) return null;
        try {
          const [page, mine] = await Promise.all([api.groupPage(slug), api.memberStats(slug, me.token).catch(() => null)]);
          return { slug, page, memberId: me.memberId, stats: mine?.stats ?? null };
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) await memberships.forget(slug); // group was deleted
          return null;
        }
      }),
    );
    setGames(found.filter((g): g is Game => g !== null));
  }, [api]);
  useFocusEffect(useCallback(() => void load(), [load]));
  useEffect(() => onMembershipsChanged(() => void load()), [load]); // games arriving from your account

  if (!games) return title ? null : <ActivityIndicator style={{ marginTop: 24 }} />;
  const shown = games.filter((g) => !exclude.includes(g.slug));
  if (title && shown.length === 0) return null;
  return (
    <View style={{ gap: 12 }}>
      {title && (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: t.text, fontSize: 18, fontWeight: "800" }}>{title}</Text>
          <StatsLink />
        </View>
      )}
      {shown.map(({ slug, page, memberId, stats }) => {
        const { group, session, roster } = page;
        const place = placeOf(roster, memberId);
        const answer = session.cancelled
          ? { label: "No game this week", color: t.danger, icon: "x" as const }
          : place.kind === "confirmed"
            ? { label: "You're in", color: t.accent, icon: "check" as const }
            : place.kind === "waitlist"
              ? { label: `Waitlist #${place.position}`, color: t.waitlist, icon: "hourglass" as const }
              : place.kind === "out"
                ? { label: "You're out", color: t.muted, icon: "x" as const }
                : { label: "Tap to answer", color: t.waitlist, icon: "arrowRight" as const };
        const goal = group.cap ?? group.targetPlayers;
        return (
          <Pressable
            key={slug}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/g/[slug]", params: { slug } })}
            style={({ pressed }) => ({ backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 18, padding: 16, gap: 6, transform: [{ scale: pressed ? 0.98 : 1 }] })}
          >
            <Text style={{ color: t.accent, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
              {relativeDay(session.startsAt, group.timezone)}
            </Text>
            <Text style={{ color: t.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.3 }}>{group.name}</Text>
            <Text style={{ color: t.muted }}>
              {sessionWhen(session.startsAt, group.durationMinutes, group.timezone)}
              {(session.location ?? group.location) ? ` · ${session.location ?? group.location}` : ""}
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <Pill {...answer} />
              {!session.cancelled && (
                <Text style={{ color: t.muted, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                  {roster.confirmed.length}{goal ? ` / ${goal}` : ""} in
                </Text>
              )}
            </View>
            {stats && statsLine(stats) && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, borderColor: t.border, paddingTop: 10, marginTop: 4 }}>
                <Icon name="trending" size={15} color={t.muted} />
                <Text style={{ color: t.muted, fontSize: 13 }}>{statsLine(stats)}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/** "Your stats ›", next to a list of your games. */
export function StatsLink({ label = "Your stats" }: { label?: string }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="link" onPress={() => router.push("/stats")} hitSlop={8} style={({ hovered }: { hovered?: boolean }) => ({ flexDirection: "row", alignItems: "center", gap: 4, opacity: hovered ? 0.7 : 1 })}>
      <Text style={{ color: t.accent, fontWeight: "700" }}>{label}</Text>
      <Icon name="arrowRight" size={15} color={t.accent} strokeWidth={2.2} />
    </Pressable>
  );
}
