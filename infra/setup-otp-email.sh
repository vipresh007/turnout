#!/usr/bin/env bash
# Send sign-in codes in Turnout's own email instead of Microsoft's (Entra custom email OTP provider).
#   ./infra/setup-otp-email.sh [test|live]      (default: live)
# Entra calls https://<api-host>/auth-events/otp-send with each code; the API sends the email via
# Azure Communication Services. If our API errors or is slow, Entra falls back to its own email.
# One tenant serves both environments, so pick which API receives the calls. Idempotent.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$HERE/.env.infra"
[ -f "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; }
TARGET="${1:-live}"
RG="${RESOURCE_GROUP:-rg-turnout}"
API_HOST="$(az containerapp show -g "$RG" -n "ca-turnout-api-$TARGET" --query properties.configuration.ingress.fqdn -o tsv)"
CLIENT_APP_ID="${ENTRA_CLIENT_ID:?Run setup-entra.sh first}"
GRAPH_APP="00000003-0000-0000-c000-000000000000"
RECEIVE_PAYLOAD_ROLE="214e810f-fda8-4fd7-a475-29461495eb00" # CustomAuthenticationExtension.Receive.Payload
echo "target=$TARGET host=$API_HOST"

# 1. The app registration that represents our endpoint (delegated calls as you, in the tenant).
g() { AZURE_CONFIG_DIR="$HOME/.azure-turnout-ciam" az rest --method "$1" --url "https://graph.microsoft.com/v1.0/$2" ${3:+--body "$3"} --headers "Content-Type=application/json" "${@:4}"; }
EVENTS_APP_ID="$(g get "applications?\$filter=displayName eq 'Turnout auth events'" "" --query "value[0].appId" -o tsv)"
[ -n "$EVENTS_APP_ID" ] || EVENTS_APP_ID="$(g post applications '{"displayName":"Turnout auth events","signInAudience":"AzureADMyOrg"}' --query appId -o tsv)"
RESOURCE_ID="api://$API_HOST/$EVENTS_APP_ID"
g patch "applications(appId='$EVENTS_APP_ID')" "{
  \"identifierUris\": [\"$RESOURCE_ID\"],
  \"api\": { \"requestedAccessTokenVersion\": 2 },
  \"requiredResourceAccess\": [{ \"resourceAppId\": \"$GRAPH_APP\", \"resourceAccess\": [{ \"id\": \"$RECEIVE_PAYLOAD_ROLE\", \"type\": \"Role\" }] }]
}" -o none
EVENTS_SP="$(g get "servicePrincipals(appId='$EVENTS_APP_ID')" "" --query id -o tsv 2>/dev/null || true)"
[ -n "$EVENTS_SP" ] || EVENTS_SP="$(g post servicePrincipals "{\"appId\":\"$EVENTS_APP_ID\"}" --query id -o tsv)"
GRAPH_SP="$(g get "servicePrincipals(appId='$GRAPH_APP')" "" --query id -o tsv)"
g post "servicePrincipals/$EVENTS_SP/appRoleAssignments" "{\"principalId\":\"$EVENTS_SP\",\"resourceId\":\"$GRAPH_SP\",\"appRoleId\":\"$RECEIVE_PAYLOAD_ROLE\"}" -o none 2>/dev/null || true
echo "events app: $EVENTS_APP_ID"

# 2. The custom extension and its listener (app-only calls through the setup app).
. "$HERE/lib/entra-app-token.sh"
beta() { curl -s -X "$1" "https://graph.microsoft.com/beta/$2" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" ${3:+-d "$3"}; }
EXT_BODY="{
  \"@odata.type\": \"#microsoft.graph.onOtpSendCustomExtension\",
  \"displayName\": \"Turnout sign-in code email\",
  \"description\": \"Sends sign-in codes through Turnout's own email template.\",
  \"authenticationConfiguration\": { \"@odata.type\": \"#microsoft.graph.azureAdTokenAuthentication\", \"resourceId\": \"$RESOURCE_ID\" },
  \"endpointConfiguration\": { \"@odata.type\": \"#microsoft.graph.httpRequestEndpoint\", \"targetUrl\": \"https://$API_HOST/auth-events/otp-send\" },
  \"clientConfiguration\": { \"timeoutInMilliseconds\": 2000, \"maximumRetries\": 1 }
}"
EXT_ID="$(beta GET "identity/customAuthenticationExtensions" | node -pe 'const v=JSON.parse(require("fs").readFileSync(0)).value||[]; (v.find(e=>e.displayName==="Turnout sign-in code email")||{}).id||""')"
if [ -n "$EXT_ID" ]; then
  beta PATCH "identity/customAuthenticationExtensions/$EXT_ID" "$EXT_BODY" >/dev/null
else
  EXT_ID="$(beta POST "identity/customAuthenticationExtensions" "$EXT_BODY" | node -pe 'const j=JSON.parse(require("fs").readFileSync(0)); j.id || (console.error(JSON.stringify(j.error)), "")')"
fi
[ -n "$EXT_ID" ] || { echo "Could not create the custom extension"; exit 1; }
echo "extension: $EXT_ID"

LISTENER_BODY="{
  \"@odata.type\": \"#microsoft.graph.onEmailOtpSendListener\",
  \"conditions\": { \"applications\": { \"includeAllApplications\": false, \"includeApplications\": [{ \"appId\": \"$CLIENT_APP_ID\" }] } },
  \"priority\": 500,
  \"handler\": {
    \"@odata.type\": \"#microsoft.graph.onOtpSendCustomExtensionHandler\",
    \"customExtension\": { \"id\": \"$EXT_ID\" },
    \"configuration\": { \"behaviorOnError\": { \"@odata.type\": \"#microsoft.graph.fallbackToMicrosoftProviderOnError\" } }
  }
}"
LISTENER_ID="$(beta GET "identity/authenticationEventListeners" | node -pe 'const v=JSON.parse(require("fs").readFileSync(0)).value||[]; (v.find(l=>l["@odata.type"]==="#microsoft.graph.onEmailOtpSendListener")||{}).id||""')"
if [ -n "$LISTENER_ID" ]; then
  beta PATCH "identity/authenticationEventListeners/$LISTENER_ID" "$LISTENER_BODY" >/dev/null
else
  LISTENER_ID="$(beta POST "identity/authenticationEventListeners" "$LISTENER_BODY" | node -pe 'const j=JSON.parse(require("fs").readFileSync(0)); j.id || (console.error(JSON.stringify(j.error)), "")')"
fi
[ -n "$LISTENER_ID" ] || { echo "Could not create the listener"; exit 1; }
echo "listener: $LISTENER_ID"

grep -v '^ENTRA_EVENTS_APP_ID=' "$ENV_FILE" > "$ENV_FILE.tmp" || true
echo "ENTRA_EVENTS_APP_ID=$EVENTS_APP_ID" >> "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"
echo "Done. Re-run ./infra/provision.sh so the API trusts the events app (ENTRA_EVENTS_APP_ID)."
