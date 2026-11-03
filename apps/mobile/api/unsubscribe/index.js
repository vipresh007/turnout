// One-click unsubscribe (RFC 8058) for organizer emails: ?digest=<token> (weekly digest) or ?alerts=<token> (game
// alert emails). Mail apps POST to the List-Unsubscribe URL; this forwards to the API. A GET goes to the page.
const fs = require("fs");
const path = require("path");

const { apiUrl, webUrl } = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "og-page", "config.json"), "utf8"));

module.exports = async function (context, req) {
  const kind = req.query.alerts ? "alertEmails" : "digest";
  const param = kind === "digest" ? "digest" : "alerts";
  const token = String(req.query[param] || "").slice(0, 100);
  if (req.method === "GET" || !token) {
    context.res = { status: 302, headers: { location: `${webUrl}/email?${param}=${encodeURIComponent(token)}` } };
    return;
  }
  try {
    const res = await fetch(`${apiUrl}/email/organizer-off`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, kind }),
      signal: AbortSignal.timeout(5000),
    });
    context.res = { status: res.ok ? 200 : 404, body: res.ok ? "Unsubscribed" : "Unknown link" };
  } catch {
    context.res = { status: 502, body: "Try again later" };
  }
};
