import { badges, nextBadge, type Badge, type PlayerStats } from "@turnout/shared";
import { Text, View } from "react-native";
import { tint, useTheme } from "@/lib/theme";
import { Icon } from "./Icon";
import { Pop } from "./motion";
import { ProgressBar } from "./ui";

// A player's badges: the ones they have as warm chips, and the next one with how close they are.

export function BadgeRow({ stats, compact }: { stats: PlayerStats; compact?: boolean }) {
  const t = useTheme();
  const all = badges(stats);
  const earned = all.filter((b) => b.earned);
  const next = nextBadge(stats);
  if (earned.length === 0 && !next) return null;
  return (
    <View style={{ gap: 10 }}>
      {earned.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {earned.map((b) => <BadgeChip key={b.id} badge={b} />)}
        </View>
      )}
      {next && !compact && (
        <View style={{ gap: 6 }}>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            Next: <Text style={{ color: t.text, fontWeight: "700" }}>{next.title}</Text> · {next.body}
          </Text>
          <ProgressBar value={next.progress} max={1} height={5} tone={t.energy} />
        </View>
      )}
    </View>
  );
}

export function BadgeChip({ badge, big }: { badge: Badge; big?: boolean }) {
  const t = useTheme();
  return (
    <View accessibilityLabel={`${badge.title}: ${badge.body}`} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: big ? 8 : 5, paddingHorizontal: big ? 14 : 10, borderRadius: 999, backgroundColor: tint(t.energy, 0.14), borderWidth: 1, borderColor: tint(t.energy, 0.4) }}>
      <Icon name="trophy" size={big ? 16 : 13} color={t.energy} strokeWidth={2.4} />
      <Text style={{ color: t.text, fontWeight: "800", fontSize: big ? 15 : 13 }}>{badge.title}</Text>
    </View>
  );
}

/** "You earned Regular": shown once, right after the tap that earned it. */
export function BadgeEarned({ badge }: { badge: Badge }) {
  const t = useTheme();
  return (
    <Pop>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.energySoft, borderRadius: 14, padding: 14 }}>
        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: tint(t.energy, 0.2), alignItems: "center", justifyContent: "center" }}>
          <Icon name="trophy" size={22} color={t.energy} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>You earned {badge.title}</Text>
          <Text style={{ color: t.muted, fontSize: 14 }}>{badge.body}</Text>
        </View>
      </View>
    </Pop>
  );
}
