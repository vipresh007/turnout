// App Store screenshots in the house style (as Tally's and Fullcrew's): a mono eyebrow and a display headline over
// the real app in a device frame, on Turnout's midnight ground.
//
//   node scripts/store-screenshots.mjs capture   needs the local API with demo data (see docs/app-store.md) and the
//                                                 dev-auth web (launch.json "web-local", port 8082)
//   node scripts/store-screenshots.mjs compose   frames raw/ into out/<size>/ (no servers needed)
//
// Raw captures are the web app at the device's point size minus the status bar and home indicator, which are drawn
// here, so the result matches a phone. Output: ../../docs/app-store-screenshots/.
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = new URL("../../../docs/app-store-screenshots/", import.meta.url);
const RAW = new URL("raw/", ROOT);
const WEB = "http://localhost:8082";
const API = "http://localhost:4000";
const ORGANIZER = "seed"; // the dev organizer the demo data belongs to (x-dev-user)

const DEVICES = {
  iphone: { w: 440, h: 956, scale: 3, status: 59, home: 21 },
  ipad: { w: 1032, h: 1376, scale: 2, status: 24, home: 20 },
};

// In App Store order. `page` is built once the demo slugs are known; `as` picks who's looking.
const SLIDES = [
  { name: "01-group", as: "player", group: "soccer", eyebrow: "One link", headline: "Players tap<br>I'm in. Done." },
  { name: "02-home", as: "organizer", path: "/dashboard", eyebrow: "Your week", headline: "Every game,<br>one glance." },
  { name: "03-manage", as: "organizer", group: "soccer", eyebrow: "Autopilot", headline: "Short? It knows<br>who to ask." },
  { name: "04-insights", as: "organizer", path: "/insights", eyebrow: "Insights", headline: "Know your<br>regulars." },
  { name: "05-play", as: "player", path: "/play", eyebrow: "For players", headline: "Your games,<br>your record." },
];

const SIZES = {
  "iphone-6.9": { device: "iphone", w: 1320, h: 2868 },
  "iphone-6.3": { device: "iphone", w: 1206, h: 2622 },
};

const json = (method, path, body, headers = {}) =>
  fetch(`${API}${path}`, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());

/** The demo groups, and memberships for a regular in each (claimed, so the player has a real record). A claim is
 *  one-time, so the memberships are remembered next to the output for re-runs against the same seed. */
async function demo() {
  const { groups } = await json("GET", "/me/dashboard", undefined, { "x-dev-user": ORGANIZER });
  const cache = new URL(".memberships.json", ROOT);
  if (existsSync(cache)) {
    const saved = JSON.parse(readFileSync(cache, "utf8"));
    if (Object.keys(saved.memberships).every((slug) => groups.some((g) => g.group.slug === slug))) return saved;
  }
  const find = (word) => groups.find((g) => g.group.name.toLowerCase().includes(word))?.group.slug;
  const slugs = { soccer: find("soccer"), basketball: find("basketball") };
  if (!slugs.soccer || !slugs.basketball) throw new Error("Demo groups missing: run the local seed first");
  const memberships = {};
  for (const [key, name, answer] of [["soccer", "Carlos", "in"], ["basketball", "Mike", null]]) {
    const page = await json("GET", `/groups/${slugs[key]}`);
    const unclaimed = page.unclaimed.find((p) => p.name === name);
    const roster = [...page.roster.confirmed, ...page.roster.waitlist, ...page.roster.out].find((p) => p.name === name);
    const memberId = unclaimed?.id ?? roster?.memberId;
    const m = await json("POST", `/groups/${slugs[key]}/members/${memberId}/claim`);
    if (!m.token) throw new Error(`Couldn't claim ${name}: ${JSON.stringify(m)}`);
    if (answer) await json("PUT", `/groups/${slugs[key]}/rsvp`, { status: answer }, { "x-member-token": m.token });
    memberships[slugs[key]] = JSON.stringify({ memberId: m.member.id, token: m.token, name });
  }
  mkdirSync(ROOT, { recursive: true });
  writeFileSync(cache, JSON.stringify({ slugs, memberships }));
  return { slugs, memberships };
}

