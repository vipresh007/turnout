/** What a game costs, and what each player owes. Amounts are in cents; the currency is the group's local dollars. */
export interface GroupCost {
  feeCents: number | null;
  /** true: feeCents is the total (court, field) split between everyone in; false: feeCents is per player. */
  feeSplit: boolean;
}

/** Each player's share for this game, or null when there's no cost. A split rounds up to the next cent. */
export function shareCents(cost: GroupCost, confirmed: number): number | null {
  if (!cost.feeCents) return null;
  if (!cost.feeSplit) return cost.feeCents;
  return Math.ceil(cost.feeCents / Math.max(1, confirmed));
}

/** "$10", "$7.50" or "$2,500". */
export function formatMoney(cents: number): string {
  const dollars = cents / 100;
  const digits = Number.isInteger(dollars) ? 0 : 2;
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/** "$10 each" or "$120 split between everyone in · $10 each so far". */
export function describeCost(cost: GroupCost, confirmed: number): string | null {
  const share = shareCents(cost, confirmed);
  if (share === null) return null;
  if (!cost.feeSplit) return `${formatMoney(share)} each`;
  return confirmed > 0
    ? `${formatMoney(cost.feeCents!)} split between everyone in · ${formatMoney(share)} each so far`
    : `${formatMoney(cost.feeCents!)} split between everyone in`;
}

/** Parses "10", "$7.50", "7,5" into cents; empty is null; anything else is undefined (invalid). */
export function parseMoney(text: string): number | null | undefined {
  let t = text.trim().replace(/^\$/, "");
  t = /^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(t) ? t.replace(/,/g, "") : t.replace(",", "."); // "2,500" vs "7,5"
  if (!t) return null;
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(t)) return undefined;
  return Math.round(Number(t) * 100);
}

/** Each season member's share of an upfront season fee, rounded up to the cent. */
export function seasonShareCents(seasonFeeCents: number | null, members: number): number | null {
  if (!seasonFeeCents || members <= 0) return null;
  return Math.ceil(seasonFeeCents / members);
}

/** How many players the group aims for this week: the cap if there is one, otherwise the target. */
export function playerGoal(g: { cap: number | null; targetPlayers?: number | null }): number | null {
  return g.cap ?? g.targetPlayers ?? null;
}

/** Players still needed to reach the goal (0 when there's no goal or it's met). */
export function playersNeeded(g: { cap: number | null; targetPlayers?: number | null }, confirmed: number): number {
  const goal = playerGoal(g);
  return goal ? Math.max(0, goal - confirmed) : 0;
}
