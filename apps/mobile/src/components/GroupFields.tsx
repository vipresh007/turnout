import { useState, type ReactNode } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { formatMoney, looksLikeSeasonTotal, minutesBetween, parseMoney } from "@turnout/shared";
import type { GroupFormValues } from "@/lib/groupForm";
import { useTheme } from "@/lib/theme";
import { Card, Field, webTransition } from "./ui";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** One short line under the cost choice, so it's clear who pays what and when. */
const COST_HELP: Record<GroupFormValues["costMode"], string | null> = {
  none: null,
  per: "Everyone who plays pays this, each game.",
  split: "The game's cost is shared by whoever plays.",
  season: "Members pay once, up front. Others join as subs.",
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
  return parts.join(" + ");
}

function costSummary(v: GroupFormValues): string {
  switch (v.costMode) {
    case "none": return "No cost";
    case "per": return money(v.fee) ? `${money(v.fee)} each game` : "Per player, each game";
    case "split": return money(v.fee) ? `${money(v.fee)} a game, split` : "Split each game";
    case "season": return money(v.seasonFee) ? `${money(v.seasonFee)} season${money(v.fee) ? ` · subs ${money(v.fee)}` : ""}` : "Season, paid up front";
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
        <View style={{ flexDirection: "row", gap: 6 }}>
          {days.map((d, i) => {
            const selected = value.weekdays.includes(i);
            return <DayDot key={d} label={d} selected={selected} onPress={() => set("weekdays")(selected ? value.weekdays.filter((x) => x !== i) : [...value.weekdays, i].sort())} />;
          })}
        </View>
        <Segmented
          options={[[1, "Weekly"], [2, "2 wks"], [3, "3 wks"], [4, "4 wks"]]}
          value={value.intervalWeeks}
          onChange={(n) => set("intervalWeeks")(n)}
        />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Field label="Starts" placeholder="19:30" value={value.startTime} onChangeText={set("startTime")} />
          <Field label="Ends" placeholder="21:30" value={value.endTime} onChangeText={set("endTime")} />
          <Field label="Last game" placeholder="Optional" value={value.endsOn} onChangeText={set("endsOn")} />
        </View>
        <Hint>{[length, timezone].filter(Boolean).join(" · ")}</Hint>
      </Section>

      <Section title="Players">
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Field label="Max players" placeholder="No limit" value={value.cap} onChangeText={digits("cap")} keyboardType="number-pad" />
          {value.cap ? <View style={{ flex: 1 }} /> : <Field label="Aim for" placeholder="Optional" value={value.target} onChangeText={digits("target")} keyboardType="number-pad" />}
        </View>
        <Hint>{value.cap ? "When it's full, new players join a waitlist." : "No max: everyone who's in plays."}</Hint>
      </Section>

      <Section title="Cost" summary={costSummary(value)} startOpen={value.costMode !== "none" && !value.fee && !value.seasonFee}>
        <Segmented
          options={[["none", "None"], ["per", "Per game"], ["split", "Split"], ["season", "Season"]]}
          value={value.costMode}
          onChange={(m) => onChange({ ...value, costMode: m, feeSplit: m === "split" })}
        />
        {COST_HELP[value.costMode] && <Hint>{COST_HELP[value.costMode]}</Hint>}
        {value.costMode === "per" && <Field label="Each player pays ($)" placeholder="10" value={value.fee} onChangeText={amount("fee")} keyboardType="decimal-pad" />}
        {value.costMode === "split" && <Field label="One game costs ($)" placeholder="150" value={value.fee} onChangeText={amount("fee")} keyboardType="decimal-pad" />}
        {seasonHint && (
          <Pressable accessibilityRole="button" onPress={() => onChange({ ...value, costMode: "season", feeSplit: false, seasonFee: value.fee, fee: "" })}>
            <Text style={{ color: t.waitlist, fontWeight: "700" }}>Is that the whole season's cost? Tap to switch to Season.</Text>
          </Pressable>
        )}
        {value.costMode === "season" && (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Field label="Season total ($)" placeholder="2500" value={value.seasonFee} onChangeText={amount("seasonFee")} keyboardType="decimal-pad" />
            <Field label="Sub price ($)" placeholder="Optional" value={value.fee} onChangeText={amount("fee")} keyboardType="decimal-pad" />
          </View>
        )}
        {value.costMode !== "none" && <Field label="How to pay" placeholder="e.g. e-Transfer to sam@example.com" value={value.payNote} onChangeText={set("payNote")} />}
      </Section>

      <Section title="Reminders" summary={reminderSummary(value.reminders)}>
        <Labeled label="First reminder">
          <Segmented
            options={[["evening", "Evening"], ["24h", "24h before"], ["off", "Off"]]}
            value={!value.reminders.dayBefore ? "off" : value.reminders.first === "24h" ? "24h" : "evening"}
            onChange={(v) => setReminders(v === "off" ? { dayBefore: false } : { dayBefore: true, first: v })}
          />
        </Labeled>
        <Labeled label="Last reminder">
          <Segmented
            options={[[0, "Off"], [1, "1h"], [2, "2h"], [3, "3h"], [6, "6h"]]}
            value={value.reminders.hoursBefore ?? 0}
            onChange={(h) => setReminders({ hoursBefore: h || null })}
          />
        </Labeled>
        {value.reminders.hoursBefore !== null && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ color: t.text, fontSize: 15, flex: 1 }}>Nudge anyone who hasn't answered</Text>
            <Switch value={!!value.reminders.nudgeAgain} onValueChange={(on) => setReminders({ nudgeAgain: on })} trackColor={{ true: t.accent }} />
          </View>
        )}
        <Hint>Only players who turned on reminders get these.</Hint>
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

/** A short label over a control, so every control lines up at the left edge. */
function Labeled({ label, children }: { label: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: t.muted, fontSize: 13, fontWeight: "600" }}>{label}</Text>
      {children}
    </View>
  );
}

/** One quiet line of help under a control. */
function Hint({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.muted, fontSize: 13, lineHeight: 18 }}>{children}</Text>;
}

/** Equal-width options in one rounded track (iOS-style). Never wraps. */
function Segmented<V extends string | number>({ options, value, onChange }: { options: [V, string][]; value: V; onChange: (v: V) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", backgroundColor: t.bg, borderRadius: 12, borderWidth: 1, borderColor: t.border, padding: 3, gap: 3 }}>
      {options.map(([v, label]) => {
        const selected = v === value;
        return (
          <Pressable
            key={String(v)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(v)}
            style={({ hovered }: { hovered?: boolean }) => ({
              flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8, paddingHorizontal: 4, borderRadius: 9,
              backgroundColor: selected ? t.card : hovered ? t.soft : "transparent",
              borderWidth: 1, borderColor: selected ? t.accent : "transparent", ...webTransition,
            })}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: selected ? t.accent : t.text, fontWeight: selected ? "800" : "600", fontSize: 14 }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A weekday as a round toggle; the seven fill one row. */
function DayDot({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) => ({
        flex: 1, aspectRatio: 1, maxWidth: 52, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1,
        borderColor: selected || hovered ? t.accent : t.border, backgroundColor: selected ? t.accent : t.bg, ...webTransition,
      })}
    >
      <Text style={{ color: selected ? t.accentText : t.text, fontWeight: "700", fontSize: 13 }}>{label.slice(0, 2)}</Text>
    </Pressable>
  );
}
