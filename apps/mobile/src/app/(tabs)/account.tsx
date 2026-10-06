import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SignInGate } from "@/components/SignInGate";
import { Card, Muted } from "@/components/ui";
import { useAccount } from "@/lib/account";
import { useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { confirm } from "@/lib/confirm";
import { disablePush, enablePush, hasPushToken, pushAvailable, pushPermission } from "@/lib/pushNative";
import { useTheme } from "@/lib/theme";

export default function AccountScreen() {
  return (
    <SignInGate reason="Sign in to manage your account.">
      <Account />
    </SignInGate>
  );
}

function Account() {
  const t = useTheme();
  const api = useApi();
  const account = useAccount();
  const { signOut } = useAuth();
  const [push, setPush] = useState(false);
  const [pushNote, setPushNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    if (pushAvailable) Promise.all([pushPermission(), hasPushToken()]).then(([p, has]) => setPush(p === "granted" && has));
  }, []));

  const togglePush = async (on: boolean) => {
    setPushNote(null);
    try {
      if (on) {
        const ok = await enablePush(api);
        setPush(ok);
        if (!ok) setPushNote("Notifications are off for Turnout. Turn them on in the iPhone Settings app, then try again.");
      } else {
        await disablePush(api);
        setPush(false);
      }
    } catch (e) {
      setPushNote((e as Error).message);
    }
  };

  const doSignOut = async () => {
    await disablePush(api);
    await signOut();
    router.replace("/");
  };

  const deleteAccount = async () => {
    if (!(await confirm("Delete your account?", "Groups you run on your own are deleted with their players and history. Groups you run with a co-organizer are handed to them. This can't be undone.", "Delete account"))) return;
    try {
      await disablePush(api);
      await api.deleteAccount();
      await signOut();
      router.replace("/");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}>
      <Card>
        <Text style={{ color: t.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 }}>Signed in as</Text>
        <Text style={{ color: t.text, fontSize: 18, fontWeight: "800" }}>{account?.name || account?.email || "…"}</Text>
        {account?.name && account.email && <Muted>{account.email}</Muted>}
      </Card>

      {pushAvailable && (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>Notifications</Text>
              <Muted>When someone drops out, and when a game looks short.</Muted>
            </View>
            <Switch value={push} onValueChange={togglePush} trackColor={{ true: t.accent }} />
          </View>
          {pushNote && <Text style={{ color: t.waitlist }}>{pushNote}</Text>}
        </Card>
      )}

      <Card>
        {account?.isAdmin && <Row label="Metrics" onPress={() => router.push("/admin")} />}
        <Row label="Your stats as a player" onPress={() => router.push("/stats")} />
        <Row label="Suggest an improvement" onPress={() => router.push("/feedback")} />
        <Row label="Privacy policy" onPress={() => router.push("/privacy")} />
        <Row label="Terms of service" onPress={() => router.push("/terms")} />
        <Row label="Sign out" onPress={doSignOut} />
      </Card>

      <Card>
        <Row label="Delete account" danger onPress={deleteAccount} />
        <Muted>Players never have accounts, so this only removes your organizer account and the groups you run alone.</Muted>
      </Card>
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
      <Text style={{ color: t.muted, textAlign: "center", fontSize: 12 }}>Turnout {Constants.expoConfig?.version ?? ""}</Text>
    </ScrollView>
  );
}

function Row({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ color: danger ? t.danger : t.text, fontSize: 16, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}
