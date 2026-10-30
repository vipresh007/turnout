import { inviteMessage, shareCents, shortWhen, type GroupPage } from "@turnout/shared";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ForecastCard, paidLine, SeasonCard } from "@/components/game/Organizer";
import { Pop } from "@/components/motion";
import { ShareCard } from "@/components/ShareCard";
import { BackLink, Button, IconLine, ListRow, Muted, RowGroup, Screen, Title } from "@/components/ui";
import { shareUrl, trackEvent, useApi } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { useLiveGroup } from "@/lib/live";
import { shareText } from "@/lib/share";
import { useTheme } from "@/lib/theme";

// The organizer's tools for one group, as a sheet over the group page: autopilot, the reminder, the money, and the
// way into every editing screen. The group page itself stays about the game.

export default function ManageScreen() {
  const t = useTheme();
  const api = useApi();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [page, setPage] = useState<GroupPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reminder, setReminder] = useState<{ notified: number; reachable: number; message: string } | null>(null);
  const [focused, setFocused] = useState(false);

  const load = useCallback(() => api.groupPage(slug).then(setPage, (e: Error) => setError(e.message)), [api, slug]);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      load();
      return () => setFocused(false);
    }, [load]),
  );
  useLiveGroup(api, slug, focused, load);

  const run = async (key: string, action: () => Promise<GroupPage>) => {
    setPending(key);
    setError(null);
    try {
      setPage(await action());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(null);
    }
  };
  const share = async (message: string) => {
    if (await shareText(message)) {
      setNotice("Copied to clipboard");
      setTimeout(() => setNotice(null), 2000);
    }
  };

  if (!page) {
    return <Screen>{error ? <Text style={{ color: t.danger }}>{error}</Text> : <ActivityIndicator style={{ marginTop: 48 }} />}</Screen>;
  }
  const { group, session, roster, viewer } = page;
  if (!viewer.isOrganizer) {
    return <Screen><Muted>Only organizers can manage this group.</Muted></Screen>;
  }
  const link = shareUrl(slug);
  const paidSet = new Set(page.organizer?.paid ?? []);
  const shareInput = {
    name: group.name, activity: group.activity, location: session.location ?? group.location, timezone: group.timezone, cap: group.cap, targetPlayers: group.targetPlayers,
    startsAt: session.startsAt, confirmed: roster.confirmed.length, cancelled: session.cancelled, link,
    feeCents: group.feeCents, feeSplit: group.feeSplit, dropIn: !!page.season,
  };
  const go = (pathname: "/edit/[slug]" | "/schedule/[slug]" | "/members/[slug]" | "/teams/[slug]" | "/insights/[slug]" | "/history/[slug]" | "/organizers/[slug]") =>
    () => router.push({ pathname, params: { slug } });

  return (
    <Screen>
      <Stack.Screen options={{ title: "Manage" }} />
      <BackLink fallback={{ pathname: "/g/[slug]", params: { slug } }} label={group.name} />
      <View style={{ gap: 4 }}>
        <Title>Manage</Title>
        <Muted>{group.name}</Muted>
      </View>

      <ForecastCard page={page} onAsk={(name) => {
        trackEvent("invite_asked", slug, { status: page.organizer?.forecast?.status ?? "none", from: "manage" });
        share(inviteMessage(name.split(" ")[0]!, group.name, page.organizer?.forecast?.short || roster.spotsLeft, shortWhen(session.startsAt, group.timezone), link));
      }} />

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          label="Remind everyone"
          icon="bell"
          loading={pending === "remind"}
          disabled={session.cancelled}
          onPress={async () => {
            setPending("remind");
            setError(null);
            try {
              setReminder(await api.remind(slug));
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setPending(null);
            }
          }}
        />
        <Button label="Teams" icon="teams" variant="secondary" disabled={roster.confirmed.length < 2} onPress={go("/teams/[slug]")} />
      </View>
      {reminder && (
        <Pop style={{ gap: 8 }}>
          <Text style={{ color: t.text, fontWeight: "700" }}>
            {reminder.reachable === 0
              ? "Nobody has turned on reminders yet, so post this in your group chat:"
              : reminder.notified > 0
                ? `Notified ${reminder.notified} of ${reminder.reachable} players with reminders on. Post this for everyone else:`
                : "Reminders already went out in the last hour. You can still post this:"}
          </Text>
          <View style={{ backgroundColor: t.surface2, borderRadius: 10, padding: 12 }}>
            <Text style={{ color: t.muted }}>{reminder.message}</Text>
          </View>
          <View style={{ flexDirection: "row" }}>
            <Button label="Share to group chat" onPress={() => share(reminder.message)} />
          </View>
        </Pop>
      )}
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
      {notice && <Muted>{notice}</Muted>}

      <RowGroup>
        <ListRow first icon="edit" title="Edit group" subtitle="Name, schedule, spots, cost" onPress={go("/edit/[slug]")} />
        <ListRow icon="calendar" title="Schedule" subtitle="Skip, move or cancel a week" onPress={go("/schedule/[slug]")} />
        <ListRow icon="people" title="Members" subtitle="Add players, merge duplicates, season members" onPress={go("/members/[slug]")} />
        <ListRow icon="chart" title="Insights" subtitle="Turnout, best times, who you can count on" onPress={go("/insights/[slug]")} />
        <ListRow icon="clock" title="History" subtitle="Past games, drops and payments" onPress={go("/history/[slug]")} />
        <ListRow last icon="key" title="Organizers" subtitle="Invite a co-organizer or hand over" onPress={go("/organizers/[slug]")} />
      </RowGroup>

      {page.season && <SeasonCard page={page} onShare={share} onChanged={() => void load()} />}
      {roster.confirmed.length > 0 && !page.season && (!!group.feeCents || group.feeSplit) && (
        <IconLine icon="cash">{paidLine(roster.confirmed.filter((r) => paidSet.has(r.memberId)).length, roster.confirmed.length, shareCents(group, roster.confirmed.length))}</IconLine>
      )}

      <ShareCard input={shareInput} title="Invite people" />

      <Pressable
        accessibilityRole="button"
        disabled={pending === "cancel"}
        onPress={async () => {
          if (session.cancelled || (await confirm("Cancel this week?", "Everyone will see the game is off. You can restore it any time.", "Cancel week"))) {
            await run("cancel", () => api.setCancelled(slug, !session.cancelled));
          }
        }}
        style={({ hovered }: { hovered?: boolean }) => ({ alignSelf: "center", paddingVertical: 6, opacity: hovered ? 0.7 : 1 })}
      >
        <Text style={{ color: session.cancelled ? t.accent : t.danger, fontWeight: "700" }}>
          {pending === "cancel" ? "…" : session.cancelled ? "Restore this week's game" : "Cancel this week's game"}
        </Text>
      </Pressable>
    </Screen>
  );
}