async function capture() {
  mkdirSync(RAW, { recursive: true });
  const { slugs, memberships } = await demo();
  const browser = await chromium.launch();
  for (const [deviceName, d] of Object.entries(DEVICES)) {
    for (const s of SLIDES) {
      const path = s.path ?? `/g/${slugs[s.group]}`;
      const ctx = await browser.newContext({
        viewport: { width: d.w, height: d.h - d.status - d.home }, deviceScaleFactor: d.scale,
        isMobile: deviceName === "iphone", hasTouch: true, colorScheme: "dark",
      });
      const page = await ctx.newPage();
      await page.addInitScript(({ as, memberships }) => {
        try {
          // The organizer plays too, so their group page shows "You're in" instead of the name field.
          if (as === "organizer") localStorage.setItem("devOrganizerId", "seed");
          for (const [slug, value] of Object.entries(memberships)) localStorage.setItem(`membership:${slug}`, value);
          localStorage.setItem("joinedGroups", JSON.stringify(Object.keys(memberships)));
          localStorage.setItem("signInPrompt", JSON.stringify({ shows: 9, lastAt: new Date().toISOString() }));
        } catch {}
      }, { as: s.as, memberships });
      await page.goto(`${WEB}${path}`);
      await page.waitForTimeout(4500);
      const file = new URL(`${deviceName}-${s.name}.png`, RAW);
      await page.screenshot({ path: file.pathname });
      console.log(file.pathname);
      await ctx.close();
    }
  }
  await browser.close();
}

const THEME = { bg: "#0F1216", glow: "rgba(34,197,94,.22)", glow2: "rgba(251,146,60,.12)", ink: "#F2F4F6", accent: "#22C55E", bezel: "#1F252B", screen: "#0F1216", home: "#F2F4F6", shadow: "0 60px 120px rgba(0,0,0,.6)" };

const font = (p) => pathToFileURL(require.resolve(`@expo-google-fonts/${p}`)).href;
const FONTS = `
@font-face{font-family:Display;src:url(${font("bricolage-grotesque/800ExtraBold/BricolageGrotesque_800ExtraBold.ttf")})}
@font-face{font-family:Mono;src:url(${font("ibm-plex-mono/500Medium/IBMPlexMono_500Medium.ttf")})}
@font-face{font-family:Sans;src:url(${font("ibm-plex-sans/600SemiBold/IBMPlexSans_600SemiBold.ttf")})}`;

/** iOS status bar: time left, signal / Wi-Fi / battery right; a Dynamic Island on iPhone. */
function statusBar(device) {
  const c = "#fff";
  const icons = `<svg width="300" height="44" viewBox="0 0 300 44" fill="${c}">
    <rect x="0" y="22" width="12" height="14" rx="3"/><rect x="18" y="16" width="12" height="20" rx="3"/><rect x="36" y="10" width="12" height="26" rx="3"/><rect x="54" y="4" width="12" height="32" rx="3"/>
    <path d="M118 36l-9-10a14 14 0 0 1 18 0zM100 18a26 26 0 0 1 36 0l-6 7a17 17 0 0 0-24 0zM90 8a40 40 0 0 1 56 0l-6 7a31 31 0 0 0-44 0z"/>
    <rect x="186" y="6" width="84" height="32" rx="10" fill="none" stroke="${c}" stroke-width="3" opacity=".45"/><rect x="192" y="12" width="66" height="20" rx="5"/><rect x="274" y="16" width="6" height="12" rx="3" opacity=".45"/></svg>`;
  return device === "iphone"
    ? `<div class="sb iphone"><span class="time" style="color:${c}">9:41</span><span class="island"></span><span class="icons">${icons}</span></div>`
    : `<div class="sb ipad"><span class="time" style="color:${c}">9:41&nbsp;&nbsp;Tue 27 Oct</span><span class="icons">${icons}</span></div>`;
}

