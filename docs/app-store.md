# App Store assets

## Screenshots

House style (as Tally's and Fullcrew's): a mono eyebrow and a display headline over the real app in a device frame, on the midnight ground. Made by `apps/mobile/scripts/store-screenshots.mjs` from the web app at phone size, so they always show the current design.

| Slot | Folder | Pixels |
|---|---|---|
| iPhone 6.9" | `docs/app-store-screenshots/iphone-6.9/` | 1320 × 2868 |
| iPhone 6.1"/6.3" | `docs/app-store-screenshots/iphone-6.3/` | 1206 × 2622 |

Regenerate after a design change:

1. Demo data on the local database (the API must be stopped while this runs; it uses the same PGlite folder):
   wipe the groups, then run `infra/demo/seed.ts` with its `/app/...` imports pointed at `apps/api/src` and the organizer lookup set to `external_id = 'dev:seed'`. Then start the API and rename the two groups without the " (demo)" suffix (`PATCH /groups/:slug` as `x-dev-user: seed`).
2. Start the dev-auth web: launch.json `web-local` (port 8082) and `api` (port 4000).
3. `node scripts/store-screenshots.mjs capture` (in apps/mobile), then `node scripts/store-screenshots.mjs compose`.

The capture claims two demo regulars (Carlos in soccer, Mike in basketball) as the device's memberships, so the player slides show a real record and badges. Upload the composed PNGs to App Store Connect → the version → App Previews and Screenshots; the file name carries the size so the Asset Library matches them.

## Slides

1. One link: the player's group page, in and roster.
2. Your week: organizer Home with the next game and the calendar.
3. Autopilot: the organizer's group page with the manage bar and forecast.
4. Insights: the Insights tab.
5. For players: the Play home with record and badges.
