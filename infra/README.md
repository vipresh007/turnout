# infra

Azure resources for Turnout, all in resource group `rg-turnout` (`canadacentral`).

| Resource | Shared / per env | SKU | ~Cost |
| --- | --- | --- | --- |
| PostgreSQL Flexible Server (DBs `turnout_test`, `turnout_live`) | shared | B1ms Burstable, 32 GB | ~$15/mo |
| Container Registry | shared | Basic | ~$5/mo |
| Container Apps environment + Log Analytics | shared | Consumption | usage |
| API container app `ca-turnout-api-<env>` | per env | 0.5 vCPU / 1 GiB, scales to zero | usage |
| Static Web App `swa-turnout-<env>` (Expo web build + landing page) | per env | Free | $0 |
| Web PubSub `wps-turnout-<env>-*` (live updates) | per env | Free (20 connections) | $0 |
| Application Insights `appi-turnout-<env>` | per env | pay per GB | small |
| Entra External ID tenant `turnoutapp` (organizer sign-in) | shared | first 50k MAU free | $0 |
| AI Services (optional, `CREATE_AI_ACCOUNT=true`) | shared | S0, `gpt-4.1-mini` | per token |
| Communication Services + Email (Azure-managed sender domain) | shared | pay per email | ~$0.25 / 1,000 |
| Reminder job `caj-turnout-reminders-<env>` (every 15 min, same image as the API) | per env | Consumption | cents/mo |

## Scripts (all idempotent)

| Script | When | What |
| --- | --- | --- |
| `./provision.sh` | on infra changes | Deploys `main.bicep`. Keeps the running API images. Needs Owner (it creates role assignments), so it runs locally, not in CI. |
| `./setup-cd.sh` | once | GitHub → Azure OIDC: deploy app, federated credentials for the `test`/`live` GitHub environments, Contributor on the RG, repo secrets. |
| `./setup-entra.sh` | once (and when web URLs change) | Configures the External ID tenant: app registrations, admin consent, email one-time-code sign-in flow. Saves settings to `.env.infra` and GitHub environment variables. |

Settings, the generated Postgres password and the browser-push (VAPID) keys live in `infra/.env.infra` (gitignored). Don't lose the VAPID keys: new ones invalidate every existing notification subscription. Losing it is harmless: `provision.sh` generates a new password and updates the server and apps together.

## Deploying

GitHub Actions (`.github/workflows/deploy.yml`):
- **Push to `main`** → CI checks → build the API image in ACR (`turnout-api:<sha>`) → update `ca-turnout-api-test` → build the web app → upload to `swa-turnout-test`.
- **Push a tag `v*`** → the same, to **live**, reusing the image built for that commit.
- **Actions → Deploy → Run workflow** deploys any branch to either environment.

## AI

Creating a new AI Services account was blocked by Azure's fraud check ("unusual activity") on 2026-09-26. Options:
- Retry later with `CREATE_AI_ACCOUNT=true ./provision.sh` (or open a support request).
- Point at an existing Azure OpenAI deployment: set `AI_ENDPOINT`, `AI_KEY`, `AI_DEPLOYMENT` in `.env.infra` and re-run `provision.sh`.

Until then, one-sentence setup uses the rule-based parser (`apps/api/src/ai/heuristic.ts`).

## Tear down

```bash
az group delete -n rg-turnout
```
This deletes everything, including the External ID tenant resource. Only do it on purpose.