function page(size, s, t, img) {
  const d = DEVICES[size.device];
  const W = size.device === "iphone" ? 1320 : 2064;
  const zoom = size.w / W;
  const H = Math.round(size.h / zoom);
  const phone = size.device === "iphone";
  const frameW = phone ? 940 : 1480;
  const pad = phone ? 16 : 22;
  const screenW = frameW - 2 * pad;
  const ptToPx = screenW / d.w;
  const capTop = phone ? 170 : 160;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
html{margin:0;overflow:hidden}
body{margin:0;width:${W}px;height:${H}px;overflow:hidden;zoom:${zoom};position:relative;
  background:radial-gradient(1100px 820px at 95% -5%,${t.glow},transparent 62%),radial-gradient(900px 700px at -10% 105%,${t.glow2},transparent 60%),${t.bg}}
.cap{position:absolute;left:${phone ? 110 : 150}px;right:${phone ? 110 : 150}px;top:${capTop}px}
.eb{font-family:Mono;font-size:${phone ? 34 : 40}px;letter-spacing:.2em;text-transform:uppercase;color:${t.accent};display:flex;align-items:center;gap:22px}
.eb:before{content:"";width:56px;height:3px;background:${t.accent};border-radius:2px}
h1{margin:30px 0 0;font-family:Display;font-size:${phone ? 112 : 128}px;line-height:1.02;letter-spacing:-.025em;color:${t.ink};font-weight:800}
.dev{position:absolute;left:50%;top:${phone ? 640 : 560}px;transform:translateX(-50%);width:${frameW}px;padding:${pad}px;border-radius:${phone ? 108 : 64}px;background:${t.bezel};box-shadow:${t.shadow}}
.scr{border-radius:${phone ? 94 : 44}px;overflow:hidden;background:${t.screen};position:relative}
.sb{height:${d.status * ptToPx}px;display:flex;align-items:center;justify-content:space-between;padding:0 ${phone ? 64 : 40}px 0 ${phone ? 50 : 40}px;box-sizing:border-box;position:relative}
.sb .time{font-family:Sans;font-size:${phone ? 46 : 30}px;${phone ? "width:150px;text-align:center" : ""}}
.sb .icons svg{display:block;${phone ? "height:27px;width:auto" : "height:22px;width:auto"}}
.island{position:absolute;left:50%;top:${11 * ptToPx}px;transform:translateX(-50%);width:${126 * ptToPx}px;height:${37 * ptToPx}px;border-radius:999px;background:#000}
.scr img{display:block;width:100%}
.home{height:${d.home * ptToPx}px;display:flex;align-items:center;justify-content:center}
.home i{display:block;width:${(phone ? 140 : 320) * ptToPx}px;height:${5 * ptToPx}px;border-radius:9px;background:${t.home};opacity:.85}
</style></head><body>
<div class="cap"><div class="eb">${s.eyebrow}</div><h1>${s.headline}</h1></div>
<div class="dev"><div class="scr">${statusBar(size.device)}<img src="${img}"><div class="home"><i></i></div></div></div>
</body></html>`;
}

async function compose() {
  const browser = await chromium.launch();
  const tmp = join(tmpdir(), "turnout-store");
  mkdirSync(tmp, { recursive: true });
  for (const [sizeName, size] of Object.entries(SIZES)) {
    const out = new URL(`${sizeName}/`, ROOT);
    mkdirSync(out, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1 });
    const pg = await ctx.newPage();
    for (const s of SLIDES) {
      const img = new URL(`${size.device}-${s.name}.png`, RAW).href;
      const html = join(tmp, `${sizeName}-${s.name}.html`);
      writeFileSync(html, page(size, s, THEME, img));
      await pg.goto(pathToFileURL(html).href);
      await pg.evaluate(() => document.fonts.ready);
      await pg.waitForTimeout(200);
      const file = new URL(`turnout-${sizeName.replace(/[.-]/g, "")}-${s.name}.png`, out);
      await pg.screenshot({ path: file.pathname });
      console.log(file.pathname);
    }
    await ctx.close();
  }
  await browser.close();
}

const step = process.argv[2];
if (step === "capture") await capture();
else if (step === "compose") await compose();
else console.error("Usage: node scripts/store-screenshots.mjs capture|compose");
