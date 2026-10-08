import { Link } from "expo-router";
import { useEffect, type ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { wakeApi } from "@/lib/api";
import { useAuth, type Provider } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { AppleLogo, EmailIcon, GoogleLogo, MicrosoftLogo } from "./BrandLogos";
import { Muted, Screen } from "./ui";

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
  useEffect(() => {
    if (status === "signedOut") wakeApi(); // warm the API while they pick a sign-in method
  }, [status]);
  if (status === "signedIn") return <>{children}</>;
  return (
    <Screen>
      {status === "loading" ? (
        <ActivityIndicator style={{ marginTop: 48 }} />
      ) : (
        // No card: just the logo, a title and the buttons, with room to breathe on a phone.
        <View style={{ gap: 28, paddingTop: 24, paddingHorizontal: 8, width: "100%", maxWidth: 420, alignSelf: "center" }}>
          <View style={{ gap: 10 }}>
            {Platform.OS !== "web" && ( // the website's header already shows the logo
              <Text style={{ color: t.text, fontSize: 26, fontWeight: "900", letterSpacing: -1 }}>
                turnout<Text style={{ color: t.accent }}>.</Text>
              </Text>
            )}
            <Text style={{ color: t.text, fontSize: 32, fontWeight: "900", letterSpacing: -1 }}>Sign in</Text>
            <Muted>{reason}</Muted>
          </View>
          <View style={{ gap: 10 }}>
            {providers.map((p) => (
              <ProviderButton key={p} provider={p} disabled={!ready} onPress={() => signIn(p)} />
            ))}
          </View>
          <Text style={{ color: t.muted, fontSize: 12, lineHeight: 18, textAlign: "center" }}>
            New here? Any option creates your account. You agree to the{" "}
            <Link href="/terms" style={{ textDecorationLine: "underline" }}>terms</Link> and{" "}
            <Link href="/privacy" style={{ textDecorationLine: "underline" }}>privacy policy</Link>.
          </Text>
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
  if (provider === "microsoft") return <MicrosoftLogo />;
  if (provider === "google") return <GoogleLogo />;
  if (provider === "apple") return <AppleLogo />;
  return <EmailIcon color={t.accentText} />;
}
