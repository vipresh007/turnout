import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { Button, Muted, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

// Native sign-in returns here inside the in-app browser sheet; this hands the result back to the app.
WebBrowser.maybeCompleteAuthSession();

/** Where the sign-in page sends people back to. On web it finishes the full-page sign-in. */
export default function AuthCallback() {
  const t = useTheme();
  const { ready, completeRedirect } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "web" || !ready || started.current) return;
    started.current = true; // the code can only be exchanged once
    completeRedirect().then(
      (returnTo) => router.replace(returnTo as never),
      (e: Error) => setError(e.message),
    );
  }, [ready, completeRedirect]);

  return (
    <Screen>
      {error ? (
        <View style={{ gap: 16, marginTop: 48 }}>
          <Text style={{ color: t.text, fontSize: 20, fontWeight: "800" }}>Couldn't sign you in</Text>
          <Text style={{ color: t.danger }}>{error}</Text>
          <View style={{ flexDirection: "row" }}>
            <Button label="Try again" onPress={() => router.replace("/dashboard")} />
          </View>
        </View>
      ) : (
        <View style={{ gap: 12, marginTop: 48, alignItems: "center" }}>
          <ActivityIndicator />
          <Muted>Signing you in…</Muted>
        </View>
      )}
    </Screen>
  );
}
