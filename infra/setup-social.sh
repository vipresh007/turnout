#!/usr/bin/env bash
# Add Google and/or Apple sign-in to the Turnout tenant. Idempotent.
#   ./infra/setup-social.sh
# Put the keys in infra/.env.infra (gitignored), never in git or chat:
#   GOOGLE_CLIENT_ID=...            GOOGLE_CLIENT_SECRET=...
#   APPLE_SERVICE_ID=...            APPLE_TEAM_ID=...
#   APPLE_KEY_ID=...                APPLE_KEY_FILE=/path/to/AuthKey_XXXX.p8
# Providers without keys are skipped. Afterwards the app's sign-in buttons are updated
# (GitHub variable ENTRA_PROVIDERS) and both environments need a redeploy to show them.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$HERE/.env.infra"
[ -f "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; }
REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
. "$HERE/lib/entra-app-token.sh"
api() { curl -s -X "$1" "https://graph.microsoft.com/beta/$2" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" ${3:+-d "$3"}; }
json() { node -e 'const [k, ...v] = process.argv.slice(1); const o = {}; for (let i = 0; i < v.length; i += 2) o[v[i]] = v[i + 1]; console.log(JSON.stringify(Object.assign({ "@odata.type": k }, o)))' "$@"; }

FLOW_ID="$(api GET "identity/authenticationEventsFlows" | node -pe '(JSON.parse(require("fs").readFileSync(0)).value.find(f => f.displayName === "Turnout sign in") || {}).id || ""')"
[ -n "$FLOW_ID" ] || { echo "User flow 'Turnout sign in' not found; run setup-entra.sh first"; exit 1; }
FLOW_IDPS="identity/authenticationEventsFlows/$FLOW_ID/microsoft.graph.externalUsersSelfServiceSignUpEventsFlow/onAuthenticationMethodLoadStart/microsoft.graph.onAuthenticationMethodLoadStartExternalUsersSelfServiceSignUp/identityProviders"

# Creates or updates a provider ($1 = display name, $2 = JSON body) and attaches it to the flow.
ensure_provider() {
  local name="$1" body="$2" id res
  id="$(api GET "identity/identityProviders" | node -pe "(JSON.parse(require('fs').readFileSync(0)).value.find(p => p.displayName === '$name') || {}).id || ''")"
  if [ -n "$id" ]; then
    api PATCH "identity/identityProviders/$id" "$body" >/dev/null
  else
    res="$(api POST "identity/identityProviders" "$body")"
    id="$(echo "$res" | node -pe 'const j = JSON.parse(require("fs").readFileSync(0)); j.id || ""')"
    [ -n "$id" ] || { echo "$name: $(echo "$res" | head -c 400)"; return 1; }
  fi
  if ! api GET "$FLOW_IDPS" | grep -q "\"$id\""; then
    api POST "$FLOW_IDPS/\$ref" "{\"@odata.id\":\"https://graph.microsoft.com/beta/identityProviders/$id\"}" >/dev/null
  fi
  echo "$name: ready ($id)"
}

PROVIDERS="microsoft"
if [ -n "${GOOGLE_CLIENT_ID:-}" ] && [ -n "${GOOGLE_CLIENT_SECRET:-}" ]; then
  ensure_provider "Google" "$(json "#microsoft.graph.socialIdentityProvider" displayName Google identityProviderType Google clientId "$GOOGLE_CLIENT_ID" clientSecret "$GOOGLE_CLIENT_SECRET")"
  PROVIDERS="$PROVIDERS,google"
else
  echo "Google: skipped (no GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)"
fi
if [ -n "${APPLE_SERVICE_ID:-}" ] && [ -n "${APPLE_TEAM_ID:-}" ] && [ -n "${APPLE_KEY_ID:-}" ] && [ -f "${APPLE_KEY_FILE:-/nonexistent}" ]; then
  ensure_provider "Apple" "$(json "#microsoft.graph.appleManagedIdentityProvider" displayName Apple developerId "$APPLE_TEAM_ID" serviceId "$APPLE_SERVICE_ID" keyId "$APPLE_KEY_ID" certificateData "$(cat "$APPLE_KEY_FILE")")"
  PROVIDERS="$PROVIDERS,apple"
else
  echo "Apple: skipped (needs APPLE_SERVICE_ID, APPLE_TEAM_ID, APPLE_KEY_ID and APPLE_KEY_FILE)"
fi

for env in test live; do gh variable set ENTRA_PROVIDERS -R "$REPO" -e "$env" -b "$PROVIDERS"; done
echo "Sign-in buttons: $PROVIDERS. Redeploy to show them: gh workflow run deploy.yml -f environment=test"
