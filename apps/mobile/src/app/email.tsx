import { Link, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Card, Muted, Screen } from "@/components/ui";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";

/** Landing page for the links in reminder emails: ?confirm=<token> or ?unsubscribe=<token>. */
export default function EmailLink() {
  const t = useTheme();
  const api = useApi();
  const { confirm, unsubscribe } = useLocalSearchParams<{ confirm?: string; unsubscribe?: string }>();
  const [result, setResult] = useState<{ groupName: string; slug: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);
  const token = confirm ?? unsubscribe;

  useEffect(() => {
    if (done.current || !token) return;
    done.current = true; // tokens are one-shot for unsubscribe; don't double-post
    (confirm ? api.confirmEmail(token) : api.unsubscribeEmail(token)).then(setResult, (e: Error) => setError(e.message));
  }, [api, confirm, token]);

  return (
    <Screen>
      <Card>
        {!token || error ? (
          <>
            <Text style={{ color: t.text, fontSize: 20, fontWeight: "800" }}>That link didn't work</Text>
            <Muted>{error ?? "This link is incomplete."}</Muted>
          </>
        ) : !result ? (
          <ActivityIndicator />
        ) : confirm ? (
          <>
            <Text style={{ color: t.text, fontSize: 22, fontWeight: "900" }}>You're all set ✅</Text>
            <Muted>We'll email you before each {result.groupName} game. Every email has a link to stop.</Muted>
          </>
        ) : (
          <>
            <Text style={{ color: t.text, fontSize: 22, fontWeight: "900" }}>Emails stopped</Text>
            <Muted>You won't get any more reminder emails for {result.groupName}.</Muted>
          </>
        )}
        {result && (
          <View style={{ marginTop: 8 }}>
            <Link href={{ pathname: "/g/[slug]", params: { slug: result.slug } }}>
              <Text style={{ color: t.accent, fontWeight: "700" }}>Go to {result.groupName} →</Text>
            </Link>
          </View>
        )}
      </Card>
    </Screen>
  );
}
