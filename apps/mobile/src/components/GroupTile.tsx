import { ASK_WINDOW_HOURS, describeForecast, describeRecurrence, formatMoney, groupShareMessage, inviteMessage, LATE_WARNING_HOURS, playerGoal, shareCents, shortWhen, teamNames, type DashboardGroup } from "@turnout/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { shareUrl, trackEvent, useApi } from "@/lib/api";
import { hoursUntil, relativeDay, sessionWhen } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Pop } from "./motion";
import { Button, Eyebrow, IconLine, Pill, webTransition } from "./ui";

/**
 * One group on the dashboard. Collapsed: when, how full, and anything that needs attention.
 * Expanded: share and remind, who to ask, everyone's answer and payment, the teams, and a way into the group.
 */
export function GroupTile({ item, isNext, expanded, onToggle, onShare, onChanged, demo }: {
  item: DashboardGroup;
  isNext: boolean;
  expanded: boolean;
  onToggle: () => void;
  onShare: (text: string) => void;
  onChanged: () => void;
  /** The public demo: actions change local state instead of calling the API. */
  demo?: { setPaid: (memberId: string) => void; open: () => void };
}) {
  const t = useTheme();
  const api = useApi();
  const { group, session, players } = item;
  const [reminder, setReminder] = useState<{ notified: number; reachable: number; message: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const link = shareUrl(group.slug);
  const where = session.location ?? group.location;
  const message = groupShareMessage({
    name: group.name, activity: group.activity, location: where, timezone: group.timezone, cap: group.cap, targetPlayers: group.targetPlayers,
    startsAt: session.startsAt, confirmed: item.confirmed, cancelled: session.cancelled, link,
    // Season groups paid up front; their per-game price is a drop-in for subs.
    feeCents: group.feeCents, feeSplit: group.feeSplit, dropIn: !!group.seasonFeeCents,
  });
  const season = !!group.seasonFeeCents;
  const share = season ? null : shareCents(group, item.confirmed);
  const goal = playerGoal(group);
  const fill = goal ? Math.min(1, item.confirmed / goal) : 0;
  const status = session.cancelled
    ? { text: "Cancelled this week", color: t.danger }
    : goal === null
      ? { text: `${item.confirmed} in`, color: t.muted }
      : group.cap && item.spotsLeft === 0
        ? { text: item.waitlist ? `Full · ${item.waitlist} waitlisted` : "Full", color: t.accent }
        : !group.cap && item.spotsLeft === 0
          ? { text: `${item.confirmed} in · target met`, color: t.accent }
          : group.cap
            ? { text: `${item.spotsLeft} ${item.spotsLeft === 1 ? "spot" : "spots"} left`, color: t.waitlist }
            : { text: `Need ${item.spotsLeft} more`, color: t.waitlist };
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

  const open = () => (demo ? demo.open() : router.push({ pathname: "/g/[slug]", params: { slug: group.slug } }));
  const remind = demo
    ? async () => setReminder({ notified: 9, reachable: 11, message: `⏰ Reminder: ${group.name} is ${relativeDay(session.startsAt, group.timezone)}. Tap to say if you're in: ${link}` })
    : async () => setReminder(await api.remind(group.slug));
  const hint = attentionHint(item);

  let waitlistPos = 0;
  return (
    <View style={{ backgroundColor: t.card, borderColor: isNext || expanded ? t.accent : t.border, borderWidth: 1, borderRadius: 20, overflow: "hidden" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${group.name}, ${status.text}. ${expanded ? "Hide details" : "Show details"}`}
        onPress={onToggle}
        style={({ hovered }: { hovered?: boolean }) => ({ padding: 18, gap: 10, backgroundColor: hovered ? t.bg : "transparent" })}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            {isNext && (
              <Text style={{ color: t.accent, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
                Next up · {relativeDay(session.startsAt, group.timezone)}
              </Text>
            )}
            <Text style={{ color: t.text, fontSize: 19, fontWeight: "900", letterSpacing: -0.3 }}>{group.name}</Text>
            <Text style={{ color: t.muted }}>
              {sessionWhen(session.startsAt, group.durationMinutes, group.timezone)}
              {where ? ` · ${where}` : ""}
              {expanded ? ` · ${describeRecurrence(group)}` : ""}
              {item.role === "admin" ? " · co-organizer" : ""}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 6 }}>
            <Pill label={status.text} color={status.color} />
            <View style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}><Icon name="chevronDown" size={18} color={t.muted} /></View>
          </View>
        </View>

        {!session.cancelled && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ color: t.text, fontSize: 26, fontWeight: "900", letterSpacing: -1, fontVariant: ["tabular-nums"] }}>
              {item.confirmed}
              <Text style={{ color: t.muted, fontSize: 15, fontWeight: "700" }}>{group.cap ? ` / ${group.cap}` : goal ? ` in · target ${goal}` : " in"}</Text>
            </Text>
            {goal ? (
              <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: t.border, overflow: "hidden" }}>
                <View style={{ height: "100%", width: `${fill * 100}%`, borderRadius: 4, backgroundColor: session.cancelled ? t.muted : t.accent }} />
              </View>
            ) : <View style={{ flex: 1 }} />}
          </View>
        )}
        {!expanded && hint && <IconLine icon="sparkles" color={t.text}>{hint}</IconLine>}
      </Pressable>

      {expanded && (
      <View style={{ paddingHorizontal: 18, paddingBottom: 18, gap: 16 }}>
      {!session.cancelled && (
          <Eyebrow>
            {item.confirmed} in · {item.out} out · {item.waitlist} waitlist{item.confirmed && !season ? ` · ${paidCount}/${item.confirmed} paid` : ""}
            {share !== null && item.confirmed ? ` · ${formatMoney(paidCount * share)} of ${formatMoney(item.confirmed * share)}` : ""}
          </Eyebrow>
      )}
      {session.cancelled && <Text style={{ color: t.danger, fontWeight: "800", fontSize: 16 }}>No game this week</Text>}

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Button icon="megaphone" label={item.spotsLeft && !session.cancelled ? `Need ${item.spotsLeft} more` : "Share"} onPress={() => { trackEvent("link_shared", group.slug, { via: "share", from: "dashboard" }); onShare(message); }} />
        <Button icon="bell" label="Remind" variant="secondary" disabled={session.cancelled} loading={busy === "remind"} onPress={() => act("remind", remind)} />
        <Button label="Open group" icon="arrowRight" variant="secondary" onPress={open} />
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

      <Suggestions item={item} link={link} onShare={onShare} />

      {players.length > 0 && (
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderColor: t.border }}>
            <Text style={{ color: t.muted, fontSize: 12, fontWeight: "800", flex: 1, textTransform: "uppercase", letterSpacing: 0.6 }}>Player</Text>
            <Text style={{ color: t.muted, fontSize: 12, fontWeight: "800", width: 110, textTransform: "uppercase", letterSpacing: 0.6 }}>Status</Text>
            {!season && <Text style={{ color: t.muted, fontSize: 12, fontWeight: "800", width: 56, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.6 }}>Paid</Text>}
          </View>
          {players.map((p) => {
            const status = p.status === "in" ? { label: "In", color: t.accent, icon: "check" as const } : p.status === "waitlist" ? { label: `Waitlist #${++waitlistPos}`, color: t.waitlist, icon: "hourglass" as const } : { label: "Out", color: t.muted, icon: "x" as const };
            return (
              <View key={p.memberId} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 7 }}>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Avatar name={p.name} size={26} />
                  <Text style={{ color: p.status === "out" ? t.muted : t.text, fontSize: 15, flexShrink: 1 }} numberOfLines={1}>
                    {p.name}
                  </Text>
                </View>
                <View style={{ width: 110 }}><Pill {...status} /></View>
                {!season && <View style={{ width: 56, alignItems: "center" }}>
                  {p.status === "out" ? (
                    <Text style={{ color: t.muted }}>—</Text>
                  ) : (
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: p.paid }}
                      accessibilityLabel={`${p.name} paid`}
                      hitSlop={8}
                      onPress={() => (demo ? demo.setPaid(p.memberId) : act(`paid:${p.memberId}`, async () => {
                        await api.setPaid(group.slug, p.memberId, !p.paid);
                        onChanged();
                      }))}
                      style={({ hovered }: { hovered?: boolean }) => ({ width: 28, height: 28, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", borderColor: p.paid || hovered ? t.accent : t.border, backgroundColor: p.paid || hovered ? t.soft : "transparent" })}
                    >
                      {p.paid && <Icon name="check" size={16} color={t.accent} strokeWidth={2.6} />}
                    </Pressable>
                  )}
                </View>}
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
      )}
    </View>
  );
}

/** One line for a collapsed tile: the most useful thing to know or do. */
function attentionHint({ group, session, spotsLeft, suggestions, players, confirmed }: DashboardGroup): string | null {
  if (session.cancelled) return null;
  if (session.note) return session.note;
  const hours = hoursUntil(session.startsAt);
  const close = hours > 0 && hours <= ASK_WINDOW_HOURS;
  const { forecast } = suggestions;
  if (close && forecast?.status === "short") return `You may be ${forecast.short} short · tap to see who to ask`;
  if (close && forecast?.status === "good") return `You're probably good · ${forecast.unanswered} still to answer`;
  if (close && forecast?.status === "full" && hours <= LATE_WARNING_HOURS && forecast.expectedLateDrops > 0) return "Full · you usually lose a player late, a backup would help";
  const waiting = suggestions.invite.length;
  if (close && !forecast && spotsLeft > 0 && waiting > 0 && suggestions.games >= 2) {
    return `${waiting} ${waiting === 1 ? "regular hasn't" : "regulars haven't"} answered yet · tap to ask`;
  }
  const unpaid = players.filter((p) => p.status === "in" && !p.paid).length;
  // Season groups track the season fee on the group page; per-game payments there are only subs.
  if (group.feeCents && !group.seasonFeeCents && confirmed > 0 && unpaid > 0) return `${unpaid} of ${confirmed} still to pay`;
  return null;
}

/**
 * Autopilot, close to game time: "probably good" or "may be N short", and the regulars most likely to say yes,
 * one tap to ask each. Hidden until ASK_WINDOW_HOURS before the game, when most answers are still to come.
 */
function Suggestions({ item, link, onShare }: { item: DashboardGroup; link: string; onShare: (text: string) => void }) {
  const t = useTheme();
  const { group, session, suggestions, spotsLeft, confirmed } = item;
  const hours = hoursUntil(session.startsAt);
  if (session.cancelled || hours <= 0 || hours > ASK_WINDOW_HOURS) return null;
  const when = shortWhen(session.startsAt, group.timezone);
  const { forecast } = suggestions;

  let headline: string | null = null;
  let detail: string | null = null;
  let ask = suggestions.invite;
  let askCount = Math.max(3, spotsLeft);
  const goal = playerGoal(group);
  if (forecast && goal) {
    ({ headline, detail } = describeForecast(forecast, confirmed, goal));
    if (forecast.status === "full" && (hours > LATE_WARNING_HOURS || forecast.expectedLateDrops === 0)) detail = null;
    ask = forecast.status === "full" ? [] : forecast.likely;
    askCount = Math.max(2, forecast.short + 1);
  } else if (spotsLeft > 0 && suggestions.invite.length && suggestions.games >= 2) {
    headline = `Need ${spotsLeft} more? These regulars haven't answered yet:`;
  }
  if (!headline) return null;
  const shortBy = forecast?.short || spotsLeft;

  return (
    <View style={{ backgroundColor: t.soft, borderRadius: 14, padding: 14, gap: 10 }}>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name={forecast && forecast.status !== "short" ? "check" : "warning"} size={18} color={forecast && forecast.status !== "short" ? t.accent : t.waitlist} strokeWidth={2.2} />
          <Text style={{ color: t.text, fontWeight: "800", fontSize: 15, flex: 1 }}>{headline}</Text>
        </View>
        {detail && <Text style={{ color: t.text }}>{detail}</Text>}
      </View>
      {ask.slice(0, askCount).map((p) => (
        <View key={p.memberId} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Avatar name={p.name} size={26} />
          <Text style={{ color: t.text, flex: 1 }} numberOfLines={1}>
            {p.name} <Text style={{ color: t.muted }}>· played {p.played} of {p.games}</Text>
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ask ${p.name}`}
            hitSlop={8}
            onPress={() => {
              trackEvent("invite_asked", group.slug, { status: forecast?.status ?? "none" });
              onShare(inviteMessage(p.name.split(" ")[0]!, group.name, shortBy, when, link));
            }}
            style={({ hovered }: { hovered?: boolean }) => ({ borderWidth: 1, borderColor: t.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: hovered ? t.accent : "transparent", ...webTransition })}
          >
            {({ hovered }: { hovered?: boolean }) => <Text style={{ color: hovered ? t.accentText : t.accent, fontWeight: "800" }}>Ask</Text>}
          </Pressable>
        </View>
      ))}
    </View>
  );
}
