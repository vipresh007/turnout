// One-click unsubscribe (RFC 8058) for the organizer's weekly digest. Mail apps POST to the List-Unsubscribe URL
// (/api/unsubscribe?digest=<token>); this forwards to the API. A GET (someone opening the URL) goes to the page.
const fs = require("fs");
const path = require("path");

const { apiUrl, webUrl } = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "og-page", "config.json"), "utf8"));

module.exports = async function (context, req) {
  const token = String(req.query.digest || "").slice(0, 100);
  if (req.method === "GET" || !token) {
    context.res = { status: 302, headers: { location: `${webUrl}/email?digest=${encodeURIComponent(token)}` } };
    return;
  }
  try {
    const res = await fetch(`${apiUrl}/email/digest-off`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(5000),
    });
    context.res = { status: res.ok ? 200 : 404, body: res.ok ? "Unsubscribed" : "Unknown link" };
  } catch {
    context.res = { status: 502, body: "Try again later" };
  }
};
