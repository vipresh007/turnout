#!/usr/bin/env bash
# Configure the Entra External ID tenant (turnoutapp) for Turnout. Idempotent.
#   ./infra/setup-entra.sh
# Signs in to the external tenant with a separate az profile (your main az login is untouched),
# then creates the app registrations, admin consent, and the email one-time-code sign-in flow.
# Prints the values to put in infra/.env.infra and the GitHub environment variables.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$HERE/.env.infra"
[ -f "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; }

RESOURCE_GROUP="${RESOURCE_GROUP:-rg-turnout}"
TENANT_NAME="${ENTRA_TENANT_NAME:-turnoutapp}"
REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
GRAPH="https://graph.microsoft.com/v1.0"
GRAPH_BETA="https://graph.microsoft.com/beta"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

# Look up the tenant ID and the web URLs with the main az profile.
SUB_ID="$(az account show --query id -o tsv)"
TENANT_ID="$(az rest --method get --url "https://management.azure.com/subscriptions/$SUB_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.AzureActiveDirectory/ciamDirectories?api-version=2023-05-17-preview" --query "value[?name=='$TENANT_NAME'].properties.tenantId | [0]" -o tsv)"
[ -n "$TENANT_ID" ] && [ "$TENANT_ID" != "00000000-0000-0000-0000-000000000000" ] || { echo "Tenant $TENANT_NAME is not ready yet"; exit 1; }
web_url() { echo "https://$(az staticwebapp show -g "$RESOURCE_GROUP" -n "swa-turnout-$1" --query defaultHostname -o tsv)"; }
TEST_WEB="$(web_url test)"
LIVE_WEB="$(web_url live)"
echo "tenant=$TENANT_ID  test=$TEST_WEB  live=$LIVE_WEB"

# Everything below runs as you, inside the external tenant.
export AZURE_CONFIG_DIR="${HOME}/.azure-turnout-ciam"
if ! az account show --query tenantId -o tsv 2>/dev/null | grep -q "$TENANT_ID"; then
  say "Sign in to the Turnout tenant in your browser"
  az login --tenant "$TENANT_ID" --allow-no-subscriptions -o none
fi

graph() { az rest --method "$1" --url "$2" ${3:+--body "$3"} --headers "Content-Type=application/json" "${@:4}"; }
app_id_by_name() { graph get "$GRAPH/applications?\$filter=displayName eq '$1'" "" --query "value[0].appId" -o tsv; }
object_id() { graph get "$GRAPH/applications(appId='$1')" "" --query id -o tsv; }
ensure_sp() {
  local id
  id="$(graph get "$GRAPH/servicePrincipals(appId='$1')" "" --query id -o tsv 2>/dev/null || true)"
  [ -n "$id" ] || id="$(graph post "$GRAPH/servicePrincipals" "{\"appId\":\"$1\"}" --query id -o tsv)"
  echo "$id"
}

say "API app registration"
API_APP_ID="$(app_id_by_name "Turnout API")"
[ -n "$API_APP_ID" ] || API_APP_ID="$(graph post "$GRAPH/applications" '{"displayName":"Turnout API","signInAudience":"AzureADMyOrg"}' --query appId -o tsv)"
SCOPE_ID="$(graph get "$GRAPH/applications(appId='$API_APP_ID')" "" --query "api.oauth2PermissionScopes[?value=='access'].id | [0]" -o tsv)"
[ -n "$SCOPE_ID" ] || SCOPE_ID="$(uuidgen | tr 'A-Z' 'a-z')"
graph patch "$GRAPH/applications(appId='$API_APP_ID')" "{
  \"identifierUris\": [\"api://$API_APP_ID\"],
  \"api\": {
    \"requestedAccessTokenVersion\": 2,
    \"oauth2PermissionScopes\": [{
      \"id\": \"$SCOPE_ID\", \"value\": \"access\", \"type\": \"User\", \"isEnabled\": true,
      \"adminConsentDisplayName\": \"Use Turnout\", \"adminConsentDescription\": \"Manage your Turnout groups.\",
      \"userConsentDisplayName\": \"Use Turnout\", \"userConsentDescription\": \"Manage your Turnout groups.\"
    }]
  },
  \"optionalClaims\": { \"accessToken\": [{ \"name\": \"email\", \"essential\": false }] }
}" -o none
API_SP="$(ensure_sp "$API_APP_ID")"
echo "API app: $API_APP_ID"

