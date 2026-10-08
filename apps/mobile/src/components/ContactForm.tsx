import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useAccount } from "@/lib/account";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { Button, Card, Field, Muted, SectionTitle } from "./ui";

/** Support page form: goes straight to our inbox, and replying answers the person who wrote. */
export function ContactForm() {
  const t = useTheme();
  const api = useApi();
  const account = useAccount();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const replyTo = email || account?.email || "";

  if (sent) {
    return (
      <Card>
        <SectionTitle icon="check">Thanks, we got it</SectionTitle>
        <Muted>We'll reply to {replyTo}, usually within one business day.</Muted>
      </Card>
    );
  }
  return (
    <Card>
      <SectionTitle icon="mail">Send us a message</SectionTitle>
      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <View style={{ flexGrow: 1, flexBasis: 180 }}>
          <Field label="Your name (optional)" value={name} onChangeText={setName} autoComplete="name" />
        </View>
        <View style={{ flexGrow: 1, flexBasis: 220 }}>
          <Field label="Email for our reply" placeholder={account?.email ?? "you@example.com"} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={{ color: t.muted, fontSize: 13, fontWeight: "600" }}>How can we help?</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          multiline
          placeholder="Your group's link or name helps, if it's about a group."
          placeholderTextColor={t.muted}
          style={{ minHeight: 120, borderWidth: 1, borderRadius: 12, borderColor: t.border, backgroundColor: t.bg, color: t.text, padding: 14, fontSize: 16, textAlignVertical: "top" }}
        />
      </View>
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
      <View style={{ flexDirection: "row" }}>
        <Button
          label="Send"
          loading={busy}
          disabled={!replyTo.includes("@") || message.trim().length < 5}
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              await api.contactSupport({ name: name.trim() || account?.name || undefined, email: replyTo, message });
              setSent(true);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </View>
    </Card>
  );
}
