import { ASK_WINDOW_HOURS, describeCost, describeForecast, describeRecurrence, formatMoney, inviteMessage, LATE_WARNING_HOURS, placeOf, playerGoal, playersNeeded, shareCents, shortWhen, teamNames, teamsText, type GroupPage, type Rsvp, type RsvpStatus } from "@turnout/shared";
import * as Haptics from "expo-haptics";
import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from "react-native";
import { ActionGrid, ActionTile } from "@/components/ActionTile";
import { Bump, Pop } from "@/components/motion";
import { Avatar } from "@/components/Avatar";
import { RemindMe } from "@/components/RemindMe";
import { ReadyCard } from "@/components/ReadyCard";
import { ShareCard } from "@/components/ShareCard";
import { Button, Card, Field, Muted, Screen, Title, webTransition } from "@/components/ui";
import { ApiError, calendarUrl, memberships, NameTakenError, shareUrl, trackEvent, type Membership, useApi } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { hoursUntil, mapsUrl, relativeDay, sessionWhen } from "@/lib/format";
import { useLiveGroup } from "@/lib/live";
import { shareText } from "@/lib/share";
import { useTheme } from "@/lib/theme";

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
  const [reminder, setReminder] = useState<{ notified: number; reachable: number; message: string } | null>(null);
  // Joining with a name that's taken: ask "is that you?" before creating a second one.
  const [nameTaken, setNameTaken] = useState<{ existing: NameTakenError["existing"]; status: RsvpStatus } | null>(null);
  const [identityStep, setIdentityStep] = useState<"ask" | "someoneElse" | "emailSent" | "noEmail">("ask");

  const load = useCallback(() => {
    api.groupPage(slug).then(setPage, (e: Error) => setError(e.message));
  }, [api, slug]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      load();
      memberships.get(slug).then(setMe);
      return () => setFocused(false);
    }, [load, slug]),
  );
  useLiveGroup(api, slug, focused, load);

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
  const where = session.location ?? group.location;
  const moved = session.startsAt !== session.scheduledAt;
  const shareInput = {
    name: group.name, activity: group.activity, location: where, timezone: group.timezone, cap: group.cap, targetPlayers: group.targetPlayers,
    startsAt: session.startsAt, confirmed: roster.confirmed.length, cancelled: session.cancelled, link,
    feeCents: group.feeCents, feeSplit: group.feeSplit, dropIn: !!page.season,
  };
  const goal = playerGoal(group);
  const needed = group.cap ? roster.spotsLeft : playersNeeded(group, roster.confirmed.length);
  // Season groups: members paid up front, so only subs pay per game.
  const seasonMembers = page.season ? new Set(page.season.memberIds) : null;
  const needsName = !me && name.trim().length === 0;
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

  return (
    <Screen signInLabel="Organizer? Sign in">
      <Stack.Screen options={{ title: group.name, headerShown: Platform.OS !== "web" }} />

      {created && viewer.isOrganizer && <ReadyCard page={page} shareInput={shareInput} onDone={() => router.setParams({ created: undefined })} />}

      <View style={{ gap: 4 }}>
        <Title>{group.name}</Title>
        <Text style={{ color: t.muted, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>{describeRecurrence(group)}</Text>
        <Text style={{ color: t.text, fontSize: 16, fontWeight: "600" }}>
          {sessionWhen(session.startsAt, group.durationMinutes, group.timezone)}
          <Text style={{ color: t.accent }}> · {relativeDay(session.startsAt, group.timezone)}</Text>
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 2 }}>
          {where && (
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(mapsUrl(where))} hitSlop={6} style={({ hovered }: { hovered?: boolean }) => ({ opacity: hovered ? 0.7 : 1 })}>
              <Text style={{ color: t.muted }}>📍 <Text style={{ textDecorationLine: "underline" }}>{where}</Text></Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(calendarUrl(slug))} hitSlop={6} style={({ hovered }: { hovered?: boolean }) => ({ opacity: hovered ? 0.7 : 1 })}>
            <Text style={{ color: t.muted }}>📅 <Text style={{ textDecorationLine: "underline" }}>Add to calendar</Text></Text>
          </Pressable>
        </View>
      </View>

      {!session.cancelled && (moved || session.location || session.note) && (
        <View style={{ backgroundColor: t.soft, borderColor: t.waitlist, borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 }}>
          <Text style={{ color: t.text, fontWeight: "800" }}>⚠️ Change for this week</Text>
          {moved && <Text style={{ color: t.text }}>New time: {new Date(session.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: group.timezone })} (usually {new Date(session.scheduledAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: group.timezone })})</Text>}
          {session.location && <Text style={{ color: t.text }}>Place: {session.location}</Text>}
          {session.note && <Text style={{ color: t.muted }}>“{session.note}”</Text>}
        </View>
      )}

      {page.seasonOver ? (
        <Card>
          <Text style={{ color: t.text, fontSize: 20, fontWeight: "800" }}>That's a wrap for this season 🎉</Text>
          <Muted>
            {viewer.isOrganizer
              ? "The last game has been played. To keep going, set a new last game in Edit group, or start a new season below."
              : "The last game has been played. Thanks for playing! Your organizer will share the next season here."}
          </Muted>
        </Card>
      ) : session.cancelled ? (
        <Card>
          <Text style={{ color: t.danger, fontSize: 20, fontWeight: "800" }}>Cancelled this week</Text>
          <Muted>No game this week. See you next time!</Muted>
        </Card>
      ) : (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <Bump value={roster.confirmed.length}>
              <Text style={{ color: t.text, fontSize: 56, fontWeight: "800", letterSpacing: -2 }}>{roster.confirmed.length}</Text>
            </Bump>
            <Text style={{ color: t.muted, fontSize: 22, fontWeight: "600" }}>{group.cap ? `/ ${group.cap} in` : goal ? `in · aiming for ${goal}` : "in"}</Text>
          </View>
          {goal && (
            <View style={{ height: 8, borderRadius: 4, backgroundColor: t.border, overflow: "hidden" }}>
              <View style={{ height: "100%", borderRadius: 4, backgroundColor: t.accent, width: `${Math.min(100, (roster.confirmed.length / goal) * 100)}%` }} />
            </View>
          )}
          {roster.waitlist.length > 0 && <Text style={{ color: t.waitlist, fontWeight: "600" }}>{roster.waitlist.length} on the waitlist</Text>}
          {needed > 0 && <Muted>{group.cap ? `${needed} ${needed === 1 ? "spot" : "spots"} left` : `Need ${needed} more to get to ${goal}`}</Muted>}

          <StatusLine place={place} name={me?.name} />
          {page.season ? (
            <SeasonLine page={page} me={me} />
          ) : (
            <CostLine cost={describeCost(group, goal)} payNote={group.payNote} />
          )}

          {!me && nameTaken ? (
            <IdentityPrompt
              existing={nameTaken.existing}
              step={identityStep}
              onThatsMe={async () => {
                // Added by the organizer and never opened on a phone: it's theirs to claim.
                if (nameTaken.existing.claimable) return claimAs(nameTaken.existing.id, nameTaken.status);
                if (!nameTaken.existing.hasEmail) return setIdentityStep("noEmail");
                const { sent } = await api.requestRestore(slug, nameTaken.existing.id);
                setIdentityStep(sent ? "emailSent" : "noEmail");
              }}
              onSomeoneElse={() => setIdentityStep("someoneElse")}
              onJoinAs={(newName) => respond(nameTaken.status, { name: newName, confirmNew: true })}
            />
          ) : (
            !me && (
              <>
                {page.unclaimed.length > 0 && <ClaimList people={page.unclaimed} onClaim={(id) => claimAs(id)} />}
                <Field label={page.unclaimed.length ? "Not on the list? Your name" : "Your name"} placeholder="First name is fine" value={name} onChangeText={setName} autoComplete="given-name" />
              </>
            )
          )}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <RsvpButton
              label={place.kind === "confirmed" ? "✓ You're in" : place.kind === "waitlist" ? "✓ On the waitlist" : "I'm in"}
              kind="in"
              selected={place.kind === "confirmed" || place.kind === "waitlist"}
              disabled={needsName}
              loading={pending === "in"}
              onPress={() => respond("in")}
            />
            <RsvpButton label={place.kind === "out" ? "✓ You're out" : "I'm out"} kind="out" selected={place.kind === "out"} disabled={needsName} loading={pending === "out"} onPress={() => respond("out")} />
          </View>
        </Card>
      )}
      {error && <Text style={{ color: t.danger }}>{error}</Text>}

      {me && !session.cancelled && place.kind !== "out" && <RemindMe slug={slug} me={me} />}

      {session.teams && <TeamsCard teams={session.teams.teams} roster={[...roster.confirmed, ...roster.waitlist, ...roster.out]} onShare={share} groupName={group.name} />}

      <PeopleList title="In" people={roster.confirmed} numbered onRemove={onRemove} paid={paidSet} onTogglePaid={onTogglePaid} seasonMembers={seasonMembers} />
      {roster.waitlist.length > 0 && <PeopleList title="Waitlist" people={roster.waitlist} numbered onRemove={onRemove} seasonMembers={seasonMembers} />}
      {roster.out.length > 0 && <PeopleList title="Out" people={roster.out} onRemove={onRemove} lateDrops={viewer.isOrganizer ? new Set(page.organizer?.lateDrops ?? []) : undefined} seasonMembers={seasonMembers} />}

      {!(created && viewer.isOrganizer) && <ShareCard input={shareInput} />}
      {notice && <Muted>{notice}</Muted>}

      {viewer.isOrganizer && (
        <Card>
          <Text style={{ color: t.muted, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>Organizer</Text>
          <ForecastCard page={page} onAsk={(name) => {
            trackEvent("invite_asked", slug, { status: page.organizer?.forecast?.status ?? "none", from: "group" });
            share(inviteMessage(name.split(" ")[0]!, group.name, page.organizer?.forecast?.short || roster.spotsLeft, shortWhen(session.startsAt, group.timezone), link));
          }} />
          <ActionGrid>
            <ActionTile icon="edit" label="Edit" onPress={() => router.push({ pathname: "/edit/[slug]", params: { slug } })} />
            <ActionTile
              icon="bell"
              label="Remind"
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
            <ActionTile icon="teams" label="Teams" disabled={roster.confirmed.length < 2} onPress={() => router.push({ pathname: "/teams/[slug]", params: { slug } })} />
            <ActionTile icon="calendar" label="Schedule" onPress={() => router.push({ pathname: "/schedule/[slug]", params: { slug } })} />
            <ActionTile icon="people" label="Members" onPress={() => router.push({ pathname: "/members/[slug]", params: { slug } })} />
            <ActionTile icon="chart" label="Insights" onPress={() => router.push({ pathname: "/insights/[slug]", params: { slug } })} />
            <ActionTile icon="clock" label="History" onPress={() => router.push({ pathname: "/history/[slug]", params: { slug } })} />
            <ActionTile icon="key" label="Organizers" onPress={() => router.push({ pathname: "/organizers/[slug]", params: { slug } })} />
          </ActionGrid>
          {reminder && (
            <Pop style={{ gap: 8 }}>
              <Text style={{ color: t.text, fontWeight: "700" }}>
                {reminder.reachable === 0
                  ? "Nobody has turned on reminders yet, so post this in your group chat:"
                  : reminder.notified > 0
                    ? `Notified ${reminder.notified} of ${reminder.reachable} players with reminders on. Post this for everyone else:`
                    : "Reminders already went out in the last hour. You can still post this:"}
              </Text>
              <View style={{ backgroundColor: t.bg, borderRadius: 10, padding: 12 }}>
                <Text style={{ color: t.muted }}>{reminder.message}</Text>
              </View>
              <View style={{ flexDirection: "row" }}>
                <Button label="Share to group chat" onPress={() => share(reminder.message)} />
              </View>
            </Pop>
          )}
          {page.season && <SeasonCard page={page} onShare={share} onChanged={() => void load()} />}
          {paidSet && roster.confirmed.length > 0 && !page.season && (
            <Text style={{ color: t.muted }}>
              💵 {paidLine(roster.confirmed.filter((r) => paidSet.has(r.memberId)).length, roster.confirmed.length, shareCents(group, roster.confirmed.length))}
            </Text>
          )}
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
        </Card>
      )}

      <View style={{ alignItems: "center", marginTop: 24 }}>
        <Link href="/new">
          <Text style={{ color: t.muted }}>
            Run a weekly game? <Text style={{ color: t.accent, fontWeight: "700" }}>Start your own group on Turnout</Text>
          </Text>
        </Link>
      </View>
    </Screen>
  );
}

