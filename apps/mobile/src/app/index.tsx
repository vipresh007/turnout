import { Redirect } from "expo-router";
import { Platform } from "react-native";
import { AppWelcome } from "@/components/AppWelcome";
import { Landing } from "@/components/Landing";
import { useAuth } from "@/lib/auth";

// The web root is the public landing page. The app shows a welcome screen when signed out,
// and goes straight to your groups once you're signed in.
export default function Index() {
  const { status } = useAuth();
  if (Platform.OS === "web") return <Landing />;
  if (status === "signedIn") return <Redirect href="/dashboard" />;
  return status === "loading" ? null : <AppWelcome />;
}
