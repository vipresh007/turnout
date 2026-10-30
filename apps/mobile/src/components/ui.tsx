import type { ReactNode, Ref } from "react";
import { router, type Href } from "expo-router";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle } from "react-native";
import Svg, { Defs, Line, Pattern, Rect } from "react-native-svg";
import { tint, useTheme } from "@/lib/theme";
import { webTransition } from "@/lib/webStyle";
import { Icon, type IconName } from "./Icon";
import { Illustration, type IllustrationName } from "./Illustrations";
import { PageGlow, SiteHeader } from "./SiteHeader";

/** A page: the site header and background glow (web), then a centred column of content. */
export function Screen({ children, signInLabel, scrollRef, bottomInset = 0 }: { children: ReactNode; signInLabel?: string; scrollRef?: Ref<ScrollView>; bottomInset?: number }) {
  const t = useTheme();
  const web = Platform.OS === "web";
  return (
    <ScrollView
      ref={scrollRef}
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={[styles.screen, !web && { paddingTop: 16 }, bottomInset > 0 && { paddingBottom: 48 + bottomInset }]}
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

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>{children}</View>;
}

/** Big type in the display face (Archivo): page titles, group names, headcounts. On the web it marks itself so the
 *  global Inter rule in app/_layout leaves it alone. */
export function Display({ level = "h1", style, ...props }: TextProps & { level?: "display" | "h1" | "stat" | "statSm" }) {
  const t = useTheme();
  const heavy = level === "display" || level === "stat";
  return <Text {...props} {...(Platform.OS === "web" ? { dataSet: { display: heavy ? "heavy" : "1" } } : {})} style={[t.type[level], { color: t.text }, style]} />;
}

export function Title({ children }: { children: ReactNode }) {
  return <Display level="h1">{children}</Display>;
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[t.type.small, { color: t.muted, fontSize: 15, lineHeight: 21 }, style]}>{children}</Text>;
}

/** The heading over a section or inside a card: optional eyebrow above, optional icon bubble, anything on the right. */
export function SectionHeader({ title, eyebrow, icon, right, tone }: { title: ReactNode; eyebrow?: string; icon?: IconName; right?: ReactNode; tone?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      {icon && (
        <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: tone ? tint(tone) : t.soft, alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={17} color={tone ?? t.accent} strokeWidth={2} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        {eyebrow && <Eyebrow color={tone}>{eyebrow}</Eyebrow>}
        <Text style={[t.type.h3, { color: t.text }]}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

/** @deprecated Use SectionHeader. Kept while screens migrate. */
export function SectionTitle({ icon, children, right }: { icon?: IconName; children: ReactNode; right?: ReactNode }) {
  return <SectionHeader icon={icon} title={children} right={right} />;
}

/** Small uppercase label above a group of things ("IN · 12", "ORGANIZER"). */
export function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
  const t = useTheme();
  return <Text style={[t.type.caption, { color: color ?? t.muted }]}>{children}</Text>;
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

/** A tappable chip: a filter, a quick pick ("Ask Sam"), a toggle. `selected` fills it with the tone. */
export function Chip({ label, onPress, selected, icon, tone, disabled }: { label: string; onPress?: () => void; selected?: boolean; icon?: IconName; tone?: string; disabled?: boolean }) {
  const t = useTheme();
  const c = tone ?? t.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled || !onPress}
      hitSlop={4}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.chip, webTransition,
        {
          backgroundColor: selected ? c : hovered ? tint(c, 0.1) : t.surface2,
          borderColor: selected ? c : hovered ? tint(c, 0.5) : t.border,
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}
    >
      {icon && <Icon name={icon} size={14} color={selected ? t.accentText : c} strokeWidth={2.4} />}
      <Text style={{ color: selected ? t.accentText : t.text, fontSize: 14, fontWeight: "700" }}>{label}</Text>
    </Pressable>
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

/** How full the game is. `tone` defaults to green, amber when short, danger when over. */
export function ProgressBar({ value, max, tone, height = 8 }: { value: number; max: number; tone?: string; height?: number }) {
  const t = useTheme();
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max, now: Math.min(value, max) }}
      style={{ height, borderRadius: height / 2, backgroundColor: t.border, overflow: "hidden", width: "100%" }}
    >
      <View style={{ height: "100%", borderRadius: height / 2, backgroundColor: tone ?? t.accent, width: `${pct}%` }} />
    </View>
  );
}

/** A number with a label: "PLAYED 9 of 10 games". `tone` colours the value. */
export function StatTile({ label, value, hint, tone, compact }: { label: string; value: string | number; hint?: string; tone?: string; compact?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: tone ? tint(tone, 0.1) : t.surface2, borderRadius: t.radius.md, padding: compact ? 10 : 12, gap: 2 }}>
      <Eyebrow>{label}</Eyebrow>
      <Display level="statSm" style={[tone ? { color: tone } : null, compact && { fontSize: 22, lineHeight: 26 }]}>{String(value)}</Display>
      {hint && <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>{hint}</Text>}
    </View>
  );
}

