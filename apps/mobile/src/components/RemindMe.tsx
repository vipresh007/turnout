import type { MemberSelf } from "@turnout/shared";
import { useCallback, useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import { useApi, type Membership } from "@/lib/api";
import { browserSubscribed, pushSupport, subscribeBrowser, unsubscribeBrowser } from "@/lib/push";
import { devicePushToken, pushPermission } from "@/lib/pushNative";
import { useTheme } from "@/lib/theme";
import { Button, Card, Field, Muted, SectionTitle } from "./ui";

const inApp = Platform.OS !== "web";

/** Lets a member (no account) choose how to get reminders: notifications (browser or this app) and/or email. */
export function RemindMe({ slug, me }: { slug: string; me: Membership }) {
  const t = useTheme();
  const api = useApi();
  const [options, setOptions] = useState<{ publicKey: string | null; email: boolean } | null>(null);
  const [self, setSelf] = useState<MemberSelf | null>(null);
  const [onThisDevice, setOnThisDevice] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const support = pushSupport();

  const load = useCallback(
    () => Promise.all([
      api.reminderOptions(),
      api.memberSelf(slug, me.token),
      inApp ? pushPermission().then((p) => p === "granted") : browserSubscribed(),
    ]),
    [api, slug, me.token],
  );
  const apply = useCallback(([o, s, sub]: Awaited<ReturnType<typeof load>>) => {
    setOptions(o);
    setSelf(s);
    setOnThisDevice(sub && s.channels.push > 0);
  }, []);
  const refresh = async () => apply(await load());

  useEffect(() => {
    load().then(apply, () => {});
  }, [load, apply]);

  const run = async (key: string, action: () => Promise<MemberSelf | void>) => {
    setBusy(key);
    setError(null);
    try {
      const result = await action();
      if (result) setSelf(result);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!options || !self) return null;
  const pushAvailable = inApp || (!!options.publicKey && support !== "unsupported");
  if (!pushAvailable && !options.email) return null;
  const { channels } = self;

  return (
    <Card>
      <SectionTitle icon="bell">Remind me before games</SectionTitle>
      <Muted>A nudge before each game. Stop any time.</Muted>

      {pushAvailable && (
        <View style={{ gap: 6 }}>
          {!inApp && support === "ios-needs-home-screen" ? (
            <Muted>On iPhone, add Turnout to your Home Screen (Share, then Add to Home Screen) to get notifications.</Muted>
          ) : onThisDevice ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ color: t.accent, fontWeight: "700", flex: 1 }}>Notifications on for this device</Text>
              <Button label="Turn off" variant="secondary" loading={busy === "push-off"} onPress={() => run("push-off", async () => {
                if (!inApp) await unsubscribeBrowser();
                return api.unsubscribePush(slug, me.token);
              })} />
            </View>
          ) : (
            <View style={{ flexDirection: "row" }}>
              <Button label="Turn on notifications" loading={busy === "push"} onPress={() => run("push", async () => {
                if (inApp) {
                  const token = await devicePushToken();
                  if (!token) throw new Error("Notifications are off for Turnout. Turn them on in Settings, then try again.");
                  return api.subscribeAppPush(slug, me.token, token);
                }
                const sub = await subscribeBrowser(options.publicKey!);
                return api.subscribePush(slug, me.token, sub);
              })} />
            </View>
          )}
        </View>
      )}

      {options.email && (
        <View style={{ gap: 8 }}>
          {channels.email && channels.emailConfirmed ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ color: t.accent, fontWeight: "700", flex: 1 }} numberOfLines={1}>Emailing {channels.email}</Text>
              <Button label="Stop" variant="secondary" loading={busy === "email-off"} onPress={() => run("email-off", () => api.removeEmail(slug, me.token))} />
            </View>
          ) : null}
          {!channels.emailConfirmed && (
            <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
              <Field label="Or get an email" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
              <View style={{ width: 110 }}>
                <Button label="Email me" variant="secondary" disabled={!email.includes("@")} loading={busy === "email"} onPress={() => run("email", async () => {
                  const r = await api.setEmail(slug, me.token, email);
                  setEmail("");
                  return r;
                })} />
              </View>
            </View>
          )}
        </View>
      )}
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
    </Card>
  );
}
