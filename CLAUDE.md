# Turnout

See README.md for layout and design decisions. Conventions:

- TypeScript everywhere. The API and shared packages run on Node type stripping: use erasable syntax only and import relative files with `.ts` extensions.
- Domain rules (roster, waitlist, messages) belong in `packages/shared` as pure functions with tests.
- Mobile: follow `apps/mobile/AGENTS.md` (Expo SDK changes often, so check the versioned docs) and use `npx expo install` for dependencies.
- Before finishing: `npm test` and `npm run typecheck` from the repo root.