say "Client app registration (web + iOS + Android)"
CLIENT_APP_ID="$(app_id_by_name "Turnout App")"
[ -n "$CLIENT_APP_ID" ] || CLIENT_APP_ID="$(graph post "$GRAPH/applications" '{"displayName":"Turnout App","signInAudience":"AzureADMyOrg"}' --query appId -o tsv)"
GRAPH_SP_APP="00000003-0000-0000-c000-000000000000"
graph patch "$GRAPH/applications(appId='$CLIENT_APP_ID')" "{
  \"isFallbackPublicClient\": true,
  \"spa\": { \"redirectUris\": [\"http://localhost:8081/auth\", \"$TEST_WEB/auth\", \"$LIVE_WEB/auth\"] },
  \"publicClient\": { \"redirectUris\": [\"turnout://auth\"] },
  \"requiredResourceAccess\": [
    { \"resourceAppId\": \"$API_APP_ID\", \"resourceAccess\": [{ \"id\": \"$SCOPE_ID\", \"type\": \"Scope\" }] },
    { \"resourceAppId\": \"$GRAPH_SP_APP\", \"resourceAccess\": [
      { \"id\": \"37f7f235-527c-4136-accd-4a02d197296e\", \"type\": \"Scope\" },
      { \"id\": \"7427e0e9-2fba-42fe-b0c0-848c9e6a8182\", \"type\": \"Scope\" },
      { \"id\": \"14dad69e-099b-42c9-810b-d002981feec1\", \"type\": \"Scope\" }
    ]}
  ]
}" -o none
CLIENT_SP="$(ensure_sp "$CLIENT_APP_ID")"
echo "Client app: $CLIENT_APP_ID"

say "Admin consent (customers can't consent for themselves)"
grant() {
  local resource_sp="$1" scopes="$2" existing
  existing="$(graph get "$GRAPH/oauth2PermissionGrants?\$filter=clientId eq '$CLIENT_SP' and resourceId eq '$resource_sp'" "" --query "value[0].id" -o tsv)"
  if [ -n "$existing" ]; then
    graph patch "$GRAPH/oauth2PermissionGrants/$existing" "{\"scope\":\"$scopes\"}" -o none
  else
    graph post "$GRAPH/oauth2PermissionGrants" "{\"clientId\":\"$CLIENT_SP\",\"consentType\":\"AllPrincipals\",\"resourceId\":\"$resource_sp\",\"scope\":\"$scopes\"}" -o none
  fi
}
grant "$API_SP" "access"
grant "$(ensure_sp "$GRAPH_SP_APP")" "openid profile offline_access"

say "Email one-time code sign-in"
graph patch "$GRAPH/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/email" \
  '{"@odata.type":"#microsoft.graph.emailAuthenticationMethodConfiguration","state":"enabled","allowExternalIdToUseEmailOtp":"enabled"}' -o none || \
  echo "  (could not update the email OTP policy; it is usually enabled by default)"

FLOW_ID="$(graph get "$GRAPH_BETA/identity/authenticationEventsFlows" "" --query "value[?displayName=='Turnout sign in'].id | [0]" -o tsv)"
if [ -z "$FLOW_ID" ]; then
  FLOW_ID="$(graph post "$GRAPH_BETA/identity/authenticationEventsFlows" '{
    "@odata.type": "#microsoft.graph.externalUsersSelfServiceSignUpEventsFlow",
    "displayName": "Turnout sign in",
    "onInteractiveAuthFlowStart": { "@odata.type": "#microsoft.graph.onInteractiveAuthFlowStartExternalUsersSelfServiceSignUp", "isSignUpAllowed": true },
    "onAuthenticationMethodLoadStart": { "@odata.type": "#microsoft.graph.onAuthenticationMethodLoadStartExternalUsersSelfServiceSignUp",
      "identityProviders": [{ "id": "EmailOtpSignup-OAUTH" }] },
    "onAttributeCollection": { "@odata.type": "#microsoft.graph.onAttributeCollectionExternalUsersSelfServiceSignUp",
      "attributes": [{ "id": "displayName", "displayName": "Display Name", "dataType": "string", "userFlowAttributeType": "builtIn" }],
      "attributeCollectionPage": { "views": [{ "inputs": [{ "attribute": "displayName", "label": "Your name", "inputType": "text", "hidden": false, "editable": true, "required": true, "writeToDirectory": true, "validationRegEx": "^.*" }] }] } }
  }' --query id -o tsv)"
fi
LINKED="$(graph get "$GRAPH_BETA/identity/authenticationEventsFlows/$FLOW_ID/conditions/applications/includeApplications" "" --query "value[?appId=='$CLIENT_APP_ID'] | length(@)" -o tsv 2>/dev/null || echo 0)"
[ "$LINKED" = "1" ] || graph post "$GRAPH_BETA/identity/authenticationEventsFlows/$FLOW_ID/conditions/applications/includeApplications" \
  "{\"@odata.type\":\"#microsoft.graph.authenticationConditionApplication\",\"appId\":\"$CLIENT_APP_ID\"}" -o none
echo "User flow: $FLOW_ID"

AUTHORITY="https://$TENANT_NAME.ciamlogin.com/$TENANT_ID/v2.0"
API_SCOPE="api://$API_APP_ID/access"

say "Saving settings"
unset AZURE_CONFIG_DIR
touch "$ENV_FILE"
for kv in "ENTRA_AUTHORITY=$AUTHORITY" "ENTRA_API_CLIENT_ID=$API_APP_ID" "ENTRA_CLIENT_ID=$CLIENT_APP_ID" "ENTRA_API_SCOPE=$API_SCOPE"; do
  key="${kv%%=*}"
  grep -v "^$key=" "$ENV_FILE" > "$ENV_FILE.tmp" || true
  echo "$kv" >> "$ENV_FILE.tmp"
  mv "$ENV_FILE.tmp" "$ENV_FILE"
done
for env in test live; do
  gh variable set ENTRA_AUTHORITY -R "$REPO" -e "$env" -b "$AUTHORITY"
  gh variable set ENTRA_CLIENT_ID -R "$REPO" -e "$env" -b "$CLIENT_APP_ID"
  gh variable set ENTRA_API_SCOPE -R "$REPO" -e "$env" -b "$API_SCOPE"
done

cat <<OUT

Done. Saved to infra/.env.infra and the GitHub test/live environments.
Re-run ./infra/provision.sh so the API validates Entra tokens, then redeploy.
For local sign-in, add to apps/mobile/.env:
  EXPO_PUBLIC_ENTRA_AUTHORITY=$AUTHORITY
  EXPO_PUBLIC_ENTRA_CLIENT_ID=$CLIENT_APP_ID
  EXPO_PUBLIC_ENTRA_API_SCOPE=$API_SCOPE
and to apps/api/.env:
  ENTRA_AUTHORITY=$AUTHORITY
  ENTRA_API_CLIENT_ID=$API_APP_ID
OUT