function StatusLine({ place, name }: { place: ReturnType<typeof placeOf>; name?: string }) {
  const t = useTheme();
  const text =
    place.kind === "confirmed" ? `You're in, ${name}${name?.endsWith(".") ? "" : "."}` :
    place.kind === "waitlist" ? `You're #${place.position} on the waitlist. We'll move you up if someone drops.` :
    place.kind === "out" ? "You're out this week." :
    null;
  if (!text) return null;
  const color = place.kind === "confirmed" ? t.accent : place.kind === "waitlist" ? t.waitlist : t.muted;
  return <Text style={{ color, fontSize: 16, fontWeight: "600" }}>{text}</Text>;
}

/** Autopilot on the group page, for organizers, within ASK_WINDOW_HOURS of the game. */
function ForecastCard({ page, onAsk }: { page: GroupPage; onAsk: (name: string) => void }) {
  const t = useTheme();
  const forecast = page.organizer?.forecast;
  const { group, session, roster } = page;
  const hours = hoursUntil(session.startsAt);
  const goal = playerGoal(group);
  if (!forecast || !goal || session.cancelled || hours <= 0 || hours > ASK_WINDOW_HOURS) return null;
  const { headline, detail } = describeForecast(forecast, roster.confirmed.length, goal);
  const showDetail = forecast.status !== "full" || (hours <= LATE_WARNING_HOURS && forecast.expectedLateDrops > 0);
  const ask = forecast.status === "full" ? [] : forecast.likely.slice(0, Math.max(2, forecast.short + 1));
  return (
    <View style={{ backgroundColor: t.soft, borderRadius: 12, padding: 12, gap: 8 }}>
      <Text style={{ color: t.text, fontWeight: "800" }}>{headline}</Text>
      {showDetail && <Text style={{ color: t.text }}>{detail}</Text>}
      {ask.length > 0 && (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {ask.map((p) => (
            <Pressable
              key={p.memberId}
              accessibilityRole="button"
              accessibilityLabel={`Ask ${p.name}`}
              onPress={() => onAsk(p.name)}
              style={({ hovered }: { hovered?: boolean }) => ({ borderWidth: 1, borderColor: t.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: hovered ? t.accent : "transparent", ...webTransition })}
            >
              {({ hovered }: { hovered?: boolean }) => <Text style={{ color: hovered ? t.accentText : t.accent, fontWeight: "800" }}>Ask {p.name}</Text>}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/** "3 of 10 paid · $30 of $100 collected". */
const paidLine = (paid: number, total: number, share: number | null) =>
  `${paid} of ${total} paid${share !== null ? ` · ${formatMoney(paid * share)} of ${formatMoney(total * share)} collected` : ""}`;

/** What a player sees about money in a season group: their season fee and whether it's paid, or the sub price. */
function SeasonLine({ page, me }: { page: GroupPage; me: Membership | null }) {
  const t = useTheme();
  const api = useApi();
  const { group, season } = page;
  const [status, setStatus] = useState<{ member: boolean; paid: boolean } | null>(null);
  useEffect(() => {
    if (me) api.memberSelf(group.slug, me.token).then((s) => setStatus(s.season), () => {});
  }, [api, group.slug, me]);
  if (!season) return null;
  const fee = season.shareCents !== null ? formatMoney(season.shareCents) : null;
  const drop = group.feeCents ? formatMoney(group.feeCents) : null;
  let line: string | null;
  if (status?.member) line = fee ? `Season fee ${fee} · ${status.paid ? "✅ paid, thanks!" : "due before the first game"}` : null;
  else if (status) line = drop ? `Playing as a sub: ${drop} this game` : "Playing as a sub this game";
  else line = [fee && `Season members: ${fee} for the season`, drop && `subs ${drop} a game`].filter(Boolean).join(" · ") || null;
  if (!line) return null;
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: t.text, fontWeight: "700" }}>💵 {line}</Text>
      {group.payNote && !status?.paid && <Text style={{ color: t.muted }}>{group.payNote}</Text>}
    </View>
  );
}

/** Organizer: the season at a glance, who still owes, and a nudge. */
function SeasonCard({ page, onShare, onChanged }: { page: GroupPage; onShare: (text: string) => void; onChanged: () => void }) {
  const t = useTheme();
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ notified: number; unpaid: number; message: string } | null>(null);
  const { group, season } = page;
  if (!season) return null;
  const members = season.memberIds.length;
  const paid = page.organizer?.seasonPaid.length ?? 0;
  const share = season.shareCents;
  return (
    <View style={{ backgroundColor: t.soft, borderRadius: 12, padding: 12, gap: 8 }}>
      <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.6 }}>SEASON</Text>
      {members ? (
        <>
          <Text style={{ color: t.text, fontSize: 20, fontWeight: "800" }}>
            {paid} of {members} paid
          </Text>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: t.bg, overflow: "hidden" }}>
            <View style={{ width: `${Math.round((paid / members) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: t.accent }} />
          </View>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            {formatMoney((share ?? 0) * paid)} of {formatMoney(group.seasonFeeCents!)} · {formatMoney(share!)} each
          </Text>
        </>
      ) : (
        <Text style={{ color: t.muted }}>{formatMoney(group.seasonFeeCents!)} season. Mark who's in on the Members screen.</Text>
      )}
      <ActionGrid>
        <ActionTile icon="people" label="Members" onPress={() => router.push({ pathname: "/members/[slug]", params: { slug: group.slug } })} />
        {members > paid && (
          <ActionTile
            icon="cash"
            label="Remind unpaid"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              try {
                setResult(await api.remindSeason(group.slug));
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
      </ActionGrid>
      <Pressable
        accessibilityRole="button"
        onPress={async () => {
          if (await confirm("Start a new season?", "Members stay, and everyone goes back to unpaid for the new season fee. You can change the fee and dates in Edit group.", "Start new season")) {
            await api.newSeason(group.slug);
            onChanged();
          }
        }}
        style={{ alignSelf: "center", paddingVertical: 4 }}
      >
        <Text style={{ color: t.muted, fontSize: 13, fontWeight: "600" }}>Season over? Start a new one</Text>
      </Pressable>
      {result && (
        <Pop style={{ gap: 6 }}>
          <Text style={{ color: t.text }}>{result.notified ? `Reminded ${result.notified} of ${result.unpaid} with reminders on.` : "Nobody unpaid has reminders on."} Post this too:</Text>
          <Pressable onPress={() => onShare(result.message)} style={{ backgroundColor: t.bg, borderRadius: 10, padding: 10 }}>
            <Text style={{ color: t.muted }}>{result.message}</Text>
            <Text style={{ color: t.accent, fontWeight: "700", marginTop: 4 }}>Tap to share</Text>
          </Pressable>
        </Pop>
      )}
    </View>
  );
}

function CostLine({ cost, payNote }: { cost: string | null; payNote: string | null }) {
  const t = useTheme();
  if (!cost) return null;
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: t.text, fontWeight: "700" }}>💵 {cost}</Text>
      {payNote && <Text style={{ color: t.muted }}>{payNote}</Text>}
    </View>
  );
}

function PeopleList({ title, people, numbered, onRemove, paid, onTogglePaid, lateDrops, seasonMembers }: {
  lateDrops?: Set<string>;
  /** Season groups: members paid up front; everyone else is tagged a sub and pays per game. */
  seasonMembers?: Set<string> | null;
  title: string;
  people: Rsvp[];
  numbered?: boolean;
  onRemove?: (p: Rsvp) => void;
  paid?: Set<string>;
  onTogglePaid?: (p: Rsvp) => void;
}) {
  const t = useTheme();
  return (
    <Card>
      <Text style={{ color: t.muted, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {title} · {people.length}
      </Text>
      {people.length === 0 && <Muted>Nobody yet. Be the first!</Muted>}
      {people.map((p, i) => (
        <Pop key={p.memberId} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
            {numbered && <Text style={{ color: t.muted, width: 18, textAlign: "right", fontVariant: ["tabular-nums"] }}>{i + 1}</Text>}
            <Avatar name={p.name} />
            <Text style={{ color: t.text, fontSize: 16, flexShrink: 1 }} numberOfLines={1}>
              {p.name}
            </Text>
            {seasonMembers && !seasonMembers.has(p.memberId) && (
              <View style={{ borderWidth: 1, borderColor: t.border, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: t.muted, fontSize: 11, fontWeight: "800" }}>sub</Text>
              </View>
            )}
            {lateDrops?.has(p.memberId) && (
              <View style={{ borderWidth: 1, borderColor: t.waitlist, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: t.waitlist, fontSize: 11, fontWeight: "800" }}>late drop</Text>
              </View>
            )}
          </View>
          {onTogglePaid && paid && !seasonMembers?.has(p.memberId) && (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: paid.has(p.memberId) }}
              accessibilityLabel={`${p.name} paid`}
              onPress={() => onTogglePaid(p)}
              hitSlop={8}
              style={({ hovered }: { hovered?: boolean }) => ({
                paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, marginRight: 12,
                borderColor: paid.has(p.memberId) || hovered ? t.accent : t.border, backgroundColor: paid.has(p.memberId) || hovered ? t.soft : "transparent",
              })}
            >
              <Text style={{ color: paid.has(p.memberId) ? t.accent : t.muted, fontSize: 12, fontWeight: "800" }}>{paid.has(p.memberId) ? "✓ Paid" : "Paid?"}</Text>
            </Pressable>
          )}
          {onRemove && (
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`} onPress={() => onRemove(p)} hitSlop={12}>
              {({ hovered }: { hovered?: boolean }) => <Text style={{ color: hovered ? t.danger : t.muted, fontSize: 18 }}>×</Text>}
            </Pressable>
          )}
        </Pop>
      ))}
    </Card>
  );
}

