import { needPlayersMessage, placeOf, type GroupPage, type Rsvp, type RsvpStatus } from "@turnout/shared";
import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Bump, Pop } from "@/components/motion";
import { Button, Card, Field, Muted, Screen, Title } from "@/components/ui";
import { ApiError, memberships, shareUrl, useApi, type Membership } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { formatSessionDate } from "@/lib/format";
import { useLiveGroup } from "@/lib/live";
import { shareText } from "@/lib/share";
import { useTheme } from "@/lib/theme";

export default function GroupScreen() {
  const t = useTheme();
  const api = useApi();
  const { slug, created } = useLocalSearchParams<{ slug: string; created?: string }>();
  const [page, setPage] = useState<GroupPage | null>(null);
  const [me, setMe] = useState<Membership | null>(null);
  const [name, setName] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

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
  const needMessage = session.cancelled ? null : needPlayersMessage(group.name, roster, link);
  const needsName = !me && name.trim().length === 0;
  const onRemove = viewer.isOrganizer
    ? async (p: Rsvp) => {
        if (await confirm(`Remove ${p.name}?`, "They'll be taken off this week's list and will need the link to join again.")) {
          await run(`remove:${p.memberId}`, () => api.removeMember(slug, p.memberId));
        }
      }
    : undefined;

  return (
    <Screen>
      <Stack.Screen options={{ title: group.name }} />

      {created && (
        <Card>
          <Text style={{ color: t.text, fontSize: 17, fontWeight: "700" }}>Your group is ready 🎉</Text>
          <Muted>Drop this link in your group chat. People tap it, type their name once, and they're in.</Muted>
          <View style={{ flexDirection: "row" }}>
            <Button label="Share link" onPress={() => share(`Join ${group.name} on Turnout: ${link}`)} />
          </View>
        </Card>
      )}

      <View style={{ gap: 4 }}>
        <Title>{group.name}</Title>
        <Muted>
          {formatSessionDate(session.startsAt, group.timezone)}
          {group.location ? ` · ${group.location}` : ""}
        </Muted>
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
            <Button label="I'm in" big onPress={() => respond("in")} loading={pending === "in"} disabled={needsName || place.kind === "confirmed" || place.kind === "waitlist"} />
            <Button label="I'm out" big variant="secondary" onPress={() => respond("out")} loading={pending === "out"} disabled={needsName || place.kind === "out"} />
          </View>
        </Card>
      )}
      {error && <Text style={{ color: t.danger }}>{error}</Text>}

      <PeopleList title="In" people={roster.confirmed} numbered onRemove={onRemove} />
      {roster.waitlist.length > 0 && <PeopleList title="Waitlist" people={roster.waitlist} numbered onRemove={onRemove} />}
      {roster.out.length > 0 && <PeopleList title="Out" people={roster.out} onRemove={onRemove} />}

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Button label="Share link" variant="secondary" onPress={() => share(`Join ${group.name} on Turnout: ${link}`)} />
        {needMessage && <Button label={`Need ${roster.spotsLeft} more`} variant="secondary" onPress={() => share(needMessage)} />}
      </View>
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

function PeopleList({ title, people, numbered, onRemove }: { title: string; people: Rsvp[]; numbered?: boolean; onRemove?: (p: Rsvp) => void }) {
  const t = useTheme();
  return (
    <Card>
      <Text style={{ color: t.muted, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {title} · {people.length}
      </Text>
      {people.length === 0 && <Muted>Nobody yet. Be the first!</Muted>}
      {people.map((p, i) => (
        <Pop key={p.memberId} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: t.text, fontSize: 16 }}>
            {numbered ? `${i + 1}. ` : ""}
            {p.name}
          </Text>
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
