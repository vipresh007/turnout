import { teamNames, teamsText, type Rsvp, type TeamsPostGame } from "@turnout/shared";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/lib/theme";
import { Icon } from "../Icon";
import { TeamBoard } from "../TeamBoard";
import { Card, SectionHeader } from "../ui";

/** This week's teams, folded to one line until someone wants the full lists. */
export function Teams({ teams, roster, groupName, activity, game, onShare }: { teams: string[][]; roster: Rsvp[]; groupName: string; activity?: string | null; game?: TeamsPostGame; onShare: (text: string) => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const names = new Map(roster.map((r) => [r.memberId, r.name]));
  const named = teams.map((ids) => ids.map((id) => names.get(id)).filter((n): n is string => !!n));
  const text = teamsText(groupName, named, activity ?? null, game);
  const summary = named.map((ns, i) => `${teamNames[i]} (${ns.length})`).join(" vs ");
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((o) => !o)} style={{ flex: 1 }}>
          <SectionHeader icon="flag" title="Teams" eyebrow={open ? undefined : summary} right={<Icon name={open ? "chevronDown" : "chevronRight"} size={18} color={t.muted} />} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => onShare(text)} hitSlop={8} style={({ hovered }: { hovered?: boolean }) => ({ opacity: hovered ? 0.7 : 1 })}>
          <Text style={{ color: t.accent, fontWeight: "700" }}>Share</Text>
        </Pressable>
      </View>
      {open && (
        <TeamBoard teams={named.map((ns) => ns.map((n, k) => ({ key: `${k}-${n}`, name: n })))} />
      )}
    </Card>
  );
}
