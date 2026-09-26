import { createGroupSchema, type GroupDraft } from "@turnout/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button, Card, Field, Muted, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export default function NewGroup() {
  const t = useTheme();
  const [sentence, setSentence] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [activity, setActivity] = useState("");
  const [location, setLocation] = useState("");
  const [weekday, setWeekday] = useState<number | null>(null);
  const [startTime, setStartTime] = useState("");
  const [cap, setCap] = useState("");

  const applyDraft = (d: GroupDraft) => {
    if (d.name) setName(d.name);
    if (d.activity) setActivity(d.activity);
    if (d.location) setLocation(d.location);
    if (d.weekday !== undefined) setWeekday(d.weekday);
    if (d.startTime) setStartTime(d.startTime);
    if (d.cap) setCap(String(d.cap));
  };

  const draft = async () => {
    setDrafting(true);
    setError(null);
    try {
      applyDraft((await api.draftGroup(sentence)).draft);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDrafting(false);
    }
  };

  const create = async () => {
    const parsed = createGroupSchema.safeParse({
      name, activity: activity || undefined, location: location || undefined,
      weekday, startTime, timezone: deviceTimezone, cap: cap ? Number(cap) : null,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      setError(`${issue.path.join(".") || "Form"}: ${issue.message}`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { group } = await api.createGroup(parsed.data);
      router.replace({ pathname: "/g/[slug]", params: { slug: group.slug, created: "1" } });
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: "700" }}>Describe your group</Text>
        <Field
          label="One sentence is enough"
          placeholder="Tuesday soccer at Riverside Park, 7:30pm, 14 players"
          value={sentence}
          onChangeText={setSentence}
          onSubmitEditing={draft}
          multiline
        />
        <View style={{ flexDirection: "row" }}>
          <Button label="Fill it in for me" variant="secondary" onPress={draft} loading={drafting} disabled={sentence.trim().length < 3} />
        </View>
      </Card>

      <Card>
        <Field label="Group name" placeholder="Tuesday Soccer" value={name} onChangeText={setName} />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Field label="Activity" placeholder="soccer" value={activity} onChangeText={setActivity} />
          <Field label="Max players" placeholder="No limit" value={cap} onChangeText={(v) => setCap(v.replace(/\D/g, ""))} keyboardType="number-pad" />
        </View>
        <Field label="Location" placeholder="Riverside Park" value={location} onChangeText={setLocation} />
        <View style={{ gap: 6 }}>
          <Text style={{ color: t.muted, fontSize: 13, fontWeight: "600" }}>Every</Text>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {days.map((d, i) => (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityState={{ selected: weekday === i }}
                onPress={() => setWeekday(i)}
                style={{
                  paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1,
                  borderColor: weekday === i ? t.accent : t.border, backgroundColor: weekday === i ? t.soft : t.card,
                }}
              >
                <Text style={{ color: weekday === i ? t.accent : t.text, fontWeight: "600" }}>{d}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Field label="Start time (24h)" placeholder="19:30" value={startTime} onChangeText={setStartTime} />
        <Muted>Timezone: {deviceTimezone}</Muted>
      </Card>

      {error && <Text style={{ color: t.danger }}>{error}</Text>}
      <View style={{ flexDirection: "row" }}>
        <Button label="Create group" onPress={create} loading={saving} big />
      </View>
    </Screen>
  );
}
