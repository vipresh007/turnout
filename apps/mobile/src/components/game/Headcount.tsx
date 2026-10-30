import { describeCost, formatMoney, isOneOff, placeOf, playerGoal, type GroupPage, type RsvpStatus, type ShareInput } from "@turnout/shared";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { useApi, type Membership, type NameTakenError } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { webTransition } from "@/lib/webStyle";
import { Avatar } from "../Avatar";
import { Bump } from "../motion";
import { ShareButtons } from "../ShareCard";
import { Button, Card, Display, EmptyState, Field, IconLine, Muted, Ring, SectionHeader } from "../ui";

// The one thing a player came to do: see the count and tap In or Out. Everything else on the page is secondary.

export type IdentityStep = "ask" | "someoneElse" | "emailSent" | "noEmail";

export function Headcount({ page, me, place, goal, needed, name, onName, pending, nameTaken, identityStep, onThatsMe, onSomeoneElse, onJoinAs, onClaim, onRespond, shareInput, shortShare = true }: {
  page: GroupPage;
  me: Membership | null;
  place: ReturnType<typeof placeOf>;
  goal: number | null;
  needed: number;
  name: string;
  onName: (v: string) => void;
  pending: string | null;
  nameTaken: { existing: NameTakenError["existing"]; status: RsvpStatus } | null;
  identityStep: IdentityStep;
  onThatsMe: () => void;
  onSomeoneElse: () => void;
  onJoinAs: (name: string) => void;
  onClaim: (id: string) => void;
  onRespond: (status: RsvpStatus) => void;
  shareInput: ShareInput;
  /** Off when the page shows the stronger "find a sub" ask instead. */
  shortShare?: boolean;
}) {
  const t = useTheme();
  const { group, session, roster, viewer } = page;
  const needsName = !me && name.trim().length === 0;

  if (page.seasonOver) {
    return (
      <Card>
        <EmptyState
          illustration="wrap"
          title={isOneOff(group) ? "This event is over" : "That's a wrap for this season"}
          body={
            isOneOff(group)
              ? viewer.isOrganizer ? "Thanks for running it. To do it again, change the date in Edit group." : "Thanks for coming!"
              : viewer.isOrganizer
                ? "The last game has been played. To keep going, set a new last game in Edit group, or start a new season."
                : "The last game has been played. Thanks for playing! Your organizer will share the next season here."
          }
        />
      </Card>
    );
  }
  if (session.cancelled) {
    return (
      <Card>
        <EmptyState illustration="cancelled" tone={t.danger} title="Cancelled this week" body="No game this week. See you next time!" />
      </Card>
    );
  }

  const short = shortShare && needed > 0 && !viewer.isOrganizer && roster.confirmed.length > 0;
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
        <Ring value={roster.confirmed.length} max={goal} size={104} tone={goal && roster.confirmed.length >= goal ? t.accent : t.energy}>
          <Bump value={roster.confirmed.length}>
            <Display level="stat" style={{ fontSize: 40, lineHeight: 44 }}>{String(roster.confirmed.length)}</Display>
          </Bump>
        </Ring>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: t.text, fontSize: 20, fontWeight: "600", letterSpacing: -0.3 }}>{group.cap ? `of ${group.cap} in` : goal ? `in · aiming for ${goal}` : "in"}</Text>
          {needed > 0 && group.cap && <Text style={{ color: t.energy, fontWeight: "600" }}>{`${needed} ${needed === 1 ? "spot" : "spots"} left`}</Text>}
          {goal && needed <= 0 && !roster.waitlist.length && <Text style={{ color: t.accent, fontWeight: "600" }}>Full</Text>}
          {roster.waitlist.length > 0 && <Text style={{ color: t.energy, fontWeight: "600" }}>{roster.waitlist.length} on the waitlist</Text>}
        </View>
      </View>

      <StatusLine place={place} name={me?.name} />
      {page.season ? <SeasonLine page={page} me={me} /> : <CostLine cost={describeCost(group, goal)} payNote={group.payNote} />}

      {!me && nameTaken ? (
        <IdentityPrompt existing={nameTaken.existing} step={identityStep} onThatsMe={onThatsMe} onSomeoneElse={onSomeoneElse} onJoinAs={onJoinAs} />
      ) : (
        !me && (
          <>
            {page.unclaimed.length > 0 && <ClaimList people={page.unclaimed} onClaim={onClaim} />}
            <Field label={page.unclaimed.length ? "Not on the list? Your name" : "Your name"} placeholder="First name is fine" value={name} onChangeText={onName} autoComplete="given-name" />
          </>
        )
      )}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <RsvpButton
          label={place.kind === "confirmed" ? "You're in" : place.kind === "waitlist" ? "On the waitlist" : "I'm in"}
          kind="in"
          selected={place.kind === "confirmed" || place.kind === "waitlist"}
          disabled={needsName}
          loading={pending === "in"}
          onPress={() => onRespond("in")}
        />
        <RsvpButton label={place.kind === "out" ? "You're out" : "I'm out"} kind="out" selected={place.kind === "out"} disabled={needsName} loading={pending === "out"} onPress={() => onRespond("out")} />
      </View>
      {short && (
        <View style={{ gap: 8, marginTop: 4 }}>
          <Text style={[t.type.small, { color: t.muted }]}>Need {needed} more. Know someone? Send them the link.</Text>
          <ShareButtons input={shareInput} />
        </View>
      )}
    </Card>
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
  const color = place.kind === "confirmed" ? t.accent : place.kind === "waitlist" ? t.energy : t.muted;
  return <Text style={{ color, fontSize: 16, fontWeight: "600" }}>{text}</Text>;
}

