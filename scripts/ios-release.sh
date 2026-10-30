#!/usr/bin/env bash
# Build the iPhone app on this Mac and upload it to TestFlight, without Expo's build or submit servers.
#   ./scripts/ios-release.sh            build + upload
#   ./scripts/ios-release.sh upload <file.ipa>   upload an .ipa you already have
# Needs Xcode, and ASC_KEY_ID / ASC_ISSUER_ID in infra/.env.infra with the key at infra/AuthKey_<ID>.p8
# (App Store Connect → Users and Access → Integrations → Team Keys, role App Manager).
# The build step still fetches the signing certificate from EAS (free, instant); it never uses a cloud build credit.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source infra/.env.infra; set +a
: "${ASC_KEY_ID:?ASC_KEY_ID missing in infra/.env.infra}" "${ASC_ISSUER_ID:?ASC_ISSUER_ID missing in infra/.env.infra}"
KEY="infra/AuthKey_${ASC_KEY_ID}.p8"
[ -f "$KEY" ] || { echo "Missing $KEY" >&2; exit 1; }

if [ "${1:-}" = "upload" ]; then
  IPA="${2:?usage: ios-release.sh upload <file.ipa>}"
else
  VERSION=$(node -p "require('./apps/mobile/app.json').expo.version")
  IPA="apps/mobile/turnout-${VERSION}.ipa"
  (cd apps/mobile && npx --yes eas-cli@latest build -p ios --profile production --local --output "turnout-${VERSION}.ipa" --non-interactive)
fi

# altool looks for the key in one of a few folders; point it at ours.
export API_PRIVATE_KEYS_DIR="$(pwd)/infra"
xcrun altool --validate-app -f "$IPA" -t ios --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"
xcrun altool --upload-app -f "$IPA" -t ios --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"
echo "Uploaded $IPA. Apple processes it in 5–30 minutes, then it shows in TestFlight."
