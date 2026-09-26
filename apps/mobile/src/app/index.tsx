import { Redirect } from "expo-router";
import { Platform } from "react-native";
import { Landing } from "@/components/Landing";

// The web root is the public landing page. The native app opens straight to the organizer's groups.
export default function Index() {
  return Platform.OS === "web" ? <Landing /> : <Redirect href="/dashboard" />;
}
