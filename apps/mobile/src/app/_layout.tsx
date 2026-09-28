import { Stack } from "expo-router";
import Head from "expo-router/head";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
import { AuthProvider } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

export default function RootLayout() {
  const t = useTheme();
  return (
    <AuthProvider>
      {Platform.OS === "web" && (
        <Head>
          {/* Lets people add Turnout to their Home Screen, which iPhone requires for notifications. */}
          <link rel="manifest" href="/manifest.json" />
          <link rel="apple-touch-icon" href="/icon.png" />
          <meta name="theme-color" content="#16A34A" />
        </Head>
      )}
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bg },
          title: "Turnout",
          // On the web the site header (components/SiteHeader) is the only header.
          headerShown: Platform.OS !== "web",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false, title: "Turnout: stop asking who's playing" }} />
        {/* The dashboard has its own greeting header on web; native keeps the bar for safe-area spacing. */}
        <Stack.Screen name="dashboard" options={{ title: "Turnout", headerShown: Platform.OS !== "web" }} />
        <Stack.Screen name="new" options={{ title: "New group", presentation: "modal" }} />
        <Stack.Screen name="edit/[slug]" options={{ title: "Edit group", presentation: "modal" }} />
        <Stack.Screen name="g/[slug]" options={{ title: "", headerShown: Platform.OS !== "web" }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="email" options={{ title: "Email reminders" }} />
        <Stack.Screen name="restore" options={{ title: "New phone" }} />
        <Stack.Screen name="members/[slug]" options={{ title: "Members", presentation: "modal" }} />
        <Stack.Screen name="teams/[slug]" options={{ title: "Make teams", presentation: "modal" }} />
        <Stack.Screen name="schedule/[slug]" options={{ title: "Schedule", presentation: "modal" }} />
        <Stack.Screen name="insights/[slug]" options={{ title: "Insights", presentation: "modal" }} />
        <Stack.Screen name="history/[slug]" options={{ title: "History", presentation: "modal" }} />
        <Stack.Screen name="admin" options={{ title: "Metrics" }} />
        <Stack.Screen name="founding" options={{ title: "Founding organizers", headerShown: Platform.OS !== "web" }} />
        <Stack.Screen name="organizers/[slug]" options={{ title: "Organizers", presentation: "modal" }} />
        <Stack.Screen name="organize" options={{ title: "Help run a group" }} />
        <Stack.Screen name="privacy" options={{ title: "Privacy", headerShown: Platform.OS !== "web" }} />
        <Stack.Screen name="terms" options={{ title: "Terms", headerShown: Platform.OS !== "web" }} />
      </Stack>
    </AuthProvider>
  );
}
