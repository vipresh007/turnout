#!/usr/bin/env bash
# Ship a JS-only change to installed iPhone apps (EAS Update), no App Store review.
#   ./scripts/ota.sh "Fix roster layout"
# Only apps built with the same native code get it (runtimeVersion policy "fingerprint"); anything that changes
# native code (new module, SDK upgrade, app.json plugins/permissions) needs a new build instead.
# Undo a bad update: npx eas-cli@latest update:rollback
set -euo pipefail
cd "$(dirname "$0")/.."

MESSAGE="${1:?usage: scripts/ota.sh \"what changed\"}"
OUT=dist-ota

if [ -n "$(git status --porcelain)" ]; then
  echo "Commit your changes first, so the update matches what's in git." >&2
  exit 1
fi

# Production values from eas.json, exported so they win over the local .env (which points at dev/test).
eval "$(node -e '
const b = require("./eas.json").build;
for (const [k, v] of Object.entries({ ...b.base.env, ...b.production.env })) console.log(`export ${k}=${JSON.stringify(v)}`);
')"

rm -rf "$OUT"
npx expo export --platform ios --output-dir "$OUT"

# Refuse to ship a bundle without the live settings, or with the test ones (config.ts's localhost fallbacks stay in
# the bundle as dead strings, so they aren't a signal).
BUNDLE=$(find "$OUT/_expo/static/js/ios" -name '*.hbc' -o -name '*.js' | head -1)
if ! grep -aq "$EXPO_PUBLIC_API_URL" "$BUNDLE" || ! grep -aq "$EXPO_PUBLIC_WEB_URL" "$BUNDLE" \
  || grep -aEq "ca-turnout-api-test|turnout-test\.dataeaver" "$BUNDLE"; then
  echo "The bundle doesn't point at the live API; not publishing." >&2
  exit 1
fi

npx --yes eas-cli@latest update --channel production --environment production --message "$MESSAGE" \
  --skip-bundler --input-dir "$OUT" --platform ios --non-interactive
