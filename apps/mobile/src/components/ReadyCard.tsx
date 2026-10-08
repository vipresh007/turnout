import { describeRecurrence, formatMoney, playerGoal, type GroupPage, type ShareInput, isOneOff } from "@turnout/shared";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Platform, Text, View } from "react-native";
import { relativeDay, sessionWhen } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { Pop } from "./motion";
import { PushPrompt } from "./PushPrompt";
import { ShareButtons } from "./ShareCard";
import { Button, Card, IconLine, Pill } from "./ui";

/**
 * Right after an organizer creates a group: what they made, when the first game is, and the two ways
 * to get players in (add them, or send the link). Nothing → live group in a couple of minutes.
 */
export function ReadyCard({ page, shareInput, onDone }: { page: GroupPage; shareInput: ShareInput; onDone: () => void }) {
  const t = useTheme();
  const { group, session } = page;
  const goal = playerGoal(group);
  const where = session.location ?? group.location;

  return (
    <Pop style={{ gap: 12 }}>
      <Card>
        <Pill label="Your group is ready" color={t.accent} icon="check" />
        <Text style={{ color: t.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.8 }}>{group.name}</Text>
        <View style={{ gap: 6 }}>
          <IconLine icon="calendar" color={t.text}>
            {isOneOff(group) ? sessionWhen(session.startsAt, group.durationMinutes, group.timezone) : `${describeRecurrence(group)} · ${sessionWhen(session.startsAt, group.durationMinutes, group.timezone)}`}
          </IconLine>
          {where && <IconLine icon="pin">{where}</IconLine>}
          <IconLine icon="people">{group.cap ? `Up to ${group.cap} players` : goal ? `Aiming for ${goal} players` : "No player limit"}</IconLine>
          {(group.seasonFeeCents || group.feeCents) && (
            <IconLine icon="cash">
              {group.seasonFeeCents ? `${formatMoney(group.seasonFeeCents)} season, split between members` : `${formatMoney(group.feeCents!)}${group.feeSplit ? " a game, split" : " each"}`}
            </IconLine>
          )}
        </View>
        <Text style={{ color: t.accent, fontWeight: "700" }}>
          {isOneOff(group) ? "It's" : "First game"} {relativeDay(session.startsAt, group.timezone).toLowerCase()}
        </Text>
      </Card>

      <Card>
        <Step n={1} title={group.seasonFeeCents ? "Add your season members" : "Add your players"} body={group.seasonFeeCents ? "Paste names (and emails for reminders)." : "Paste a list, or skip: people add themselves."}>
          <View style={{ flexDirection: "row" }}>
            <Button icon="people" label={group.seasonFeeCents ? "Add members" : "Add players"} variant="secondary" onPress={() => router.push({ pathname: "/members/[slug]", params: { slug: group.slug, add: "1" } })} />
          </View>
        </Step>
        <View style={{ height: 1, backgroundColor: t.border }} />
        <Step n={2} title="Share the link" body="Post it in your group chat. That's it.">
          <ShareButtons input={shareInput} />
        </Step>
      </Card>

      {Platform.OS !== "web" && <PushPrompt />}

      <View style={{ flexDirection: "row" }}>
        <Button label="Done, show my group" variant="secondary" onPress={onDone} />
      </View>
    </Pop>
  );
}

/** A numbered setup step: badge, title, one line, then its action. */
function Step({ n, title, body, children }: { n: number; title: string; body: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: t.accentText, fontWeight: "900", fontSize: 14 }}>{n}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>{title}</Text>
          <Text style={{ color: t.muted, fontSize: 14 }}>{body}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}
