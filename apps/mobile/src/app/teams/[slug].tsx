import { balanceTeams, DEFAULT_SKILL, keepTeams, teamsText, type GroupPage, type Team, type TeamPlayer } from "@turnout/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Pop } from "@/components/motion";
import { SignInGate } from "@/components/SignInGate";
import { TeamBoard } from "@/components/TeamBoard";
import { BackLink, Button, Card, Muted, Screen } from "@/components/ui";
import { shareUrl, useApi } from "@/lib/api";
import { shareText } from "@/lib/share";
import { storage } from "@/lib/storage";
import { useTheme } from "@/lib/theme";

export default function TeamsScreen() {
  return (
    <SignInGate reason="Sign in to make teams for your group.">
      <TeamMaker />
    </SignInGate>
  );
}

function TeamMaker() {
  const t = useTheme();
  const api = useApi();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [page, setPage] = useState<GroupPage | null>(null);
  const [count, setCount] = useState(2);
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const shuffles = useRef(0);
  /** Seed for this visit's splits, so opening the screen twice doesn't always give the same draft. */
  const seedBase = useRef(0);
  /** The teams on screen are the ones saved for this week (players see them). */
  const [saved, setSaved] = useState(false);
  /** Players who said in after the teams were saved; they were added to a team for you. */
  const [added, setAdded] = useState<string[]>([]);
  const [editRatings, setEditRatings] = useState(false);

  useEffect(() => {
    api.groupPage(slug).then(
      async (p) => {
        if (!p.viewer.isOrganizer) return setError("Only the organizer can make teams.");
        // Open on this week's teams: the saved ones, or a fresh split from the saved ratings in the last team count used.
        seedBase.current = Date.now();
        const players = playersOf(p);
        const kept = p.session.teams?.teams;
        if (kept && kept.length >= 2) {
          const { teams, added } = keepTeams(kept, players);
          setCount(kept.length);
          setTeams(teams);
          setAdded(added.map((a) => a.name));
          setSaved(added.length === 0 && teams.every((tm) => tm.players.length > 0));
        } else {
          const n = Math.min(Number(await storage.get(`teamCount:${slug}`)) || 2, Math.max(2, players.length));
          setCount(n);
          if (players.length >= 2) setTeams(balanceTeams(players, n, seedBase.current));
        }
        setPage(p);
      },
      (e: Error) => setError(e.message),
    );
  }, [api, slug]);

  if (!page) return <Screen>{error ? <Text style={{ color: t.danger }}>{error}</Text> : <ActivityIndicator style={{ marginTop: 48 }} />}</Screen>;

  const skills = page.organizer?.skills ?? {};
  const players = playersOf(page);
  const unrated = players.filter((p) => skills[p.memberId] === undefined);

  const draft = (next: Team[]) => {
    setTeams(next);
    setSaved(false);
    setAdded([]);
  };

  const make = (n = count, from: TeamPlayer[] = players) => {
    shuffles.current += 1; // each press gives a different, equally fair split
    draft(balanceTeams(from, n, seedBase.current + shuffles.current * 7919));
  };

  const rate = async (memberId: string, skill: number) => {
    try {
      const next = await api.setSkill(slug, memberId, skill);
      setPage(next);
      make(count, playersOf(next)); // ratings changed; rebalance
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const save = async () => {
    if (!teams) return;
    setBusy("save");
    setError(null);
    try {
      await api.saveTeams(slug, teams.map((tm) => tm.players.map((p) => p.memberId)));
      void storage.set(`teamCount:${slug}`, String(teams.length));
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  /** Tap a name: they move to the next team (A → B → … → A). Strength totals follow. */
  const move = (memberId: string, from: number) => {
    if (!teams) return;
    const to = (from + 1) % teams.length;
    const player = teams[from]!.players.find((p) => p.memberId === memberId);
    if (!player) return;
    draft(teams.map((tm, i) => {
      const players = i === from ? tm.players.filter((p) => p.memberId !== memberId) : i === to ? [...tm.players, player] : tm.players;
      return { players, total: players.reduce((n, p) => n + p.skill, 0) };
    }));
  };

  const share = async () => {
    if (!teams) return;
    if (await shareText(teamsText(page.group.name, teams.map((tm) => tm.players.map((p) => p.name)), page.group.activity, { startsAt: page.session.startsAt, timezone: page.group.timezone, location: page.session.location ?? page.group.location, link: shareUrl(slug) }))) {
      setNotice("Copied to clipboard");
      setTimeout(() => setNotice(null), 2000);
    }
  };

  if (players.length < 2) {
    return (
      <Screen>
        <BackLink fallback={{ pathname: "/g/[slug]", params: { slug } }} label="Back to group" />
        <Card>
          <Text style={{ color: t.text, fontSize: 18, fontWeight: "800" }}>Not enough players yet</Text>
          <Muted>Teams need at least two people who are in this week.</Muted>
        </Card>
      </Screen>
    );
  }

  const rated = players.length - unrated.length;
  const showAll = editRatings || rated === 0;

  return (
    <Screen>
      <BackLink fallback={{ pathname: "/g/[slug]", params: { slug } }} label="Back to group" />
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text style={{ color: t.text, fontSize: 17, fontWeight: "800" }}>Ratings</Text>
          {rated > 0 && (
            <Pressable accessibilityRole="button" onPress={() => setEditRatings(!editRatings)} hitSlop={8} style={({ hovered }: { hovered?: boolean }) => ({ opacity: hovered ? 0.7 : 1 })}>
              <Text style={{ color: t.accent, fontWeight: "700" }}>{editRatings ? "Done" : "Edit ratings"}</Text>
            </Pressable>
          )}
        </View>
        <Muted>
          {rated === 0
            ? "Optional: rate players 1–5 so teams come out even. Ratings are saved, so you only do this once. Only you see them."
            : unrated.length === 0
              ? `All ${players.length} players rated. Ratings are saved and used every week; only you see them.`
              : `${unrated.length} new ${unrated.length === 1 ? "player isn't" : "players aren't"} rated yet (they count as ${DEFAULT_SKILL}). Everyone else's rating is saved from before.`}
        </Muted>
        {(showAll ? players : unrated).map((p) => (
          <View key={p.memberId} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: t.text, fontSize: 16, flex: 1 }} numberOfLines={1}>
              {p.name}
              {skills[p.memberId] === undefined && rated > 0 ? <Text style={{ color: t.energy, fontSize: 13 }}>  new</Text> : null}
            </Text>
            <View style={{ flexDirection: "row", gap: 4 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${p.name} ${n} of 5`}
                  onPress={() => rate(p.memberId, n)}
                  hitSlop={4}
                  style={({ hovered }: { hovered?: boolean }) => ({
                    width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center",
                    backgroundColor: n <= p.skill ? t.accent : hovered ? t.soft : t.bg, borderWidth: 1, borderColor: n <= p.skill || hovered ? t.accent : t.border,
                  })}
                >
                  <Text style={{ color: n <= p.skill ? t.accentText : t.muted, fontSize: 11, fontWeight: "800" }}>{n}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={{ color: t.muted, fontSize: 13, fontWeight: "700" }}>Number of teams</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[2, 3, 4].filter((n) => n <= players.length).map((n) => (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityState={{ selected: count === n }}
              onPress={() => {
                setCount(n);
                void storage.set(`teamCount:${slug}`, String(n));
                make(n);
              }}
              style={({ hovered }: { hovered?: boolean }) => ({
                paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1,
                borderColor: count === n ? t.accent : hovered ? t.accent : t.border, backgroundColor: count === n ? t.soft : t.card,
              })}
            >
              <Text style={{ color: count === n ? t.accent : t.text, fontWeight: "800" }}>{n}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: "row" }}>
          <Button icon={teams ? "shuffle" : undefined} label={teams ? "Shuffle" : "Make teams"} onPress={() => make()} big={!teams} variant={teams ? "secondary" : "primary"} />
        </View>
      </Card>

      {teams && (
        <>
          <Muted>
            {saved
              ? "These are this week's teams. Players see them on the group page."
              : added.length
                ? `${added.join(", ")} said in after you saved, so ${added.length === 1 ? "they were" : "they were each"} added to a team. Save to show the update.`
                : "Made from your saved ratings. Players see the teams once you save."}
          </Muted>
          <Pop key={teams.map((tm) => tm.players.map((p) => p.memberId).join()).join("|")}>
            <TeamBoard
              teams={teams.map((tm) => tm.players.map((p) => ({ key: p.memberId, name: p.name })))}
              totals={teams.map((tm) => tm.total)}
              onPress={(i, key) => move(key, i)}
            />
          </Pop>
          <Muted>Tap a name to move them to the next team.</Muted>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {!saved && <Button label="Save & show everyone" onPress={save} loading={busy === "save"} />}
            <Button label="Share" variant="secondary" onPress={share} />
          </View>
          {notice && <Muted>{notice}</Muted>}
        </>
      )}
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
    </Screen>
  );
}

/** Who's in this week, with the organizer's saved rating (unrated players count as the middle). */
function playersOf(page: GroupPage): TeamPlayer[] {
  const skills = page.organizer?.skills ?? {};
  return page.roster.confirmed.map((r) => ({ memberId: r.memberId, name: r.name, skill: skills[r.memberId] ?? DEFAULT_SKILL }));
}
