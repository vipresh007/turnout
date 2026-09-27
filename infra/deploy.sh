#!/usr/bin/env bash
# Deploy from this machine: the same steps as .github/workflows/deploy.yml. Use it when GitHub
# Actions isn't available. Runs the checks first.
#   ./infra/deploy.sh test
#   CONFIRM_LIVE=yes ./infra/deploy.sh live
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
ENV_FILE="$HERE/.env.infra"
[ -f "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; }
TARGET="${1:?usage: deploy.sh test|live}"
[ "$TARGET" = "live" ] && [ "${CONFIRM_LIVE:-}" != "yes" ] && { echo "Refusing to deploy live without CONFIRM_LIVE=yes"; exit 1; }
RG="${RESOURCE_GROUP:-rg-turnout}"
REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
cd "$ROOT"
[ -z "$(git status --porcelain)" ] || { echo "Commit your changes first (the image is tagged with the commit)"; exit 1; }
IMAGE_TAG="$(git rev-parse HEAD)"
say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

say "Checks"
npm test >/dev/null && npm run typecheck >/dev/null && npm run lint -w @turnout/mobile >/dev/null && echo "tests, typecheck, lint: ok"

ACR="$(az acr list -g "$RG" --query '[0].name' -o tsv)"
IMAGE="$(az acr show -n "$ACR" --query loginServer -o tsv)/turnout-api:$IMAGE_TAG"
API_URL="https://$(az containerapp show -g "$RG" -n "ca-turnout-api-$TARGET" --query properties.configuration.ingress.fqdn -o tsv)"
WEB_URL="$(gh variable get WEB_URL -R "$REPO" -e "$TARGET" 2>/dev/null || true)"
[ -n "$WEB_URL" ] || WEB_URL="https://$(az staticwebapp show -g "$RG" -n "swa-turnout-$TARGET" --query defaultHostname -o tsv)"

say "API image $IMAGE_TAG"
if az acr repository show -n "$ACR" --image "turnout-api:$IMAGE_TAG" -o none 2>/dev/null; then echo "reusing"; else az acr build -r "$ACR" -t "turnout-api:$IMAGE_TAG" -f apps/api/Dockerfile . --no-logs -o none; fi

say "Deploy API"
az containerapp ingress update -g "$RG" -n "ca-turnout-api-$TARGET" --target-port 8080 -o none
az containerapp update -g "$RG" -n "ca-turnout-api-$TARGET" --image "$IMAGE" --set-env-vars "APP_VERSION=$IMAGE_TAG" -o none
if az containerapp job show -g "$RG" -n "caj-turnout-reminders-$TARGET" -o none 2>/dev/null; then
  az containerapp job update -g "$RG" -n "caj-turnout-reminders-$TARGET" --image "$IMAGE" -o none
fi
for i in $(seq 1 30); do curl -fsS "$API_URL/health" >/dev/null 2>&1 && break; sleep 10; done
curl -fsS "$API_URL/health" && echo

say "Build and deploy web"
cd apps/mobile
EXPO_PUBLIC_API_URL="$API_URL" EXPO_PUBLIC_WEB_URL="$WEB_URL" \
EXPO_PUBLIC_ENTRA_AUTHORITY="$(gh variable get ENTRA_AUTHORITY -R "$REPO" -e "$TARGET")" \
EXPO_PUBLIC_ENTRA_CLIENT_ID="$(gh variable get ENTRA_CLIENT_ID -R "$REPO" -e "$TARGET")" \
EXPO_PUBLIC_ENTRA_API_SCOPE="$(gh variable get ENTRA_API_SCOPE -R "$REPO" -e "$TARGET")" \
EXPO_PUBLIC_ENTRA_PROVIDERS="$(gh variable get ENTRA_PROVIDERS -R "$REPO" -e "$TARGET" 2>/dev/null || true)" \
  npx expo export -p web --clear >/dev/null
# Variables set here take precedence over apps/mobile/.env (Expo never overrides the shell).
node scripts/add-meta.mjs dist "$API_URL" "$WEB_URL"
TOKEN="$(az staticwebapp secrets list -g "$RG" -n "swa-turnout-$TARGET" --query properties.apiKey -o tsv)"
# The Static Web Apps uploader is x86-only; run it in a Linux container on the registry instead
# (works from Apple Silicon without Rosetta). The token goes in as a secret, never on a command line.
CTX="$(mktemp -d)"
cp -R dist api public/staticwebapp.config.json "$CTX/"
cat > "$CTX/swa-deploy.yaml" <<'YAML'
version: v1.1.0
steps:
  - cmd: node:20 sh -c "npx --yes @azure/static-web-apps-cli@2 deploy dist --api-location api --api-language node --api-version 20 --env production"
    env: ["SWA_CLI_DEPLOYMENT_TOKEN={{.Secrets.TOKEN}}"]
    timeout: 900
YAML
az acr run -r "$ACR" -f swa-deploy.yaml --set-secret "TOKEN=$TOKEN" "$CTX" 2>&1 | grep -E "Project deployed|Deployment Failed|error" || true
rm -rf "$CTX"
echo "Deployed $IMAGE_TAG to $TARGET: $WEB_URL"
