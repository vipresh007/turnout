import type { GroupPage } from "@turnout/shared";
import { router } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";
import { tint, useTheme } from "@/lib/theme";
import { webTransition } from "@/lib/webStyle";
import { Icon } from "../Icon";
import { Card, Chip } from "../ui";
import { forecastFor } from "./Organizer";

/** Room the page leaves at the bottom so the floating button never covers the last row. */
export const MANAGE_FAB_INSET = 72;

// The organizer's way into the Manage sheet (remind, teams, share, editing): one floating button at the bottom right,
// above the tab bar in the app. An orange dot when autopilot thinks the game will be short.

/** Autopilot's one line for the organizer, in the page under the headcount: how it looks and the first person to ask. */
export function AutopilotRow({ page, onAsk }: { page: GroupPage; onAsk: (name: string) => void }) {
  const t = useTheme();
  const f = forecastFor(page);
  if (!f) return null;
  const tone = f.short ? t.energy : t.accent;
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: tint(tone), alignItems: "center", justifyContent: "center" }}>
          <Icon name={f.short ? "warning" : "sparkles"} size={16} color={tone} strokeWidth={2.2} />
        </View>
        <Text style={{ color: t.text, fontWeight: "700", fontSize: 15, flex: 1 }} numberOfLines={2}>{f.headline}</Text>
        {f.ask[0] && <Chip label={`Ask ${f.ask[0].name}`} tone={tone} onPress={() => onAsk(f.ask[0]!.name)} />}
      </View>
    </Card>
  );
}

export function ManageFab({ page, slug }: { page: GroupPage; slug: string }) {
  const t = useTheme();
  const web = Platform.OS === "web";
  const fixed = web ? ({ position: "fixed" } as object) : null;
  const short = forecastFor(page)?.short;
  return (
    <View pointerEvents="box-none" style={[{ position: "absolute", right: 0, bottom: 0, left: 0, alignItems: "center" }, fixed]}>
      <View pointerEvents="box-none" style={{ width: "100%", maxWidth: 560, alignItems: "flex-end", paddingHorizontal: 16, paddingBottom: web ? 24 : 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Manage group"
          onPress={() => router.push({ pathname: "/manage/[slug]", params: { slug } })}
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
            flexDirection: "row", alignItems: "center", gap: 8, height: 52, paddingHorizontal: 20, borderRadius: 26, backgroundColor: t.accent,
            boxShadow: `0 8px 20px ${t.accentShadow}`, opacity: hovered ? 0.92 : 1, transform: [{ scale: pressed ? 0.95 : 1 }], ...webTransition,
          })}
        >
          <Icon name="sliders" size={20} color={t.accentText} strokeWidth={2.2} />
          <Text style={{ color: t.accentText, fontWeight: "800", fontSize: 15 }}>Manage</Text>
          {short && <View style={{ position: "absolute", top: 4, right: 6, width: 10, height: 10, borderRadius: 5, backgroundColor: t.energy, borderWidth: 2, borderColor: t.accent }} />}
        </Pressable>
      </View>
    </View>
  );
}
