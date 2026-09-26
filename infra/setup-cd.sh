#!/usr/bin/env bash
# One-time: let GitHub Actions deploy to Azure with OIDC (no stored passwords).
#   ./infra/setup-cd.sh
# Creates an app registration in your Azure tenant with federated credentials for the repo's
# "test" and "live" GitHub environments, grants it Contributor on the resource group, creates the
# GitHub environments, and sets the repo secrets. Idempotent.
set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:-rg-turnout}"
APP_NAME="${OIDC_APP_NAME:-turnout-github-deploy}"
REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
SUB_ID="$(az account show --query id -o tsv)"
TENANT_ID="$(az account show --query tenantId -o tsv)"
echo "repo=$REPO  rg=$RESOURCE_GROUP  subscription=$SUB_ID"

APP_ID="$(az ad app list --display-name "$APP_NAME" --query '[0].appId' -o tsv)"
[ -n "$APP_ID" ] || APP_ID="$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)"
az ad sp show --id "$APP_ID" -o none 2>/dev/null || az ad sp create --id "$APP_ID" -o none
echo "deploy app: $APP_ID"

# GitHub's OIDC subject may embed owner/repo IDs; read the repo's actual prefix.
SUB_PREFIX="$(gh api "/repos/$REPO/actions/oidc/customization/sub" -q .sub_claim_prefix 2>/dev/null || true)"
[ -n "$SUB_PREFIX" ] || SUB_PREFIX="repo:$REPO"

for env in test live; do
  gh api -X PUT "/repos/$REPO/environments/$env" --silent
  name="gh-env-$env"
  old="$(az ad app federated-credential list --id "$APP_ID" --query "[?name=='$name'].id" -o tsv)"
  [ -n "$old" ] && az ad app federated-credential delete --id "$APP_ID" --federated-credential-id "$old" -o none
  az ad app federated-credential create --id "$APP_ID" --parameters "{
    \"name\": \"$name\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"$SUB_PREFIX:environment:$env\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }" -o none
  echo "federated credential: $SUB_PREFIX:environment:$env"
done

az role assignment create --assignee "$APP_ID" --role Contributor \
  --scope "/subscriptions/$SUB_ID/resourceGroups/$RESOURCE_GROUP" -o none 2>/dev/null || echo "(role assignment already exists)"

gh secret set AZURE_CLIENT_ID -R "$REPO" -b "$APP_ID"
gh secret set AZURE_TENANT_ID -R "$REPO" -b "$TENANT_ID"
gh secret set AZURE_SUBSCRIPTION_ID -R "$REPO" -b "$SUB_ID"
echo "Done. Push to main deploys to test; push a v* tag to deploy to live."
