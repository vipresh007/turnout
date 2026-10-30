import type { Roster, Rsvp } from "@turnout/shared";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/lib/theme";
import { webTransition } from "@/lib/webStyle";
import { Avatar } from "../Avatar";
import { Pop } from "../motion";
import { Card, Chip, EmptyState, Pill } from "../ui";

// Who's in, waiting, or out: one card with a segment per list. Players see a grid of names (quick to scan);
// organizers see rows with the paid toggle and remove.

type Segment = "in" | "waitlist" | "out";

export function Rosters({ roster, organizer, onRemove, paid, onTogglePaid, lateDrops, seasonMembers }: {
  roster: Roster;
  organizer: boolean;
  onRemove?: (p: Rsvp) => void;
  paid?: Set<string>;
  onTogglePaid?: (p: Rsvp) => void;
  lateDrops?: Set<string>;
  /** Season groups: members paid up front; everyone else is tagged a sub and pays per game. */
  seasonMembers?: Set<string> | null;
}) {
  const t = useTheme();
  const [segment, setSegment] = useState<Segment>("in");
  const all: { key: Segment; label: string; people: Rsvp[]; tone?: string }[] = [
    { key: "in", label: `In · ${roster.confirmed.length}`, people: roster.confirmed },
    { key: "waitlist", label: `Waitlist · ${roster.waitlist.length}`, people: roster.waitlist, tone: t.energy },
    { key: "out", label: `Out · ${roster.out.length}`, people: roster.out, tone: t.muted },
  ];
  const lists = all.filter((l) => l.key === "in" || l.people.length > 0);
  const current = lists.find((l) => l.key === segment) ?? lists[0]!;
  const numbered = current.key !== "out";

  return (
    <Card>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {lists.map((l) => <Chip key={l.key} label={l.label} selected={current.key === l.key} tone={l.tone} onPress={() => setSegment(l.key)} />)}
      </View>
      {current.people.length === 0 ? (
        <EmptyState illustration="emptyRoster" title="Nobody yet" body="Be the first: tap I'm in above." />
      ) : organizer ? (
        <View style={{ gap: 10 }}>
          {current.people.map((p, i) => (
            <Pop key={p.memberId} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {numbered && <Text numberOfLines={1} style={{ color: t.muted, width: 22, textAlign: "right", fontVariant: ["tabular-nums"] }}>{i + 1}</Text>}
              <Avatar name={p.name} />
              <Text style={{ color: t.text, fontSize: 16, flexShrink: 1 }} numberOfLines={1}>{p.name}</Text>
              {seasonMembers && !seasonMembers.has(p.memberId) && <Pill label="sub" />}
              {lateDrops?.has(p.memberId) && <Pill label="late drop" color={t.energy} />}
              <View style={{ flex: 1 }} />
              {onTogglePaid && paid && current.key === "in" && !seasonMembers?.has(p.memberId) && (
                <Chip label={paid.has(p.memberId) ? "Paid" : "Paid?"} icon={paid.has(p.memberId) ? "check" : undefined} selected={paid.has(p.memberId)} onPress={() => onTogglePaid(p)} />
              )}
              {onRemove && (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`} onPress={() => onRemove(p)} hitSlop={12} style={{ paddingHorizontal: 4 }}>
                  {({ hovered }: { hovered?: boolean }) => <Text style={{ color: hovered ? t.danger : t.muted, fontSize: 20 }}>×</Text>}
                </Pressable>
              )}
            </Pop>
          ))}
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {current.people.map((p, i) => (
            <Pop key={p.memberId}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, borderRadius: 999, backgroundColor: t.surface2, ...webTransition }}>
                <Avatar name={p.name} size={26} />
                <Text style={{ color: t.text, fontWeight: "600", fontSize: 15 }} numberOfLines={1}>{p.name}</Text>
                {numbered && current.key === "waitlist" && <Text style={{ color: t.energy, fontWeight: "800", fontSize: 12 }}>#{i + 1}</Text>}
                {seasonMembers && !seasonMembers.has(p.memberId) && <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700" }}>sub</Text>}
              </View>
            </Pop>
          ))}
        </View>
      )}
    </Card>
  );
}
