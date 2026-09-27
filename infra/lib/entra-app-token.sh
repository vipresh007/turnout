# Sourced by infra scripts: an app-only Graph token for the Turnout tenant's setup app.
# Mints a 1-hour client secret on the setup app (using your az login to the tenant), trades it
# for a token, and never prints either. Sets TENANT_ID and TOKEN.
TENANT_ID="${ENTRA_TENANT_ID:-f4ca4cb4-8099-4717-a3e6-a4ef0acaa7ee}"
SETUP_APP_ID="${ENTRA_SETUP_APP_ID:-9974bccd-5d14-485c-91cb-47c8d75107f5}"
_end="$(date -u -v+1H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%SZ)"
_secret="$(AZURE_CONFIG_DIR="$HOME/.azure-turnout-ciam" az rest --method post \
  --url "https://graph.microsoft.com/v1.0/applications(appId='$SETUP_APP_ID')/addPassword" \
  --headers "Content-Type=application/json" \
  --body "{\"passwordCredential\":{\"displayName\":\"script $(date +%s)\",\"endDateTime\":\"$_end\"}}" --query secretText -o tsv)"
[ -n "$_secret" ] || { echo "Could not create a setup secret. Sign in: AZURE_CONFIG_DIR=~/.azure-turnout-ciam az login --tenant $TENANT_ID --allow-no-subscriptions"; exit 1; }
sleep 10 # new secrets take a moment to work
TOKEN="$(curl -s -X POST "https://login.microsoftonline.com/$TENANT_ID/oauth2/v2.0/token" \
  -d "client_id=$SETUP_APP_ID" --data-urlencode "client_secret=$_secret" \
  -d "scope=https://graph.microsoft.com/.default" -d "grant_type=client_credentials" \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).access_token || ""')"
unset _secret _end
[ -n "$TOKEN" ] || { echo "Could not get a Graph token for the setup app"; exit 1; }
