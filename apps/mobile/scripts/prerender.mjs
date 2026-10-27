// After `expo export` and add-meta.mjs: gives each public page real HTML, so search engines and AI crawlers
// (which mostly don't run JavaScript) can read the site. People still get the normal app: it replaces the
// pre-rendered markup as soon as it starts. Also writes robots.txt, sitemap.xml and llms.txt.
//   node scripts/prerender.mjs <dist> <webUrl>   (Node 24 reads the TypeScript copy file directly)
// Only the live site is indexable; any other host (test) is marked noindex and disallowed in robots.txt.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { activities, comparison, faqs, features, SITE, steps } from "../src/content/site.ts";

const [dist = "dist", webUrl = SITE.url] = process.argv.slice(2);
const live = webUrl.replace(/\/$/, "") === SITE.url;
const base = readFileSync(`${dist}/index.html`, "utf8");

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const abs = (path) => `${webUrl}${path === "/" ? "" : path}`;

/** @typedef {{ path: string, title: string, description: string, body: string, jsonLd?: object[] }} Page */

const nav = `<nav><a href="/">Turnout</a> · <a href="/compare">Compare</a> · ${activities.slice(0, 4).map((a) => `<a href="/for/${a.slug}">${esc(a.name)}</a>`).join(" · ")} · <a href="/support">Support</a></nav>`;
const cta = `<p><a href="/new">Start a group, it's free</a> · <a href="/demo">Try the demo</a> · <a href="${SITE.appStoreUrl}">Get the iPhone app</a></p>`;
const faqHtml = (list) => `<section><h2>Questions organizers ask</h2>${list.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("")}</section>`;
const footer = `<footer><p>Turnout is made by ${esc(SITE.company)} in Ontario, Canada. Contact: <a href="mailto:${SITE.contact}">${SITE.contact}</a>. <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/support">Support</a></p><p>Use cases: ${activities.map((a) => `<a href="/for/${a.slug}">${esc(a.name)}</a>`).join(" · ")}</p></footer>`;

const organization = { "@type": "Organization", name: SITE.company, url: "https://dataeaver.ca", email: SITE.contact };
const app = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE.name,
  alternateName: "Turnout: Who's In?",
  description: SITE.description,
  url: SITE.url,
  applicationCategory: "SportsApplication",
  operatingSystem: "iOS, Web",
  installUrl: SITE.appStoreUrl,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  publisher: organization,
};

