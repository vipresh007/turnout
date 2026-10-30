import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { SignInGate } from "@/components/SignInGate";
import { Display, ListRow, RowGroup } from "@/components/ui";
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

      {pushAvailable && (
        <RowGroup>
          <ListRow first last icon="bell" title="Notifications" subtitle={pushNote ?? "Dropouts and short games"} right={<Switch value={push} onValueChange={togglePush} trackColor={{ true: t.accent }} />} />
        </RowGroup>
      )}

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
