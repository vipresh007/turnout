import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useApi } from "@/lib/api";
import { enablePush, hasPushToken, pushAvailable, pushPermission } from "@/lib/pushNative";
import { storage } from "@/lib/storage";
import { useTheme } from "@/lib/theme";
import { Pop } from "./motion";
import { Button, SectionTitle } from "./ui";

const DISMISSED = "pushPromptDismissed";

/** App only, once: offer notifications with the reason first, so the iPhone permission prompt makes sense. */
export function PushPrompt() {
  const t = useTheme();
  const api = useApi();
  const [show, setShow] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (!pushAvailable) return;
    Promise.all([pushPermission(), hasPushToken(), storage.get(DISMISSED)]).then(([p, has, dismissed]) => setShow(!(p === "granted" && has) && p !== "denied" && !dismissed));
  }, []);
  if (!show) return null;
  const dismiss = () => {
    storage.set(DISMISSED, "1").catch(() => {});
    setShow(false);
  };
  return (
    <Pop style={{ backgroundColor: t.card, borderColor: t.accent, borderWidth: 1, borderRadius: 20, padding: 18, gap: 10 }}>
      <SectionTitle icon="bell">Know the moment someone drops out</SectionTitle>
      <Text style={{ color: t.text }}>Turnout can tell you when a player drops out or a game looks short, so you can fill the spot in time.</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          label="Turn on notifications"
          onPress={async () => {
            try {
              const ok = await enablePush(api);
              if (ok) setShow(false);
              else setNote("No problem. You can turn them on later in Account.");
            } catch (e) {
              setNote((e as Error).message);
            }
          }}
        />
        <Button label="Not now" variant="secondary" onPress={dismiss} />
      </View>
      {note && <Text style={{ color: t.muted }}>{note}</Text>}
    </Pop>
  );
}
