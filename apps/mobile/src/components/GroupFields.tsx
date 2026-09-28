import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { formatMoney, looksLikeSeasonTotal, minutesBetween, parseMoney } from "@turnout/shared";
import type { GroupFormValues } from "@/lib/groupForm";
import { useTheme } from "@/lib/theme";
import { Card, Field, Muted, webTransition } from "./ui";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** One line under the cost choice, so it's clear who pays what and when. */
const COST_HELP: Record<GroupFormValues["costMode"], string> = {
  none: "No money to track.",
  per: "Everyone who plays pays the same fixed amount each game, e.g. $10 a head for drop-in.",
  split: "One game has a set cost (e.g. $150 for the court) shared by whoever plays that night, so the share changes with turnout.",
  season: "Members pay their share of the whole season once, before it starts. After that, weekly in/out is just a headcount. Others can join as subs.",
};

/** The player goal as typed: the max if set, otherwise the target. */
const goalFromForm = (v: GroupFormValues) => Number(v.cap) || Number(v.target) || null;

const money = (text: string) => {
  const cents = parseMoney(text);
  return cents ? formatMoney(cents) : null;
};

/** "Evening before + 2h before" etc., for the collapsed Reminders section. */
function reminderSummary(r: GroupFormValues["reminders"]): string {
  const parts = [r.dayBefore ? (r.first === "24h" ? "24h before" : "evening before") : null, r.hoursBefore ? `${r.hoursBefore}h before` : null].filter(Boolean);
  if (!parts.length) return "Off";
  return `${parts.join(" + ")}${r.nudgeAgain && r.hoursBefore ? ", nudging anyone who hasn't answered" : ""}`;
}

function costSummary(v: GroupFormValues): string {
  switch (v.costMode) {
    case "none": return "No cost";
    case "per": return money(v.fee) ? `${money(v.fee)} each game` : "Per player, each game";
    case "split": return money(v.fee) ? `${money(v.fee)} a game, split` : "Split each game";
    case "season": return money(v.seasonFee) ? `${money(v.seasonFee)} season, paid up front${money(v.fee) ? ` · subs ${money(v.fee)}` : ""}` : "Season, paid up front";
  }
}

