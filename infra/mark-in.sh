#!/usr/bin/env bash
# One-off: mark everyone in an organizer's season group as in for this week, except the names given.
# Usage: ./infra/mark-in.sh <organizer email> <test|live> "<name to skip>[,<name>...]"
# Runs inside Azure (an ACR task using the deployed API image), so the database firewall stays closed.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
EMAIL="${1:?organizer email}"
ENV="${2:?test or live}"
SKIP="${3:-}"
case "$ENV" in test|live) ;; *) echo "env must be test or live" >&2; exit 1;; esac
set -a; . "$HERE/.env.infra"; set +a
RG=rg-turnout
ACR="$(az acr list -g "$RG" --query '[0].name' -o tsv)"
TAG="$(az containerapp show -g "$RG" -n ca-turnout-api-$ENV --query 'properties.template.containers[0].image' -o tsv | sed 's/.*://')"
IMAGE="$(az acr show -n "$ACR" --query loginServer -o tsv)/turnout-api:$TAG"
SERVER="$(az postgres flexible-server list -g "$RG" --query '[0].fullyQualifiedDomainName' -o tsv)"
DB="postgres://turnoutadmin:$(node -pe 'encodeURIComponent(process.env.POSTGRES_PASSWORD)')@$SERVER:5432/turnout_$ENV?sslmode=require"
az acr run -r "$ACR" -f mark-in.yaml --set IMAGE="$IMAGE" --set EMAIL="$EMAIL" --set SKIP="$SKIP" --set-secret DB="$DB" "$HERE/demo" 2>&1 | grep -E "marked|skipped|rror|Expected|No organizer" || true
