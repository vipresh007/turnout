import { ASK_WINDOW_HOURS, badges, groupShareMessage, inviteMessage, newlyEarned, placeOf, playerGoal, playersNeeded, shortWhen, type Badge, type GroupPage, type MyPlayerStats, type Rsvp, type RsvpStatus } from "@turnout/shared";
import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { GameHeader } from "@/components/game/GameHeader";
import { Headcount, type IdentityStep } from "@/components/game/Headcount";
import { ManageBar, MANAGE_BAR_HEIGHT } from "@/components/game/ManageBar";
import { Rosters } from "@/components/game/Rosters";
import { FindSub, InviteFriend, SignInAsk } from "@/components/game/PlayerExtras";
import { RecapCard } from "@/components/game/RecapCard";
import { Teams } from "@/components/game/Teams";
import { BadgeEarned, BadgeRow } from "@/components/Badges";
import { statsLine } from "@/components/PlayerStats";
import { ReadyCard } from "@/components/ReadyCard";
import { ReportAndLeave } from "@/components/ReportAndLeave";
import { Card, ListRow, Muted, RowGroup, Screen, SectionHeader } from "@/components/ui";
import { ApiError, memberships, NameTakenError, shareUrl, trackEvent, type Membership, useApi } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { hoursUntil } from "@/lib/format";
import { useLiveGroup } from "@/lib/live";
import { shareText } from "@/lib/share";
import { useTheme } from "@/lib/theme";

// A group's page: the game, the count, In/Out, then who's in. Organizer tools live in the bar at the bottom and the
// Manage sheet; a player's extras (reminders, stats, report) are rows below the rosters.

