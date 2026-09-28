import type { MemberSummary } from "@turnout/shared";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
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
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [members, setMembers] = useState<MemberSummary[] | null>(null);
  const [season, setSeason] = useState(false);
  const [merging, setMerging] = useState<MemberSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => api.members(slug).then((r) => {
    setMembers(r.members);
    setSeason(r.season);
  }, (e: Error) => setError(e.message)), [api, slug]);
  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <Screen>
      <BackLink fallback={{ pathname: "/g/[slug]", params: { slug } }} label="Back to group" />
      <View style={{ gap: 4 }}>
        <Text style={{ color: t.text, fontSize: 24, fontWeight: "900" }}>Members · {members.length}</Text>
        <Muted>Everyone who has joined. Same person twice (like a new phone)? Merge them so their history stays together.</Muted>
        {season && (
          <Muted>
            Season group: tick who's a season member ({members.filter((m) => m.seasonMember).length} now) and who has paid. Everyone else plays as a sub.
          </Muted>
        )}
      </View>
      <AddPlayers slug={slug} season={season} onAdded={load} />
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
          <View key={m.id} style={[{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }, i > 0 && { borderTopWidth: 1, borderColor: t.border }]}>
            <Avatar name={m.name} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 16, fontWeight: "600" }}>{m.name}</Text>
              <Text style={{ color: t.muted, fontSize: 13 }}>
                {m.gamesIn} {m.gamesIn === 1 ? "game" : "games"} · {m.devices ? `${m.devices} ${m.devices === 1 ? "device" : "devices"}` : "hasn't opened the link yet"}
                {m.hasEmail ? " · 📧 reminders" : ""}
              </Text>
            </View>
            {season && (
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Toggle label="Member" on={m.seasonMember} onPress={() => act(() => api.setSeason(slug, m.id, { member: !m.seasonMember }))} />
                {m.seasonMember && <Toggle label="Paid" on={m.seasonPaid} onPress={() => act(() => api.setSeason(slug, m.id, { paid: !m.seasonPaid }))} />}
              </View>
            )}
            <Pressable accessibilityRole="button" onPress={() => setMerging(m)} hitSlop={8} style={({ hovered }: { hovered?: boolean }) => ({ opacity: hovered ? 0.7 : 1 })}>
              <Text style={{ color: t.accent, fontWeight: "700" }}>Merge</Text>
            </Pressable>
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

function AddPlayers({ slug, season, onAdded }: { slug: string; season: boolean; onAdded: () => void }) {
  const t = useTheme();
  const api = useApi();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
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
              setText("");
              onAdded();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
        <Button label="Done" variant="secondary" onPress={() => { setOpen(false); setResult(null); }} />
      </View>
      {result && <Text style={{ color: t.accent, fontWeight: "700" }}>{result}</Text>}
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
    </Card>
  );
}
