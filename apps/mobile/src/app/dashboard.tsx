import type { Group } from "@turnout/shared";
import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SignInGate } from "@/components/SignInGate";
import { Button, Card, Muted, Screen, Title } from "@/components/ui";
import { useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatTime, weekdayName } from "@/lib/format";
import { useTheme } from "@/lib/theme";

export default function DashboardScreen() {
  return (
    <SignInGate reason="Sign in to see and manage your groups.">
      <Dashboard />
    </SignInGate>
  );
}

function Dashboard() {
  const t = useTheme();
  const api = useApi();
  const { signOut } = useAuth();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      api.myGroups().then((r) => setGroups(r.groups), (e: Error) => setError(e.message));
    }, [api]),
  );

  return (
    <Screen>
      <Title>Your groups</Title>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Button label="+ New group" onPress={() => router.push("/new")} />
        <Button label="Sign out" variant="secondary" onPress={signOut} />
      </View>
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
      {groups?.length === 0 && <Muted>No groups yet. Create one and share the link in your group chat.</Muted>}
      {groups?.map((g) => (
        <Link key={g.id} href={{ pathname: "/g/[slug]", params: { slug: g.slug } }} asChild>
          <Pressable>
            <Card>
              <Text style={{ color: t.text, fontSize: 18, fontWeight: "700" }}>{g.name}</Text>
              <Muted>
                {weekdayName(g.weekday)}s at {formatTime(g.startTime)}
                {g.location ? ` · ${g.location}` : ""}
                {g.cap ? ` · ${g.cap} spots` : ""}
              </Muted>
            </Card>
          </Pressable>
        </Link>
      ))}
    </Screen>
  );
}
