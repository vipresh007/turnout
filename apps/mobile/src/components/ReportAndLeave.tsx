import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { memberships, useApi, type Membership } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { confirm } from "@/lib/confirm";
import { useTheme } from "@/lib/theme";
import { Pop } from "./motion";
import { Button, Card, Muted, SectionTitle } from "./ui";

/**
 * Safety tools at the bottom of a group page: report the group or someone in it (it reaches us to review within a day),
 * and, for a player, leave the group so it disappears from this device (and their account).
 */
export function ReportAndLeave({ slug, people, me }: { slug: string; people: { id: string; name: string }[]; me: Membership | null }) {
  const t = useTheme();
  const api = useApi();
  const { status } = useAuth();
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leave = async () => {
    if (!me) return;
    if (!(await confirm("Leave this group?", "It disappears from this device. You can rejoin from the group's link any time.", "Leave"))) return;
    if (status === "signedIn") await api.unlinkMembership(me.memberId).catch(() => {});
    await memberships.forget(slug);
    router.replace("/");
  };

  return (
    <View style={{ gap: 12 }}>
      {open && (
        <Pop>
          <Card>
            {sent ? (
              <>
                <SectionTitle icon="check">Thanks for telling us</SectionTitle>
                <Muted>We review reports within 24 hours and remove anything that breaks our terms.</Muted>
              </>
            ) : (
              <>
                <SectionTitle icon="flag">Report a problem</SectionTitle>
                <Muted>Offensive names, abuse or spam. It goes to the Turnout team, not the organizer.</Muted>
                {people.length > 0 && (
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: t.muted, fontSize: 13, fontWeight: "600" }}>About someone? (optional)</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {people.slice(0, 30).map((p) => (
                        <Pressable
                          key={p.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected: who === p.id }}
                          onPress={() => setWho(who === p.id ? null : p.id)}
                          style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: who === p.id ? t.danger : t.border, backgroundColor: who === p.id ? t.card : t.bg }}
                        >
                          <Text style={{ color: who === p.id ? t.danger : t.text, fontWeight: "600" }}>{p.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  placeholder="What's wrong?"
                  placeholderTextColor={t.muted}
                  style={{ minHeight: 90, borderWidth: 1, borderRadius: 12, borderColor: t.border, backgroundColor: t.bg, color: t.text, padding: 14, fontSize: 16, textAlignVertical: "top" }}
                />
                {error && <Text style={{ color: t.danger }}>{error}</Text>}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Button label="Send report" variant="danger" loading={busy} disabled={reason.trim().length < 3} onPress={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      await api.report(slug, { reason, memberId: who ?? undefined });
                      setSent(true);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }} />
                  <Button label="Cancel" variant="secondary" onPress={() => setOpen(false)} />
                </View>
              </>
            )}
          </Card>
        </Pop>
      )}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 20 }}>
        {!open && (
          <Pressable accessibilityRole="button" onPress={() => { setOpen(true); setSent(false); }} hitSlop={8} style={({ hovered }: { hovered?: boolean }) => ({ opacity: hovered ? 0.7 : 1 })}>
            <Text style={{ color: t.muted, fontSize: 13, fontWeight: "600" }}>Report a problem</Text>
          </Pressable>
        )}
        {me && (
          <Pressable accessibilityRole="button" onPress={leave} hitSlop={8} style={({ hovered }: { hovered?: boolean }) => ({ opacity: hovered ? 0.7 : 1 })}>
            <Text style={{ color: t.muted, fontSize: 13, fontWeight: "600" }}>Leave this group</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
