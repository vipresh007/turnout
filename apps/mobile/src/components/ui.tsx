import type { ReactNode, Ref } from "react";
import { router, type Href } from "expo-router";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { tint, useTheme } from "@/lib/theme";
import { webTransition } from "@/lib/webStyle";
import { Icon, type IconName } from "./Icon";
import { PageGlow, SiteHeader } from "./SiteHeader";

/** A page: the site header and background glow (web), then a centred column of content. */
export function Screen({ children, signInLabel, scrollRef }: { children: ReactNode; signInLabel?: string; scrollRef?: Ref<ScrollView> }) {
  const t = useTheme();
  const web = Platform.OS === "web";
  return (
    <ScrollView
      ref={scrollRef}
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={[styles.screen, !web && { paddingTop: 16 }]}
      keyboardShouldPersistTaps="handled"
      // iOS: make room for the keyboard and keep the field you're typing in visible; swipe down to close it.
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
    >
      {web && <PageGlow />}
      {web && <SiteHeader signInLabel={signInLabel} />}
      <View style={styles.column}>{children}</View>
    </ScrollView>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.title, { color: t.text }]}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.muted, fontSize: 15, lineHeight: 21 }}>{children}</Text>;
}

/** A card's heading: an icon in a soft bubble, the title, and anything that belongs on the right (a link, a count). */
export function SectionTitle({ icon, children, right }: { icon?: IconName; children: ReactNode; right?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      {icon && (
        <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: t.soft, alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={17} color={t.accent} strokeWidth={2} />
        </View>
      )}
      <Text style={{ color: t.text, fontSize: 17, fontWeight: "800", letterSpacing: -0.2, flex: 1 }}>{children}</Text>
      {right}
    </View>
  );
}

/** Small uppercase label above a group of things ("IN · 12", "ORGANIZER"). */
export function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
  const t = useTheme();
  return <Text style={{ color: color ?? t.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 }}>{children}</Text>;
}

/** A status chip: tinted background, colored text, optional icon. "In", "Waitlist #2", "Out", "sub". */
export function Pill({ label, color, icon, outline }: { label: string; color?: string; icon?: IconName; outline?: boolean }) {
  const t = useTheme();
  const c = color ?? t.muted;
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999,
      backgroundColor: outline ? "transparent" : tint(c), borderWidth: outline ? 1 : 0, borderColor: tint(c, 0.5),
    }}>
      {icon && <Icon name={icon} size={12} color={c} strokeWidth={2.6} />}
      <Text style={{ color: c, fontSize: 12, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}

/** A line of secondary info with an icon in front: where, when, what it costs. */
export function IconLine({ icon, children, color }: { icon: IconName; children: ReactNode; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 7 }}>
      <View style={{ paddingTop: 2 }}><Icon name={icon} size={16} color={color ?? t.muted} /></View>
      <Text style={{ color: color ?? t.muted, fontSize: 15, lineHeight: 20, flexShrink: 1 }}>{children}</Text>
    </View>
  );
}

export { webTransition } from "@/lib/webStyle";

type Variant = "primary" | "secondary" | "danger";
export function Button({ label, onPress, variant = "primary", loading, disabled, big, icon }: {
  label: string; onPress: () => void; variant?: Variant; loading?: boolean; disabled?: boolean; big?: boolean; icon?: IconName;
}) {
  const t = useTheme();
  const bg = variant === "primary" ? t.accent : variant === "danger" ? t.danger : t.card;
  const fg = variant === "secondary" ? t.text : variant === "primary" ? t.accentText : "#fff";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => {
        const hover = hovered && !disabled && !loading;
        return [
          styles.button, big && styles.bigButton, webTransition,
          {
            backgroundColor: hover && variant === "secondary" ? t.soft : bg,
            borderColor: variant === "secondary" ? (hover ? t.accent : t.border) : bg,
            opacity: disabled ? 0.5 : hover && variant !== "secondary" ? 0.92 : 1,
            transform: [{ translateY: hover && !pressed ? -1 : 0 }, { scale: pressed ? 0.96 : 1 }],
            boxShadow: variant === "primary" && !disabled ? `0 ${hover ? 10 : 6}px ${hover ? 22 : 16}px ${t.accentShadow}` : undefined,
          },
        ];
      }}
    >
      {({ hovered }: { hovered?: boolean }) => {
        const color = hovered && !disabled && variant === "secondary" ? t.accent : fg;
        return loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            {icon && <Icon name={icon} size={big ? 20 : 17} color={color} strokeWidth={2.2} />}
            <Text numberOfLines={1} style={[styles.buttonText, big && styles.bigButtonText, { color, flexShrink: 1 }]}>{label}</Text>
          </View>
        );
      }}
    </Pressable>
  );
}

/** "← Back" on web pages that open on top of another (they can be opened directly from a link, with nothing to go back to). */
export function BackLink({ fallback, label = "Back" }: { fallback: Href; label?: string }) {
  const t = useTheme();
  if (Platform.OS !== "web") return null; // the app's nav bar already has a back arrow
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      hitSlop={8}
      style={({ hovered }: { hovered?: boolean }) => ({ alignSelf: "flex-start", paddingVertical: 4, opacity: hovered ? 0.7 : 1 })}
    >
      <Text style={{ color: t.muted, fontWeight: "700", fontSize: 15 }}>← {label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Text numberOfLines={1} style={{ color: t.muted, fontSize: 13, fontWeight: "600" }}>{label}</Text>
      <TextInput
        placeholderTextColor={t.muted}
        {...props}
        style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg }, props.style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 48, alignItems: "center" },
  column: { width: "100%", maxWidth: 560, gap: 16, paddingHorizontal: 16 },
  card: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 12 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.8 },
  button: { borderWidth: 1, borderRadius: 14, minHeight: 46, paddingVertical: 11, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", flex: 1 },
  bigButton: { paddingVertical: 18, borderRadius: 16 },
  buttonText: { fontSize: 16, fontWeight: "700" },
  bigButtonText: { fontSize: 19 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
});
