import { Redirect, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { CheckList, MarketingPage } from "@/components/MarketingPage";
import { Card, SectionTitle } from "@/components/ui";
import { activities, steps } from "@/content/site";
import { useTheme } from "@/lib/theme";

/** A use-case page: /for/pickup-soccer, /for/basketball, ... (copy in content/site.ts). */
export default function ActivityPage() {
  const t = useTheme();
  const { activity } = useLocalSearchParams<{ activity: string }>();
  const a = activities.find((x) => x.slug === activity);
  if (!a) return <Redirect href="/" />;
  return (
    <MarketingPage
      title={`${a.title} · Turnout`}
      description={`${a.intro.split(". ")[0]}. Free, and players need no app or account.`}
      eyebrow={`${a.emoji} Turnout for ${a.name}`}
      heading={a.title}
      intro={a.intro}
    >
      <Card>
        <SectionTitle icon="sparkles">Why organizers use it</SectionTitle>
        <CheckList items={a.points} />
      </Card>
      <Card>
        <SectionTitle icon="bolt">Set up in one sentence</SectionTitle>
        <Text style={{ color: t.muted, fontSize: 16, fontStyle: "italic" }}>“{a.example}”</Text>
        <View style={{ gap: 10 }}>
          {steps.map((s) => (
            <Text key={s.n} style={{ color: t.text, fontSize: 15, lineHeight: 22 }}>
              <Text style={{ color: t.accent, fontWeight: "900" }}>{s.n}. {s.title}. </Text>
              {s.body}
            </Text>
          ))}
        </View>
      </Card>
    </MarketingPage>
  );
}
