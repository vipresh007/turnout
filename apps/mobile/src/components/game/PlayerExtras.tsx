import { inviteFriendMessage, shouldOfferSignIn, subRequestMessage, type PlayerStats, type PromptSeen, type ShareInput } from "@turnout/shared";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { trackEvent } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { useTheme } from "@/lib/theme";
import { ShareButtons } from "../ShareCard";
import { AskCard, Button, Card, Chip, Field, ListRow, SectionHeader } from "../ui";

// The optional extras for a player on a group page: a reason to sign in (never required), inviting a friend, and
// finding a sub when the game is short. None of these get in the way of I'm in.

const SEEN_KEY = "signInPrompt";

/** After a couple of games, once, with a 30-day gap: keep your games and streaks on any phone. */
export function SignInAsk({ stats, slug }: { stats: PlayerStats | null; slug: string }) {
  const { status } = useAuth();
  const [seen, setSeen] = useState<PromptSeen | null>(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    storage.get(SEEN_KEY).then((raw) => setSeen(raw ? (JSON.parse(raw) as PromptSeen) : { shows: 0, lastAt: null }));
  }, []);
  const show = !!stats && !!seen && status === "signedOut" && !dismissed && shouldOfferSignIn(stats, seen);
  useEffect(() => {
    if (!show || !seen) return;
    // Counts as shown the moment it appears, so a refresh doesn't show it again.
    const next = { shows: seen.shows + 1, lastAt: new Date().toISOString() };
    storage.set(SEEN_KEY, JSON.stringify(next));
    trackEvent("signin_prompt_shown", slug, { played: stats!.played });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per show
  }, [show]);
  if (!show) return null;
  return (
    <AskCard icon="user" title="Keep your games with you" body="Sign in and your groups, streaks and reminders follow you to any phone or the website. Same name, same taps; nothing else changes." onDismiss={() => setDismissed(true)}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label="Sign in" onPress={() => { trackEvent("signin_prompt_accepted", slug); router.push({ pathname: "/sign-in", params: { next: `/g/${slug}` } }); }} />
        <Button label="Not now" variant="secondary" onPress={() => setDismissed(true)} />
      </View>
    </AskCard>
  );
}

/** A row that opens into "who are you inviting?" and the share buttons with a personal message. */
export function InviteFriend({ input, first, last }: { input: ShareInput; first?: boolean; last?: boolean }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [friend, setFriend] = useState("");
  return (
    <>
      <ListRow first={first} last={last && !open} icon="people" title="Invite a friend" subtitle="Send them the link with a note from you" tone={t.energy} onPress={() => setOpen((o) => !o)} right={<View />} />
      {open && (
        <View style={{ backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderTopWidth: 0, padding: 16, gap: 12, borderBottomLeftRadius: last ? t.radius.lg : 0, borderBottomRightRadius: last ? t.radius.lg : 0 }}>
          <Field label="Their name (optional)" placeholder="Sam" value={friend} onChangeText={setFriend} autoComplete="name" />
          <Text style={{ color: t.muted, fontSize: 13, lineHeight: 18 }}>{inviteFriendMessage(friend, input)}</Text>
          <ShareButtons input={input} message={inviteFriendMessage(friend, input)} event="friend_invited" from="player" />
        </View>
      )}
    </>
  );
}

/** When the game is short and close: one tap to ask around for a sub. */
export function FindSub({ input, needed }: { input: ShareInput; needed: number }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  if (!open) return <Chip label="Find a sub" icon="megaphone" tone={t.energy} onPress={() => setOpen(true)} />;
  return (
    <Card>
      <SectionHeader icon="megaphone" tone={t.energy} title={`Need ${needed} more`} eyebrow="Find a sub" />
      <Text style={{ color: t.muted, fontSize: 13, lineHeight: 18 }}>{subRequestMessage(input, needed)}</Text>
      <ShareButtons input={input} message={subRequestMessage(input, needed)} event="sub_requested" from="player" />
    </Card>
  );
}
