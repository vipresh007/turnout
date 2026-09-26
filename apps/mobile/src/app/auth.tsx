import * as WebBrowser from "expo-web-browser";
import { ActivityIndicator } from "react-native";
import { Muted, Screen } from "@/components/ui";

// Sign-in redirects here. On web this closes the popup and hands the result back to the opener.
WebBrowser.maybeCompleteAuthSession();

export default function AuthCallback() {
  return (
    <Screen>
      <ActivityIndicator style={{ marginTop: 48 }} />
      <Muted>Signing you in…</Muted>
    </Screen>
  );
}
