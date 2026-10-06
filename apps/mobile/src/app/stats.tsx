import { combinePlayerStats, type GroupPage, type MyPlayerStats } from "@turnout/shared";
import { router, useFocusEffect } from "expo-router";
import Head from "expo-router/head";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { GameDots, StatsStrip } from "@/components/PlayerStats";
import { BackLink, Button, Card, Eyebrow, Muted, Screen, SectionTitle } from "@/components/ui";
import { useAccount } from "@/lib/account";
import { memberships, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { confirm } from "@/lib/confirm";
import { useTheme } from "@/lib/theme";

type Entry = { slug: string; memberId: string; name: string; page: GroupPage; mine: MyPlayerStats };

/**
 * Your own record as a player, across every group on this device (and, signed in, every device). Private to you:
 * organizers see attendance only for their own group.
 */
export default function StatsScreen() {
  const t = useTheme();
  const api = useApi();
  const { status } = useAuth();
  const account = useAccount();
  const [entries, setEntries] = useState<Entry[] | null>(null);

  const load = useCallback(async () => {
    const found = await Promise.all(
      (await memberships.slugs()).map(async (slug): Promise<Entry | null> => {
        const m = await memberships.get(slug);
        if (!m) return null;
        try {
          const [page, mine] = await Promise.all([api.groupPage(slug), api.memberStats(slug, m.token)]);
          return { slug, memberId: m.memberId, name: m.name, page, mine };
        } catch {
          return null;
        }
      }),
    );
    setEntries(found.filter((e): e is Entry => e !== null));
  }, [api]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const total = entries ? combinePlayerStats(entries.map((e) => e.mine.stats)) : null;
  const signedIn = status === "signedIn";

  return (
    <Screen>
      <Head>
        <title>Your stats · Turnout</title>
      </Head>
      <BackLink fallback="/" />
      <View style={{ gap: 4 }}>
        <Text style={{ color: t.text, fontSize: 28, fontWeight: "900", letterSpacing: -0.8 }}>Your stats</Text>
        <Muted>Only you see this. Organizers see attendance for their own group, nothing else.</Muted>
      </View>

      {!entries ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : entries.length === 0 ? (
        <Card>
          <SectionTitle icon="chart">No games yet</SectionTitle>
          <Muted>Open your group's link from the organizer and tap I'm in. Your games and streaks show up here.</Muted>
        </Card>
      ) : (
        <>
          <Card>
            <Eyebrow>All your groups</Eyebrow>
            <StatsStrip stats={total!} />
            {total!.unpaid > 0 && <Text style={{ color: t.waitlist, fontWeight: "700" }}>{total!.unpaid} {total!.unpaid === 1 ? "game" : "games"} not marked paid yet</Text>}
          </Card>
          {entries.map((e) => (
            <Card key={e.slug}>
              <SectionTitle
                right={
                  <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: "/g/[slug]", params: { slug: e.slug } })} hitSlop={8} style={({ hovered }: { hovered?: boolean }) => ({ opacity: hovered ? 0.7 : 1 })}>
                    <Text style={{ color: t.accent, fontWeight: "700" }}>Open</Text>
                  </Pressable>
                }
              >
                {e.page.group.name}
              </SectionTitle>
              <Text style={{ color: t.muted, marginTop: -6 }}>as {e.name}</Text>
              <StatsStrip stats={e.mine.stats} />
              <GameDots games={e.mine.recent} />
              {e.mine.stats.lateDrops > 0 && <Text style={{ color: t.muted, fontSize: 13 }}>{e.mine.stats.lateDrops} late {e.mine.stats.lateDrops === 1 ? "drop" : "drops"} (said out close to game time)</Text>}
              {signedIn && (
                <Pressable
                  accessibilityRole="button"
                  onPress={async () => {
                    if (!(await confirm("Remove this group?", `"${e.name}" in ${e.page.group.name} will come off your account and this device. Your games stay in the group.`, "Remove"))) return;
                    await api.unlinkMembership(e.memberId).catch(() => {});
                    await memberships.forget(e.slug);
                    await load();
                  }}
                  style={({ hovered }: { hovered?: boolean }) => ({ alignSelf: "flex-start", opacity: hovered ? 0.7 : 1 })}
                >
                  <Text style={{ color: t.muted, fontSize: 13 }}>Not you? Remove</Text>
                </Pressable>
              )}
            </Card>
          ))}
        </>
      )}

      {entries && entries.length > 0 && (
        signedIn ? (
          <Muted>Synced with your Turnout account{account?.email ? ` (${account.email})` : ""}, so these follow you to any phone or the website.</Muted>
        ) : (
          <Card>
            <SectionTitle icon="user">Keep these on every device</SectionTitle>
            <Muted>Sign in (optional) and your games, stats and streaks follow you to a new phone or the website. Nothing changes for your group.</Muted>
            <View style={{ flexDirection: "row" }}>
              <Button label="Sign in" onPress={() => router.push({ pathname: "/sign-in", params: { next: "/stats" } })} />
            </View>
          </Card>
        )
      )}
    </Screen>
  );
}
