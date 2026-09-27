import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text } from "react-native";
import { Card, Muted, Screen } from "@/components/ui";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";

/** Opened from the "use Turnout on your new phone" email: puts this device back on the member. */
export default function Restore() {
  const t = useTheme();
  const api = useApi();
  const { t: token } = useLocalSearchParams<{ t?: string }>();
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !token) return;
    done.current = true; // the link works once
    api.restore(token).then(
      (r) => router.replace({ pathname: "/g/[slug]", params: { slug: r.slug } }),
      (e: Error) => setError(e.message),
    );
  }, [api, token]);

  return (
    <Screen>
      <Card>
        {!token || error ? (
          <>
            <Text style={{ color: t.text, fontSize: 20, fontWeight: "800" }}>That link didn't work</Text>
            <Muted>{error ?? "This link is incomplete."}</Muted>
          </>
        ) : (
          <>
            <ActivityIndicator />
            <Muted>Setting up this phone…</Muted>
          </>
        )}
      </Card>
    </Screen>
  );
}
