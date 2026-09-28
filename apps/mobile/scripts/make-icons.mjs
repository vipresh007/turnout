// Draws every app icon from the Turnout mark (white "t" and a dark green dot on green).
// Run from the repo root after changing the mark: node apps/mobile/scripts/make-icons.mjs
import { writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const GREEN = "#16A34A";
const DARK = "#0B3D1E";
const out = (p) => new URL(`../${p}`, import.meta.url);

/** The mark on a 240-unit canvas. `scale` shrinks the glyph toward the centre (for safe zones). */
function glyph({ fill = "#FFFFFF", dot = DARK, scale = 1 } = {}) {
  const t = `translate(120 120) scale(${scale}) translate(-120 -120)`;
  return `<g transform="${t}"><text x="120" y="162" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial" font-weight="700" font-size="150" letter-spacing="-6" fill="${fill}">t<tspan fill="${dot}">.</tspan></text></g>`;
}
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">${body}</svg>`;
const tile = (rx) => `<rect width="240" height="240" rx="${rx}" fill="${GREEN}"/>`;

function png(path, body, size) {
  const data = new Resvg(svg(body), { fitTo: { mode: "width", value: size }, font: { loadSystemFonts: true } }).render().asPng();
  writeFileSync(out(path), data);
  console.log(`${path} (${size}px)`);
}

png("assets/icon.png", tile(0) + glyph(), 1024); // iOS rounds the corners itself
png("assets/favicon.png", tile(52) + glyph(), 64); // browser tab
png("assets/splash-icon.png", tile(56) + glyph(), 1024);
png("assets/android-icon-foreground.png", glyph({ scale: 0.62 }), 512); // inside Android's safe zone
png("assets/android-icon-background.png", tile(0), 512);
png("assets/android-icon-monochrome.png", glyph({ dot: "#FFFFFF", scale: 0.62 }), 432);
png("public/icon.png", tile(0) + glyph(), 512); // home screen, install, notifications
png("public/icon-maskable.png", tile(0) + glyph({ scale: 0.8 }), 512);
png("public/badge.png", glyph({ dot: "#FFFFFF" }), 96); // Android status-bar badge: white on transparent
