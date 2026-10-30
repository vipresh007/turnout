import { teamNames, teamsText, type Rsvp } from "@turnout/shared";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/lib/theme";
import { Icon } from "../Icon";
import { Card, SectionHeader } from "../ui";

/** This week's teams, folded to one line until someone wants the full lists. */
export function Teams({ teams, roster, groupName, onShare }: { teams: string[][]; roster: Rsvp[]; groupName: string; onShare: (text: string) => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const names = new Map(roster.map((r) => [r.memberId, r.name]));
  const named = teams.map((ids) => ids.map((id) => names.get(id)).filter((n): n is string => !!n));
  const text = teamsText(groupName, named);
  const summary = named.map((ns, i) => `${teamNames[i]} (${ns.length})`).join(" vs ");
  return (
    <Card>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((o) => !o)}>
        <SectionHeader
          icon="flag"
          title="Teams"
          eyebrow={open ? undefined : summary}
          right={
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Pressable accessibilityRole="button" onPress={() => onShare(text)} hitSlop={8} style={({ hovered }: { hovered?: boolean }) => ({ opacity: hovered ? 0.7 : 1 })}>
                <Text style={{ color: t.accent, fontWeight: "700" }}>Share</Text>
              </Pressable>
              <Icon name={open ? "chevronDown" : "chevronRight"} size={18} color={t.muted} />
            </View>
          }
        />
      </Pressable>
      {open && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {named.map((ns, i) => (
            <View key={i} style={{ flexGrow: 1, flexBasis: "45%", backgroundColor: t.surface2, borderRadius: 12, padding: 12, gap: 4 }}>
              <Text style={{ color: i % 2 ? t.energy : t.accent, fontWeight: "900" }}>{teamNames[i]}</Text>
              {ns.map((n) => <Text key={n} style={{ color: t.text }}>{n}</Text>)}
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}
