import { Link, router } from "expo-router";
import Head from "expo-router/head";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { activities } from "@/content/site";
import { AppStoreBadge } from "./AppStoreBadge";
import { useTheme } from "@/lib/theme";
import { Icon } from "./Icon";
import { Button, Card, Display, Screen } from "./ui";

/** Shared layout for the public use-case and comparison pages: headline, intro, calls to action, then sections. */
export function MarketingPage({ title, description, eyebrow, heading, intro, children }: {
  title: string; description: string; eyebrow: string; heading: string; intro: string; children: ReactNode;
}) {
  const t = useTheme();
  return (
    <Screen>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
      </Head>
      <View style={{ gap: 12, paddingTop: 8 }}>
        <Text style={{ color: t.accent, fontSize: 13, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>{eyebrow}</Text>
        <Display level="display" role="heading" aria-level={1} style={{ fontSize: 34, lineHeight: 40 }}>{heading}</Display>
        <Text style={{ color: t.muted, fontSize: 17, lineHeight: 25 }}>{intro}</Text>
        <View style={{ gap: 10, marginTop: 6 }}>
          <Button big label="Start a group, it's free" onPress={() => router.push("/new")} />
          <Button label="Try the demo" variant="secondary" onPress={() => router.push("/demo")} />
          <View style={{ alignItems: "center", marginTop: 4 }}>
            <AppStoreBadge height={44} />
          </View>
        </View>
      </View>
      {children}
      <MoreGames />
    </Screen>
  );
}

export function CheckList({ items }: { items: string[] }) {
  const t = useTheme();
  return (
    <View style={{ gap: 12 }}>
      {items.map((p) => (
        <View key={p} style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ paddingTop: 2 }}><Icon name="check" size={18} color={t.accent} strokeWidth={2.4} /></View>
          <Text style={{ color: t.text, fontSize: 16, lineHeight: 23, flex: 1 }}>{p}</Text>
        </View>
      ))}
    </View>
  );
}

/** Links to the other use-case pages and the comparison. */
function MoreGames() {
  const t = useTheme();
  return (
    <Card>
      <Text role="heading" aria-level={2} style={{ color: t.text, fontSize: 17, fontWeight: "800" }}>Turnout for every kind of game</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {activities.map((a) => (
          <Link key={a.slug} href={{ pathname: "/for/[activity]", params: { activity: a.slug } }}>
            <Text style={{ color: t.text, borderWidth: 1, borderColor: t.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, overflow: "hidden" }}>{a.emoji} {a.name}</Text>
          </Link>
        ))}
      </View>
      <Link href="/compare"><Text style={{ color: t.accent, fontWeight: "700" }}>How Turnout compares to group chats, polls and team apps</Text></Link>
    </Card>
  );
}
