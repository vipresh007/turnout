import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
import { AuthProvider } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

export default function RootLayout() {
  const t = useTheme();
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bg },
          title: "Turnout",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false, title: "Turnout: who's in this week?" }} />
        {/* The dashboard has its own greeting header on web; native keeps the bar for safe-area spacing. */}
        <Stack.Screen name="dashboard" options={{ title: "Turnout", headerShown: Platform.OS !== "web" }} />
        <Stack.Screen name="new" options={{ title: "New group", presentation: "modal" }} />
        <Stack.Screen name="edit/[slug]" options={{ title: "Edit group", presentation: "modal" }} />
        <Stack.Screen name="g/[slug]" options={{ title: "" }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
