import type { FastifyInstance } from "fastify";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { HttpError } from "./auth.ts";
import { sendEmail } from "./notify.ts";

// Entra calls this with a sign-in code so we can send it in our own email (custom email OTP provider).
// ENTRA_EVENTS_APP_ID is the "Turnout auth events" app registration; tokens are issued to it by the
// tenant for Entra's custom-extension service, whose app ID is fixed by Microsoft:
const ENTRA_EXTENSIONS_SERVICE_APP_ID = "99045fe1-7639-4a75-9d4a-577b6ca3810f";

let verifier: Promise<(token: string) => Promise<void>> | undefined;

function eventsVerifier() {
  const authority = process.env.ENTRA_AUTHORITY;
  const audience = process.env.ENTRA_EVENTS_APP_ID;
  if (!authority || !audience) return undefined;
  verifier ??= (async () => {
    const res = await fetch(`${authority.replace(/\/$/, "")}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Entra discovery failed: ${res.status}`);
    const { issuer, jwks_uri } = (await res.json()) as { issuer: string; jwks_uri: string };
    const jwks = createRemoteJWKSet(new URL(jwks_uri), { timeoutDuration: 3000, cooldownDuration: 30_000 });
    // Load the signing keys now, so the first sign-in doesn't pay for the fetch.
    await jwks.reload().catch(() => {});
    return async (token: string) => {
      const { payload } = await jwtVerify(token, jwks, { issuer, audience });
      if ((payload.azp ?? payload.appid) !== ENTRA_EXTENSIONS_SERVICE_APP_ID) throw new Error("unexpected caller");
    };
  })().catch((err) => {
    verifier = undefined;
    throw err;
  });
  return verifier;
}

const continueResponse = {
  data: {
    "@odata.type": "microsoft.graph.OnOtpSendResponseData",
    actions: [{ "@odata.type": "microsoft.graph.OtpSend.continueWithDefaultBehavior" }],
  },
};

interface OtpSendEvent {
  data?: { otpContext?: { identifier?: string; onetimecode?: string } };
}

export function registerAuthEvents(app: FastifyInstance) {
  // Warm up at startup: Entra gives us about 2 seconds per call, too short for first-time fetches.
  eventsVerifier()?.catch((err) => app.log.warn({ err }, "auth events verifier warm-up failed"));

  app.post("/auth-events/otp-send", async (req) => {
    const started = Date.now();
    const verify = eventsVerifier();
    const auth = req.headers.authorization;
    if (!verify || !auth?.startsWith("Bearer ")) throw new HttpError(401, "Unauthorized");
    try {
      await (await verify)(auth.slice(7));
    } catch (err) {
      req.log.warn({ err }, "rejected auth event token");
      throw new HttpError(401, "Unauthorized");
    }

    const verifiedMs = Date.now() - started;

    const otp = (req.body as OtpSendEvent).data?.otpContext;
    if (!otp?.identifier || !otp.onetimecode) throw new HttpError(400, "Missing code");
    // Answer Entra immediately and send in the background: the email doesn't have to be accepted
    // by the mail service before we reply, and Entra only waits about 2 seconds.
    sendEmail(otp.identifier, `${otp.onetimecode} is your Turnout code`, otpEmailHtml(otp.onetimecode), otpEmailText(otp.onetimecode), undefined, { wait: false })
      .then(() => req.log.info({ ms: Date.now() - started }, "sign-in code email accepted"))
      .catch((err) => req.log.error({ err }, "sign-in code email failed"));
    req.log.info({ verifiedMs }, "sign-in code event handled");
    return continueResponse;
  });
}

export function otpEmailText(code: string): string {
  return `Your Turnout sign-in code is ${code}\n\nEnter it on the sign-in page to continue. It expires in 30 minutes.\n\nDidn't try to sign in? You can ignore this email.`;
}

export function otpEmailHtml(code: string): string {
  const digits = code.replace(/[^0-9A-Za-z]/g, "");
  return `<!doctype html><html><body style="margin:0;background:#0E1113;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0E1113"><tr><td align="center" style="padding:40px 16px">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#171B1F;border:1px solid #262B31;border-radius:24px">
      <tr><td style="padding:32px 32px 0;font-size:26px;font-weight:900;color:#F3F4F6;letter-spacing:-1px">turnout<span style="color:#22C55E">.</span></td></tr>
      <tr><td style="padding:24px 32px 0;font-size:22px;font-weight:800;color:#F3F4F6">Your sign-in code</td></tr>
      <tr><td style="padding:8px 32px 0;font-size:15px;line-height:22px;color:#9CA3AF">Enter this on the sign-in page to continue organizing your games.</td></tr>
      <tr><td style="padding:24px 32px 0">
        <div style="background:#0E1113;border:1px solid #262B31;border-radius:16px;padding:20px;text-align:center;font-size:36px;font-weight:900;letter-spacing:8px;color:#22C55E;font-family:SFMono-Regular,Menlo,Consolas,monospace">${digits}</div>
      </td></tr>
      <tr><td style="padding:16px 32px 0;font-size:13px;color:#9CA3AF">It expires in 30 minutes.</td></tr>
      <tr><td style="padding:24px 32px 32px;font-size:12px;line-height:18px;color:#6B7280;border-top:0">Didn't try to sign in? You can ignore this email. Nobody can get in without this code.</td></tr>
    </table>
    <p style="font-size:12px;color:#6B7280;margin:16px 0 0">Turnout · who's in this week?</p>
  </td></tr></table></body></html>`;
}
