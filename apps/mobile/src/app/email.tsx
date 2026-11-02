import { Link, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Card, Muted, Screen } from "@/components/ui";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";

/** Landing page for links in emails: ?confirm=<token> or ?unsubscribe=<token> (player reminders), ?digest=<token> (an organizer's weekly digest). */
export default function EmailLink() {
  const t = useTheme();
  const api = useApi();
  const { confirm, unsubscribe, digest } = useLocalSearchParams<{ confirm?: string; unsubscribe?: string; digest?: string }>();
  const [result, setResult] = useState<{ groupName: string; slug: string } | null>(null);
  const [digestOff, setDigestOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);
  const token = confirm ?? unsubscribe ?? digest;

  useEffect(() => {
    if (done.current || !token) return;
    done.current = true; // tokens are one-shot for unsubscribe; don't double-post
    if (digest) {
      api.stopDigest(token).then(() => setDigestOff(true), (e: Error) => setError(e.message));
      return;
    }
    (confirm ? api.confirmEmail(token) : api.unsubscribeEmail(token)).then(setResult, (e: Error) => setError(e.message));
  }, [api, confirm, digest, token]);

  return (
    <Screen>
      <Card>
        {!token || error ? (
          <>
            <Text style={{ color: t.text, fontSize: 20, fontWeight: "800" }}>That link didn't work</Text>
            <Muted>{error ?? "This link is incomplete."}</Muted>
          </>
        ) : digest ? (
          digestOff ? (
            <>
              <Text style={{ color: t.text, fontSize: 22, fontWeight: "900" }}>Unsubscribed</Text>
              <Muted>You won't get the weekly digest anymore. Turn it back on any time in Account › Notifications. Game alerts are separate and unchanged.</Muted>
            </>
          ) : (
            <ActivityIndicator />
          )
        ) : !result ? (
          <ActivityIndicator />
        ) : confirm ? (
          <>
            <Text style={{ color: t.text, fontSize: 22, fontWeight: "900" }}>You're all set</Text>
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
