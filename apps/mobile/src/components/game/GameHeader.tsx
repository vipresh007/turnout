import { activityEmoji, describeRecurrence, type GroupPage } from "@turnout/shared";
import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { calendarUrl } from "@/lib/api";
import { mapsUrl, relativeDay, sessionWhen } from "@/lib/format";
import { sportTone, tint, useTheme } from "@/lib/theme";
import { Display, Eyebrow, IconLine, Pill, Texture } from "../ui";

// The top of a group page: what the game is, when, where. The sport sets the colour; a change for this week is one
// pill that opens, so the page starts with the game and not a warning box.

export function GameHeader({ page, slug }: { page: GroupPage; slug: string }) {
  const t = useTheme();
  const { group, session } = page;
  const tone = sportTone(group.activity, t);
  const where = session.location ?? group.location;
  const moved = session.startsAt !== session.scheduledAt;
  const changed = !session.cancelled && (moved || session.location || session.note);
  const [showChange, setShowChange] = useState(false);
  const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: group.timezone });

  return (
    <View style={{ borderRadius: t.radius.lg, overflow: "hidden", backgroundColor: tint(tone, 0.1), borderWidth: 1, borderColor: tint(tone, 0.25), padding: 18, gap: 10, boxShadow: t.shadow.card }}>
      <Texture color={tone} opacity={0.08} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: tint(tone, 0.18), alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 22 }}>{activityEmoji(group.activity, group.name)}</Text>
        </View>
        <Eyebrow color={tone}>{describeRecurrence(group)}</Eyebrow>
      </View>
      <Display level="display">{group.name}</Display>
      <Text style={[t.type.body, { color: t.text, fontWeight: "500" }]}>
        {sessionWhen(session.startsAt, group.durationMinutes, group.timezone)}
        <Text style={{ color: tone, fontWeight: "600" }}> · {relativeDay(session.startsAt, group.timezone)}</Text>
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
        {where && (
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(mapsUrl(where))} hitSlop={6} style={({ hovered }: { hovered?: boolean }) => ({ opacity: hovered ? 0.7 : 1, flexShrink: 1 })}>
            <IconLine icon="pin">{where}</IconLine>
          </Pressable>
        )}
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(calendarUrl(slug))} hitSlop={6} style={({ hovered }: { hovered?: boolean }) => ({ opacity: hovered ? 0.7 : 1 })}>
          <IconLine icon="calendar">Add to calendar</IconLine>
        </Pressable>
        {changed && (
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: showChange }} onPress={() => setShowChange((s) => !s)} hitSlop={6}>
            <Pill label={showChange ? "Changed this week" : "Changed this week ›"} color={t.energy} icon="warning" />
          </Pressable>
        )}
      </View>
      {changed && showChange && (
        <View style={{ backgroundColor: t.surface2, borderRadius: t.radius.md, padding: 12, gap: 4 }}>
          {moved && <Text style={{ color: t.text }}>New time: {time(session.startsAt)} (usually {time(session.scheduledAt)})</Text>}
          {session.location && <Text style={{ color: t.text }}>Place: {session.location}</Text>}
          {session.note && <Text style={{ color: t.muted }}>“{session.note}”</Text>}
        </View>
      )}
    </View>
  );
}
