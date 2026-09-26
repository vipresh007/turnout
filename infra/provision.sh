#!/usr/bin/env bash
# Create or update all Turnout Azure resources (test + live). Idempotent: safe to re-run.
#   ./infra/provision.sh
# Needs: az CLI logged in as an Owner of the subscription (it creates role assignments).
# Settings and the generated Postgres password live in infra/.env.infra (gitignored).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$HERE/.env.infra"
[ -f "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; }

RESOURCE_GROUP="${RESOURCE_GROUP:-rg-turnout}"
LOCATION="${LOCATION:-canadacentral}"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

if [ -z "${POSTGRES_PASSWORD:-}" ]; then
  POSTGRES_PASSWORD="$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 32)"
  echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" >> "$ENV_FILE"
  echo "Generated a Postgres password and saved it to infra/.env.infra"
fi

if [ -z "${VAPID_PUBLIC_KEY:-}" ]; then
  KEYS="$(cd "$HERE/../apps/api" && node -e 'const w=require("web-push").generateVAPIDKeys(); console.log(w.publicKey + " " + w.privateKey)')"
  VAPID_PUBLIC_KEY="${KEYS% *}"; VAPID_PRIVATE_KEY="${KEYS#* }"
  printf 'VAPID_PUBLIC_KEY=%s\nVAPID_PRIVATE_KEY=%s\n' "$VAPID_PUBLIC_KEY" "$VAPID_PRIVATE_KEY" >> "$ENV_FILE"
  echo "Generated browser push (VAPID) keys and saved them to infra/.env.infra"
fi

say "Subscription"
az account show --query '{name:name, id:id}' -o table

say "Resource providers"
for p in Microsoft.Communication Microsoft.App Microsoft.ContainerRegistry Microsoft.DBforPostgreSQL Microsoft.CognitiveServices \
         Microsoft.SignalRService Microsoft.Web Microsoft.OperationalInsights Microsoft.Insights Microsoft.ManagedIdentity; do
  [ "$(az provider show -n "$p" --query registrationState -o tsv 2>/dev/null)" = "Registered" ] || az provider register -n "$p" --wait -o none
done

az group create -n "$RESOURCE_GROUP" -l "$LOCATION" --tags app=turnout -o none

# Keep whatever image each environment is running now.
current_image() { az containerapp show -g "$RESOURCE_GROUP" -n "ca-turnout-api-$1" --query 'properties.template.containers[0].image' -o tsv 2>/dev/null | grep -v quickstart || true; }
TEST_IMAGE="$(current_image test)"
LIVE_IMAGE="$(current_image live)"

say "Deploying infra/main.bicep (this takes ~10 minutes the first time)"
az deployment group create -g "$RESOURCE_GROUP" -n "turnout-$(date +%Y%m%d%H%M%S)" \
  --template-file "$HERE/main.bicep" \
  --parameters location="$LOCATION" postgresPassword="$POSTGRES_PASSWORD" \
               apiImages="{\"test\":\"$TEST_IMAGE\",\"live\":\"$LIVE_IMAGE\"}" \
               entra="{\"authority\":\"${ENTRA_AUTHORITY:-}\",\"apiClientId\":\"${ENTRA_API_CLIENT_ID:-}\"}" \
               webDomains="{\"test\":\"${TEST_WEB_DOMAIN:-}\",\"live\":\"${LIVE_WEB_DOMAIN:-}\"}" \
               vapidPublicKey="$VAPID_PUBLIC_KEY" vapidPrivateKey="$VAPID_PRIVATE_KEY" \
               createAiAccount="${CREATE_AI_ACCOUNT:-false}" \
               externalAi="{\"endpoint\":\"${AI_ENDPOINT:-}\",\"deployment\":\"${AI_DEPLOYMENT:-}\"}" \
               externalAiKey="${AI_KEY:-}" \
  --query properties.outputs -o json
