import type { DashboardGroup } from "@turnout/shared";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { pushAvailable, pushPermission } from "@/lib/pushNative";
import { hasShared } from "@/lib/source";
import { storage } from "@/lib/storage";
import { useTheme } from "@/lib/theme";
import { Icon } from "./Icon";
import { AskCard, ProgressBar, StepBadge } from "./ui";

// First-run guidance. Organizers get a short checklist on Home that ticks itself off and disappears once done;
// players get one "how this works" line the first time they open a group.

const ORGANIZER_KEY = "firstRunDone";
const PLAYER_KEY = "playerTipSeen";

/** "Get your first game going": share the link, get 3 in, turn on alerts. Hidden when done or dismissed. */
export function FirstRunChecklist({ groups, onShare }: { groups: DashboardGroup[]; onShare: () => void }) {
  const t = useTheme();
  const [state, setState] = useState<{ dismissed: boolean; shared: boolean; push: boolean } | null>(null);
  useEffect(() => {
    Promise.all([storage.get(ORGANIZER_KEY), hasShared(), pushAvailable ? pushPermission() : Promise.resolve("granted" as const)]).then(([done, shared, push]) =>
      setState({ dismissed: done === "1", shared, push: push === "granted" }),
    );
  }, []);
  if (!state || state.dismissed || groups.length === 0) return null;

  const players = Math.max(0, ...groups.map((g) => g.confirmed));
  const steps = [
    { label: "Create your group", done: true },
    { label: "Share the link in your group chat", done: state.shared || groups.some((g) => g.players.length > 0), action: onShare },
    { label: "Get your first 3 players in", done: players >= 3, hint: `${Math.min(players, 3)} of 3` },
    ...(pushAvailable ? [{ label: "Turn on notifications for dropouts", done: state.push, action: () => router.push("/account") }] : []),
  ];
  const done = steps.filter((s) => s.done).length;
  const dismiss = () => {
    void storage.set(ORGANIZER_KEY, "1");
    setState({ ...state, dismissed: true });
  };
  if (done === steps.length) return null;

  return (
    <AskCard icon="sparkles" title="Get your first game going" onDismiss={dismiss}>
      <ProgressBar value={done} max={steps.length} height={5} />
      <View style={{ gap: 4 }}>
        {steps.map((s, i) => (
          <Pressable
            key={s.label}
            accessibilityRole={s.action && !s.done ? "button" : undefined}
            disabled={!s.action || s.done}
            onPress={s.action}
            style={({ hovered }: { hovered?: boolean }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: hovered && s.action && !s.done ? t.surface2 : "transparent" })}
          >
            <StepBadge n={i + 1} done={s.done} />
            <Text style={{ flex: 1, color: s.done ? t.muted : t.text, fontSize: 15, textDecorationLine: s.done ? "line-through" : "none" }}>{s.label}</Text>
            {!s.done && "hint" in s && s.hint ? <Text style={{ color: t.muted, fontSize: 13 }}>{s.hint}</Text> : null}
            {!s.done && s.action ? <Icon name="chevronRight" size={16} color={t.muted} /> : null}
          </Pressable>
        ))}
      </View>
    </AskCard>
  );
}

/** The first time someone opens a group without having joined: how it works, in one line. */
export function PlayerTip() {
  const t = useTheme();
  const [show, setShow] = useState(false);
  useEffect(() => {
    storage.get(PLAYER_KEY).then((seen) => setShow(seen !== "1"));
  }, []);
  if (!show) return null;
  const dismiss = () => {
    void storage.set(PLAYER_KEY, "1");
    setShow(false);
  };
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: t.soft, borderRadius: 14, padding: 12 }}>
      <Icon name="sparkles" size={18} color={t.accent} />
      <Text style={{ flex: 1, color: t.text, fontSize: 14, lineHeight: 20 }}>
        Type your name once and tap <Text style={{ fontWeight: "700" }}>I'm in</Text>. No app or account. If the game fills up you'll go on the waitlist and move up automatically.
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Got it" onPress={dismiss} hitSlop={8}>
        <Icon name="x" size={16} color={t.muted} />
      </Pressable>
    </View>
  );
}
