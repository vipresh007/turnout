import { Redirect, Slot, Tabs } from "expo-router";
import { Platform } from "react-native";
import { AccountIcon, InsightsIcon, GroupsIcon, HomeIcon } from "@/components/TabIcons";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

/**
 * The organizer's main screens. In the app they sit under a bottom tab bar; on the web the site header
 * (components/SiteHeader) does that job, so the pages render on their own with the same URLs.
 * Signed out in the app, the tabs aren't shown at all: the welcome screen leads to sign-in.
 */
export default function TabsLayout() {
  const t = useTheme();
  const { status } = useAuth();
  if (Platform.OS === "web") return <Slot />;
  if (status === "loading") return null;
  if (status !== "signedIn") return <Redirect href="/" />;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.text,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Home", headerTitle: "Turnout", tabBarIcon: ({ color }) => <HomeIcon color={color} /> }} />
      <Tabs.Screen name="groups" options={{ title: "Groups", tabBarIcon: ({ color }) => <GroupsIcon color={color} /> }} />
      <Tabs.Screen name="activity" options={{ title: "Insights", tabBarIcon: ({ color }) => <InsightsIcon color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: ({ color }) => <AccountIcon color={color} /> }} />
    </Tabs>
  );
}
