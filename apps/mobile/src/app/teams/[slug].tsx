import { balanceTeams, DEFAULT_SKILL, teamNames, teamsText, type GroupPage, type Team } from "@turnout/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Pop } from "@/components/motion";
import { SignInGate } from "@/components/SignInGate";
import { BackLink, Button, Card, Muted, Screen } from "@/components/ui";
import { useApi } from "@/lib/api";
import { shareText } from "@/lib/share";
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

  useEffect(() => {
    api.groupPage(slug).then(
      (p) => (p.viewer.isOrganizer ? setPage(p) : setError("Only the organizer can make teams.")),
      (e: Error) => setError(e.message),
    );
  }, [api, slug]);

  if (!page) return <Screen>{error ? <Text style={{ color: t.danger }}>{error}</Text> : <ActivityIndicator style={{ marginTop: 48 }} />}</Screen>;

  const skills = page.organizer?.skills ?? {};
  const players = page.roster.confirmed.map((r) => ({ memberId: r.memberId, name: r.name, skill: skills[r.memberId] ?? DEFAULT_SKILL }));

  const make = () => {
    shuffles.current += 1; // each press gives a different, equally fair split
    setTeams(balanceTeams(players, count, shuffles.current * 7919));
  };

  const rate = async (memberId: string, skill: number) => {
    try {
      setPage(await api.setSkill(slug, memberId, skill));
      setTeams(null); // ratings changed; rebuild
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
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  const share = async () => {
    if (!teams) return;
    if (await shareText(teamsText(page.group.name, teams.map((tm) => tm.players.map((p) => p.name))))) {
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

  return (
    <Screen>
      <BackLink fallback={{ pathname: "/g/[slug]", params: { slug } }} label="Back to group" />
      <Card>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: "800" }}>Players ({players.length})</Text>
        <Muted>Optional: rate players 1–5 so teams come out even. Only you see ratings.</Muted>
        {players.map((p) => (
          <View key={p.memberId} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: t.text, fontSize: 16, flex: 1 }} numberOfLines={1}>
              {p.name}
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
                setTeams(null);
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
          <Button icon={teams ? "shuffle" : undefined} label={teams ? "Shuffle" : "Make teams"} onPress={make} big={!teams} variant={teams ? "secondary" : "primary"} />
        </View>
      </Card>

      {teams && (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {teams.map((tm, i) => (
              <Pop key={`${i}-${tm.players.map((p) => p.memberId).join()}`} style={{ flexGrow: 1, flexBasis: "45%" }} delay={i * 80}>
                <Card>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: t.text, fontSize: 17, fontWeight: "900" }}>{teamNames[i]}</Text>
                    <Text style={{ color: t.muted }}>strength {tm.total}</Text>
                  </View>
                  {tm.players.map((p) => (
                    <Text key={p.memberId} style={{ color: t.text, fontSize: 15 }}>
                      {p.name}
                    </Text>
                  ))}
                </Card>
              </Pop>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Button label="Save & show everyone" onPress={save} loading={busy === "save"} />
            <Button label="Share" variant="secondary" onPress={share} />
          </View>
          {notice && <Muted>{notice}</Muted>}
        </>
      )}
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
    </Screen>
  );
}
