#!/usr/bin/env bash
# Finish moving Turnout's email to "Turnout <noreply@dataeaver.ca>" once the domain's DNS records verify in ACS.
#   ./infra/switch-email-sender.sh test|live|both
# Needs CUSTOM_EMAIL_DOMAIN (and optionally EMAIL_SENDER_USERNAME) in infra/.env.infra.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a; . "$HERE/.env.infra"; set +a
RG="${RESOURCE_GROUP:-rg-turnout}"
DOMAIN="${CUSTOM_EMAIL_DOMAIN:?set CUSTOM_EMAIL_DOMAIN in infra/.env.infra}"
USER_PART="${EMAIL_SENDER_USERNAME:-noreply}"
TARGETS="${1:-test}"; [ "$TARGETS" = both ] && TARGETS="test live"
ECS="$(az resource list -g "$RG" --resource-type Microsoft.Communication/emailServices --query '[0].name' -o tsv)"
ACS="$(az resource list -g "$RG" --resource-type Microsoft.Communication/CommunicationServices --query '[0].name' -o tsv)"

echo "Checking DNS verification for $DOMAIN…"
for t in Domain SPF DKIM DKIM2; do az communication email domain initiate-verification -g "$RG" --email-service-name "$ECS" --domain-name "$DOMAIN" --verification-type "$t" -o none 2>/dev/null || true; done
sleep 20
STATES="$(az communication email domain show -g "$RG" --email-service-name "$ECS" --domain-name "$DOMAIN" --query 'verificationStates.{Domain:Domain.status,SPF:SPF.status,DKIM:DKIM.status,DKIM2:DKIM2.status}' -o tsv)"
echo "Domain SPF DKIM DKIM2: $STATES"
[ "$(echo "$STATES" | tr '\t' '\n' | grep -vc Verified)" = 0 ] || { echo "Not all verified yet. Check the DNS records (see infra/README.md) and run this again."; exit 1; }

BASE="$(az resource show -g "$RG" -n "$ECS" --resource-type Microsoft.Communication/emailServices --query id -o tsv)/domains"
az communication update -g "$RG" -n "$ACS" --linked-domains "$BASE/AzureManagedDomain" "$BASE/$DOMAIN" -o none
for env in $TARGETS; do
  az containerapp update -g "$RG" -n "ca-turnout-api-$env" --set-env-vars "EMAIL_SENDER=$USER_PART@$DOMAIN" -o none
  az containerapp job update -g "$RG" -n "caj-turnout-reminders-$env" --set-env-vars "EMAIL_SENDER=$USER_PART@$DOMAIN" -o none 2>/dev/null || true
  echo "$env now sends as Turnout <$USER_PART@$DOMAIN>"
done
