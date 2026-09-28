import type { MemberSummary } from "@turnout/shared";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { SignInGate } from "@/components/SignInGate";
import { BackLink, Button, Card, Muted, Screen } from "@/components/ui";
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
  const [merging, setMerging] = useState<MemberSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => api.members(slug).then((r) => setMembers(r.members), (e: Error) => setError(e.message)), [api, slug]);
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
      </View>
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
                {m.gamesIn} {m.gamesIn === 1 ? "game" : "games"} · {m.devices} {m.devices === 1 ? "device" : "devices"}
                {m.hasEmail ? " · 📧 reminders" : ""}
              </Text>
            </View>
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
