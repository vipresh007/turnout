import { Redirect, router, Slot, Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, Text } from "react-native";
import { Icon } from "@/components/Icon";
import { AccountIcon, GroupsIcon, InsightsIcon, HomeIcon } from "@/components/TabIcons";
import { memberships, onMembershipsChanged } from "@/lib/api";
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
  // The Play tab only exists when this phone plays in a group somewhere.
  const [plays, setPlays] = useState(false);
  useEffect(() => {
    const check = () => memberships.slugs().then((s) => setPlays(s.length > 0));
    check();
    return onMembershipsChanged(() => void check());
  }, []);
  if (Platform.OS === "web") return <Slot />;
  if (status === "loading") return null;
  if (status !== "signedIn") return <Redirect href="/" />;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.cardSolid, borderTopColor: t.border },
        headerTitleStyle: { fontWeight: "600" },
        tabBarLabelStyle: { fontWeight: "700" },
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.text,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Home", headerTitle: "Turnout", headerRight: NewGroupButton, tabBarIcon: ({ color }) => <HomeIcon color={color} /> }} />
      <Tabs.Screen name="play" options={{ title: "Play", href: plays ? undefined : null, tabBarIcon: ({ color }) => <GroupsIcon color={color} /> }} />
      <Tabs.Screen name="insights" options={{ title: "Insights", tabBarIcon: ({ color }) => <InsightsIcon color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: ({ color }) => <AccountIcon color={color} /> }} />
      {/* Old URL, kept as a redirect; not a tab. */}
      <Tabs.Screen name="activity" options={{ href: null }} />
    </Tabs>
  );
}

/** "+ New" in the top bar of Home. */
function NewGroupButton() {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="New group"
      onPress={() => router.push("/new")}
      hitSlop={8}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, marginRight: 16, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: t.accent, opacity: pressed ? 0.8 : 1 })}
    >
      <Icon name="plus" size={16} color={t.accentText} strokeWidth={2.6} />
      <Text style={{ color: t.accentText, fontWeight: "800", fontSize: 15 }}>New</Text>
    </Pressable>
  );
}
