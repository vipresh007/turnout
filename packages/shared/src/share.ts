import { formatMoney } from "./cost.ts";

const emoji: [RegExp, string][] = [
  [/soccer|football|futsal/i, "⚽"], [/basketball|hoops/i, "🏀"], [/volleyball/i, "🏐"], [/hockey|shinny/i, "🏒"],
  [/pickleball|ping ?pong|table tennis/i, "🏓"], [/tennis/i, "🎾"], [/badminton/i, "🏸"], [/run|running|jog/i, "🏃"],
  [/poker|cards/i, "🃏"], [/yoga/i, "🧘"], [/ultimate|frisbee/i, "🥏"], [/cricket/i, "🏏"], [/baseball|softball/i, "⚾"],
  [/board ?game|games night/i, "🎲"], [/volunteer/i, "🤝"], [/climb/i, "🧗"], [/swim/i, "🏊"], [/golf/i, "⛳"],
];

/** An emoji for the group's activity (from its activity or name), or a generic one. */
export function activityEmoji(activity: string | null, name = ""): string {
  const text = `${activity ?? ""} ${name}`;
  return emoji.find(([re]) => re.test(text))?.[1] ?? "📣";
}

export interface ShareInput {
  name: string;
  activity: string | null;
  location: string | null;
  timezone: string;
  cap: number | null;
  /** Without a cap: the number of players the group aims for. */
  targetPlayers?: number | null;
  startsAt: string;
  confirmed: number;
  cancelled?: boolean;
  link: string;
  feeCents?: number | null;
  feeSplit?: boolean;
  /** Season groups: feeCents is the drop-in price for subs. */
  dropIn?: boolean;
}

/** "Wed, Sep 30 · 8:00 PM" in the group's timezone. */
export function shortWhen(startsAt: string, timezone: string): string {
  const d = new Date(startsAt);
  const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: timezone });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone });
  return `${day} · ${time}`;
}

/** The message people paste into the group chat: what, when, where, how full, and the link. */
export function groupShareMessage(g: ShareInput): string {
  const lines = [`${activityEmoji(g.activity, g.name)} ${g.name}`, `📅 ${shortWhen(g.startsAt, g.timezone)}`];
  if (g.location) lines.push(`📍 ${g.location}`);
  if (g.cancelled) {
    lines.push("❌ Cancelled this week");
  } else if (g.cap) {
    const need = g.cap - g.confirmed;
    lines.push(need > 0 ? `👥 ${g.confirmed}/${g.cap} in · need ${need} more!` : `👥 ${g.cap}/${g.cap} in · full, join the waitlist`);
  } else if (g.targetPlayers && g.confirmed < g.targetPlayers) {
    lines.push(`👥 ${g.confirmed} in · need ${g.targetPlayers - g.confirmed} more!`);
  } else {
    lines.push(`👥 ${g.confirmed} in so far`);
  }
  // Only a fixed price goes in the group chat. A split depends on turnout and would read as the bill.
  if (!g.cancelled && g.feeCents && !g.feeSplit) lines.push(g.dropIn ? `💵 Subs: ${formatMoney(g.feeCents)} drop-in` : `💵 ${formatMoney(g.feeCents)} each`);
  lines.push("", `Tap to join: ${g.link}`);
  return lines.join("\n");
}

/** Deep links that open a messaging app with the text ready to send. */
// api.whatsapp.com rather than wa.me: wa.me's redirect to the desktop app turns emoji into "?" diamonds.
export const whatsappUrl = (text: string) => `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
export const smsUrl = (text: string) => `sms:?&body=${encodeURIComponent(text)}`;
