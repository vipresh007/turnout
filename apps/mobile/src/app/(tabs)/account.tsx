import type { OrganizerNotify } from "@turnout/shared";
import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { SignInGate } from "@/components/SignInGate";
import { Display, Eyebrow, ListRow, RowGroup } from "@/components/ui";
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
  const [prefs, setPrefs] = useState<OrganizerNotify | null>(null);
  useEffect(() => {
    api.notificationPrefs().then(setPrefs, () => {});
  }, [api]);
  const setPref = async (key: keyof OrganizerNotify, value: boolean) => {
    setPrefs((p) => (p ? { ...p, [key]: value } : p)); // optimistic
    try {
      setPrefs(await api.setNotificationPrefs({ [key]: value }));
    } catch (e) {
      setError((e as Error).message);
    }
  };

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

  const who = account?.name || account?.email || "";
  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 48 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 4 }}>
        <Avatar name={who || "?"} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <Display level="h1" style={{ fontSize: 22, lineHeight: 26 }} numberOfLines={1}>{account?.name || "Your account"}</Display>
          {account?.email && <Text style={{ color: t.muted }} numberOfLines={1}>{account.email}</Text>}
        </View>
      </View>

      {/* Phone alerts and emails apart, so each switch says plainly what it stops. */}
      <View style={{ gap: 8 }}>
        <View style={{ paddingHorizontal: 4 }}><Eyebrow>{pushAvailable ? "On this phone" : "Alerts"}</Eyebrow></View>
        <RowGroup>
          {pushAvailable && <ListRow first icon="bell" title="Notifications" subtitle={pushNote ?? "Dropouts and games that look short, plus the two below"} right={<Switch value={push} onValueChange={togglePush} trackColor={{ true: t.accent }} />} />}
          <ListRow first={!pushAvailable} icon="check" title="Game is full" subtitle="Once per game, when the last spot goes" right={<Switch value={prefs?.full ?? true} disabled={!prefs} onValueChange={(v) => setPref("full", v)} trackColor={{ true: t.accent }} />} />
          <ListRow last icon="user" title="New player joins" subtitle="Someone new found your link" right={<Switch value={prefs?.newPlayer ?? false} disabled={!prefs} onValueChange={(v) => setPref("newPlayer", v)} trackColor={{ true: t.accent }} />} />
        </RowGroup>
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ paddingHorizontal: 4 }}><Eyebrow>By email</Eyebrow></View>
        <RowGroup>
          <ListRow first icon="mail" title="Weekly digest" subtitle="Monday morning: last week's games and what's coming" right={<Switch value={prefs?.digest ?? true} disabled={!prefs} onValueChange={(v) => setPref("digest", v)} trackColor={{ true: t.accent }} />} />
          <ListRow last icon="warning" title="Dropouts and short games" subtitle="Also emailed, in case you miss the notification" right={<Switch value={prefs?.alertEmails ?? true} disabled={!prefs} onValueChange={(v) => setPref("alertEmails", v)} trackColor={{ true: t.accent }} />} />
        </RowGroup>
      </View>

      <RowGroup>
        <ListRow first icon="trending" title="Your stats" subtitle="Games played, attendance and streaks" onPress={() => router.push("/stats")} />
        {account?.isAdmin && <ListRow icon="chart" title="Metrics" onPress={() => router.push("/admin")} />}
        <ListRow icon="bulb" title="Suggest an improvement" onPress={() => router.push("/feedback")} />
        <ListRow last icon="mail" title="Help and support" onPress={() => router.push("/support")} />
      </RowGroup>

      <RowGroup>
        <ListRow first icon="note" title="Privacy policy" onPress={() => router.push("/privacy")} />
        <ListRow last icon="note" title="Terms of service" onPress={() => router.push("/terms")} />
      </RowGroup>

      <RowGroup>
        <ListRow first icon="arrowRight" title="Sign out" onPress={doSignOut} right={<View />} />
        <ListRow last icon="x" title="Delete account" danger onPress={deleteAccount} right={<View />} />
      </RowGroup>
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
      <Text style={{ color: t.muted, textAlign: "center", fontSize: 12 }}>Turnout {Constants.expoConfig?.version ?? ""}</Text>
    </ScrollView>
  );
}
