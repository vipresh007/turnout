#!/usr/bin/env node
// App Store Connect without the website: create a version, attach a processed build, set What's New, submit for review.
//   node scripts/asc.mjs status                      builds and versions for the app
//   node scripts/asc.mjs release <version> <build> "<what's new>"   create/update the version, attach the build, submit
//   node scripts/asc.mjs promo <version> "<promotional text>"      set the promotional text on every locale (no review needed)
// Needs ASC_KEY_ID / ASC_ISSUER_ID in infra/.env.infra and infra/AuthKey_<ID>.p8 (role App Manager). App id from eas.json.
import { api, appId, rel, versions } from "./asc-lib.mjs";

async function builds() {
  const r = await api("GET", `/builds?filter[app]=${appId}&sort=-uploadedDate&limit=10&fields[builds]=version,processingState,uploadedDate,expired,preReleaseVersion&include=preReleaseVersion&fields[preReleaseVersions]=version`);
  const trains = Object.fromEntries((r.included ?? []).map((p) => [p.id, p.attributes.version]));
  return r.data.map((b) => ({ id: b.id, build: b.attributes.version, state: b.attributes.processingState, version: trains[b.relationships?.preReleaseVersion?.data?.id] ?? "?" }));
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
} else if (cmd === "promo") {
  const [, v, text] = process.argv.slice(2);
  if (!v || !text) throw new Error("usage: promo <version> \"<text>\"");
  if (text.length > 170) throw new Error(`Promotional text is ${text.length} characters; the limit is 170`);
  const version = (await versions()).find((x) => x.version === v);
  if (!version) throw new Error(`No version ${v}`);
  const locs = await api("GET", `/appStoreVersions/${version.id}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale,promotionalText`);
  for (const l of locs.data) {
    await api("PATCH", `/appStoreVersionLocalizations/${l.id}`, { data: { type: "appStoreVersionLocalizations", id: l.id, attributes: { promotionalText: text } } });
    console.log("Promotional text set for", l.attributes.locale);
  }
} else {
  console.log("usage: asc.mjs status | release <version> <build> \"<what's new>\" | promo <version> \"<text>\"");
}
