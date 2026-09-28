import Head from "expo-router/head";
import type { ReactNode } from "react";
import { Linking, Text, View } from "react-native";
import { useTheme } from "@/lib/theme";
import { Screen } from "./ui";

export const CONTACT_EMAIL = "contact@dataeaver.ca";

/** Layout for the privacy policy and terms: plain, readable text with headings. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <Screen>
      <Head>
        <title>{`${title} · Turnout`}</title>
      </Head>
      <View style={{ gap: 4, marginTop: 8 }}>
        <Text role="heading" aria-level={1} style={{ color: t.text, fontSize: 32, fontWeight: "900", letterSpacing: -1 }}>{title}</Text>
        <Text style={{ color: t.muted }}>Last updated {updated}</Text>
      </View>
      <View style={{ gap: 14, paddingBottom: 48 }}>{children}</View>
    </Screen>
  );
}

export function H({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text role="heading" aria-level={2} style={{ color: t.text, fontSize: 20, fontWeight: "800", marginTop: 12 }}>{children}</Text>;
}

export function P({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.text, fontSize: 16, lineHeight: 24 }}>{children}</Text>;
}

export function Li({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 10, paddingLeft: 4 }}>
      <Text style={{ color: t.accent, fontSize: 16, lineHeight: 24 }}>•</Text>
      <Text style={{ color: t.text, fontSize: 16, lineHeight: 24, flex: 1 }}>{children}</Text>
    </View>
  );
}

export function Email() {
  const t = useTheme();
  return (
    <Text accessibilityRole="link" onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)} style={{ color: t.accent, fontWeight: "700" }}>
      {CONTACT_EMAIL}
    </Text>
  );
}
