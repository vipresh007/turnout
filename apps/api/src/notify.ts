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

export function emailHtml(m: { title: string; body: string; url: string }, unsubscribeUrl?: string, buttonLabel = "Open Turnout"): string {
  return `<!doctype html><html><body style="margin:0;background:#f7f7f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table width="100%" style="max-width:480px;background:#fff;border-radius:16px;padding:28px" cellpadding="0" cellspacing="0">
      <tr><td style="font-size:22px;font-weight:900;color:#111418;letter-spacing:-0.5px">turnout<span style="color:#16a34a">.</span></td></tr>
      <tr><td style="padding-top:20px;font-size:20px;font-weight:800;color:#111418">${escape(m.title)}</td></tr>
      <tr><td style="padding-top:8px;font-size:16px;line-height:24px;color:#4b5563">${escape(m.body)}</td></tr>
      <tr><td style="padding-top:24px"><a href="${escape(m.url)}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:12px">${escape(buttonLabel)}</a></td></tr>
      ${unsubscribeUrl ? `<tr><td style="padding-top:28px;font-size:12px;color:#9ca3af">You asked for reminders for this group. <a href="${escape(unsubscribeUrl)}" style="color:#9ca3af">Stop these emails</a>.</td></tr>` : ""}
    </table>
  </td></tr></table></body></html>`;
}