/** A settings-style row: icon, title, subtitle, something on the right (chevron by default when pressable). */
export function ListRow({ icon, title, subtitle, right, onPress, danger, tone, first, last }: {
  icon?: IconName; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; danger?: boolean; tone?: string; first?: boolean; last?: boolean;
}) {
  const t = useTheme();
  const c = danger ? t.danger : tone ?? t.accent;
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.row,
        { backgroundColor: pressed || hovered ? t.surface2 : t.card, borderColor: t.border },
        !first && { borderTopWidth: 0 },
        first && { borderTopLeftRadius: t.radius.lg, borderTopRightRadius: t.radius.lg },
        last && { borderBottomLeftRadius: t.radius.lg, borderBottomRightRadius: t.radius.lg },
      ]}
    >
      {icon && (
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: tint(c), alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={18} color={c} strokeWidth={2} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[t.type.body, { color: danger ? t.danger : t.text, fontWeight: "600" }]} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={[t.type.small, { color: t.muted }]} numberOfLines={2}>{subtitle}</Text>}
      </View>
      {right ?? (onPress ? <Icon name="chevronRight" size={18} color={t.muted} /> : null)}
    </Pressable>
  );
}

/** A group of ListRows with the card look. Children should be ListRows; first/last radii are applied here. */
export function RowGroup({ children }: { children: ReactNode }) {
  return <View style={{ borderRadius: 20, overflow: "hidden" }}>{children}</View>;
}

/** A one-time nudge: icon, a sentence, one or two actions. Shared by the push, pricing, feedback and sign-in asks. */
export function AskCard({ icon, title, body, children, onDismiss, tone }: { icon: IconName; title: string; body?: string; children?: ReactNode; onDismiss?: () => void; tone?: string }) {
  const t = useTheme();
  const c = tone ?? t.accent;
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: tint(c, 0.6), gap: 10 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: tint(c), alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={18} color={c} strokeWidth={2} />
        </View>
        <Text style={[t.type.h3, { color: t.text, flex: 1 }]}>{title}</Text>
        {onDismiss && (
          <Pressable accessibilityRole="button" accessibilityLabel="Not now" onPress={onDismiss} hitSlop={8} style={({ hovered }: { hovered?: boolean }) => ({ opacity: hovered ? 0.7 : 1 })}>
            <Icon name="x" size={18} color={t.muted} />
          </Pressable>
        )}
      </View>
      {body && <Text style={[t.type.small, { color: t.muted, fontSize: 15, lineHeight: 21 }]}>{body}</Text>}
      {children}
    </View>
  );
}

/** A numbered step marker; `done` turns it into a tick. */
export function StepBadge({ n, done }: { n: number; done?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: done ? t.accent : t.soft, alignItems: "center", justifyContent: "center" }}>
      {done ? <Icon name="check" size={14} color={t.accentText} strokeWidth={3} /> : <Text style={{ color: t.accent, fontWeight: "900", fontSize: 13 }}>{n}</Text>}
    </View>
  );
}