function TeamsCard({ teams, roster, groupName, onShare }: { teams: string[][]; roster: Rsvp[]; groupName: string; onShare: (text: string) => void }) {
  const t = useTheme();
  const names = new Map(roster.map((r) => [r.memberId, r.name]));
  const named = teams.map((ids) => ids.map((id) => names.get(id)).filter((n): n is string => !!n));
  const text = teamsText(groupName, named);
  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: "800" }}>🏁 Teams</Text>
        <Pressable accessibilityRole="button" onPress={() => onShare(text)} hitSlop={8} style={({ hovered }: { hovered?: boolean }) => ({ opacity: hovered ? 0.7 : 1 })}>
          <Text style={{ color: t.accent, fontWeight: "700" }}>Share</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {named.map((ns, i) => (
          <View key={i} style={{ flexGrow: 1, flexBasis: "45%", backgroundColor: t.bg, borderRadius: 12, padding: 12, gap: 4 }}>
            <Text style={{ color: t.accent, fontWeight: "900" }}>{teamNames[i]}</Text>
            {ns.map((n) => (
              <Text key={n} style={{ color: t.text }}>
                {n}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </Card>
  );
}

/** Slim top bar on web: brand link home (every player sees Turnout) and, for organizers, their groups. */

/** In/Out button that shows the member's current answer as selected rather than disabled. */
function RsvpButton({ label, kind, selected, disabled, loading, onPress }: {
  label: string; kind: "in" | "out"; selected: boolean; disabled: boolean; loading: boolean; onPress: () => void;
}) {
  const t = useTheme();
  // "In" is always the green primary; "Out" fills in when chosen. A ring marks the current answer.
  const bg = kind === "in" ? t.accent : selected ? t.text : t.card;
  const fg = kind === "in" ? t.accentText : selected ? t.bg : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled, busy: loading }}
      onPress={selected ? undefined : () => {
        if (Platform.OS !== "web") void Haptics.impactAsync(kind === "in" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      disabled={disabled || loading}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => {
        const hover = hovered && !selected && !disabled && !loading;
        return {
          flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 20, borderRadius: 16, borderWidth: 2,
          backgroundColor: bg,
          borderColor: selected ? t.text : kind === "in" || hover ? t.accent : t.border,
          opacity: disabled ? 0.45 : hover && kind === "in" ? 0.9 : 1,
          transform: [{ translateY: hover && !pressed ? -2 : 0 }, { scale: pressed ? 0.97 : 1 }],
          ...webTransition,
        };
      }}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontSize: 19, fontWeight: "800" }}>{label}</Text>}
    </Pressable>
  );
}

