import type { OrganizerNotify } from "@turnout/shared";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { SignInGate } from "@/components/SignInGate";
import { BackLink, Eyebrow, ListRow, RowGroup } from "@/components/ui";
import { useApi } from "@/lib/api";
import { disablePush, enablePush, hasPushToken, pushAvailable, pushPermission } from "@/lib/pushNative";
import { useTheme } from "@/lib/theme";

// The organizer's alerts, from Account: phone notifications and emails apart, so each switch says plainly what it stops.

export default function NotificationsScreen() {
  return (
    <SignInGate reason="Sign in to choose your notifications.">
      <Notifications />
    </SignInGate>
  );
}

function Notifications() {
  const t = useTheme();
  const api = useApi();
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

  const toggle = (value: boolean, onChange: (v: boolean) => void) => <Switch value={value} disabled={!prefs} onValueChange={onChange} trackColor={{ true: t.accent }} />;
  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 48, width: "100%", maxWidth: 560, alignSelf: "center" }}>
      <BackLink fallback="/account" label="Account" />
      <View style={{ gap: 8 }}>
        <View style={{ paddingHorizontal: 4 }}><Eyebrow>{pushAvailable ? "On this phone" : "Alerts in the app"}</Eyebrow></View>
        <RowGroup>
          {pushAvailable && <ListRow first icon="bell" title="Notifications" subtitle={pushNote ?? "Dropouts and games that look short, plus the two below"} right={<Switch value={push} onValueChange={togglePush} trackColor={{ true: t.accent }} />} />}
          <ListRow first={!pushAvailable} icon="check" title="Game is full" subtitle="Once per game, when the last spot goes" right={toggle(prefs?.full ?? true, (v) => setPref("full", v))} />
          <ListRow last icon="user" title="New player joins" subtitle="Someone new found your link" right={toggle(prefs?.newPlayer ?? false, (v) => setPref("newPlayer", v))} />
        </RowGroup>
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ paddingHorizontal: 4 }}><Eyebrow>By email</Eyebrow></View>
        <RowGroup>
          <ListRow first icon="mail" title="Weekly digest" subtitle="Monday morning: last week's games and what's coming" right={toggle(prefs?.digest ?? true, (v) => setPref("digest", v))} />
          <ListRow last icon="warning" title="Dropouts and short games" subtitle="Also emailed, in case you miss the notification" right={toggle(prefs?.alertEmails ?? true, (v) => setPref("alertEmails", v))} />
        </RowGroup>
      </View>
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
    </ScrollView>
  );
}