/** The group form, in sections: Basics, When, Players, then Cost and Reminders (collapsed to a summary). */
export function GroupFields({ value, onChange, timezone }: { value: GroupFormValues; onChange: (v: GroupFormValues) => void; timezone: string }) {
  const t = useTheme();
  const set = <K extends keyof GroupFormValues>(key: K) => (v: GroupFormValues[K]) => onChange({ ...value, [key]: v });
  const setReminders = (r: Partial<GroupFormValues["reminders"]>) => onChange({ ...value, reminders: { ...value.reminders, ...r } });
  const minutes = minutesBetween(value.startTime, value.endTime);
  const length = minutes ? `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h` : ""}${minutes % 60 ? ` ${minutes % 60}m` : ""}`.trim() + (minutes > 12 * 60 ? " (check the times)" : "") : null;
  const digits = (key: "cap" | "target") => (v: string) => set(key)(v.replace(/\D/g, ""));
  const amount = (key: "fee" | "seasonFee") => (v: string) => set(key)(v.replace(/[^\d.,]/g, ""));
  const seasonHint = value.costMode === "split" && looksLikeSeasonTotal(parseMoney(value.fee) ?? null, goalFromForm(value));

  return (
    <View style={{ gap: 16 }}>
      <Section title="Basics">
        <Field label="Group name" placeholder="Tuesday Soccer" value={value.name} onChangeText={set("name")} />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Field label="Activity" placeholder="soccer" value={value.activity} onChangeText={set("activity")} />
          <Field label="Location" placeholder="Riverside Park" value={value.location} onChangeText={set("location")} />
        </View>
      </Section>

      <Section title="When">
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          {days.map((d, i) => {
            const selected = value.weekdays.includes(i);
            return <Chip key={d} label={d} selected={selected} onPress={() => set("weekdays")(selected ? value.weekdays.filter((x) => x !== i) : [...value.weekdays, i].sort())} />;
          })}
        </View>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          {[1, 2, 3, 4].map((n) => (
            <Chip key={n} label={n === 1 ? "Every week" : n === 2 ? "Every other week" : `Every ${n} weeks`} selected={value.intervalWeeks === n} onPress={() => set("intervalWeeks")(n)} />
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Field label="Starts (24h)" placeholder="19:30" value={value.startTime} onChangeText={set("startTime")} />
          <Field label="Ends (24h)" placeholder="21:30" value={value.endTime} onChangeText={set("endTime")} />
        </View>
        <Muted>{length ? `Each game runs ${length}. ` : ""}Times are in {timezone}.</Muted>
        <Field label="Last game (optional, e.g. end of season)" placeholder="2026-12-15" value={value.endsOn} onChangeText={set("endsOn")} />
      </Section>

      <Section title="Players">
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Field label="Max players" placeholder="No limit" value={value.cap} onChangeText={digits("cap")} keyboardType="number-pad" />
          {!value.cap && <Field label="Aim for (optional)" placeholder="e.g. 12" value={value.target} onChangeText={digits("target")} keyboardType="number-pad" />}
        </View>
        <Muted>
          {value.cap
            ? "Once it's full, new players join a waitlist and move up when someone drops."
            : "No limit: everyone who says in plays. “Aim for” lets Turnout tell you how many more you need."}
        </Muted>
      </Section>

      <Section title="Cost" summary={costSummary(value)} startOpen={value.costMode !== "none" && !value.fee && !value.seasonFee}>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          <Chip label="No cost" selected={value.costMode === "none"} onPress={() => onChange({ ...value, costMode: "none" })} />
          <Chip label="Per player, each game" selected={value.costMode === "per"} onPress={() => onChange({ ...value, costMode: "per", feeSplit: false })} />
          <Chip label="Split each game" selected={value.costMode === "split"} onPress={() => onChange({ ...value, costMode: "split", feeSplit: true })} />
          <Chip label="Season, paid up front" selected={value.costMode === "season"} onPress={() => onChange({ ...value, costMode: "season", feeSplit: false })} />
        </View>
        <Muted>{COST_HELP[value.costMode]}</Muted>
        {value.costMode === "per" && <Field label="Each player pays ($)" placeholder="10" value={value.fee} onChangeText={amount("fee")} keyboardType="decimal-pad" />}
        {value.costMode === "split" && <Field label="One game costs ($)" placeholder="150" value={value.fee} onChangeText={amount("fee")} keyboardType="decimal-pad" />}
        {seasonHint && (
          <Pressable accessibilityRole="button" onPress={() => onChange({ ...value, costMode: "season", feeSplit: false, seasonFee: value.fee, fee: "" })}>
            <Text style={{ color: t.waitlist, fontWeight: "700" }}>⚠️ That's a lot for one game. Is it the whole season's cost? Tap to switch to “Season, paid up front”.</Text>
          </Pressable>
        )}
        {value.costMode === "season" && (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Field label="Whole season costs ($)" placeholder="2500" value={value.seasonFee} onChangeText={amount("seasonFee")} keyboardType="decimal-pad" />
            <Field label="Subs pay per game ($, optional)" placeholder="10" value={value.fee} onChangeText={amount("fee")} keyboardType="decimal-pad" />
          </View>
        )}
        {value.costMode === "season" && <Muted>Split between your season members. Add them on the Members screen after you create the group.</Muted>}
        {value.costMode !== "none" && <Field label="How to pay (optional)" placeholder="e-Transfer to sam@example.com" value={value.payNote} onChangeText={set("payNote")} />}
      </Section>

      <Section title="Reminders" summary={reminderSummary(value.reminders)}>
        <Muted>For players who turn on reminders (email or notification) on the group page.</Muted>
        <Row label="First">
          <Chip label="Evening before (6pm)" selected={value.reminders.dayBefore && value.reminders.first !== "24h"} onPress={() => setReminders({ dayBefore: true, first: "evening" })} />
          <Chip label="24h before" selected={value.reminders.dayBefore && value.reminders.first === "24h"} onPress={() => setReminders({ dayBefore: true, first: "24h" })} />
          <Chip label="Off" selected={!value.reminders.dayBefore} onPress={() => setReminders({ dayBefore: false })} />
        </Row>
        <Row label="Before the game">
          {[null, 1, 2, 3, 6].map((h) => (
            <Chip key={String(h)} label={h ? `${h}h` : "Off"} selected={value.reminders.hoursBefore === h} onPress={() => setReminders({ hoursBefore: h })} />
          ))}
        </Row>
        {value.reminders.hoursBefore !== null && (
          <Chip label="Also nudge people who haven't answered" selected={!!value.reminders.nudgeAgain} onPress={() => setReminders({ nudgeAgain: !value.reminders.nudgeAgain })} />
        )}
      </Section>
    </View>
  );
}

/** A titled card. With a summary it starts collapsed to one line and opens on tap. */
function Section({ title, summary, startOpen, children }: { title: string; summary?: string; startOpen?: boolean; children: ReactNode }) {
  const t = useTheme();
  const [open, setOpen] = useState(!summary || !!startOpen);
  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: "800" }}>{title}</Text>
        {summary && !open && <Text style={{ color: t.muted }}>{summary}</Text>}
      </View>
      {summary && <Text style={{ color: t.accent, fontWeight: "700" }}>{open ? "Done" : "Change"}</Text>}
    </View>
  );
  return (
    <Card>
      {summary ? (
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((o) => !o)}>
          {header}
        </Pressable>
      ) : (
        header
      )}
      {open && children}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <Text style={{ color: t.text, marginRight: 4, minWidth: 110 }}>{label}</Text>
      {children}
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) => ({
        alignSelf: "flex-start", paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1,
        borderColor: selected || hovered ? t.accent : t.border, backgroundColor: selected ? t.soft : t.card, ...webTransition,
      })}
    >
      <Text style={{ color: selected ? t.accent : t.text, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}
