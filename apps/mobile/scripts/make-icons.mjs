// Draws every app icon from the Turnout mark (white "t" and a dark green dot on green).
// Run from the repo root after changing the mark: node apps/mobile/scripts/make-icons.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const GREEN = "#16A34A";
const DARK = "#0B3D1E";
const out = (p) => new URL(`../${p}`, import.meta.url);

/**
 * The mark on a 240-unit canvas, drawn as shapes (not text) so it doesn't depend on installed fonts:
 * a "t" and a round dot sharing one baseline, the pair centred on the tile.
 * `scale` shrinks it toward the centre (for safe zones).
 */
function glyph({ fill = "#FFFFFF", dot = DARK, scale = 1 } = {}) {
  // Local box: x -18..82, y 0..104 (centre 32, 52).
  const t = "M0 0H30V28H48V48H30V76Q30 83 37 83H48V104H33Q0 104 0 72V48H-18V28H0Z";
  const pos = `translate(120 120) scale(${scale}) translate(-32 -52)`;
  return `<g transform="${pos}"><path d="${t}" fill="${fill}"/><circle cx="69" cy="91" r="13" fill="${dot}"/></g>`;
}
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">${body}</svg>`;
const tile = (rx) => `<rect width="240" height="240" rx="${rx}" fill="${GREEN}"/>`;

function png(path, body, size) {
  const data = new Resvg(svg(body), { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(out(path), data);
  console.log(`${path} (${size}px)`);
}

png("assets/icon.png", tile(0) + glyph(), 1024); // iOS rounds the corners itself
// The App Store icon must have no alpha channel at all: round-trip through JPEG (macOS sips) to drop it.
execFileSync("sips", ["-s", "format", "jpeg", out("assets/icon.png").pathname, "--out", "/tmp/turnout-icon.jpg"], { stdio: "ignore" });
execFileSync("sips", ["-s", "format", "png", "/tmp/turnout-icon.jpg", "--out", out("assets/icon.png").pathname], { stdio: "ignore" });
png("assets/favicon.png", tile(52) + glyph(), 64); // browser tab
png("assets/splash-icon.png", tile(56) + glyph(), 1024);
png("assets/android-icon-foreground.png", glyph({ scale: 0.62 }), 512); // inside Android's safe zone
png("assets/android-icon-background.png", tile(0), 512);
png("assets/android-icon-monochrome.png", glyph({ dot: "#FFFFFF", scale: 0.62 }), 432);
png("public/icon.png", tile(0) + glyph(), 512); // home screen, install, notifications
png("public/icon-maskable.png", tile(0) + glyph({ scale: 0.8 }), 512);
png("public/badge.png", glyph({ dot: "#FFFFFF" }), 96); // Android status-bar badge: white on transparent
