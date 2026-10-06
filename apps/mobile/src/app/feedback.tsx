import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { SignInGate } from "@/components/SignInGate";
import { BackLink, Button, Card, Field, Muted, Screen } from "@/components/ui";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";

/** Suggest an improvement, from the account menu. Goes straight to the people building Turnout. */
export default function FeedbackScreen() {
  return (
    <SignInGate reason="Sign in to send a suggestion.">
      <Suggest />
    </SignInGate>
  );
}

function Suggest() {
  const t = useTheme();
  const api = useApi();
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Screen>
      <BackLink fallback="/dashboard" />
      <Card>
        {sent ? (
          <>
            <Text style={{ color: t.text, fontSize: 22, fontWeight: "900" }}>Thanks, got it 🙏</Text>
            <Muted>We read every one. If we have a question, we'll reply by email.</Muted>
            <View style={{ flexDirection: "row" }}>
              <Button label="Back to your groups" onPress={() => router.replace("/dashboard")} />
            </View>
          </>
        ) : (
          <>
            <Text style={{ color: t.text, fontSize: 22, fontWeight: "900" }}>Suggest an improvement</Text>
            <Muted>Something missing, confusing or annoying? Tell us what you were trying to do.</Muted>
            <Field label="Your idea" placeholder="It would help if…" value={message} onChangeText={setMessage} multiline style={{ minHeight: 120, textAlignVertical: "top" }} />
            <View style={{ flexDirection: "row" }}>
              <Button
                label="Send"
                disabled={!message.trim()}
                loading={busy}
                onPress={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await api.feedback({ source: "suggestion", message });
                    setSent(true);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </View>
            {error && <Text style={{ color: t.danger }}>{error}</Text>}
          </>
        )}
      </Card>
    </Screen>
  );
}