export default function GroupScreen() {
  const t = useTheme();
  const api = useApi();
  const { slug, created, rsvp, from } = useLocalSearchParams<{ slug: string; created?: string; rsvp?: string; from?: string }>();
  // Opened from a reminder, spot alert or "you're in" notification: count it once.
  useEffect(() => {
    if (from) trackEvent("reminder_opened", slug, { from, action: rsvp ?? "open" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per page open
  }, []);
  const [page, setPage] = useState<GroupPage | null>(null);
  const [me, setMe] = useState<Membership | null>(null);
  const [name, setName] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [mine, setMine] = useState<MyPlayerStats | null>(null);
  // Joining with a name that's taken: ask "is that you?" before creating a second one.
  const [nameTaken, setNameTaken] = useState<{ existing: NameTakenError["existing"]; status: RsvpStatus } | null>(null);
  const [identityStep, setIdentityStep] = useState<IdentityStep>("ask");

  const load = useCallback(() => {
    api.groupPage(slug).then(setPage, (e: Error) => setError(e.message));
  }, [api, slug]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      load();
      memberships.get(slug).then((m) => {
        setMe(m);
        if (m) memberships.set(slug, m); // keeps "Your games" in the app in recently-opened order
      });
      return () => setFocused(false);
    }, [load, slug]),
  );
  useLiveGroup(api, slug, focused, load);
  // Your record here, refreshed when the roster changes; a badge earned by this tap pops up once.
  const [earned, setEarned] = useState<Badge[]>([]);
  useEffect(() => {
    if (!me) return;
    api.memberStats(slug, me.token).then((next) => {
      setMine((prev) => {
        if (prev) setEarned(newlyEarned(prev.stats, next.stats));
        return next;
      });
    }, () => {});
  }, [api, slug, me, page?.roster.confirmed.length]);

  const run = async (key: string, action: () => Promise<GroupPage>) => {
    setPending(key);
    setError(null);
    try {
      setPage(await action());
    } catch (e) {
      if (!(e instanceof NameTakenError)) setError((e as Error).message); // shown as the "is that you?" prompt instead
    } finally {
      setPending(null);
    }
  };

  /** Take over a player the organizer added, then answer if they were answering. */
  const claimAs = (memberId: string, status?: RsvpStatus) =>
    run(status ?? "claim", async () => {
      const membership = await api.claim(slug, memberId);
      setNameTaken(null);
      setMe(membership);
      return status ? api.rsvp(slug, membership.token, status) : api.groupPage(slug);
    });

  const respond = (status: RsvpStatus, joinAs?: { name: string; confirmNew: boolean }) =>
    run(status, async () => {
      let membership = me;
      if (!membership) {
        try {
          membership = await api.join(slug, joinAs?.name ?? name, joinAs?.confirmNew ?? false);
        } catch (e) {
          if (e instanceof NameTakenError) {
            setNameTaken({ existing: e.existing, status });
            setIdentityStep("ask");
          }
          throw e;
        }
        setNameTaken(null);
      }
      setMe(membership);
      try {
        return await api.rsvp(slug, membership.token, status);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          // The organizer removed this member; let them join again under a name.
          await memberships.forget(slug);
          setMe(null);
          throw new Error("You were removed from this group. Enter your name to join again.");
        }
        throw e;
      }
    });

  // "I'm in" / "I'm out" tapped on a notification opens the page with ?rsvp=in|out.
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current || !me || (rsvp !== "in" && rsvp !== "out")) return;
    applied.current = true;
    respond(rsvp);
    router.setParams({ rsvp: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when the membership is known
  }, [me, rsvp]);

  const share = async (message: string) => {
    if (await shareText(message)) {
      setNotice("Copied to clipboard");
      setTimeout(() => setNotice(null), 2000);
    }
  };

  if (!page) {
    return <Screen signInLabel="Organizer? Sign in">{error ? <Text style={{ color: t.danger }}>{error}</Text> : <ActivityIndicator style={{ marginTop: 48 }} />}</Screen>;
  }

  const { group, session, roster, viewer } = page;
  const link = shareUrl(slug);
  const place = me ? placeOf(roster, me.memberId) : { kind: "none" as const };
  const shareInput = {
    name: group.name, activity: group.activity, location: session.location ?? group.location, timezone: group.timezone, cap: group.cap, targetPlayers: group.targetPlayers,
    startsAt: session.startsAt, confirmed: roster.confirmed.length, cancelled: session.cancelled, link,
    feeCents: group.feeCents, feeSplit: group.feeSplit, dropIn: !!page.season,
  };
  const goal = playerGoal(group);
  const needed = group.cap ? roster.spotsLeft : playersNeeded(group, roster.confirmed.length);
  // Season groups: members paid up front, so only subs pay per game.
  const seasonMembers = page.season ? new Set(page.season.memberIds) : null;
  const paidSet = viewer.isOrganizer ? new Set(page.organizer?.paid ?? []) : undefined;
  const onTogglePaid = viewer.isOrganizer && (!seasonMembers || group.feeCents)
    ? (p: Rsvp) => run(`paid:${p.memberId}`, () => api.setPaid(slug, p.memberId, !paidSet!.has(p.memberId)))
    : undefined;
  const onRemove = viewer.isOrganizer
    ? async (p: Rsvp) => {
        if (await confirm(`Remove ${p.name}?`, "They'll be taken off this week's list and will need the link to join again.")) {
          await run(`remove:${p.memberId}`, () => api.removeMember(slug, p.memberId));
        }
      }
    : undefined;
  const everyone = [...roster.confirmed, ...roster.waitlist, ...roster.out];
  const myStats = mine && mine.stats.games > 0 ? statsLine(mine.stats) : null;
  const hasBadges = !!mine && badges(mine.stats).some((b) => b.earned);
  const player = !!me && !viewer.isOrganizer;
  // A player who's in can look for a sub when the game is short and close.
  const canFindSub = player && place.kind === "confirmed" && needed > 0 && !session.cancelled && hoursUntil(session.startsAt) > 0 && hoursUntil(session.startsAt) <= ASK_WINDOW_HOURS;

  return (
    <View style={{ flex: 1 }}>
      <Screen signInLabel="Organizer? Sign in" bottomInset={viewer.isOrganizer ? MANAGE_BAR_HEIGHT + 24 : 0}>
        {/* The page already shows the name large; the nav bar only needs the back arrow. */}
        <Stack.Screen options={{ title: group.name, headerTitle: "", headerShown: Platform.OS !== "web" }} />

        {created && viewer.isOrganizer && <ReadyCard page={page} shareInput={shareInput} onDone={() => router.setParams({ created: undefined })} />}

        <GameHeader page={page} slug={slug} />

        <Headcount
          page={page}
          me={me}
          place={place}
          goal={goal}
          needed={needed}
          name={name}
          onName={setName}
          pending={pending}
          nameTaken={nameTaken}
          identityStep={identityStep}
          onThatsMe={async () => {
            if (!nameTaken) return;
            // Added by the organizer and never opened on a phone: it's theirs to claim.
            if (nameTaken.existing.claimable) return claimAs(nameTaken.existing.id, nameTaken.status);
            if (!nameTaken.existing.hasEmail) return setIdentityStep("noEmail");
            const { sent } = await api.requestRestore(slug, nameTaken.existing.id);
            setIdentityStep(sent ? "emailSent" : "noEmail");
          }}
          onSomeoneElse={() => setIdentityStep("someoneElse")}
          onJoinAs={(newName) => nameTaken && respond(nameTaken.status, { name: newName, confirmNew: true })}
          onClaim={(id) => claimAs(id)}
          onRespond={(status) => respond(status)}
          shareInput={shareInput}
          shortShare={!canFindSub}
        />
        {error && <Text style={{ color: t.danger }}>{error}</Text>}
        {notice && <Muted>{notice}</Muted>}
        {earned.map((b) => <BadgeEarned key={b.id} badge={b} />)}
        {canFindSub && <View style={{ flexDirection: "row" }}><FindSub input={shareInput} needed={needed} /></View>}
        {player && <SignInAsk stats={mine?.stats ?? null} slug={slug} />}

        <RecapCard page={page} me={me} slug={slug} />

        {session.teams && <Teams teams={session.teams.teams} roster={everyone} onShare={share} groupName={group.name} />}

        <Rosters
          roster={roster}
          organizer={viewer.isOrganizer}
          onRemove={onRemove}
          paid={paidSet}
          onTogglePaid={onTogglePaid}
          lateDrops={viewer.isOrganizer ? new Set(page.organizer?.lateDrops ?? []) : undefined}
          seasonMembers={seasonMembers}
        />

        {me && hasBadges && mine && (
          <Card>
            <SectionHeader icon="trophy" tone={t.energy} title="Your badges" />
            <BadgeRow stats={mine.stats} />
          </Card>
        )}
        {me && (
          <RowGroup>
            {!session.cancelled && place.kind !== "out" && (
              <ListRow first icon="bell" title="Reminders" subtitle="A nudge before each game, by notification or email" onPress={() => router.push({ pathname: "/remind/[slug]", params: { slug } })} />
            )}
            <ListRow
              first={session.cancelled || place.kind === "out"}
              last={!(player && !session.cancelled)}
              icon="trending"
              title="Your stats"
              subtitle={myStats ?? "Games played, attendance and streaks, once you've played"}
              onPress={() => router.push("/stats")}
            />
            {player && !session.cancelled && <InviteFriend input={shareInput} last />}
          </RowGroup>
        )}

        <ReportAndLeave slug={slug} me={me} people={everyone.map((r) => ({ id: r.memberId, name: r.name })).filter((p) => p.id !== me?.memberId)} />

        {!viewer.isOrganizer && (
          <View style={{ alignItems: "center", marginTop: 16 }}>
            <Link href="/new">
              <Text style={{ color: t.muted }}>
                Run a weekly game? <Text style={{ color: t.accent, fontWeight: "700" }}>Start your own group on Turnout</Text>
              </Text>
            </Link>
          </View>
        )}
      </Screen>

      {viewer.isOrganizer && !page.seasonOver && (
        <ManageBar
          page={page}
          slug={slug}
          remindBusy={pending === "remind"}
          onAsk={(who) => {
            trackEvent("invite_asked", slug, { status: page.organizer?.forecast?.status ?? "none", from: "group" });
            share(inviteMessage(who.split(" ")[0]!, group.name, page.organizer?.forecast?.short || roster.spotsLeft, shortWhen(session.startsAt, group.timezone), link));
          }}
          onRemind={() => router.push({ pathname: "/manage/[slug]", params: { slug } })}
          onShare={() => {
            trackEvent("link_shared", slug, { via: "share", from: "bar" });
            share(groupShareMessage(shareInput));
          }}
        />
      )}
    </View>
  );
}