/** "There's already a John here. Is that you?" Keeps one person from becoming two, without accounts. */
/** Players the organizer added: tap your name on your phone the first time. */
const CLAIM_PREVIEW = 8;

function ClaimList({ people, onClaim }: { people: { id: string; name: string }[]; onClaim: (id: string) => void }) {
  const t = useTheme();
  const [all, setAll] = useState(false);
  const shown = all ? people : people.slice(0, CLAIM_PREVIEW);
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: t.text, fontWeight: "800" }}>On the list? Tap your name</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {shown.map((p) => (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={`I'm ${p.name}`}
            onPress={() => onClaim(p.id)}
            style={({ hovered }: { hovered?: boolean }) => ({ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: hovered ? t.accent : t.border, backgroundColor: hovered ? t.soft : t.card, ...webTransition })}
          >
            <Avatar name={p.name} size={22} />
            <Text style={{ color: t.text, fontWeight: "700" }}>{p.name}</Text>
          </Pressable>
        ))}
        {!all && people.length > CLAIM_PREVIEW && (
          <Pressable accessibilityRole="button" onPress={() => setAll(true)} style={({ hovered }: { hovered?: boolean }) => ({ paddingVertical: 6, paddingHorizontal: 10, opacity: hovered ? 0.7 : 1 })}>
            <Text style={{ color: t.accent, fontWeight: "800" }}>Show all {people.length}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function IdentityPrompt({ existing, step, onThatsMe, onSomeoneElse, onJoinAs }: {
  existing: NameTakenError["existing"];
  step: "ask" | "someoneElse" | "emailSent" | "noEmail";
  onThatsMe: () => void;
  onSomeoneElse: () => void;
  onJoinAs: (name: string) => void;
}) {
  const t = useTheme();
  const [initial, setInitial] = useState("");
  if (step === "emailSent") {
    return (
      <View style={{ gap: 6 }}>
        <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>📬 Check your email on this phone</Text>
        <Muted>We sent a link to the address {existing.name} uses for reminders. Open it here and you'll pick up where you left off.</Muted>
      </View>
    );
  }
  if (step === "someoneElse" || step === "noEmail") {
    const full = `${existing.name} ${initial.trim()}`.trim();
    return (
      <View style={{ gap: 8 }}>
        {step === "noEmail" && (
          <Muted>We can't confirm it's you without a reminder email. Join with your last initial, and ask the organizer to merge the two.</Muted>
        )}
        <Field label="Add your last initial so people can tell you apart" placeholder="B" value={initial} onChangeText={(v) => setInitial(v.slice(0, 12))} autoCapitalize="characters" />
        <View style={{ flexDirection: "row" }}>
          <Button label={`Join as ${full}${initial ? (initial.length === 1 ? "." : "") : ""}`} disabled={!initial.trim()} onPress={() => onJoinAs(initial.trim().length === 1 ? `${full}.` : full)} />
        </View>
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>There's already a {existing.name} in this group. Is that you?</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label="Yes, that's me" onPress={onThatsMe} />
        <Button label="No, someone else" variant="secondary" onPress={onSomeoneElse} />
      </View>
    </View>
  );
}
