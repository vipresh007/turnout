import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text } from "react-native";
import { SignInGate } from "@/components/SignInGate";
import { Button, Card, Muted, Screen } from "@/components/ui";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";

/** Opened from a co-organizer invite: /organize?t=<token>. Sign in, then accept. */
export default function OrganizeInvite() {
  const t = useTheme();
  const api = useApi();
  const { t: token } = useLocalSearchParams<{ t?: string }>();
  const [groupName, setGroupName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(token ? null : "This link is incomplete.");

  useEffect(() => {
    if (token) api.organizerInvite(token).then((r) => setGroupName(r.groupName), (e: Error) => setError(e.message));
  }, [api, token]);

  if (error) {
    return (
      <Screen>
        <Card>
          <Text style={{ color: t.text, fontSize: 20, fontWeight: "800" }}>That invite didn't work</Text>
          <Muted>{error}</Muted>
        </Card>
      </Screen>
    );
  }
  if (!groupName) return <Screen><ActivityIndicator style={{ marginTop: 48 }} /></Screen>;

  return (
    <SignInGate reason={`You've been invited to help run ${groupName}.`}>
      <Accept token={token!} groupName={groupName} />
    </SignInGate>
  );
}

function Accept({ token, groupName }: { token: string; groupName: string }) {
  const t = useTheme();
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Screen>
      <Card>
        <Text style={{ color: t.text, fontSize: 24, fontWeight: "900" }}>Help run {groupName}?</Text>
        <Muted>You'll be a co-organizer: send reminders, cancel or move a week, edit details, make teams and mark payments. It shows up on your dashboard.</Muted>
        <Button
          label="Accept"
          big
          loading={busy}
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              const { slug } = await api.acceptOrganizerInvite(token);
              router.replace({ pathname: "/g/[slug]", params: { slug } });
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        />
        {error && <Text style={{ color: t.danger }}>{error}</Text>}
      </Card>
    </Screen>
  );
}
