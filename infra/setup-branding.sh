#!/usr/bin/env bash
# Apply Turnout branding to the Entra External ID sign-in pages (logo, background, favicon, CSS, text).
#   ./infra/setup-branding.sh
# Assets live in infra/branding/ (PNGs are rendered from the SVGs next to them). Idempotent.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/lib/entra-app-token.sh"   # sets TENANT_ID and TOKEN (app-only token for the setup app)
B="$HERE/branding"
URL="https://graph.microsoft.com/v1.0/organization/$TENANT_ID/branding"

body='{
  "backgroundColor": "#0E1113",
  "usernameHintText": "you@example.com",
  "signInPageText": "Players don\u0027t need an account to play. [Back to Turnout](https://turnout.dataeaver.ca)",
  "loginPageLayoutConfiguration": { "layoutTemplateType": "default", "isHeaderShown": false, "isFooterShown": true }
}'
status=$(curl -s -o /tmp/branding.out -w "%{http_code}" -X PATCH "$URL" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$body")
if [ "$status" = "404" ]; then # no branding yet: create the default (locale 0)
  status=$(curl -s -o /tmp/branding.out -w "%{http_code}" -X PATCH "$URL" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "Accept-Language: 0" -d "$body")
fi
echo "branding properties: $status"; [ "${status:0:1}" = "2" ] || { cat /tmp/branding.out; exit 1; }

upload() { # $1 = property, $2 = file, $3 = content type
  local s; s=$(curl -s -o /tmp/branding.out -w "%{http_code}" -X PUT "$URL/localizations/0/$1" -H "Authorization: Bearer $TOKEN" -H "Content-Type: $3" --data-binary "@$2")
  echo "$1: $s"; [ "${s:0:1}" = "2" ] || { cat /tmp/branding.out; exit 1; }
}
upload bannerLogo "$B/bannerLogo.png" image/png
upload squareLogo "$B/squareLogo.png" image/png
upload squareLogoDark "$B/squareLogo.png" image/png
upload favicon "$B/favicon.png" image/png
upload backgroundImage "$B/backgroundImage.png" image/png
upload customCSS "$B/customCSS.css" text/css
echo "Done. Changes can take a few minutes to show on the sign-in page."
