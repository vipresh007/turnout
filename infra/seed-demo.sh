#!/usr/bin/env bash
# Two demo groups with ~3 months of history for one organizer, for trying out stats and insights.
# Usage: ./infra/seed-demo.sh <organizer email> [test|live] [remove]   (default test; re-running replaces the previous demo groups;
# `remove` deletes that organizer's "(demo)" groups and adds nothing)
# Runs inside Azure (an ACR task using the deployed API image), so the database firewall stays closed.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
EMAIL="${1:?organizer email}"
ENV="${2:-test}"
MODE="${3:-seed}"
case "$ENV" in test|live) ;; *) echo "env must be test or live" >&2; exit 1;; esac
set -a; . "$HERE/.env.infra"; set +a
RG=rg-turnout
ACR="$(az acr list -g "$RG" --query '[0].name' -o tsv)"
TAG="$(az containerapp show -g "$RG" -n ca-turnout-api-$ENV --query 'properties.template.containers[0].image' -o tsv | sed 's/.*://')"
IMAGE="$(az acr show -n "$ACR" --query loginServer -o tsv)/turnout-api:$TAG"
SERVER="$(az postgres flexible-server list -g "$RG" --query '[0].fullyQualifiedDomainName' -o tsv)"
DB="postgres://turnoutadmin:$(node -pe 'encodeURIComponent(process.env.POSTGRES_PASSWORD)')@$SERVER:5432/turnout_$ENV?sslmode=require"
az acr run -r "$ACR" -f seed.yaml --set IMAGE="$IMAGE" --set EMAIL="$EMAIL" --set MODE="$MODE" --set-secret DB="$DB" "$HERE/demo" 2>&1 | grep -E "removed|demo\)|rror|No organizer" || true
