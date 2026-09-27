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

/** "$10" or "$7.50". */
export function formatMoney(cents: number): string {
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
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
  const t = text.trim().replace(/^\$/, "").replace(",", ".");
  if (!t) return null;
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(t)) return undefined;
  return Math.round(Number(t) * 100);
}
