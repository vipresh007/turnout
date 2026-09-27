import { Pressable, Text, View } from "react-native";
import type { GroupFormValues } from "@/lib/groupForm";
import { useTheme } from "@/lib/theme";
import { Card, Field, Muted } from "./ui";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        alignSelf: "flex-start", paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1,
        borderColor: selected ? t.accent : t.border, backgroundColor: selected ? t.soft : t.card,
      }}
    >
      <Text style={{ color: selected ? t.accent : t.text, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

export function GroupFields({ value, onChange, timezone }: { value: GroupFormValues; onChange: (v: GroupFormValues) => void; timezone: string }) {
  const t = useTheme();
  const set = <K extends keyof GroupFormValues>(key: K) => (v: GroupFormValues[K]) => onChange({ ...value, [key]: v });

  return (
    <Card>
      <Field label="Group name" placeholder="Tuesday Soccer" value={value.name} onChangeText={set("name")} />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Field label="Activity" placeholder="soccer" value={value.activity} onChangeText={set("activity")} />
        <Field label="Max players" placeholder="No limit" value={value.cap} onChangeText={(v) => set("cap")(v.replace(/\D/g, ""))} keyboardType="number-pad" />
      </View>
      <Field label="Location" placeholder="Riverside Park" value={value.location} onChangeText={set("location")} />
      <View style={{ gap: 6 }}>
        <Text style={{ color: t.muted, fontSize: 13, fontWeight: "600" }}>Days (pick one or more)</Text>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          {days.map((d, i) => {
            const selected = value.weekdays.includes(i);
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => set("weekdays")(selected ? value.weekdays.filter((d) => d !== i) : [...value.weekdays, i].sort())}
                style={{
                  paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1,
                  borderColor: selected ? t.accent : t.border, backgroundColor: selected ? t.soft : t.card,
                }}
              >
                <Text style={{ color: selected ? t.accent : t.text, fontWeight: "600" }}>{d}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <Text style={{ color: t.text, marginRight: 4 }}>Repeats:</Text>
        {[1, 2, 3, 4].map((n) => (
          <Chip key={n} label={n === 1 ? "Every week" : n === 2 ? "Every other week" : `Every ${n} weeks`} selected={value.intervalWeeks === n} onPress={() => set("intervalWeeks")(n)} />
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Field label="Start time (24h)" placeholder="19:30" value={value.startTime} onChangeText={set("startTime")} />
        <Field label="Ends on (optional)" placeholder="2026-12-15" value={value.endsOn} onChangeText={set("endsOn")} />
      </View>
      <Muted>Timezone: {timezone}</Muted>

      <View style={{ gap: 8, marginTop: 4 }}>
        <Text style={{ color: t.muted, fontSize: 13, fontWeight: "600" }}>Cost (optional)</Text>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <Chip label="Per player" selected={!value.feeSplit} onPress={() => set("feeSplit")(false)} />
          <Chip label="Total, split between everyone in" selected={value.feeSplit} onPress={() => set("feeSplit")(true)} />
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Field label={value.feeSplit ? "Total ($)" : "Each ($)"} placeholder={value.feeSplit ? "120" : "10"} value={value.fee} onChangeText={(v) => set("fee")(v.replace(/[^\d.,]/g, ""))} keyboardType="decimal-pad" />
          <Field label="How to pay" placeholder="e-Transfer to sam@example.com" value={value.payNote} onChangeText={set("payNote")} />
        </View>
        {value.feeSplit && <Muted>Each player's share updates as people join.</Muted>}
      </View>

      <View style={{ gap: 8, marginTop: 4 }}>
        <Text style={{ color: t.muted, fontSize: 13, fontWeight: "600" }}>Reminders for players who turn them on</Text>
        <Chip
          label="🌙 Evening before (6pm)"
          selected={value.reminders.dayBefore}
          onPress={() => set("reminders")({ ...value.reminders, dayBefore: !value.reminders.dayBefore })}
        />
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <Text style={{ color: t.text, marginRight: 4 }}>⏰ Before the game:</Text>
          {[null, 1, 2, 3, 6].map((h) => (
            <Chip key={String(h)} label={h ? `${h}h` : "Off"} selected={value.reminders.hoursBefore === h} onPress={() => set("reminders")({ ...value.reminders, hoursBefore: h })} />
          ))}
        </View>
      </View>
    </Card>
  );
}
