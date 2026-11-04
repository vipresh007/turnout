import type { MemberSummary } from "@turnout/shared";
import { Contact, ContactField } from "expo-contacts";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { SkillDots } from "@/components/SkillDots";
import { SignInGate } from "@/components/SignInGate";
import { BackLink, Button, Card, Field, Muted, Screen, webTransition } from "@/components/ui";
import { useApi } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { useTheme } from "@/lib/theme";

export default function MembersScreen() {
  return (
    <SignInGate reason="Sign in to manage your group's members.">
      <Members />
    </SignInGate>
  );
}

function Members() {
  const t = useTheme();
  const api = useApi();
  const { slug, add } = useLocalSearchParams<{ slug: string; add?: string }>();
  const [members, setMembers] = useState<MemberSummary[] | null>(null);
  const [season, setSeason] = useState(false);
  const [merging, setMerging] = useState<MemberSummary | null>(null);
  /** The row whose Merge / Remove are showing (behind its "…" button). */
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => api.members(slug).then((r) => {
    setMembers(r.members);
    setSeason(r.season);
  }, (e: Error) => setError(e.message)), [api, slug]);
  useEffect(() => {
    load();
  }, [load]);

  // Ratings save on the player and carry over every week; update in place so the list doesn't jump.
  const rate = async (memberId: string, skill: number) => {
    setMembers((ms) => ms && ms.map((m) => (m.id === memberId ? { ...m, skill } : m)));
    try {
      await api.setSkill(slug, memberId, skill);
    } catch (e) {
      setError((e as Error).message);
      void load();
    }
  };

  const act = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      setMerging(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!members) return <Screen>{error ? <Text style={{ color: t.danger }}>{error}</Text> : <ActivityIndicator style={{ marginTop: 48 }} />}</Screen>;

  const seasonCount = members.filter((m) => m.seasonMember).length;
  const paidCount = members.filter((m) => m.seasonPaid).length;
  return (
    <Screen>
      <BackLink fallback={{ pathname: "/g/[slug]", params: { slug } }} label="Back to group" />
      <View style={{ gap: 4 }}>
        <Text style={{ color: t.text, fontSize: 24, fontWeight: "900" }}>Members · {members.length}</Text>
        {season ? (
          <>
            <Text style={{ color: t.text, fontSize: 15, fontWeight: "600" }}>
              {paidCount} of {seasonCount} paid · {seasonCount} season {seasonCount === 1 ? "member" : "members"}
            </Text>
            <Muted>Tap Paid when someone pays; it makes them a season member too. Everyone else plays as a sub.</Muted>
          </>
        ) : (
          <Muted>Everyone who has joined. Rate players to balance teams; it's saved for every week.</Muted>
        )}
      </View>
      <AddPlayers slug={slug} season={season} onAdded={load} onRate={rate} startOpen={add === "1"} />
      {merging && (
        <Card>
          <Text style={{ color: t.text, fontWeight: "800" }}>Merge {merging.name} into…</Text>
          <Muted>{merging.name}'s phones, answers and reminders move to the player you pick, then this entry is removed.</Muted>
          {members.filter((m) => m.id !== merging.id).map((m) => (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              onPress={async () => {
                if (await confirm(`Merge ${merging.name} into ${m.name}?`, "This can't be undone.", "Merge")) await act(() => api.mergeMember(slug, merging.id, m.id));
              }}
              style={({ hovered }: { hovered?: boolean }) => ({ flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: 10, backgroundColor: hovered ? t.bg : "transparent" })}
            >
              <Avatar name={m.name} />
              <Text style={{ color: t.text, fontSize: 16 }}>{m.name}</Text>
            </Pressable>
          ))}
          <View style={{ flexDirection: "row" }}>
            <Button label="Cancel" variant="secondary" onPress={() => setMerging(null)} />
          </View>
        </Card>
      )}
      <Card>
        {members.map((m, i) => (
          <View key={m.id} style={[{ gap: 10, paddingVertical: 12 }, i > 0 && { borderTopWidth: 1, borderColor: t.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Avatar name={m.name} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontSize: 16, fontWeight: "600" }} numberOfLines={1}>{m.name}</Text>
                <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={1}>
                  {m.gamesIn} {m.gamesIn === 1 ? "game" : "games"} · {m.devices ? `${m.devices} ${m.devices === 1 ? "phone" : "phones"}` : "not opened yet"}
                  {m.hasEmail ? " · reminders on" : ""}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`More for ${m.name}`}
                accessibilityState={{ expanded: openRow === m.id }}
                onPress={() => setOpenRow(openRow === m.id ? null : m.id)}
                hitSlop={8}
                style={({ hovered }: { hovered?: boolean }) => ({ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: openRow === m.id || hovered ? t.surface2 : "transparent" })}
              >
                <Icon name="more" size={18} color={t.muted} />
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 38 }}>
              {season && (
                <>
                  <Toggle label="Member" on={m.seasonMember} onPress={() => act(() => api.setSeason(slug, m.id, { member: !m.seasonMember }))} />
                  {/* Paid on anyone: marking a sub paid makes them a season member too (the API does both). */}
                  <Toggle label="Paid" on={m.seasonPaid} onPress={() => act(() => api.setSeason(slug, m.id, { paid: !m.seasonPaid }))} />
                </>
              )}
              <View style={{ flex: 1 }} />
              <SkillDots name={m.name} value={m.skill ?? null} onChange={(n) => rate(m.id, n)} />
            </View>
            {openRow === m.id && (
              <View style={{ flexDirection: "row", gap: 18, paddingLeft: 38 }}>
                <Pressable accessibilityRole="button" onPress={() => setMerging(m)} hitSlop={8} style={({ hovered }: { hovered?: boolean }) => ({ opacity: hovered ? 0.7 : 1 })}>
                  <Text style={{ color: t.text, fontWeight: "600" }}>Merge with…</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${m.name}`}
                  hitSlop={8}
                  onPress={async () => {
                    if (await confirm(`Remove ${m.name}?`, "They'll be taken off the group, with their answers and payments. They can join again with the link.")) {
                      await act(() => api.removeMember(slug, m.id));
                    }
                  }}
                  style={({ hovered }: { hovered?: boolean }) => ({ opacity: hovered ? 0.7 : 1 })}
                >
                  <Text style={{ color: t.danger, fontWeight: "600" }}>Remove</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}
      </Card>
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
    </Screen>
  );
}

function Toggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ hovered }: { hovered?: boolean }) => ({ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: on || hovered ? t.accent : t.border, backgroundColor: on ? t.soft : "transparent", ...webTransition })}
    >
      <Text style={{ color: on ? t.accent : t.muted, fontSize: 12, fontWeight: "800" }}>{on ? `✓ ${label}` : label}</Text>
    </Pressable>
  );
}

/** App only: the phone's contact picker, one person at a time → "Name, email". Only the picked contact is read. */
async function pickContactLine(): Promise<string | null> {
  const contact = await Contact.presentPicker();
  if (!contact) return null;
  const details = await contact.getDetails([ContactField.FULL_NAME, ContactField.EMAILS]);
  const name = details.fullName?.trim();
  const email = details.emails?.[0]?.address;
  if (!name && !email) return null;
  return email ? `${name || email.split("@")[0]}, ${email}` : name!;
}

/** "Ann, ann@example.com" per line → players. The email is optional and turns on email reminders. */
function parsePlayers(text: string): { name: string; email?: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const email = line.match(/[^\s,;<>]+@[^\s,;<>]+\.[^\s,;<>]+/)?.[0];
      const name = (email ? line.replace(email, "") : line).replace(/[<>,;]+/g, " ").trim();
      return email ? { name: name || email.split("@")[0]!, email } : { name };
    });
}

function AddPlayers({ slug, season, onAdded, onRate, startOpen }: { slug: string; season: boolean; onAdded: () => void; onRate: (memberId: string, skill: number) => Promise<void>; startOpen?: boolean }) {
  const t = useTheme();
  const api = useApi();
  const [open, setOpen] = useState(!!startOpen);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  /** Just added: rate them now while they're in mind (optional). */
  const [fresh, setFresh] = useState<{ id: string; name: string; skill: number | null }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const players = parsePlayers(text);

  if (!open) {
    return (
      <View style={{ flexDirection: "row" }}>
        <Button label={season ? "+ Add season members" : "+ Add players"} variant="secondary" onPress={() => setOpen(true)} />
      </View>
    );
  }
  return (
    <Card>
      <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>{season ? "Add season members" : "Add players"}</Text>
      <Muted>
        One per line: a name, and an email if you have it. People with an email get reminders right away (with a one-tap stop).
        Everyone else taps their name the first time they open the group link.
      </Muted>
      {Platform.OS !== "web" && (
        <View style={{ flexDirection: "row" }}>
          <Button
            label="+ Pick from contacts"
            variant="secondary"
            onPress={async () => {
              const line = await pickContactLine();
              if (line) setText((prev) => (prev.trim() ? `${prev.trimEnd()}\n${line}` : line));
            }}
          />
        </View>
      )}
      <Field label="Players" placeholder={"Ann, ann@example.com\nBo\nChris chris@example.com"} value={text} onChangeText={setText} multiline style={{ minHeight: 120, textAlignVertical: "top" }} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          label={players.length ? `Add ${players.length} ${players.length === 1 ? "player" : "players"}` : "Add"}
          disabled={!players.length}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              const r = await api.addPlayers(slug, players);
              setResult(`Added ${r.added.length}.${r.skipped.length ? ` Already here: ${r.skipped.join(", ")}.` : ""}`);
              setFresh((r.players ?? []).map((p) => ({ ...p, skill: null })));
              setText("");
              onAdded();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
        <Button label="Done" variant="secondary" onPress={() => { setOpen(false); setResult(null); setFresh([]); }} />
      </View>
      {result && <Text style={{ color: t.accent, fontWeight: "700" }}>{result}</Text>}
      {fresh.length > 0 && (
        <View style={{ gap: 8 }}>
          <Muted>Rate them now for balanced teams (optional). It's saved for every week, and only you see it.</Muted>
          {fresh.map((p) => (
            <View key={p.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <Text style={{ color: t.text, fontSize: 16, flex: 1 }} numberOfLines={1}>{p.name}</Text>
              <SkillDots
                name={p.name}
                value={p.skill}
                onChange={(n) => {
                  setFresh((list) => list.map((x) => (x.id === p.id ? { ...x, skill: n } : x)));
                  void onRate(p.id, n);
                }}
              />
            </View>
          ))}
        </View>
      )}
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
    </Card>
  );
}
