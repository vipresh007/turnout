import type { GroupOrganizer, GroupRole } from "@turnout/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Pop } from "@/components/motion";
import { SignInGate } from "@/components/SignInGate";
import { Button, Card, Muted, Screen } from "@/components/ui";
import { useApi } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { shareText } from "@/lib/share";
import { useTheme } from "@/lib/theme";

export default function OrganizersScreen() {
  return (
    <SignInGate reason="Sign in to manage who runs this group.">
      <Organizers />
    </SignInGate>
  );
}

function Organizers() {
  const t = useTheme();
  const api = useApi();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [state, setState] = useState<{ role: GroupRole; organizers: GroupOrganizer[] } | null>(null);
  const [invite, setInvite] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => api.organizers(slug).then(setState, (e: Error) => setError(e.message)), [api, slug]);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (action: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const shareInvite = async (url: string) => {
    const copied = await shareText(`Can you help me run our group on Turnout? Open this link and sign in (it works once, for 7 days): ${url}`);
    if (copied) setNotice("Invite copied. Send it to them directly, not the whole group chat.");
  };

  if (!state) return <Screen>{error ? <Text style={{ color: t.danger }}>{error}</Text> : <ActivityIndicator style={{ marginTop: 48 }} />}</Screen>;
  const isOwner = state.role === "owner";

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Text style={{ color: t.text, fontSize: 24, fontWeight: "900" }}>Organizers</Text>
        <Muted>
          Co-organizers can do everything you can: remind, cancel or move a week, edit the group, make teams and mark payments.
          Only the owner adds or removes organizers and hands the group over.
        </Muted>
      </View>

      <Card>
        {state.organizers.map((o, i) => (
          <View key={o.id} style={[{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, flexWrap: "wrap" }, i > 0 && { borderTopWidth: 1, borderColor: t.border }]}>
            <Avatar name={o.name} />
            <View style={{ flex: 1, minWidth: 140 }}>
              <Text style={{ color: t.text, fontSize: 16, fontWeight: "600" }} numberOfLines={1}>
                {o.name}
                {o.isYou ? " (you)" : ""}
              </Text>
              <Text style={{ color: o.role === "owner" ? t.accent : t.muted, fontSize: 13, fontWeight: "700" }}>{o.role === "owner" ? "Owner" : "Co-organizer"}</Text>
            </View>
            {isOwner && o.role === "admin" && (
              <View style={{ flexDirection: "row", gap: 16 }}>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  disabled={busy}
                  onPress={async () => {
                    if (await confirm(`Make ${o.name} the owner?`, "You'll stay on as a co-organizer. Only the owner can add or remove organizers.", "Make owner")) {
                      await act(async () => setState(await api.transferOwner(slug, o.id)));
                    }
                  }}
                >
                  <Text style={{ color: t.accent, fontWeight: "700" }}>Make owner</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  disabled={busy}
                  onPress={async () => {
                    if (await confirm(`Remove ${o.name}?`, "They'll no longer be able to manage this group.")) {
                      await act(async () => setState({ role: state.role, organizers: (await api.removeOrganizer(slug, o.id)).organizers }));
                    }
                  }}
                >
                  <Text style={{ color: t.danger, fontWeight: "700" }}>Remove</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}
      </Card>

      {isOwner ? (
        <Card>
          <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>Add a co-organizer</Text>
          <Muted>Send them a private invite link. They sign in once (Google, Microsoft, Apple or email) and the group shows up on their dashboard.</Muted>
          {invite ? (
            <Pop style={{ gap: 8 }}>
              <View style={{ backgroundColor: t.bg, borderRadius: 10, padding: 12 }}>
                <Text style={{ color: t.muted }} selectable>{invite}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Button label="Send invite" onPress={() => shareInvite(invite)} />
                <Button label="New link" variant="secondary" loading={busy} onPress={() => act(async () => setInvite((await api.inviteOrganizer(slug)).url))} />
              </View>
              <Muted>Each link works once, for 7 days.</Muted>
            </Pop>
          ) : (
            <View style={{ flexDirection: "row" }}>
              <Button
                label="Create invite link"
                loading={busy}
                onPress={() => act(async () => {
                  const { url } = await api.inviteOrganizer(slug);
                  setInvite(url);
                  await shareInvite(url);
                })}
              />
            </View>
          )}
        </Card>
      ) : (
        <View style={{ flexDirection: "row" }}>
          <Button
            label="Leave as organizer"
            variant="secondary"
            loading={busy}
            onPress={async () => {
              const me = state.organizers.find((o) => o.isYou);
              if (me && (await confirm("Stop organizing this group?", "You'll lose the organizer controls. The owner can invite you again.", "Leave"))) {
                await act(async () => {
                  await api.removeOrganizer(slug, me.id);
                  router.replace("/dashboard");
                });
              }
            }}
          />
        </View>
      )}
      {notice && <Muted>{notice}</Muted>}
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
    </Screen>
  );
}
