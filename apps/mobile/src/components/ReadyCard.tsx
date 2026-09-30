import { describeRecurrence, formatMoney, playerGoal, type GroupPage, type ShareInput } from "@turnout/shared";
import { router } from "expo-router";
import { Platform, Text, View } from "react-native";
import { relativeDay, sessionWhen } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { Pop } from "./motion";
import { PushPrompt } from "./PushPrompt";
import { ShareCard } from "./ShareCard";
import { Button, Card, Muted } from "./ui";

/**
 * Right after an organizer creates a group: what they made, when the first game is, and the two ways
 * to get players in (add them, or send the link). Nothing → live group in a couple of minutes.
 */
export function ReadyCard({ page, shareInput, onDone }: { page: GroupPage; shareInput: ShareInput; onDone: () => void }) {
  const t = useTheme();
  const { group, session } = page;
  const goal = playerGoal(group);
  const where = session.location ?? group.location;
  const facts = [
    where && `📍 ${where}`,
    `🕗 ${describeRecurrence(group)} · ${sessionWhen(session.startsAt, group.durationMinutes, group.timezone)}`,
    `👥 ${group.cap ? `0 / ${group.cap}` : goal ? `aiming for ${goal}` : "no limit"}`,
    group.seasonFeeCents ? `💵 ${formatMoney(group.seasonFeeCents)} season, split between members` : group.feeCents ? `💵 ${formatMoney(group.feeCents)}${group.feeSplit ? " a game, split" : " each"}` : null,
  ].filter(Boolean);

  return (
    <Pop style={{ gap: 12 }}>
      <Card>
        <Text style={{ color: t.accent, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>Your group is ready 🎉</Text>
        <Text style={{ color: t.text, fontSize: 24, fontWeight: "900", letterSpacing: -0.5 }}>{group.name}</Text>
        <View style={{ gap: 4 }}>
          {facts.map((f) => <Text key={f} style={{ color: t.text, fontSize: 15 }}>{f}</Text>)}
        </View>
        <Text style={{ color: t.text, fontWeight: "700" }}>Your first game is {relativeDay(session.startsAt, group.timezone).toLowerCase()}.</Text>
      </Card>

      <Card>
        <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>1. Add your players</Text>
        <Muted>
          {group.seasonFeeCents
            ? "Paste your season members' names (and emails, so reminders just work). Then tick who's paid as e-Transfers come in."
            : "Have a list? Paste names, and emails if you have them, so reminders just work. Or skip this: people add themselves from the link."}
        </Muted>
        <View style={{ flexDirection: "row" }}>
          <Button label={group.seasonFeeCents ? "Add season members" : "Add players"} onPress={() => router.push({ pathname: "/members/[slug]", params: { slug: group.slug, add: "1" } })} />
        </View>
      </Card>

      <ShareCard input={shareInput} title="2. Send the link to your group chat" />

      {Platform.OS !== "web" && <PushPrompt />}

      <View style={{ flexDirection: "row" }}>
        <Button label="Done, show my group" variant="secondary" onPress={onDone} />
      </View>
    </Pop>
  );
}
