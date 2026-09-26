# Turnout

Replace the messy group chat for any recurring gathering with limited spots. The organizer sets up the group once and shares one link. Every week, members tap **I'm in** or **I'm out**.

## Layout

| Path | What |
| --- | --- |
| `apps/mobile` | Expo (React Native) app for iPhone, Android, and web, using Expo Router |
| `apps/api` | Node.js API (Fastify), deployed to Azure Container Apps |
| `packages/shared` | Domain logic and schemas shared by both: roster/waitlist, zod validation |
| `infra` | Bicep + scripts for Azure (see [infra/README.md](infra/README.md)) |
| `.github/workflows` | CI on pull requests; deploy to **test** on push to `main`, to **live** on a `v*` tag |

## Run locally

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
npm run dev:api      # http://localhost:4000 (embedded PGlite, no database server needed)
npm run dev:mobile   # press w for web, i for iOS simulator
```

`npm test` runs every test and `npm run typecheck` checks every package.

## Key design decisions

- **The roster is derived, never stored.** Each RSVP records `status` and `responded_at`. The first `cap` people who said "in" are confirmed and the rest are waitlisted (`packages/shared/src/roster.ts`). Auto-promotion falls out of this, and `promotedMembers()` finds who moved up so we can notify them.
- **Sessions are created on demand.** A group has a weekly schedule (weekday, time, and IANA timezone). The "current" session is the next one that hasn't ended, created the first time someone opens the page. DST is handled by Luxon.
- **Members don't need accounts.** Joining returns a random token. The server stores only its SHA-256 hash, and the device keeps the token (SecureStore on native, localStorage on web).
- **Database.** Set `DATABASE_URL` for Postgres (Azure Database for PostgreSQL). Without it, the API runs PGlite in-process. Migrations are append-only SQL in `apps/api/src/db/migrations.ts`.
- **Node runs TypeScript directly** (type stripping), so there is no build step for the API or shared packages. Stick to erasable syntax: no `enum`, `namespace`, or parameter properties.

## Web routes

| Route | Who | What |
| --- | --- | --- |
| `/` | everyone | Landing page (web). The native app opens the dashboard instead. |
| `/g/:slug` | members | The group page: I'm in / I'm out, live roster, share. Organizer controls when signed in as the owner. |
| `/dashboard`, `/new`, `/edit/:slug` | organizers | Require sign-in (Entra External ID; a dev login locally). |

## Roadmap

1. **V1**: groups, weekly in/out, cap, waitlist, share link, one-sentence setup, organizer sign-in and controls, live updates, landing page, Azure + CI/CD ✅
2. **V2**: reminders + push notifications (including "you're in" when promoted), team maker, paid/not-paid tracking
3. **V3**: Stripe payments, non-sports templates, paid organizer plan
4. **V4**: venue pages

### Open items
- [ ] AI Services account (Azure's fraud check blocked creation; see infra/README.md). The rule-based parser runs meanwhile.
- [ ] Google and Apple sign-in in the External ID tenant (needs OAuth clients from Google/Apple developer consoles)
- [ ] Postgres on private networking before real traffic
- [ ] Custom domain
