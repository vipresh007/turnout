import { Text, View } from "react-native";
import { MarketingPage } from "@/components/MarketingPage";
import { Card } from "@/components/ui";
import { comparison } from "@/content/site";
import { useTheme } from "@/lib/theme";

/** Turnout next to the usual alternatives (copy in content/site.ts). */
export default function Compare() {
  const t = useTheme();
  return (
    <MarketingPage
      title={`${comparison.title} · Turnout`}
      description={comparison.intro}
      eyebrow="Compare"
      heading={comparison.title}
      intro={comparison.intro}
    >
      {comparison.rows.map((r) => {
        const us = r.option === "Turnout";
        return (
          <Card key={r.option}>
            <Text role="heading" aria-level={2} style={{ color: us ? t.accent : t.text, fontSize: 18, fontWeight: "800" }}>{r.option}</Text>
            <View style={{ gap: 6 }}>
              <Text style={{ color: t.text, fontSize: 15, lineHeight: 22 }}><Text style={{ fontWeight: "800" }}>Good at: </Text>{r.good}</Text>
              <Text style={{ color: t.muted, fontSize: 15, lineHeight: 22 }}><Text style={{ fontWeight: "800", color: t.text }}>{us ? "Not for: " : "Falls short: "}</Text>{r.gap}</Text>
            </View>
          </Card>
        );
      })}
    </MarketingPage>
  );
}
