import { placeOf, type GroupPage } from "@turnout/shared";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ApiError, memberships, useApi } from "@/lib/api";
import { relativeDay, sessionWhen } from "@/lib/format";
import { useTheme } from "@/lib/theme";

type Game = { slug: string; page: GroupPage; memberId: string };

/**
 * Groups this phone has joined (players have no account), each with this week's game and your answer.
 * With a `title` (organizer Home), groups in `exclude` are left out and nothing renders when none are left.
 */
export function YourGames({ title, exclude = [] }: { title?: string; exclude?: string[] } = {}) {
  const t = useTheme();
  const api = useApi();
  const [games, setGames] = useState<Game[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        const found = await Promise.all(
          (await memberships.slugs()).map(async (slug): Promise<Game | null> => {
            const me = await memberships.get(slug);
            if (!me) return null;
            try {
              return { slug, page: await api.groupPage(slug), memberId: me.memberId };
            } catch (e) {
              if (e instanceof ApiError && e.status === 404) await memberships.forget(slug); // group was deleted
              return null;
            }
          }),
        );
        if (live) setGames(found.filter((g): g is Game => g !== null));
      })();
      return () => {
        live = false;
      };
    }, [api]),
  );

  if (!games) return title ? null : <ActivityIndicator style={{ marginTop: 24 }} />;
  const shown = games.filter((g) => !exclude.includes(g.slug));
  if (title && shown.length === 0) return null;
  return (
    <View style={{ gap: 12 }}>
      {title && <Text style={{ color: t.text, fontSize: 18, fontWeight: "800" }}>{title}</Text>}
      {shown.map(({ slug, page, memberId }) => {
        const { group, session, roster } = page;
        const place = placeOf(roster, memberId);
        const answer = session.cancelled
          ? { text: "No game this week", color: t.danger }
          : place.kind === "confirmed"
            ? { text: "✅ You're in", color: t.accent }
            : place.kind === "waitlist"
              ? { text: `⏳ Waitlist #${place.position}`, color: t.waitlist }
              : place.kind === "out"
                ? { text: "❌ You're out", color: t.muted }
                : { text: "Tap to answer", color: t.waitlist };
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
              <Text style={{ color: answer.color, fontWeight: "800" }}>{answer.text}</Text>
              {!session.cancelled && (
                <Text style={{ color: t.muted, fontWeight: "700" }}>
                  {roster.confirmed.length}{goal ? ` / ${goal}` : ""} in
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
