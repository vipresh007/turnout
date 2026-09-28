import type { FastifyInstance } from "fastify";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { HttpError } from "./auth.ts";
import { EMAIL, emailShell, sendEmail } from "./notify.ts";

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

/** Names of every field in the payload (never the values), to see its real shape in the logs. */
function shape(v: unknown, depth = 0): unknown {
  if (!v || typeof v !== "object" || depth > 3) return typeof v;
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, shape(x, depth + 1)]));
}

/** Finds the email and code; the payload's field names vary from the documented ones. */
export function readOtp(body: unknown): { email?: string; code?: string } {
  const data = (body as { data?: Record<string, unknown> })?.data ?? {};
  const ctx = (data.otpContext ?? data.oneTimeCodeContext ?? data.otp ?? {}) as Record<string, unknown>;
  const pick = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((x) => typeof x === "string") as string | undefined;
  return {
    email: pick(ctx, ["identifier", "email", "emailAddress", "userPrincipalName"]),
    code: pick(ctx, ["onetimecode", "oneTimeCode", "otp", "code", "passcode"]),
  };
}

export function registerAuthEvents(app: FastifyInstance) {
  // Warm up at startup: Entra gives us about 2 seconds per call, too short for first-time fetches.
  eventsVerifier()?.catch((err) => app.log.warn({ err }, "auth events verifier warm-up failed"));

  // Diagnostics: this call has stalled without logging before, so record each stage.
  app.addHook("onRequest", async (req) => {
    if (req.url.startsWith("/auth-events/")) {
      const h = req.headers;
      req.log.info({ contentType: h["content-type"], contentLength: h["content-length"], encoding: h["content-encoding"], transfer: h["transfer-encoding"], expect: h.expect }, "auth event: headers received");
    }
  });

  app.post("/auth-events/otp-send", async (req, reply) => {
    const started = Date.now();
    req.log.info("auth event: body parsed");
    const verify = eventsVerifier();
    const auth = req.headers.authorization;
    if (!verify || !auth?.startsWith("Bearer ")) throw new HttpError(401, "Unauthorized");
    try {
      // Never keep Entra waiting: past 1.5s it gives up anyway, so fail fast and let it fall back.
      await Promise.race([
        (async () => (await verify)(auth.slice(7)))(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("token check timed out")), 1500)),
      ]);
    } catch (err) {
      req.log.warn({ err: (err as Error).message, ms: Date.now() - started }, "rejected auth event token");
      return reply.status((err as Error).message.includes("timed out") ? 503 : 401).send({ error: "Unauthorized" });
    }

    const verifiedMs = Date.now() - started;

    const { email, code } = readOtp(req.body);
    if (!email || !code) {
      req.log.warn({ payload: shape(req.body) }, "auth event: code or email not found in payload");
      throw new HttpError(400, "Missing code");
    }
    const otp = { identifier: email, onetimecode: code };
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
  const c = EMAIL;
  return emailShell(
    `<tr><td style="padding:24px 32px 0;font-size:22px;font-weight:800;color:${c.text}">Your sign-in code</td></tr>
      <tr><td style="padding:8px 32px 0;font-size:15px;line-height:22px;color:${c.muted}">Enter this on the sign-in page to continue organizing your games.</td></tr>
      <tr><td style="padding:24px 32px 0">
        <div style="background:${c.bg};border:1px solid ${c.border};border-radius:16px;padding:20px;text-align:center;font-size:36px;font-weight:900;letter-spacing:8px;color:${c.accent};font-family:SFMono-Regular,Menlo,Consolas,monospace">${digits}</div>
      </td></tr>
      <tr><td style="padding:16px 32px 24px;font-size:13px;color:${c.muted}">It expires in 30 minutes.</td></tr>`,
    "Didn't try to sign in? You can ignore this email. Nobody can get in without this code.",
  );
}
