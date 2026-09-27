import { describeRecurrence, type Group, type UpcomingWeek } from "@turnout/shared";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SignInGate } from "@/components/SignInGate";
import { Button, Card, Field, Muted, Screen } from "@/components/ui";
import { useApi } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { useTheme } from "@/lib/theme";

export default function ScheduleScreen() {
  return (
    <SignInGate reason="Sign in to manage your group's schedule.">
      <Schedule />
    </SignInGate>
  );
}

function Schedule() {
  const t = useTheme();
  const api = useApi();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [weeks, setWeeks] = useState<UpcomingWeek[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.groupPage(slug), api.weeks(slug)]).then(
      ([p, w]) => {
        setGroup(p.group);
        setWeeks(w.weeks);
      },
      (e: Error) => setError(e.message),
    );
  }, [api, slug]);

  const update = async (week: UpcomingWeek, input: Parameters<typeof api.updateWeek>[2]) => {
    setError(null);
    try {
      setWeeks((await api.updateWeek(slug, week.scheduledAt, input)).weeks);
      setEditing(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!group || !weeks) return <Screen>{error ? <Text style={{ color: t.danger }}>{error}</Text> : <ActivityIndicator style={{ marginTop: 48 }} />}</Screen>;

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Text style={{ color: t.text, fontSize: 24, fontWeight: "900" }}>{group.name}</Text>
        <Muted>
          {describeRecurrence(group)} at {formatTime(group.startTime)}
          {group.endsOn ? ` until ${group.endsOn}` : ""}. Skip a week or change one without touching the rest.
        </Muted>
      </View>
      {weeks.map((w) => (
        <WeekRow key={w.scheduledAt} week={w} group={group} editing={editing === w.scheduledAt} onEdit={() => setEditing(editing === w.scheduledAt ? null : w.scheduledAt)} onUpdate={(input) => update(w, input)} />
      ))}
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
    </Screen>
  );
}

function WeekRow({ week, group, editing, onEdit, onUpdate }: {
  week: UpcomingWeek; group: Group; editing: boolean; onEdit: () => void; onUpdate: (input: { cancelled?: boolean; startTime?: string | null; location?: string | null; note?: string | null }) => Promise<void>;
}) {
  const t = useTheme();
  const tz = group.timezone;
  const moved = week.startsAt !== week.scheduledAt;
  const localTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  const [time, setTime] = useState(moved ? localTime(week.startsAt) : "");
  const [location, setLocation] = useState(week.location ?? "");
  const [note, setNote] = useState(week.note ?? "");
  const [busy, setBusy] = useState(false);
  const run = async (input: Parameters<typeof onUpdate>[0]) => {
    setBusy(true);
    await onUpdate(input);
    setBusy(false);
  };
  const date = new Date(week.startsAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: tz });
  const at = new Date(week.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: tz });

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: week.cancelled ? t.muted : t.text, fontSize: 17, fontWeight: "800", textDecorationLine: week.cancelled ? "line-through" : "none" }}>
            {date} · {at}
          </Text>
          {week.cancelled && <Text style={{ color: t.danger, fontWeight: "700" }}>Skipped</Text>}
          {!week.cancelled && (moved || week.location || week.note) && (
            <Text style={{ color: t.waitlist, fontWeight: "600" }}>
              {[moved && `Moved from ${new Date(week.scheduledAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: tz })}`, week.location && `at ${week.location}`, week.note && `“${week.note}”`].filter(Boolean).join(" · ")}
            </Text>
          )}
        </View>
        <View style={{ width: 96 }}>
          <Button label={week.cancelled ? "Restore" : "Skip"} variant={week.cancelled ? "secondary" : "danger"} loading={busy} onPress={() => run({ cancelled: !week.cancelled })} />
        </View>
      </View>
      {!week.cancelled && (
        <Text accessibilityRole="button" onPress={onEdit} style={{ color: t.accent, fontWeight: "700" }}>
          {editing ? "Close" : "Change time, place or note"}
        </Text>
      )}
      {editing && (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Field label={`Time (regular ${formatTime(group.startTime)})`} placeholder={group.startTime} value={time} onChangeText={setTime} />
            <Field label="Place (this week)" placeholder={group.location ?? "Same as usual"} value={location} onChangeText={setLocation} />
          </View>
          <Field label="Note for players" placeholder="e.g. Main gym closed, we're in Gym B" value={note} onChangeText={setNote} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Button label="Save for this week" loading={busy} onPress={() => run({ startTime: time.trim() || null, location: location.trim() || null, note: note.trim() || null })} />
            {(moved || week.location || week.note) && (
              <Button label="Back to usual" variant="secondary" onPress={() => run({ startTime: null, location: null, note: null })} />
            )}
          </View>
        </View>
      )}
    </Card>
  );
}
