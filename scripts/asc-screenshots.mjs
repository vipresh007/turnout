#!/usr/bin/env node
// Replace a version's iPhone screenshots on App Store Connect with docs/app-store-screenshots/<size>/*.png.
//   node scripts/asc-screenshots.mjs <version> [locale=en-US]
// The version must be editable (Prepare for Submission, or pulled from review). Other locales without screenshots
// fall back to this one on the store.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { api, rel, root, versions } from "./asc-lib.mjs";

const [versionString, locale = "en-US"] = process.argv.slice(2);
if (!versionString) throw new Error("usage: asc-screenshots.mjs <version> [locale]");

// App Store Connect slot → folder. 6.7" covers the 6.9" phones; 6.1" covers 6.3".
const SLOTS = { APP_IPHONE_67: "iphone-6.9", APP_IPHONE_61: "iphone-6.3" };

const version = (await versions()).find((v) => v.version === versionString);
if (!version) throw new Error(`No version ${versionString}`);
const locs = await api("GET", `/appStoreVersions/${version.id}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale`);
const loc = locs.data.find((l) => l.attributes.locale === locale);
if (!loc) throw new Error(`No ${locale} localization on ${versionString}`);

const sets = await api("GET", `/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?fields[appScreenshotSets]=screenshotDisplayType&limit=50`);
for (const [displayType, folder] of Object.entries(SLOTS)) {
  let set = sets.data.find((s) => s.attributes.screenshotDisplayType === displayType);
  if (!set) {
    set = (await api("POST", "/appScreenshotSets", { data: { type: "appScreenshotSets", attributes: { screenshotDisplayType: displayType }, relationships: { appStoreVersionLocalization: rel("appStoreVersionLocalizations", loc.id) } } })).data;
  }
  const existing = await api("GET", `/appScreenshotSets/${set.id}/appScreenshots?fields[appScreenshots]=fileName&limit=50`);
  for (const shot of existing.data) await api("DELETE", `/appScreenshots/${shot.id}`);
  console.log(`${displayType}: removed ${existing.data.length} old`);

  const dir = join(root, "docs/app-store-screenshots", folder);
  const files = readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
  const ids = [];
  for (const fileName of files) {
    const path = join(dir, fileName);
    const bytes = readFileSync(path);
    const reserved = (await api("POST", "/appScreenshots", { data: { type: "appScreenshots", attributes: { fileName, fileSize: statSync(path).size }, relationships: { appScreenshotSet: rel("appScreenshotSets", set.id) } } })).data;
    for (const op of reserved.attributes.uploadOperations) {
      const res = await fetch(op.url, { method: op.method, headers: Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value])), body: bytes.subarray(op.offset, op.offset + op.length) });
      if (!res.ok) throw new Error(`upload ${fileName} part failed: ${res.status}`);
    }
    await api("PATCH", `/appScreenshots/${reserved.id}`, { data: { type: "appScreenshots", id: reserved.id, attributes: { uploaded: true, sourceFileChecksum: createHash("md5").update(bytes).digest("hex") } } });
    ids.push(reserved.id);
    console.log(`  uploaded ${fileName}`);
  }
  await api("PATCH", `/appScreenshotSets/${set.id}/relationships/appScreenshots`, { data: ids.map((id) => ({ type: "appScreenshots", id })) });
}
console.log(`Screenshots replaced on ${versionString} (${locale}).`);
