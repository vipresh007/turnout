# Turnout

Weekly in/out headcounts for recurring games. See README.md for layout, routes, and design decisions.

## Conventions
- TypeScript everywhere. API and `packages/shared` run on Node type stripping (no build): erasable syntax only, relative imports end in `.ts`.
- Domain rules (roster/waitlist, reminders timing, team balancing, message text) live in `packages/shared` as pure functions with tests.
- Mobile/web app: follow `apps/mobile/AGENTS.md` (Expo SDK 57 changes often; check versioned docs) and add deps with `npx expo install`.
- New DB changes: append a migration to `apps/api/src/db/migrations.ts` (never edit a shipped one).
- Before finishing: `npm test`, `npm run typecheck`, `npm run lint -w @turnout/mobile` from the repo root.

## Environments & deploys
- test: https://turnout-test.dataeaver.ca (push to `main`) · live: https://turnout.dataeaver.ca (push a `v*` tag, reuses the tested image). The user wants live released only at the very end of a batch of work.
- If GitHub Actions can't run (billing/spending limit), `./infra/deploy.sh test` does the same deploy from this machine (checks first; the web upload runs in an ACR Linux container because the SWA uploader is x86-only). Live needs `CONFIRM_LIVE=yes`.
- Test keeps one API replica warm (`apiMinReplicas`); live scales to zero until release (Entra's sign-in code call times out on cold starts).
- Everything is in resource group `rg-turnout` (canadacentral). `infra/provision.sh` applies `infra/*.bicep` and needs Owner, so it runs locally, never in CI. Don't run it while a deploy workflow is in progress (it reads the running images).
- Settings and secrets for provisioning live in `infra/.env.infra` (gitignored): Postgres password, VAPID keys, Entra IDs, custom domains, AI settings. Losing the VAPID keys invalidates every browser push subscription.
- GitHub environment variables (per env): `ENTRA_*`, `ENTRA_PROVIDERS`, `WEB_URL`. Secrets: `AZURE_CLIENT_ID/TENANT_ID/SUBSCRIPTION_ID` (OIDC).

## Auth
- Organizers: Microsoft Entra External ID tenant `turnoutapp` (id f4ca4cb4-8099-4717-a3e6-a4ef0acaa7ee). Providers: email one-time code + personal Microsoft accounts (custom OIDC). Google/Apple not yet.
- Graph calls in that tenant: `AZURE_CONFIG_DIR=~/.azure-turnout-ciam az rest ...`. The Azure CLI token lacks `IdentityProvider.ReadWrite.All` / policy scopes; the temporary app `turnout-setup-automation-temp` has app-only IdentityProvider + EventListener permissions (mint a short-lived secret when needed).
- Members have no accounts: a per-device token (`x-member-token`), stored hashed.
- Local dev without Entra: leave `EXPO_PUBLIC_ENTRA_AUTHORITY` empty; the API accepts `x-dev-user` when `ALLOW_DEV_AUTH=true`.

## Features worth knowing before changing them
- Schedules: `groups.weekdays[]` + `interval_weeks` + `starts_on`/`ends_on` (rules in `packages/shared/src/schedule.ts`). `sessions.starts_at` is the *scheduled* time and identifies the week; per-week `starts_at_override`, `location_override`, `note`, `cancelled`.
- Link previews: `/og/:slug.png` (API, resvg + fonts-inter in the Docker image) and the Static Web App function `apps/mobile/api/og-page` that serves `/g/*` with Open Graph tags (index.html copied in by `scripts/add-meta.mjs` at build).
- Members may have several devices (`member_tokens`); `/restore` links and organizer merge keep one person as one member.
- Sign-in codes are emailed by our API (`/auth-events/otp-send`, Entra custom email OTP provider; `infra/setup-otp-email.sh test|live` picks which API receives them).

## Known gotchas
- Azure's fraud check blocks new AI model deployments on this subscription (error 715-123420; support ticket filed 2026-09-26). The API currently borrows ai-receipt's `gpt-5-mini` via `AI_*` in `.env.infra`.
- Metro's file watcher often misses edits here: restart `expo start --clear` if the web app looks stale.
- Typed routes: `npm run typecheck` in apps/mobile regenerates `.expo/types` first; plain `tsc` can report stale route errors.
- Web tests in the browser pane: emulated viewports scale screenshots and break click coordinates; prefer `find` refs, and scroll RN-web ScrollViews via JS.
