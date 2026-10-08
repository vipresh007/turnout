import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Icon, type IconName } from "@/components/Icon";
import { SignInGate } from "@/components/SignInGate";
import { useAccount } from "@/lib/account";
import { useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { confirm } from "@/lib/confirm";
import { disablePush, enablePush, hasPushToken, pushAvailable, pushPermission } from "@/lib/pushNative";
import { tint, useTheme } from "@/lib/theme";

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
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 22, paddingBottom: 48 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 4 }}>
        <Avatar name={who || "?"} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: t.text, fontSize: 20, fontWeight: "800" }} numberOfLines={1}>{account?.name || "Your account"}</Text>
          {account?.email && <Text style={{ color: t.muted }} numberOfLines={1}>{account.email}</Text>}
        </View>
      </View>

      {pushAvailable && (
        <Group>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
            <RowIcon name="bell" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 16, fontWeight: "600" }}>Notifications</Text>
              <Text style={{ color: t.muted, fontSize: 13 }}>Dropouts and short games</Text>
            </View>
            <Switch value={push} onValueChange={togglePush} trackColor={{ true: t.accent }} />
          </View>
          {pushNote && <Text style={{ color: t.waitlist, paddingBottom: 12 }}>{pushNote}</Text>}
        </Group>
      )}

      <Group>
        <Row icon="trending" label="Your stats" onPress={() => router.push("/stats")} />
        {account?.isAdmin && <Row icon="chart" label="Metrics" onPress={() => router.push("/admin")} />}
        <Row icon="bulb" label="Suggest an improvement" onPress={() => router.push("/feedback")} />
        <Row icon="mail" label="Help and support" onPress={() => router.push("/support")} />
      </Group>

      <Group>
        <Row icon="note" label="Privacy policy" onPress={() => router.push("/privacy")} />
        <Row icon="note" label="Terms of service" onPress={() => router.push("/terms")} />
      </Group>

      <Group>
        <Row icon="arrowRight" label="Sign out" onPress={doSignOut} plain />
        <Row icon="x" label="Delete account" danger onPress={deleteAccount} plain />
      </Group>
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
      <Text style={{ color: t.muted, textAlign: "center", fontSize: 12 }}>Turnout {Constants.expoConfig?.version ?? ""}</Text>
    </ScrollView>
  );
}

/** A rounded group of rows, iOS Settings style. */
function Group({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={{ backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14 }}>{children}</View>;
}

function RowIcon({ name, color }: { name: IconName; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: color ? tint(color) : t.soft, alignItems: "center", justifyContent: "center" }}>
      <Icon name={name} size={17} color={color ?? t.accent} strokeWidth={2} />
    </View>
  );
}

function Row({ icon, label, onPress, danger, plain }: { icon: IconName; label: string; onPress: () => void; danger?: boolean; plain?: boolean }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}>
      <RowIcon name={icon} color={danger ? t.danger : undefined} />
      <Text style={{ color: danger ? t.danger : t.text, fontSize: 16, fontWeight: "600", flex: 1 }}>{label}</Text>
      {!plain && <Icon name="chevronRight" size={16} color={t.muted} />}
    </Pressable>
  );
}
