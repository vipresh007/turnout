import { Link } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useAuth, type Provider } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Card, Muted, Screen } from "./ui";

const labels: Record<Provider, string> = {
  microsoft: "Continue with Microsoft",
  google: "Continue with Google",
  apple: "Continue with Apple",
  email: "Continue with email",
};

/** Shows children only to a signed-in organizer. Members never need to sign in. */
export function SignInGate({ children, reason }: { children: ReactNode; reason: string }) {
  const t = useTheme();
  const { status, ready, providers, signIn } = useAuth();
  if (status === "signedIn") return <>{children}</>;
  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 8 }}>
        <Link href="/" accessibilityLabel="Turnout home">
          <Text style={{ color: t.text, fontSize: 24, fontWeight: "900", letterSpacing: -1 }}>
            turnout<Text style={{ color: t.accent }}>.</Text>
          </Text>
        </Link>
        <Link href="/">
          <Text style={{ color: t.muted, fontWeight: "600" }}>← Back to home</Text>
        </Link>
      </View>
      {status === "loading" ? (
        <ActivityIndicator style={{ marginTop: 48 }} />
      ) : (
        <View style={{ marginTop: 32 }}>
          <Card>
            <Text style={{ color: t.text, fontSize: 24, fontWeight: "900", letterSpacing: -0.5 }}>Sign in to Turnout</Text>
            <Muted>{reason} Players never need an account. Only organizers sign in.</Muted>
            <View style={{ gap: 10, marginTop: 4 }}>
              {providers.map((p) => (
                <ProviderButton key={p} provider={p} disabled={!ready} onPress={() => signIn(p)} />
              ))}
            </View>
            <Text style={{ color: t.muted, fontSize: 12, textAlign: "center" }}>New here? Any option creates your account automatically.</Text>
          </Card>
        </View>
      )}
    </Screen>
  );
}

function ProviderButton({ provider, disabled, onPress }: { provider: Provider; disabled: boolean; onPress: () => void }) {
  const t = useTheme();
  const primary = provider === "email";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: primary ? t.accent : t.border,
        backgroundColor: primary ? t.accent : hovered ? t.bg : t.card,
        opacity: disabled ? 0.5 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <ProviderMark provider={provider} />
      <Text style={{ color: primary ? t.accentText : t.text, fontWeight: "700", fontSize: 16 }}>{labels[provider]}</Text>
    </Pressable>
  );
}

/** Simple provider marks drawn with views/text, so there are no image assets to manage. */
function ProviderMark({ provider }: { provider: Provider }) {
  const t = useTheme();
  if (provider === "microsoft") {
    const sq = (c: string) => <View style={{ width: 8, height: 8, backgroundColor: c }} />;
    return (
      <View style={{ width: 18, height: 18, flexDirection: "row", flexWrap: "wrap", gap: 2 }}>
        {sq("#F25022")}
        {sq("#7FBA00")}
        {sq("#00A4EF")}
        {sq("#FFB900")}
      </View>
    );
  }
  if (provider === "google") return <Text style={{ fontSize: 18, fontWeight: "900", color: "#4285F4" }}>G</Text>;
  if (provider === "apple") return <Text style={{ fontSize: 18, color: t.text }}></Text>;
  return <Text style={{ fontSize: 16 }}>✉️</Text>;
}
