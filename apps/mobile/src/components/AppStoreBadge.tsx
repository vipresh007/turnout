import { Link } from "expo-router";
import { Image, Platform } from "react-native";
import { SITE } from "@/content/site";

// Apple's official "Download on the App Store" badge (public/app-store-badge.svg, unmodified as Apple requires),
// linking to the listing. Web only: inside the iPhone app it would point at itself.
export function AppStoreBadge({ height = 48 }: { height?: number }) {
  if (Platform.OS !== "web") return null;
  return (
    <Link href={SITE.appStoreUrl as `https://${string}`} target="_blank" rel="noopener" accessibilityLabel="Download Turnout on the App Store">
      <Image source={{ uri: "/app-store-badge.svg" }} style={{ height, width: height * (119.66407 / 40) }} accessibilityIgnoresInvertColors alt="Download on the App Store" />
    </Link>
  );
}
