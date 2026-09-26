import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "@/lib/theme";

export default function RootLayout() {
  const t = useTheme();
  return (
    <>
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
        <Stack.Screen name="new" options={{ title: "New group", presentation: "modal" }} />
        <Stack.Screen name="g/[slug]" options={{ title: "" }} />
      </Stack>
    </>
  );
}
