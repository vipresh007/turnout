// After `expo export`: adds default link-preview tags to dist/index.html (between <!--og--> markers
// that the og-page function swaps per group) and copies the page + config into the function.
//   node scripts/add-meta.mjs <dist> <apiUrl> <webUrl>
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";

const [dist = "dist", apiUrl, webUrl] = process.argv.slice(2);
if (!apiUrl || !webUrl) throw new Error("usage: add-meta.mjs <dist> <apiUrl> <webUrl>");
const file = `${dist}/index.html`;
const title = "Turnout: who's in this week?";
const description = "One link for your weekly game. Players tap in or out, the headcount updates live, and the waitlist runs itself.";
const block = [
  `<meta name="description" content="${description}">`,
  `<meta property="og:type" content="website">`,
  `<meta property="og:site_name" content="Turnout">`,
  `<meta property="og:title" content="${title}">`,
  `<meta property="og:description" content="${description}">`,
  `<meta property="og:image" content="${webUrl}/og.png">`,
  `<meta property="og:image:width" content="1200">`,
  `<meta property="og:image:height" content="630">`,
  `<meta name="twitter:card" content="summary_large_image">`,
].join("");
let html = readFileSync(file, "utf8").replace(/<title>[^<]*<\/title>/, "");
html = html.replace("</head>", `<!--og--><title>${title}</title>${block}<!--/og--></head>`);
writeFileSync(file, html);
copyFileSync(file, "api/og-page/index.html");
writeFileSync("api/og-page/config.json", JSON.stringify({ apiUrl, webUrl }));
console.log("preview tags added");
