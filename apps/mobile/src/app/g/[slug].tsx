import { needPlayersMessage, placeOf, type GroupPage, type Rsvp, type RsvpStatus } from "@turnout/shared";
import { Link, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Button, Card, Field, Muted, Screen, Title } from "@/components/ui";
import { api, shareUrl, type Membership } from "@/lib/api";
import { formatSessionDate } from "@/lib/format";
import { shareText } from "@/lib/share";
import { useTheme } from "@/lib/theme";

// TODO: replace polling with Azure Web PubSub.
const POLL_MS = 10_000;

export default function GroupScreen() {
  const t = useTheme();
  const { slug, created } = useLocalSearchParams<{ slug: string; created?: string }>();
  const [page, setPage] = useState<GroupPage | null>(null);
  const [me, setMe] = useState<Membership | null>(null);
  const [name, setName] = useState("");
  const [pending, setPending] = useState<RsvpStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = () => api.groupPage(slug).then((p) => active && setPage(p), (e: Error) => active && setError(e.message));
      load();
      api.membership(slug).then((m) => active && setMe(m));
      const timer = setInterval(load, POLL_MS);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [slug]),
  );

  const respond = async (status: RsvpStatus) => {
    setPending(status);
    setError(null);
    try {
      const membership = me ?? (await api.join(slug, name));
      setMe(membership);
      setPage(await api.rsvp(slug, membership.token, status));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(null);
    }
  };

  const share = async (message: string) => {
    const copied = await shareText(message);
    if (copied) {
      setNotice("Copied to clipboard");
      setTimeout(() => setNotice(null), 2000);
    }
  };

  if (!page) {
    return (
      <Screen>
        {error ? <Text style={{ color: t.danger }}>{error}</Text> : <ActivityIndicator style={{ marginTop: 48 }} />}
      </Screen>
    );
  }

  const { group, session, roster } = page;
  const link = shareUrl(slug);
  const place = me ? placeOf(roster, me.memberId) : { kind: "none" as const };
  const needMessage = needPlayersMessage(group.name, roster, link);
  const needsName = !me && name.trim().length === 0;

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

      <Card>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
          <Text style={{ color: t.text, fontSize: 56, fontWeight: "800", letterSpacing: -2 }}>{roster.confirmed.length}</Text>
          <Text style={{ color: t.muted, fontSize: 22, fontWeight: "600" }}>{group.cap ? `/ ${group.cap} in` : "in"}</Text>
        </View>
        {roster.waitlist.length > 0 && <Text style={{ color: t.waitlist, fontWeight: "600" }}>{roster.waitlist.length} on the waitlist</Text>}
        {roster.spotsLeft > 0 && <Muted>{roster.spotsLeft} {roster.spotsLeft === 1 ? "spot" : "spots"} left</Muted>}

        <StatusLine place={place} name={me?.name} />

        {!me && <Field label="Your name" placeholder="First name is fine" value={name} onChangeText={setName} autoComplete="given-name" />}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Button label="I'm in" big onPress={() => respond("in")} loading={pending === "in"} disabled={needsName || place.kind === "confirmed" || place.kind === "waitlist"} />
          <Button label="I'm out" big variant="secondary" onPress={() => respond("out")} loading={pending === "out"} disabled={needsName || place.kind === "out"} />
        </View>
        {error && <Text style={{ color: t.danger }}>{error}</Text>}
      </Card>

      <PeopleList title="In" people={roster.confirmed} numbered />
      {roster.waitlist.length > 0 && <PeopleList title="Waitlist" people={roster.waitlist} numbered />}
      {roster.out.length > 0 && <PeopleList title="Out" people={roster.out} />}

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Button label="Share link" variant="secondary" onPress={() => share(`Join ${group.name} on Turnout: ${link}`)} />
        {needMessage && <Button label={`Need ${roster.spotsLeft} more`} variant="secondary" onPress={() => share(needMessage)} />}
      </View>
      {notice && <Muted>{notice}</Muted>}

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

function PeopleList({ title, people, numbered }: { title: string; people: Rsvp[]; numbered?: boolean }) {
  const t = useTheme();
  return (
    <Card>
      <Text style={{ color: t.muted, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {title} · {people.length}
      </Text>
      {people.length === 0 && <Muted>Nobody yet. Be the first!</Muted>}
      {people.map((p, i) => (
        <Text key={p.memberId} style={{ color: t.text, fontSize: 16 }}>
          {numbered ? `${i + 1}. ` : ""}
          {p.name}
        </Text>
      ))}
    </Card>
  );
}
