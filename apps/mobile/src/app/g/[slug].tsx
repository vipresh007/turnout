import { placeOf, teamNames, teamsText, type GroupPage, type Rsvp, type RsvpStatus } from "@turnout/shared";
import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from "react-native";
import { Bump, Pop } from "@/components/motion";
import { Avatar } from "@/components/Avatar";
import { RemindMe } from "@/components/RemindMe";
import { ShareCard } from "@/components/ShareCard";
import { Button, Card, Field, Muted, Screen, Title } from "@/components/ui";
import { ApiError, calendarUrl, memberships, shareUrl, useApi, type Membership } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { mapsUrl, relativeDay, sessionWhen } from "@/lib/format";
import { useLiveGroup } from "@/lib/live";
import { shareText } from "@/lib/share";
import { useTheme } from "@/lib/theme";

export default function GroupScreen() {
  const t = useTheme();
  const api = useApi();
  const { slug, created, rsvp } = useLocalSearchParams<{ slug: string; created?: string; rsvp?: string }>();
  const [page, setPage] = useState<GroupPage | null>(null);
  const [me, setMe] = useState<Membership | null>(null);
  const [name, setName] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [reminder, setReminder] = useState<{ notified: number; reachable: number; message: string } | null>(null);

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
      setError((e as Error).message);
    } finally {
      setPending(null);
    }
  };

  const respond = (status: RsvpStatus) =>
    run(status, async () => {
      const membership = me ?? (await api.join(slug, name));
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
    return <Screen>{error ? <Text style={{ color: t.danger }}>{error}</Text> : <ActivityIndicator style={{ marginTop: 48 }} />}</Screen>;
  }

  const { group, session, roster, viewer } = page;
  const link = shareUrl(slug);
  const place = me ? placeOf(roster, me.memberId) : { kind: "none" as const };
  const shareInput = {
    name: group.name, activity: group.activity, location: group.location, timezone: group.timezone, cap: group.cap,
    startsAt: session.startsAt, confirmed: roster.confirmed.length, cancelled: session.cancelled, link,
  };
  const needsName = !me && name.trim().length === 0;
  const paidSet = viewer.isOrganizer ? new Set(page.organizer?.paid ?? []) : undefined;
  const onTogglePaid = viewer.isOrganizer
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
    <Screen>
      <Stack.Screen options={{ title: group.name, headerShown: Platform.OS !== "web" }} />
      {Platform.OS === "web" && <BrandBar />}

      {created && (
        <ShareCard input={shareInput} title="🎉 Your group is ready. Send it to your group chat" />
      )}

      <View style={{ gap: 4 }}>
        <Title>{group.name}</Title>
        <Text style={{ color: t.text, fontSize: 16, fontWeight: "600" }}>
          {sessionWhen(session.startsAt, group.durationMinutes, group.timezone)}
          <Text style={{ color: t.accent }}> · {relativeDay(session.startsAt, group.timezone)}</Text>
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 2 }}>
          {group.location && (
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(mapsUrl(group.location!))} hitSlop={6}>
              <Text style={{ color: t.muted }}>📍 <Text style={{ textDecorationLine: "underline" }}>{group.location}</Text></Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(calendarUrl(slug))} hitSlop={6}>
            <Text style={{ color: t.muted }}>📅 <Text style={{ textDecorationLine: "underline" }}>Add to calendar</Text></Text>
          </Pressable>
        </View>
      </View>

      {session.cancelled ? (
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
            <Text style={{ color: t.muted, fontSize: 22, fontWeight: "600" }}>{group.cap ? `/ ${group.cap} in` : "in"}</Text>
          </View>
          {group.cap && (
            <View style={{ height: 8, borderRadius: 4, backgroundColor: t.border, overflow: "hidden" }}>
              <View style={{ height: "100%", borderRadius: 4, backgroundColor: t.accent, width: `${Math.min(100, (roster.confirmed.length / group.cap) * 100)}%` }} />
            </View>
          )}
          {roster.waitlist.length > 0 && <Text style={{ color: t.waitlist, fontWeight: "600" }}>{roster.waitlist.length} on the waitlist</Text>}
          {roster.spotsLeft > 0 && <Muted>{roster.spotsLeft} {roster.spotsLeft === 1 ? "spot" : "spots"} left</Muted>}

          <StatusLine place={place} name={me?.name} />

          {!me && <Field label="Your name" placeholder="First name is fine" value={name} onChangeText={setName} autoComplete="given-name" />}
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

      <PeopleList title="In" people={roster.confirmed} numbered onRemove={onRemove} paid={paidSet} onTogglePaid={onTogglePaid} />
      {roster.waitlist.length > 0 && <PeopleList title="Waitlist" people={roster.waitlist} numbered onRemove={onRemove} />}
      {roster.out.length > 0 && <PeopleList title="Out" people={roster.out} onRemove={onRemove} />}

      <ShareCard input={shareInput} />
      {notice && <Muted>{notice}</Muted>}

      {viewer.isOrganizer && (
        <Card>
          <Text style={{ color: t.muted, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>Organizer</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Button label="Edit group" variant="secondary" onPress={() => router.push({ pathname: "/edit/[slug]", params: { slug } })} />
            <Button
              label={session.cancelled ? "Restore this week" : "Cancel this week"}
              variant={session.cancelled ? "secondary" : "danger"}
              loading={pending === "cancel"}
              onPress={async () => {
                if (session.cancelled || (await confirm("Cancel this week?", "Everyone will see the game is off. You can restore it any time.", "Cancel week"))) {
                  await run("cancel", () => api.setCancelled(slug, !session.cancelled));
                }
              }}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Button
              label="⏰ Send reminder"
              variant="secondary"
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
            <Button label="🏁 Make teams" variant="secondary" disabled={roster.confirmed.length < 2} onPress={() => router.push({ pathname: "/teams/[slug]", params: { slug } })} />
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
              <View style={{ backgroundColor: t.bg, borderRadius: 10, padding: 12 }}>
                <Text style={{ color: t.muted }}>{reminder.message}</Text>
              </View>
              <View style={{ flexDirection: "row" }}>
                <Button label="Share to group chat" onPress={() => share(reminder.message)} />
              </View>
            </Pop>
          )}
          {paidSet && roster.confirmed.length > 0 && (
            <Text style={{ color: t.muted }}>
              💵 {roster.confirmed.filter((r) => paidSet.has(r.memberId)).length} of {roster.confirmed.length} paid · tap “Paid” next to a name to mark it
            </Text>
          )}
          <Muted>Tap × next to a name to remove someone from the group.</Muted>
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
    place.kind === "confirmed" ? `You're in, ${name}.` :
    place.kind === "waitlist" ? `You're #${place.position} on the waitlist. We'll move you up if someone drops.` :
    place.kind === "out" ? "You're out this week." :
    null;
  if (!text) return null;
  const color = place.kind === "confirmed" ? t.accent : place.kind === "waitlist" ? t.waitlist : t.muted;
  return <Text style={{ color, fontSize: 16, fontWeight: "600" }}>{text}</Text>;
}

function PeopleList({ title, people, numbered, onRemove, paid, onTogglePaid }: {
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
          </View>
          {onTogglePaid && paid && (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: paid.has(p.memberId) }}
              accessibilityLabel={`${p.name} paid`}
              onPress={() => onTogglePaid(p)}
              hitSlop={8}
              style={{
                paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, marginRight: 12,
                borderColor: paid.has(p.memberId) ? t.accent : t.border, backgroundColor: paid.has(p.memberId) ? t.soft : "transparent",
              }}
            >
              <Text style={{ color: paid.has(p.memberId) ? t.accent : t.muted, fontSize: 12, fontWeight: "800" }}>{paid.has(p.memberId) ? "✓ Paid" : "Paid?"}</Text>
            </Pressable>
          )}
          {onRemove && (
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`} onPress={() => onRemove(p)} hitSlop={12}>
              <Text style={{ color: t.muted, fontSize: 18 }}>×</Text>
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
        <Pressable accessibilityRole="button" onPress={() => onShare(text)} hitSlop={8}>
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
function BrandBar() {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Link href="/" accessibilityLabel="Turnout home">
        <Text style={{ color: t.text, fontSize: 20, fontWeight: "900", letterSpacing: -0.8 }}>
          turnout<Text style={{ color: t.accent }}>.</Text>
        </Text>
      </Link>
      <Link href="/dashboard">
        <Text style={{ color: t.muted, fontWeight: "600" }}>Organizer? Your groups →</Text>
      </Link>
    </View>
  );
}

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
      onPress={selected ? undefined : onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 20, borderRadius: 16, borderWidth: 2,
        backgroundColor: bg,
        borderColor: selected ? t.text : kind === "in" ? t.accent : t.border,
        opacity: disabled ? 0.45 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontSize: 19, fontWeight: "800" }}>{label}</Text>}
    </Pressable>
  );
}
