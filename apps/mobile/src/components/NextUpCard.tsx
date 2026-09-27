import { describeRecurrence, formatMoney, groupShareMessage, shareCents, teamNames, type DashboardGroup } from "@turnout/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { shareUrl, useApi } from "@/lib/api";
import { relativeDay, sessionWhen } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { Avatar } from "./Avatar";
import { Pop } from "./motion";
import { Button } from "./ui";

/**
 * The operational view of the organizer's next game: how full it is, one-tap share and remind,
 * everyone's answer and payment, and the teams. What an organizer needs when they open Turnout.
 */
export function NextUpCard({ item, onShare, onChanged }: { item: DashboardGroup; onShare: (text: string) => void; onChanged: () => void }) {
  const t = useTheme();
  const api = useApi();
  const { group, session, players } = item;
  const [reminder, setReminder] = useState<{ notified: number; reachable: number; message: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const link = shareUrl(group.slug);
  const where = session.location ?? group.location;
  const message = groupShareMessage({
    name: group.name, activity: group.activity, location: where, timezone: group.timezone, cap: group.cap,
    startsAt: session.startsAt, confirmed: item.confirmed, cancelled: session.cancelled, link,
    feeCents: group.feeCents, feeSplit: group.feeSplit,
  });
  const share = shareCents(group, item.confirmed);
  const fill = group.cap ? Math.min(1, item.confirmed / group.cap) : 0;
  const status = session.cancelled
    ? { text: "Cancelled this week", color: t.danger }
    : group.cap === null
      ? { text: `${item.confirmed} in`, color: t.muted }
      : item.spotsLeft === 0
        ? { text: item.waitlist ? `Full · ${item.waitlist} waitlisted` : "Full", color: t.accent }
        : { text: `${item.spotsLeft} ${item.spotsLeft === 1 ? "spot" : "spots"} left`, color: t.waitlist };
  const names = new Map(players.map((p) => [p.memberId, p.name]));
  const paidCount = players.filter((p) => p.status === "in" && p.paid).length;

  const act = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  let waitlistPos = 0;
  return (
    <View style={{ backgroundColor: t.card, borderColor: t.accent, borderWidth: 1, borderRadius: 22, padding: 20, gap: 16 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: t.accent, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
          Next up · {relativeDay(session.startsAt, group.timezone)}
        </Text>
        <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: "/g/[slug]", params: { slug: group.slug } })}>
          <Text style={{ color: t.text, fontSize: 24, fontWeight: "900", letterSpacing: -0.5 }}>{group.name}</Text>
        </Pressable>
        <Text style={{ color: t.muted }}>
          {sessionWhen(session.startsAt, group.durationMinutes, group.timezone)}
          {where ? ` · ${where}` : ""} · {describeRecurrence(group)}
        </Text>
      </View>

      {!session.cancelled && (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <Text style={{ color: t.text, fontSize: 44, fontWeight: "900", letterSpacing: -2 }}>{item.confirmed}</Text>
            <Text style={{ color: t.muted, fontSize: 20, fontWeight: "700" }}>{group.cap ? `/ ${group.cap}` : "in"}</Text>
            <View style={{ borderWidth: 1, borderColor: status.color, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginLeft: 6 }}>
              <Text style={{ color: status.color, fontWeight: "800", fontSize: 13 }}>{status.text}</Text>
            </View>
          </View>
          {group.cap && (
            <View style={{ height: 8, borderRadius: 4, backgroundColor: t.border, overflow: "hidden" }}>
              <View style={{ height: "100%", width: `${fill * 100}%`, borderRadius: 4, backgroundColor: t.accent }} />
            </View>
          )}
          <Text style={{ color: t.muted, fontWeight: "700", fontSize: 13, letterSpacing: 0.4 }}>
            {item.confirmed} IN · {item.out} OUT · {item.waitlist} WAITLIST{item.confirmed ? ` · ${paidCount}/${item.confirmed} PAID` : ""}
            {share !== null && item.confirmed ? ` · ${formatMoney(paidCount * share)} OF ${formatMoney(item.confirmed * share)}` : ""}
          </Text>
        </View>
      )}
      {session.cancelled && <Text style={{ color: t.danger, fontWeight: "800", fontSize: 18 }}>Cancelled this week</Text>}

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Button label={item.spotsLeft && !session.cancelled ? `📣 Need ${item.spotsLeft} more` : "📣 Share"} onPress={() => onShare(message)} />
        <Button label="⏰ Remind everyone" variant="secondary" disabled={session.cancelled} loading={busy === "remind"} onPress={() => act("remind", async () => setReminder(await api.remind(group.slug)))} />
      </View>
      {reminder && (
        <Pop style={{ gap: 8 }}>
          <Text style={{ color: t.text, fontWeight: "700" }}>
            {reminder.reachable === 0
              ? "Nobody has reminders on yet. Post this in the group chat:"
              : reminder.notified > 0
                ? `Notified ${reminder.notified} of ${reminder.reachable} with reminders on. Post this for everyone else:`
                : "Reminders already went out in the last hour. You can still post this:"}
          </Text>
          <Pressable onPress={() => onShare(reminder.message)} style={{ backgroundColor: t.bg, borderRadius: 10, padding: 12 }}>
            <Text style={{ color: t.muted }}>{reminder.message}</Text>
            <Text style={{ color: t.accent, fontWeight: "700", marginTop: 6 }}>Tap to share</Text>
          </Pressable>
        </Pop>
      )}

      {players.length > 0 && (
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderColor: t.border }}>
            <Text style={{ color: t.muted, fontSize: 12, fontWeight: "800", flex: 1, textTransform: "uppercase", letterSpacing: 0.6 }}>Player</Text>
            <Text style={{ color: t.muted, fontSize: 12, fontWeight: "800", width: 110, textTransform: "uppercase", letterSpacing: 0.6 }}>Status</Text>
            <Text style={{ color: t.muted, fontSize: 12, fontWeight: "800", width: 56, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.6 }}>Paid</Text>
          </View>
          {players.map((p) => {
            const label = p.status === "in" ? "✅ In" : p.status === "waitlist" ? `⏳ Waitlist #${++waitlistPos}` : "❌ Out";
            return (
              <View key={p.memberId} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 7 }}>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Avatar name={p.name} size={26} />
                  <Text style={{ color: p.status === "out" ? t.muted : t.text, fontSize: 15, flexShrink: 1 }} numberOfLines={1}>
                    {p.name}
                  </Text>
                </View>
                <Text style={{ color: p.status === "out" ? t.muted : t.text, width: 110, fontSize: 14 }}>{label}</Text>
                <View style={{ width: 56, alignItems: "center" }}>
                  {p.status === "out" ? (
                    <Text style={{ color: t.muted }}>—</Text>
                  ) : (
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: p.paid }}
                      accessibilityLabel={`${p.name} paid`}
                      hitSlop={8}
                      onPress={() => act(`paid:${p.memberId}`, async () => {
                        await api.setPaid(group.slug, p.memberId, !p.paid);
                        onChanged();
                      })}
                      style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", borderColor: p.paid ? t.accent : t.border, backgroundColor: p.paid ? t.soft : "transparent" }}
                    >
                      <Text style={{ color: t.accent, fontWeight: "900" }}>{p.paid ? "✓" : ""}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
      {players.length === 0 && <Text style={{ color: t.muted }}>No answers yet. Share the link to get people in.</Text>}

      {session.teams && (
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          {session.teams.teams.map((ids, i) => (
            <View key={i} style={{ flexGrow: 1, flexBasis: "45%", backgroundColor: t.bg, borderRadius: 12, padding: 12, gap: 2 }}>
              <Text style={{ color: t.accent, fontWeight: "900" }}>{teamNames[i]}</Text>
              <Text style={{ color: t.text }}>{ids.map((id) => names.get(id)).filter(Boolean).join(" · ")}</Text>
            </View>
          ))}
        </View>
      )}
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
    </View>
  );
}
