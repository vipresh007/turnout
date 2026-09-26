import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button, Card, Muted, Screen } from "./ui";

/** Shows children only to a signed-in organizer. Members never need to sign in. */
export function SignInGate({ children, reason }: { children: ReactNode; reason: string }) {
  const t = useTheme();
  const { status, ready, signIn } = useAuth();
  if (status === "signedIn") return <>{children}</>;
  return (
    <Screen>
      {status === "loading" ? (
        <ActivityIndicator style={{ marginTop: 48 }} />
      ) : (
        <Card>
          <Text style={{ color: t.text, fontSize: 20, fontWeight: "800" }}>Sign in to continue</Text>
          <Muted>{reason} Players never need an account. Only organizers sign in.</Muted>
          <View style={{ flexDirection: "row" }}>
            <Button label="Sign in" onPress={signIn} disabled={!ready} />
          </View>
        </Card>
      )}
    </Screen>
  );
}
