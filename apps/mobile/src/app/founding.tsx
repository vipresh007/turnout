import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { SignInGate } from "@/components/SignInGate";
import { BackLink, Button, Card, Field, Muted, Screen } from "@/components/ui";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";

/** "I'd pay for this" from the pricing section. Nothing is charged: it records interest and locks the founding price. */
export default function Founding() {
  return (
    <SignInGate reason="Sign in so we can hold the founding price for you.">
      <FoundingForm />
    </SignInGate>
  );
}

function FoundingForm() {
  const t = useTheme();
  const api = useApi();
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.pricing("yes", "landing", reason);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BackLink fallback="/" />
      <Card>
        {done ? (
          <>
            <Text style={{ color: t.text, fontSize: 24, fontWeight: "900" }}>You're on the founding list 🎉</Text>
            <Muted>Thanks. Everything stays free until we tell you, and your $49/year price is locked. We'll email you before anything changes.</Muted>
            <View style={{ flexDirection: "row" }}>
              <Button label="Go to your groups" onPress={() => router.replace("/dashboard")} />
            </View>
          </>
        ) : (
          <>
            <Text style={{ color: t.text, fontSize: 24, fontWeight: "900" }}>Organizer · $49/year</Text>
            <Muted>
              We're not charging anything yet. Tell us you'd pay and we'll lock the founding price for you, and use your answer to decide what to build.
            </Muted>
            <Field label="What would make it worth it? (optional)" placeholder="e.g. no more chasing people in the group chat" value={reason} onChangeText={setReason} multiline />
            <View style={{ flexDirection: "row" }}>
              <Button label="Count me in" onPress={join} loading={busy} />
            </View>
            {error && <Text style={{ color: t.danger }}>{error}</Text>}
          </>
        )}
      </Card>
    </Screen>
  );
}
