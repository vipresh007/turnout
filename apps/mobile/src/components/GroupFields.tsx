import { Pressable, Text, View } from "react-native";
import type { GroupFormValues } from "@/lib/groupForm";
import { useTheme } from "@/lib/theme";
import { Card, Field, Muted } from "./ui";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
        <Text style={{ color: t.muted, fontSize: 13, fontWeight: "600" }}>Every</Text>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          {days.map((d, i) => {
            const selected = value.weekday === i;
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => set("weekday")(i)}
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
      <Field label="Start time (24h)" placeholder="19:30" value={value.startTime} onChangeText={set("startTime")} />
      <Muted>Timezone: {timezone}</Muted>
    </Card>
  );
}
