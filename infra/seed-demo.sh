#!/usr/bin/env bash
# Two demo groups with ~3 months of history for one organizer, for trying out stats and insights.
# Usage: ./infra/seed-demo.sh <organizer email>   (test only; re-running replaces the previous demo groups)
# Runs inside Azure (an ACR task using the deployed API image), so the database firewall stays closed.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
EMAIL="${1:?organizer email}"
set -a; . "$HERE/.env.infra"; set +a
RG=rg-turnout
ACR="$(az acr list -g "$RG" --query '[0].name' -o tsv)"
TAG="$(az containerapp show -g "$RG" -n ca-turnout-api-test --query 'properties.template.containers[0].image' -o tsv | sed 's/.*://')"
IMAGE="$(az acr show -n "$ACR" --query loginServer -o tsv)/turnout-api:$TAG"
SERVER="$(az postgres flexible-server list -g "$RG" --query '[0].fullyQualifiedDomainName' -o tsv)"
DB="postgres://turnoutadmin:$(node -pe 'encodeURIComponent(process.env.POSTGRES_PASSWORD)')@$SERVER:5432/turnout_test?sslmode=require"
az acr run -r "$ACR" -f seed.yaml --set IMAGE="$IMAGE" --set EMAIL="$EMAIL" --set-secret DB="$DB" "$HERE/demo" 2>&1 | grep -E "removed|demo\)|rror|No organizer" || true
