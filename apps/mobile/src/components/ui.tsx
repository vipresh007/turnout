import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useTheme } from "@/lib/theme";

export function Screen({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
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

/** Smooth hover/press changes on web; native ignores these. */
export const webTransition = { transitionProperty: "background-color, border-color, color, opacity, transform, box-shadow", transitionDuration: "150ms" } as object;

type Variant = "primary" | "secondary" | "danger";
export function Button({ label, onPress, variant = "primary", loading, disabled, big }: {
  label: string; onPress: () => void; variant?: Variant; loading?: boolean; disabled?: boolean; big?: boolean;
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
      {({ hovered }: { hovered?: boolean }) =>
        loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <Text style={[styles.buttonText, big && styles.bigButtonText, { color: hovered && !disabled && variant === "secondary" ? t.accent : fg }]}>{label}</Text>
        )
      }
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Text style={{ color: t.muted, fontSize: 13, fontWeight: "600" }}>{label}</Text>
      <TextInput
        placeholderTextColor={t.muted}
        {...props}
        style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.card }, props.style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 48, alignItems: "center" },
  column: { width: "100%", maxWidth: 560, gap: 16 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  button: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", flex: 1 },
  bigButton: { paddingVertical: 20, borderRadius: 16 },
  buttonText: { fontSize: 16, fontWeight: "700" },
  bigButtonText: { fontSize: 20 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
});
