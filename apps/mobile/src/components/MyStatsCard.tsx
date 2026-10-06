import { combinePlayerStats, type PlayerStats } from "@turnout/shared";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { memberships, onMembershipsChanged, useApi } from "@/lib/api";
import { StatsStrip } from "./PlayerStats";
import { Card, SectionTitle } from "./ui";
import { StatsLink } from "./YourGames";

/** "You as a player": your totals across the groups you play in, for organizers who play too. Hidden until you've played. */
export function MyStatsCard() {
  const api = useApi();
  const [total, setTotal] = useState<PlayerStats | null>(null);
  const load = useCallback(async () => {
    const all = await Promise.all(
      (await memberships.slugs()).map(async (slug) => {
        const m = await memberships.get(slug);
        return m ? api.memberStats(slug, m.token).then((r) => r.stats, () => null) : null;
      }),
    );
    setTotal(combinePlayerStats(all.filter((s): s is PlayerStats => s !== null)));
  }, [api]);
  useFocusEffect(useCallback(() => void load(), [load]));
  useEffect(() => onMembershipsChanged(() => void load()), [load]);
  if (!total || total.games === 0) return null;
  return (
    <Card>
      <SectionTitle icon="trending" right={<StatsLink label="Details" />}>You as a player</SectionTitle>
      <StatsStrip stats={total} />
    </Card>
  );
}
