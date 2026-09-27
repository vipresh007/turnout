import { Resvg } from "@resvg/resvg-js";
import { shortWhen, type GroupPage } from "@turnout/shared";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** The link-preview card (1200×630) chat apps show when a group link is shared. */
export function groupCardSvg(page: Pick<GroupPage, "group" | "session" | "roster">): string {
  const { group, session, roster } = page;
  const count = roster.confirmed.length;
  const cap = group.cap;
  const status = session.cancelled
    ? { text: "Cancelled this week", color: "#F87171" }
    : cap && count >= cap
      ? { text: roster.waitlist.length ? `Full · ${roster.waitlist.length} on the waitlist` : "Full · join the waitlist", color: "#22C55E" }
      : cap
        ? { text: `Need ${cap - count} more`, color: "#FBBF24" }
        : { text: "Tap to say you're in", color: "#22C55E" };
  const fill = cap ? Math.min(1, count / cap) : 0;
  const where = [shortWhen(session.startsAt, group.timezone), group.location].filter(Boolean).join("  ·  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="g1" cx="0.1" cy="0" r="0.7"><stop offset="0" stop-color="#22C55E" stop-opacity="0.35"/><stop offset="1" stop-color="#22C55E" stop-opacity="0"/></radialGradient>
    <radialGradient id="g2" cx="1" cy="0.6" r="0.6"><stop offset="0" stop-color="#3B82F6" stop-opacity="0.22"/><stop offset="1" stop-color="#3B82F6" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#0E1113"/><rect width="1200" height="630" fill="url(#g1)"/><rect width="1200" height="630" fill="url(#g2)"/>
  <text x="72" y="104" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="40" fill="#F3F4F6" letter-spacing="-1.5">turnout<tspan fill="#22C55E">.</tspan></text>
  <text x="72" y="222" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="76" fill="#F3F4F6" letter-spacing="-2.5">${esc(clip(group.name, 26))}</text>
  <text x="72" y="282" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-weight="500" font-size="34" fill="#9CA3AF">${esc(clip(where, 52))}</text>
  <text x="72" y="450" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="150" fill="#F3F4F6" letter-spacing="-6">${count}<tspan font-size="64" font-weight="700" fill="#9CA3AF" letter-spacing="-1">${cap ? ` / ${cap} in` : " in"}</tspan></text>
  ${cap ? `<rect x="72" y="486" width="1056" height="16" rx="8" fill="#262B31"/><rect x="72" y="486" width="${Math.max(16, Math.round(1056 * fill))}" height="16" rx="8" fill="#22C55E"/>` : ""}
  <rect x="72" y="532" width="${Math.round(status.text.length * 19 + 56)}" height="60" rx="30" fill="#171B1F" stroke="${status.color}" stroke-width="2"/>
  <text x="100" y="572" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-weight="700" font-size="30" fill="${status.color}">${esc(status.text)}</text>
</svg>`;
}

export function renderPng(svg: string): Buffer {
  return new Resvg(svg, { fitTo: { mode: "width", value: 1200 }, font: { loadSystemFonts: true, defaultFontFamily: "Inter" } }).render().asPng();
}
