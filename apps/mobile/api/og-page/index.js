// Serves /g/<slug> pages (rewritten here by staticwebapp.config.json) with that group's link-preview
// tags, so WhatsApp, iMessage, Slack etc. show a card with the live count. People get the same app.
// index.html and config.json are copied in at build time by scripts/add-meta.mjs.
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const { apiUrl, webUrl } = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function tags({ title, description, image, url }) {
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Turnout">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:image" content="${esc(image)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].join("");
}

module.exports = async function (context, req) {
  const original = req.headers["x-ms-original-url"] || "";
  const slug = (new URL(original, webUrl).pathname.match(/^\/g\/([a-z0-9]{4,20})/) || [])[1];
  let page = html;
  if (slug) {
    try {
      const res = await fetch(`${apiUrl}/groups/${slug}`, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        const { group, session, roster } = await res.json();
        const count = roster.confirmed.length;
        const when = new Date(session.startsAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: group.timezone });
        const status = session.cancelled ? "Cancelled this week" : group.cap ? (count >= group.cap ? `${count}/${group.cap} in · full` : `${count}/${group.cap} in · need ${group.cap - count} more`) : `${count} in`;
        const block = tags({
          title: `${group.name} · ${status}`,
          description: `${when}${group.location ? ` · ${group.location}` : ""}. Tap to say you're in. No app or account needed.`,
          image: `${apiUrl}/og/${slug}.png?v=${count}`,
          url: `${webUrl}/g/${slug}`,
        });
        page = html.replace(/<!--og-->[\s\S]*?<!--\/og-->/, `<!--og-->${block}<!--/og-->`);
      }
    } catch (err) {
      context.log.warn(`preview tags failed for ${slug}: ${err.message}`);
    }
  }
  context.res = { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" }, body: page };
};
