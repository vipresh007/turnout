import type { GroupPage } from "@turnout/shared";
import { router } from "expo-router";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { webTransition } from "@/lib/webStyle";
import { Icon, type IconName } from "../Icon";
import { Chip } from "../ui";
import { forecastFor } from "./Organizer";

export const MANAGE_BAR_HEIGHT = 72;

// The organizer's tools, always within reach at the bottom of the group page instead of below the rosters.
// When autopilot has something to say, it says it here, with the first person to ask.

export function ManageBar({ page, slug, onAsk, onRemind, remindBusy, onShare }: {
  page: GroupPage; slug: string; onAsk: (name: string) => void; onRemind: () => void; remindBusy: boolean; onShare: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const f = forecastFor(page);
  const bottom = Platform.OS === "web" ? 0 : insets.bottom;
  const fixed = Platform.OS === "web" ? ({ position: "fixed" } as object) : null;
  return (
    <View pointerEvents="box-none" style={[{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center" }, fixed]}>
      <View style={{ width: "100%", maxWidth: 560, paddingHorizontal: 12, paddingBottom: Math.max(bottom, 10), paddingTop: 8 }}>
        <View style={{ backgroundColor: "rgba(23,27,33,0.92)", borderColor: t.borderStrong, borderWidth: 1, borderRadius: 24, padding: 8, gap: 8, boxShadow: t.shadow.float }}>
          {f && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 4 }}>
              <Icon name={f.short ? "warning" : "sparkles"} size={16} color={f.short ? t.energy : t.accent} strokeWidth={2.2} />
              <Text style={{ color: t.text, fontWeight: "700", fontSize: 14, flex: 1 }} numberOfLines={1}>{f.headline}</Text>
              {f.ask[0] && <Chip label={`Ask ${f.ask[0].name}`} tone={f.short ? t.energy : t.accent} onPress={() => onAsk(f.ask[0]!.name)} />}
            </View>
          )}
          <View style={{ flexDirection: "row", gap: 6 }}>
            <BarButton icon="bell" label="Remind" loading={remindBusy} disabled={page.session.cancelled} onPress={onRemind} />
            <BarButton icon="teams" label="Teams" disabled={page.roster.confirmed.length < 2} onPress={() => router.push({ pathname: "/teams/[slug]", params: { slug } })} />
            <BarButton icon="megaphone" label="Share" onPress={onShare} />
            <BarButton icon="edit" label="Manage" primary onPress={() => router.push({ pathname: "/manage/[slug]", params: { slug } })} />
          </View>
        </View>
      </View>
    </View>
  );
}

function BarButton({ icon, label, onPress, primary, disabled, loading }: { icon: IconName; label: string; onPress: () => void; primary?: boolean; disabled?: boolean; loading?: boolean }) {
  const t = useTheme();
  const fg = primary ? t.accentText : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 8, borderRadius: 16,
        backgroundColor: primary ? t.accent : hovered ? t.surface2 : "transparent",
        opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.96 : 1 }], ...webTransition,
      })}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Icon name={icon} size={20} color={fg} strokeWidth={2} />}
      <Text style={{ color: fg, fontSize: 11, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}
