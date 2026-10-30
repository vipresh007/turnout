import { ASK_WINDOW_HOURS, describeForecast, formatMoney, LATE_WARNING_HOURS, playerGoal, type GroupPage } from "@turnout/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useApi } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { hoursUntil } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { Icon } from "../Icon";
import { Pop } from "../motion";
import { Button, Chip, Eyebrow, ProgressBar } from "../ui";

// Organizer-only pieces of a group: the autopilot forecast and the season money. Used by the Manage sheet and the
// sticky bar on the group page.

/** The forecast, if it's time to show one: within ASK_WINDOW_HOURS of a game that isn't cancelled. */
export function forecastFor(page: GroupPage) {
  const forecast = page.organizer?.forecast;
  const { group, session, roster } = page;
  const hours = hoursUntil(session.startsAt);
  const goal = playerGoal(group);
  if (!forecast || !goal || session.cancelled || hours <= 0 || hours > ASK_WINDOW_HOURS) return null;
  const { headline, detail } = describeForecast(forecast, roster.confirmed.length, goal);
  const ask = forecast.status === "full" ? [] : forecast.likely.slice(0, Math.min(3, Math.max(2, forecast.short + 1)));
  // The Ask buttons already name the likely players, so the sentence only shows when there's no one to ask.
  const showDetail = ask.length === 0 && (forecast.status !== "full" || (hours <= LATE_WARNING_HOURS && forecast.expectedLateDrops > 0));
  return { forecast, headline, detail, ask, showDetail, short: forecast.status === "short" };
}

/** Autopilot on the group page, for organizers, within ASK_WINDOW_HOURS of the game. */
export function ForecastCard({ page, onAsk }: { page: GroupPage; onAsk: (name: string) => void }) {
  const t = useTheme();
  const f = forecastFor(page);
  if (!f) return null;
  return (
    <View style={{ backgroundColor: f.short ? t.energySoft : t.soft, borderRadius: 14, padding: 14, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name={f.short ? "warning" : "check"} size={18} color={f.short ? t.energy : t.accent} strokeWidth={2.2} />
        <Text style={{ color: t.text, fontWeight: "800", fontSize: 15, flex: 1 }}>{f.headline}</Text>
      </View>
      {f.showDetail && <Text style={{ color: t.text }}>{f.detail}</Text>}
      {f.ask.length > 0 && (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {f.ask.map((p) => <Chip key={p.memberId} label={`Ask ${p.name}`} icon="megaphone" tone={f.short ? t.energy : t.accent} onPress={() => onAsk(p.name)} />)}
        </View>
      )}
    </View>
  );
}

/** "3 of 10 paid · $30 of $100 collected". */
export const paidLine = (paid: number, total: number, share: number | null) =>
  `${paid} of ${total} paid${share !== null ? ` · ${formatMoney(paid * share)} of ${formatMoney(total * share)} collected` : ""}`;

/** Organizer: the season at a glance, who still owes, and a nudge. */
export function SeasonCard({ page, onShare, onChanged }: { page: GroupPage; onShare: (text: string) => void; onChanged: () => void }) {
  const t = useTheme();
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ notified: number; unpaid: number; message: string } | null>(null);
  const { group, season } = page;
  if (!season) return null;
  const members = season.memberIds.length;
  const paid = page.organizer?.seasonPaid.length ?? 0;
  const share = season.shareCents;
  return (
    <View style={{ backgroundColor: t.soft, borderRadius: 14, padding: 14, gap: 8 }}>
      <Eyebrow>Season</Eyebrow>
      {members ? (
        <>
          <Text style={{ color: t.text, fontSize: 20, fontWeight: "800" }}>{paid} of {members} paid</Text>
          <ProgressBar value={paid} max={members} height={6} />
          <Text style={{ color: t.muted, fontSize: 13 }}>
            {formatMoney((share ?? 0) * paid)} of {formatMoney(group.seasonFeeCents!)} · {formatMoney(share!)} each
          </Text>
        </>
      ) : (
        <Text style={{ color: t.muted }}>{formatMoney(group.seasonFeeCents!)} season. Mark who's in on the Members screen.</Text>
      )}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label="Members" variant="secondary" icon="people" onPress={() => router.push({ pathname: "/members/[slug]", params: { slug: group.slug } })} />
        {members > paid && (
          <Button label="Remind unpaid" variant="secondary" icon="cash" loading={busy} onPress={async () => {
            setBusy(true);
            try {
              setResult(await api.remindSeason(group.slug));
            } finally {
              setBusy(false);
            }
          }} />
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={async () => {
          if (await confirm("Start a new season?", "Members stay, and everyone goes back to unpaid for the new season fee. You can change the fee and dates in Edit group.", "Start new season")) {
            await api.newSeason(group.slug);
            onChanged();
          }
        }}
        style={{ alignSelf: "center", paddingVertical: 4 }}
      >
        <Text style={{ color: t.muted, fontSize: 13, fontWeight: "600" }}>Season over? Start a new one</Text>
      </Pressable>
      {result && (
        <Pop style={{ gap: 6 }}>
          <Text style={{ color: t.text }}>{result.notified ? `Reminded ${result.notified} of ${result.unpaid} with reminders on.` : "Nobody unpaid has reminders on."} Post this too:</Text>
          <Pressable onPress={() => onShare(result.message)} style={{ backgroundColor: t.bg, borderRadius: 10, padding: 10 }}>
            <Text style={{ color: t.muted }}>{result.message}</Text>
            <Text style={{ color: t.accent, fontWeight: "700", marginTop: 4 }}>Tap to share</Text>
          </Pressable>
        </Pop>
      )}
    </View>
  );
}
