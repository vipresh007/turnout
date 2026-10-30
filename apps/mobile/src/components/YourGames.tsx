import { placeOf, type GroupPage, type PlayerStats } from "@turnout/shared";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ApiError, memberships, onMembershipsChanged, useApi } from "@/lib/api";
import { relativeDay, sessionWhen } from "@/lib/format";
import { sportTone, tint, useTheme } from "@/lib/theme";
import { Icon } from "./Icon";
import { statsLine } from "./PlayerStats";
import { Display, Pill, ProgressBar } from "./ui";

type Game = { slug: string; page: GroupPage; memberId: string; stats: PlayerStats | null };

/**
 * Groups this phone has joined (players have no account), each with this week's game and your answer.
 * With a `title` (organizer Home), groups in `exclude` are left out and nothing renders when none are left.
 */
export function YourGames({ title, exclude = [], onEmpty, onLoaded }: { title?: string; exclude?: string[]; onEmpty?: () => void; onLoaded?: (stats: PlayerStats[]) => void } = {}) {
  const t = useTheme();
  const api = useApi();
  const [games, setGames] = useState<Game[] | null>(null);
  // Callers pass inline callbacks; keep them in refs so `load` stays stable and a load never triggers another load.
  const onEmptyRef = useRef(onEmpty);
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onEmptyRef.current = onEmpty;
    onLoadedRef.current = onLoaded;
  });
  const load = useCallback(async () => {
    const found = await Promise.all(
      (await memberships.slugs()).map(async (slug): Promise<Game | null> => {
        const me = await memberships.get(slug);
        if (!me) {
          await memberships.forget(slug); // listed without its saved entry: tidy it away
          return null;
        }
        try {
          const [page, mine] = await Promise.all([api.groupPage(slug), api.memberStats(slug, me.token).catch(() => null)]);
          return { slug, page, memberId: me.memberId, stats: mine?.stats ?? null };
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) await memberships.forget(slug); // group was deleted
          return null;
        }
      }),
    );
    const games = found.filter((g): g is Game => g !== null);
    setGames(games);
    if (games.length === 0) onEmptyRef.current?.();
    onLoadedRef.current?.(games.map((g) => g.stats).filter((s): s is PlayerStats => !!s));
  }, [api]);
  useFocusEffect(useCallback(() => void load(), [load]));
  useEffect(() => onMembershipsChanged(() => void load()), [load]); // games arriving from your account

  if (!games) return title ? null : <ActivityIndicator style={{ marginTop: 24 }} />;
  const shown = games.filter((g) => !exclude.includes(g.slug));
  if (title && shown.length === 0) return null;
  if (shown.length === 0) return <Text style={{ color: t.muted, fontSize: 15 }}>Couldn't load your games right now. Check your connection and try again.</Text>;
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
              ? { label: `Waitlist #${place.position}`, color: t.energy, icon: "hourglass" as const }
              : place.kind === "out"
                ? { label: "You're out", color: t.muted, icon: "x" as const }
                : { label: "Tap to answer", color: t.energy, icon: "arrowRight" as const };
        const goal = group.cap ?? group.targetPlayers;
        return (
          <Pressable
            key={slug}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/g/[slug]", params: { slug } })}
            style={({ pressed }) => ({ backgroundColor: t.card, borderColor: place.kind === "none" && !session.cancelled ? tint(t.energy, 0.5) : t.border, borderWidth: 1, borderRadius: 18, padding: 16, gap: 6, transform: [{ scale: pressed ? 0.98 : 1 }] })}
          >
            <Text style={{ color: sportTone(group.activity, t), fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
              {relativeDay(session.startsAt, group.timezone)}
            </Text>
            <Display level="h1" style={{ fontSize: 20, lineHeight: 24 }}>{group.name}</Display>
            <Text style={{ color: t.muted }}>
              {sessionWhen(session.startsAt, group.durationMinutes, group.timezone)}
              {(session.location ?? group.location) ? ` · ${session.location ?? group.location}` : ""}
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <Pill {...answer} />
              {!session.cancelled && (
                <View style={{ alignItems: "flex-end", gap: 4, width: 80 }}>
                  <Text style={{ color: t.muted, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                    {roster.confirmed.length}{goal ? ` / ${goal}` : ""} in
                  </Text>
                  {goal ? <ProgressBar value={roster.confirmed.length} max={goal} height={4} tone={roster.confirmed.length >= goal ? t.accent : t.energy} /> : null}
                </View>
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
