# Turnout

Replace the messy group chat for any recurring gathering with limited spots. The organizer sets up the group once and shares one link. Every week, members tap **I'm in** or **I'm out**.

## Layout

| Path | What |
| --- | --- |
| `apps/mobile` | Expo (React Native) app for iPhone, Android, and web, using Expo Router |
| `apps/api` | Node.js API (Fastify), deployed to Azure Container Apps |
| `packages/shared` | Domain logic and schemas shared by both: roster/waitlist, zod validation |

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

## Roadmap

1. **V1**: groups, weekly in/out, cap, waitlist, share link, one-sentence AI setup ✅ (in progress, see TODOs below)
2. **V2**: reminders, team maker, paid/not-paid tracking
3. **V3**: Stripe payments, non-sports templates, paid organizer plan
4. **V4**: venue pages

### Open TODOs for V1
- [ ] Organizer sign-in with Microsoft Entra External ID (the API currently accepts `x-dev-user` when `ALLOW_DEV_AUTH=true`)
- [ ] Live updates via Azure Web PubSub (the app polls every 10s for now)
- [ ] Push notification when promoted off the waitlist (`apps/api/src/events.ts`)
- [ ] Organizer controls: edit group, cancel a week, remove a member
- [ ] Rate limiting on public endpoints (join / RSVP)
- [ ] Dockerfile, Azure infra (Bicep), and GitHub Actions for test and live environments
