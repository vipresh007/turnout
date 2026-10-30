#!/usr/bin/env node
// App Store Connect without the website: create a version, attach a processed build, set What's New, submit for review.
//   node scripts/asc.mjs status                      builds and versions for the app
//   node scripts/asc.mjs release <version> <build> "<what's new>"   create/update the version, attach the build, submit
// Needs ASC_KEY_ID / ASC_ISSUER_ID in infra/.env.infra and infra/AuthKey_<ID>.p8 (role App Manager). App id from eas.json.
import { createPrivateKey, createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(readFileSync(join(root, "infra/.env.infra"), "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => l.split(/=(.*)/s).slice(0, 2).map((s) => s.trim().replace(/^"|"$/g, ""))));
const keyId = env.ASC_KEY_ID, issuer = env.ASC_ISSUER_ID;
const appId = JSON.parse(readFileSync(join(root, "apps/mobile/eas.json"), "utf8")).submit.production.ios.ascAppId;
const key = createPrivateKey(readFileSync(join(root, `infra/AuthKey_${keyId}.p8`)));

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "ES256", kid: keyId, typ: "JWT" })}.${b64({ iss: issuer, iat: now, exp: now + 15 * 60, aud: "appstoreconnect-v1" })}`;
  const der = createSign("SHA256").update(unsigned).sign({ key, dsaEncoding: "ieee-p1363" });
  return `${unsigned}.${der.toString("base64url")}`;
}
async function api(method, path, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com/v1${path}`, {
    method, headers: { authorization: `Bearer ${jwt()}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json.errors ?? json).slice(0, 600)}`);
  return json;
}
const rel = (type, id) => ({ data: { type, id } });

async function builds() {
  const r = await api("GET", `/builds?filter[app]=${appId}&sort=-uploadedDate&limit=10&fields[builds]=version,processingState,uploadedDate,expired,preReleaseVersion&include=preReleaseVersion&fields[preReleaseVersions]=version`);
  const trains = Object.fromEntries((r.included ?? []).map((p) => [p.id, p.attributes.version]));
  return r.data.map((b) => ({ id: b.id, build: b.attributes.version, state: b.attributes.processingState, version: trains[b.relationships?.preReleaseVersion?.data?.id] ?? "?" }));
}
async function versions() {
  const r = await api("GET", `/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=5&fields[appStoreVersions]=versionString,appStoreState,appVersionState,releaseType`);
  return r.data.map((v) => ({ id: v.id, version: v.attributes.versionString, state: v.attributes.appVersionState ?? v.attributes.appStoreState }));
}

const [cmd, versionString, buildNumber, whatsNew] = process.argv.slice(2);
if (cmd === "status") {
  console.log("Builds:", await builds());
  console.log("Versions:", await versions());
} else if (cmd === "release") {
  if (!versionString || !buildNumber || !whatsNew) throw new Error("usage: release <version> <build> \"<what's new>\"");
  const build = (await builds()).find((b) => b.version === versionString && b.build === buildNumber);
  if (!build) throw new Error(`No build ${buildNumber} for ${versionString} found`);
  if (build.state !== "VALID") throw new Error(`Build ${buildNumber} is ${build.state}; wait for processing to finish`);
  let version = (await versions()).find((v) => v.version === versionString);
  if (!version) {
    const r = await api("POST", "/appStoreVersions", { data: { type: "appStoreVersions", attributes: { versionString, platform: "IOS", releaseType: "AFTER_APPROVAL" }, relationships: { app: rel("apps", appId) } } });
    version = { id: r.data.id, version: versionString, state: r.data.attributes.appVersionState };
    console.log("Created version", versionString);
  } else console.log("Version exists:", version);
  // What's New on every localization the version has (App Store Connect copies the rest of the text from the last version).
  const locs = await api("GET", `/appStoreVersions/${version.id}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale,whatsNew`);
  for (const l of locs.data) {
    await api("PATCH", `/appStoreVersionLocalizations/${l.id}`, { data: { type: "appStoreVersionLocalizations", id: l.id, attributes: { whatsNew } } });
    console.log("What's New set for", l.attributes.locale);
  }
  await api("PATCH", `/appStoreVersions/${version.id}/relationships/build`, rel("builds", build.id));
  console.log(`Attached build ${buildNumber}`);
  // Submit: a review submission holding this version.
  const open = await api("GET", `/reviewSubmissions?filter[app]=${appId}&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES&limit=5`);
  let sub = open.data[0];
  if (!sub) {
    sub = (await api("POST", "/reviewSubmissions", { data: { type: "reviewSubmissions", attributes: { platform: "IOS" }, relationships: { app: rel("apps", appId) } } })).data;
    console.log("Created review submission");
  }
  if (sub.attributes.state === "READY_FOR_REVIEW") {
    await api("POST", "/reviewSubmissionItems", { data: { type: "reviewSubmissionItems", relationships: { reviewSubmission: rel("reviewSubmissions", sub.id), appStoreVersion: rel("appStoreVersions", version.id) } } }).catch((e) => { if (!String(e).includes("ENTITY_ERROR")) throw e; console.log("(version already in the submission)"); });
    await api("PATCH", `/reviewSubmissions/${sub.id}`, { data: { type: "reviewSubmissions", id: sub.id, attributes: { submitted: true } } });
    console.log(`Submitted ${versionString} (build ${buildNumber}) for review`);
  } else console.log("Submission already", sub.attributes.state);
} else {
  console.log("usage: asc.mjs status | release <version> <build> \"<what's new>\"");
}