/** What an empty screen is waiting for: a small scene, a line, and the one thing to do next. */
export function EmptyState({ illustration, title, body, action, tone }: { illustration: IllustrationName; title: string; body?: string; action?: ReactNode; tone?: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: "center", gap: 8, paddingVertical: 20, paddingHorizontal: 12 }}>
      <Illustration name={illustration} tone={tone} />
      <Text style={[t.type.h2, { color: t.text, textAlign: "center" }]}>{title}</Text>
      {body && <Text style={[t.type.small, { color: t.muted, fontSize: 15, lineHeight: 21, textAlign: "center", maxWidth: 320 }]}>{body}</Text>}
      {action && <View style={{ marginTop: 8, alignSelf: "stretch", maxWidth: 320, width: "100%" }}>{action}</View>}
    </View>
  );
}

/** Faint diagonal pitch lines for a header. Absolutely positioned; put it first inside a relative, clipped parent. */
export function Texture({ color, opacity = 0.06 }: { color: string; opacity?: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="pitch" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
            <Line x1="0" y1="0" x2="0" y2="18" stroke={color} strokeWidth="2" strokeOpacity={opacity} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#pitch)" />
      </Svg>
    </View>
  );
}

export { webTransition } from "@/lib/webStyle";

type Variant = "primary" | "secondary" | "danger" | "energy";
export function Button({ label, onPress, variant = "primary", loading, disabled, big, size, icon, fill = true }: {
  label: string; onPress: () => void; variant?: Variant; loading?: boolean; disabled?: boolean; big?: boolean; size?: "sm" | "md" | "lg"; icon?: IconName; fill?: boolean;
}) {
  const t = useTheme();
  const sz = size ?? (big ? "lg" : "md");
  const bg = variant === "primary" ? t.accent : variant === "energy" ? t.energy : variant === "danger" ? t.danger : t.card;
  const fg = variant === "secondary" ? t.text : variant === "primary" ? t.accentText : variant === "energy" ? t.energyText : "#fff";
  const shadow = variant === "primary" ? t.accentShadow : variant === "energy" ? tint(t.energy, 0.35) : null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => {
        const hover = hovered && !disabled && !loading;
        return [
          styles.button, sz === "lg" && styles.bigButton, sz === "sm" && styles.smallButton, !fill && { flex: 0, alignSelf: "flex-start" }, webTransition,
          {
            backgroundColor: hover && variant === "secondary" ? t.soft : bg,
            borderColor: variant === "secondary" ? (hover ? t.accent : t.border) : bg,
            opacity: disabled ? 0.5 : hover && variant !== "secondary" ? 0.92 : 1,
            transform: [{ translateY: hover && !pressed ? -1 : 0 }, { scale: pressed ? 0.96 : 1 }],
            boxShadow: shadow && !disabled ? `0 ${hover ? 10 : 6}px ${hover ? 22 : 16}px ${shadow}` : undefined,
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
            {icon && <Icon name={icon} size={sz === "lg" ? 20 : sz === "sm" ? 15 : 17} color={color} strokeWidth={2.2} />}
            <Text numberOfLines={1} style={[styles.buttonText, sz === "lg" && styles.bigButtonText, sz === "sm" && styles.smallButtonText, { color, flexShrink: 1 }]}>{label}</Text>
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
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 16, borderWidth: 1, minHeight: 56 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, alignSelf: "flex-start" },
  button: { borderWidth: 1, borderRadius: 14, minHeight: 46, paddingVertical: 11, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", flex: 1 },
  bigButton: { paddingVertical: 18, borderRadius: 16 },
  smallButton: { minHeight: 36, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  buttonText: { fontSize: 16, fontWeight: "700" },
  bigButtonText: { fontSize: 19 },
  smallButtonText: { fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
});
