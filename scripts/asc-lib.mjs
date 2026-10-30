// Shared App Store Connect API client for the release scripts: a signed JWT from the key in infra/.env.infra.
import { createPrivateKey, createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(readFileSync(join(root, "infra/.env.infra"), "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => l.split(/=(.*)/s).slice(0, 2).map((s) => s.trim().replace(/^"|"$/g, ""))));
const keyId = env.ASC_KEY_ID, issuer = env.ASC_ISSUER_ID;
export const appId = JSON.parse(readFileSync(join(root, "apps/mobile/eas.json"), "utf8")).submit.production.ios.ascAppId;
const key = createPrivateKey(readFileSync(join(root, `infra/AuthKey_${keyId}.p8`)));

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
export function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "ES256", kid: keyId, typ: "JWT" })}.${b64({ iss: issuer, iat: now, exp: now + 15 * 60, aud: "appstoreconnect-v1" })}`;
  const der = createSign("SHA256").update(unsigned).sign({ key, dsaEncoding: "ieee-p1363" });
  return `${unsigned}.${der.toString("base64url")}`;
}

export async function api(method, path, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com/v1${path}`, {
    method, headers: { authorization: `Bearer ${jwt()}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json.errors ?? json).slice(0, 600)}`);
  return json;
}
export const rel = (type, id) => ({ data: { type, id } });

export async function versions() {
  const r = await api("GET", `/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=5&fields[appStoreVersions]=versionString,appStoreState,appVersionState,releaseType`);
  return r.data.map((v) => ({ id: v.id, version: v.attributes.versionString, state: v.attributes.appVersionState ?? v.attributes.appStoreState }));
}