/** @type {Page[]} */
const pages = [
  {
    path: "/",
    title: "Turnout: stop asking who's playing",
    description: SITE.description,
    body: `<h1>${esc(SITE.tagline)}</h1><p>${esc(SITE.description)}</p>${cta}
      <section><h2>How it works</h2><ol>${steps.map((s) => `<li><strong>${esc(s.title)}.</strong> ${esc(s.body)}</li>`).join("")}</ol></section>
      <section><h2>Everything the group chat can't do</h2><ul>${features.map((f) => `<li><strong>${esc(f.title)}.</strong> ${esc(f.body)}</li>`).join("")}</ul></section>
      <section><h2>Pricing</h2><p>Free for organizers while we're getting started, and players are always free. An optional Organizer plan is planned at a $49/year founding price; nothing is charged today.</p></section>
      ${faqHtml(faqs)}`,
    jsonLd: [
      app,
      { "@context": "https://schema.org", "@type": "WebSite", name: SITE.name, url: SITE.url },
      { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  },
  ...activities.map((a) => ({
    path: `/for/${a.slug}`,
    title: `${a.title} · Turnout`,
    description: `${a.intro.split(". ")[0]}. Free, and players need no app or account.`,
    body: `<h1>${esc(a.title)}</h1><p>${esc(a.intro)}</p>${cta}
      <section><h2>Why organizers use Turnout for ${esc(a.name)}</h2><ul>${a.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></section>
      <section><h2>Set up in one sentence</h2><p>“${esc(a.example)}”</p><ol>${steps.map((s) => `<li><strong>${esc(s.title)}.</strong> ${esc(s.body)}</li>`).join("")}</ol></section>
      ${faqHtml(faqs.slice(0, 4))}`,
    jsonLd: [{ ...app, description: a.intro }],
  })),
  {
    path: "/compare",
    title: `${comparison.title} · Turnout`,
    description: comparison.intro,
    body: `<h1>${esc(comparison.title)}</h1><p>${esc(comparison.intro)}</p>${cta}
      <table><thead><tr><th>Option</th><th>Good at</th><th>Falls short</th></tr></thead><tbody>${comparison.rows.map((r) => `<tr><td>${esc(r.option)}</td><td>${esc(r.good)}</td><td>${esc(r.gap)}</td></tr>`).join("")}</tbody></table>`,
  },
  { path: "/support", title: "Support · Turnout", description: `Help with Turnout: contact ${SITE.contact}, answers for players and organizers, and how to delete your account.`, body: `<h1>Support</h1><p>Email <a href="mailto:${SITE.contact}">${SITE.contact}</a>; we usually reply within one business day.</p>${faqHtml(faqs)}` },
  { path: "/privacy", title: "Privacy policy · Turnout", description: "What Turnout collects, why, and the choices you have. Players need no account; we don't sell data or use third-party tracking.", body: `<h1>Privacy policy</h1><p>Turnout collects as little as it can: organizers' name and email, the groups they run, and the names and answers players enter. No advertising, no selling data, no third-party tracking. Questions: ${SITE.contact}.</p>` },
  { path: "/terms", title: "Terms of service · Turnout", description: "The terms for using Turnout, including acceptable use and how reports of objectionable content are handled.", body: `<h1>Terms of service</h1><p>Turnout is provided by ${esc(SITE.company)}. There is no tolerance for objectionable content or abusive users; reports are reviewed within 24 hours. Questions: ${SITE.contact}.</p>` },
];

// The pre-rendered markup gets simple dark styling so the moment before the app starts looks intentional.
const style = `<style>.pr{height:100%;width:100%;overflow:auto;background:#0E1113;color:#F3F4F6;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}.pr main,.pr nav,.pr footer{max-width:760px;margin:0 auto;padding:16px 20px}.pr a{color:#22C55E}.pr h1{font-size:40px;line-height:1.1;letter-spacing:-1px}.pr table{border-collapse:collapse}.pr td,.pr th{border:1px solid #262B31;padding:8px;vertical-align:top;text-align:left}</style>`;

/** @param {Page} page */
function render(page) {
  const head = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}">`,
    `<link rel="canonical" href="${abs(page.path)}">`,
    live ? "" : `<meta name="robots" content="noindex">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Turnout">`,
    `<meta property="og:title" content="${esc(page.title)}">`,
    `<meta property="og:description" content="${esc(page.description)}">`,
    `<meta property="og:url" content="${abs(page.path)}">`,
    `<meta property="og:image" content="${webUrl}/og.png">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="apple-itunes-app" content="app-id=6820230750">`,
    ...(page.jsonLd ?? []).map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`),
    style,
  ].join("");
  const withHead = base.includes("<!--og-->") ? base.replace(/<!--og-->[\s\S]*?<!--\/og-->/, `<!--og-->${head}<!--/og-->`) : base.replace(/<title>[^<]*<\/title>/, head);
  return withHead.replace('<div id="root"></div>', `<div id="root"><div class="pr">${nav}<main>${page.body}</main>${footer}</div></div>`);
}

// A clean copy for every other route (the app's own pages), so they don't flash the landing page's content.
writeFileSync(`${dist}/app.html`, base);
for (const page of pages) {
  const dir = page.path === "/" ? dist : `${dist}${page.path}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/index.html`, render(page));
}

// Static Web Apps config: fall back to the clean copy, serve each pre-rendered page at its path, keep private pages out of search.
const configPath = `${dist}/staticwebapp.config.json`;
const config = JSON.parse(readFileSync(configPath, "utf8"));
config.navigationFallback.rewrite = "/app.html";
const noindex = { "X-Robots-Tag": "noindex" };
const privateRoutes = ["/dashboard", "/groups", "/activity", "/account", "/stats", "/new", "/sign-in", "/auth", "/email", "/restore", "/organize", "/founding", "/feedback", "/admin", "/edit/*", "/members/*", "/teams/*", "/schedule/*", "/insights/*", "/history/*", "/organizers/*"];
config.routes = [
  ...pages.filter((p) => p.path !== "/").map((p) => ({ route: p.path, rewrite: `${p.path}/index.html` })),
  ...config.routes.map((r) => (r.route === "/g/*" ? { ...r, headers: { ...r.headers, ...noindex } } : r)),
  ...privateRoutes.map((route) => ({ route, headers: noindex })),
];
if (!live) config.globalHeaders = { ...config.globalHeaders, ...noindex };
writeFileSync(configPath, JSON.stringify(config, null, 2));

writeFileSync(
  `${dist}/robots.txt`,
  live
    ? `# Turnout: public pages are open to search engines and AI assistants; groups and accounts are private.\nUser-agent: *\nAllow: /\n${["/g/", ...privateRoutes.map((r) => r.replace("/*", "/"))].map((p) => `Disallow: ${p}`).join("\n")}\n\nSitemap: ${SITE.url}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n",
);
if (live) {
  writeFileSync(
    `${dist}/sitemap.xml`,
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${abs(p.path)}</loc></url>`).join("\n")}\n</urlset>\n`,
  );
}

// llms.txt (llmstxt.org): a plain summary for AI assistants.
writeFileSync(
  `${dist}/llms.txt`,
  `# Turnout\n\n> ${SITE.description}\n\nTurnout (${SITE.url}) is a free headcount and RSVP tool for recurring group games and events: pickup soccer, basketball runs, volleyball, pickleball, shinny, ultimate, badminton, run clubs, poker nights and more. It is made by ${SITE.company} (Ontario, Canada). Web app plus an iPhone app (${SITE.appStoreUrl}).\n\n## How it works\n${steps.map((s) => `- ${s.title}: ${s.body}`).join("\n")}\n\n## Features\n${features.map((f) => `- ${f.title}: ${f.body}`).join("\n")}\n- Also: one-time events, season fees split between members, balanced teams, payment tracking, game history, attendance stats, co-organizers, and an autopilot that warns organizers when a game looks short.\n\n## Compared with alternatives\n${comparison.rows.map((r) => `- ${r.option}: good at ${r.good.toLowerCase()} ${r.option === "Turnout" ? "Not for" : "Falls short"}: ${r.gap}`).join("\n")}\n\n## FAQ\n${faqs.map((f) => `- ${f.q} ${f.a}`).join("\n")}\n\n## Pages\n${pages.map((p) => `- [${p.title}](${abs(p.path)})`).join("\n")}\n\nContact: ${SITE.contact}\n`,
);

console.log(`prerendered ${pages.length} pages (${live ? "indexable" : "noindex"})`);
