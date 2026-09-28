import { Pressable, Text, View } from "react-native";
import { looksLikeSeasonTotal, parseMoney } from "@turnout/shared";
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
      style={({ hovered }: { hovered?: boolean }) => ({
        alignSelf: "flex-start", paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1,
        borderColor: selected || hovered ? t.accent : t.border, backgroundColor: selected ? t.soft : t.card,
      })}
    >
      <Text style={{ color: selected ? t.accent : t.text, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

/** The player goal as typed: the max if set, otherwise the target. */
const goalFromForm = (v: GroupFormValues) => Number(v.cap) || Number(v.target) || null;

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
      {!value.cap && (
        <Field label="Target players (optional, when there's no max)" placeholder="e.g. 12. We'll say how many more you need" value={value.target} onChangeText={(v) => set("target")(v.replace(/\D/g, ""))} keyboardType="number-pad" />
      )}
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
                style={({ hovered }: { hovered?: boolean }) => ({
                  paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1,
                  borderColor: selected || hovered ? t.accent : t.border, backgroundColor: selected ? t.soft : t.card,
                })}
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
          <Chip label="Per player, each game" selected={value.costMode === "per"} onPress={() => onChange({ ...value, costMode: "per", feeSplit: false })} />
          <Chip label="Total split, each game" selected={value.costMode === "split"} onPress={() => onChange({ ...value, costMode: "split", feeSplit: true })} />
          <Chip label="Season, paid up front" selected={value.costMode === "season"} onPress={() => onChange({ ...value, costMode: "season", feeSplit: false })} />
        </View>
        {value.costMode === "season" && (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Field label="Season total ($)" placeholder="2500" value={value.seasonFee} onChangeText={(v) => set("seasonFee")(v.replace(/[^\d.,]/g, ""))} keyboardType="decimal-pad" />
            <Field label="Drop-in for subs ($, optional)" placeholder="10" value={value.fee} onChangeText={(v) => set("fee")(v.replace(/[^\d.,]/g, ""))} keyboardType="decimal-pad" />
          </View>
        )}
        <View style={{ flexDirection: "row", gap: 12 }}>
          {value.costMode !== "season" && (
            <Field label={value.costMode === "split" ? "Total ($)" : "Each ($)"} placeholder={value.costMode === "split" ? "120" : "10"} value={value.fee} onChangeText={(v) => set("fee")(v.replace(/[^\d.,]/g, ""))} keyboardType="decimal-pad" />
          )}
          <Field label="How to pay" placeholder="e-Transfer to sam@example.com" value={value.payNote} onChangeText={set("payNote")} />
        </View>
        {value.costMode === "split" && !looksLikeSeasonTotal(parseMoney(value.fee) ?? null, goalFromForm(value)) && <Muted>Each player's share depends on how many play that night.</Muted>}
        {value.costMode === "split" && looksLikeSeasonTotal(parseMoney(value.fee) ?? null, goalFromForm(value)) && (
          <Pressable accessibilityRole="button" onPress={() => onChange({ ...value, costMode: "season", feeSplit: false, seasonFee: value.fee, fee: "" })}>
            <Text style={{ color: t.waitlist, fontWeight: "700" }}>
              ⚠️ That's a lot for one game. Is it the whole season's cost? Tap to switch to “Season, paid up front”.
            </Text>
          </Pressable>
        )}
        {value.costMode === "season" && <Muted>Split between your season members (you'll tick them on the Members screen). Anyone else plays as a sub.</Muted>}
      </View>

      <View style={{ gap: 8, marginTop: 4 }}>
        <Text style={{ color: t.muted, fontSize: 13, fontWeight: "600" }}>Reminders for players who turn them on</Text>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <Text style={{ color: t.text, marginRight: 4 }}>First reminder:</Text>
          <Chip label="🌙 Evening before (6pm)" selected={value.reminders.dayBefore && value.reminders.first !== "24h"} onPress={() => set("reminders")({ ...value.reminders, dayBefore: true, first: "evening" })} />
          <Chip label="24 hours before" selected={value.reminders.dayBefore && value.reminders.first === "24h"} onPress={() => set("reminders")({ ...value.reminders, dayBefore: true, first: "24h" })} />
          <Chip label="Off" selected={!value.reminders.dayBefore} onPress={() => set("reminders")({ ...value.reminders, dayBefore: false })} />
        </View>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <Text style={{ color: t.text, marginRight: 4 }}>⏰ Before the game:</Text>
          {[null, 1, 2, 3, 6].map((h) => (
            <Chip key={String(h)} label={h ? `${h}h` : "Off"} selected={value.reminders.hoursBefore === h} onPress={() => set("reminders")({ ...value.reminders, hoursBefore: h })} />
          ))}
        </View>
        {value.reminders.hoursBefore !== null && (
          <Chip
            label="Also nudge people who haven't answered yet"
            selected={!!value.reminders.nudgeAgain}
            onPress={() => set("reminders")({ ...value.reminders, nudgeAgain: !value.reminders.nudgeAgain })}
          />
        )}
      </View>
    </Card>
  );
}
