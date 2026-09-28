import { EmailClient } from "@azure/communication-email";
import webpush from "web-push";
import type { Db } from "./db/client.ts";

// Browser push (VAPID). The subject is a contact URL push services can reach us at.
const vapid = process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  ? { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY }
  : null;
if (vapid) webpush.setVapidDetails(process.env.WEB_URL ?? "https://turnout.dataeaver.ca", vapid.publicKey, vapid.privateKey);

// Email through Azure Communication Services.
const email = process.env.ACS_CONNECTION_STRING && process.env.EMAIL_SENDER
  ? { client: new EmailClient(process.env.ACS_CONNECTION_STRING), sender: process.env.EMAIL_SENDER }
  : null;

export const webUrl = () => process.env.WEB_URL ?? "http://localhost:8081";
export const pushPublicKey = () => vapid?.publicKey ?? null;
export const emailEnabled = () => email !== null;

export interface Message {
  title: string;
  body: string;
  /** Opened when the notification or email button is tapped. */
  url: string;
  /** Offer "I'm in" / "I'm out" buttons on the notification. */
  rsvpActions?: boolean;
}

/** Sends to every channel the member has turned on. Returns how many deliveries were attempted. */
export async function notifyMember(db: Db, memberId: string, message: Message): Promise<number> {
  const [subs, [member]] = await Promise.all([
    db.query<{ endpoint: string; p256dh: string; auth: string }>(`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE member_id = $1`, [memberId]),
    db.query<{ email: string | null; confirmed: boolean; token: string | null }>(
      `SELECT email, email_confirmed_at IS NOT NULL AS confirmed, email_token AS token FROM members WHERE id = $1`,
      [memberId],
    ),
  ]);
  let sent = 0;

  if (vapid) {
    const payload = JSON.stringify(message);
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600, urgency: "normal" });
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410: the browser dropped the subscription (permission revoked, app cleared). Forget it.
        if (status === 404 || status === 410) {
          await db.query(`DELETE FROM push_subscriptions WHERE member_id = $1 AND endpoint = $2`, [memberId, s.endpoint]);
        } else {
          console.warn("push failed", status, (err as Error).message);
        }
      }
    }
  }

  if (email && member?.email && member.confirmed && member.token) {
    const unsubscribe = `${webUrl()}/email?unsubscribe=${member.token}`;
    await sendEmail(member.email, message.title, emailHtml(message, unsubscribe), `${message.body}\n\n${message.url}\n\nStop these emails: ${unsubscribe}`, unsubscribe)
      .then(() => sent++)
      .catch((err) => console.warn("email failed", (err as Error).message));
  }
  return sent;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  plainText: string,
  unsubscribeUrl?: string,
  { wait = true }: { wait?: boolean } = {},
): Promise<void> {
  if (!email) return;
  const poller = await email.client.beginSend({
    senderAddress: email.sender,
    recipients: { to: [{ address: to }] },
    content: { subject, html, plainText },
    headers: unsubscribeUrl ? { "List-Unsubscribe": `<${unsubscribeUrl}>` } : undefined,
  });
  // beginSend returns once the service has accepted the message; waiting confirms delivery started.
  if (wait) await poller.pollUntilDone();
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The one look for every Turnout email: dark card, green accents, the same logo and footer. */
export const EMAIL = { bg: "#0E1113", card: "#171B1F", border: "#262B31", text: "#F3F4F6", muted: "#9CA3AF", faint: "#6B7280", accent: "#22C55E", button: "#16A34A" };

/** Wraps email content (table rows) in the shared layout. `footer` is extra small print inside the card. */
export function emailShell(rows: string, footer = ""): string {
  const c = EMAIL;
  return `<!doctype html><html><head><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
  <body style="margin:0;background:${c.bg};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${c.bg}"><tr><td align="center" style="padding:40px 16px">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${c.card};border:1px solid ${c.border};border-radius:24px">
      <tr><td style="padding:32px 32px 0;font-size:26px;font-weight:900;color:${c.text};letter-spacing:-1px">turnout<span style="color:${c.accent}">.</span></td></tr>
      ${rows}
      ${footer ? `<tr><td style="padding:0 32px 32px;font-size:12px;line-height:18px;color:${c.faint}">${footer}</td></tr>` : `<tr><td style="padding-bottom:32px"></td></tr>`}
    </table>
    <p style="font-size:12px;color:${c.faint};margin:16px 0 0">Turnout · stop asking who's playing</p>
  </td></tr></table></body></html>`;
}

export function emailHtml(m: { title: string; body: string; url: string }, unsubscribeUrl?: string, buttonLabel = "Open Turnout"): string {
  const c = EMAIL;
  return emailShell(
    `<tr><td style="padding:24px 32px 0;font-size:22px;font-weight:800;color:${c.text}">${escape(m.title)}</td></tr>
      <tr><td style="padding:8px 32px 0;font-size:16px;line-height:24px;color:${c.muted}">${escape(m.body)}</td></tr>
      <tr><td style="padding:24px 32px 24px"><a href="${escape(m.url)}" style="display:inline-block;background:${c.button};color:#FFFFFF;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:12px">${escape(buttonLabel)}</a></td></tr>`,
    unsubscribeUrl ? `Sent by Turnout because this address was entered for reminders on the group's page. <a href="${escape(unsubscribeUrl)}" style="color:${c.muted};font-weight:700">Stop these emails</a>` : "",
  );
}