function CostLine({ cost, payNote }: { cost: string | null; payNote: string | null }) {
  const t = useTheme();
  if (!cost) return null;
  return (
    <View style={{ gap: 2 }}>
      <IconLine icon="cash" color={t.text}>{cost}</IconLine>
      {payNote && <Text style={{ color: t.muted }}>{payNote}</Text>}
    </View>
  );
}

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
  if (status?.member) line = fee ? `Season fee ${fee} · ${status.paid ? "paid, thanks!" : "due before the first game"}` : null;
  else if (status) line = drop ? `Playing as a sub: ${drop} this game` : "Playing as a sub this game";
  else line = [fee && `Season members: ${fee} for the season`, drop && `subs ${drop} a game`].filter(Boolean).join(" · ") || null;
  if (!line) return null;
  return (
    <View style={{ gap: 2 }}>
      <IconLine icon="cash" color={t.text}>{line}</IconLine>
      {group.payNote && !status?.paid && <Text style={{ color: t.muted }}>{group.payNote}</Text>}
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
      onPress={selected ? undefined : () => {
        if (Platform.OS !== "web") void Haptics.impactAsync(kind === "in" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      disabled={disabled || loading}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => {
        const hover = hovered && !selected && !disabled && !loading;
        return {
          flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 18, borderRadius: 16, borderWidth: 2,
          backgroundColor: bg,
          borderColor: selected ? t.text : kind === "in" || hover ? t.accent : t.border,
          opacity: disabled ? 0.45 : hover && kind === "in" ? 0.9 : 1,
          transform: [{ translateY: hover && !pressed ? -2 : 0 }, { scale: pressed ? 0.97 : 1 }],
          boxShadow: kind === "in" && !disabled && !selected ? `0 6px 16px ${t.accentShadow}` : undefined,
          ...webTransition,
        };
      }}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <Text style={{ color: fg, fontSize: 19, fontWeight: "800" }}>{selected ? "✓ " : ""}{label}</Text>
      )}
    </Pressable>
  );
}

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
            style={({ hovered }: { hovered?: boolean }) => ({ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: hovered ? t.accent : t.border, backgroundColor: hovered ? t.soft : t.surface2, ...webTransition })}
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

/** "There's already a John here. Is that you?" Keeps one person from becoming two, without accounts. */
function IdentityPrompt({ existing, step, onThatsMe, onSomeoneElse, onJoinAs }: {
  existing: NameTakenError["existing"];
  step: IdentityStep;
  onThatsMe: () => void;
  onSomeoneElse: () => void;
  onJoinAs: (name: string) => void;
}) {
  const t = useTheme();
  const [initial, setInitial] = useState("");
  if (step === "emailSent") {
    return (
      <View style={{ gap: 6 }}>
        <SectionHeader icon="mail" title="Check your email on this phone" />
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

export { playerGoal };
