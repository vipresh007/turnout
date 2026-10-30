import { Archivo_800ExtraBold } from "@expo-google-fonts/archivo/800ExtraBold";
import { Archivo_900Black } from "@expo-google-fonts/archivo/900Black";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import Head from "expo-router/head";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import { NotificationRouter } from "@/components/NotificationRouter";
import { PlayerSync } from "@/components/PlayerSync";
import { AuthProvider } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

// A screen opened from a link (a group page, say) always has home underneath, so the back arrow
// leads to "Your games" for players, or the tabs for a signed-in organizer.
export const unstable_settings = { initialRouteName: "index" };

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const t = useTheme();
  // The display font (names, headcounts). Hold the splash until it's in so nothing re-flows; on a load error, carry on
  // with the system font rather than a blank screen.
  const [fontsReady, fontError] = useFonts({ Archivo_800ExtraBold, Archivo_900Black });
  useEffect(() => {
    if (fontsReady || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady, fontError]);
  if (!fontsReady && !fontError && Platform.OS !== "web") return null;
  return (
    <AuthProvider>
      {Platform.OS === "web" && (
        <Head>
          {/* Lets people add Turnout to their Home Screen, which iPhone requires for notifications. */}
          <link rel="manifest" href="/manifest.json" />
          <link rel="apple-touch-icon" href="/icon.png" />
          <meta name="theme-color" content="#16A34A" />
          {/* Inter for body text on the web (the app uses the phone's own font). React Native sets the system stack on
              each text node, so that needs !important; display text (the Display component in ui.tsx) marks itself with
              data-display and gets Archivo instead. */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400..900&display=swap" />
          <style>{`body, body *:not([data-display]):not([data-display] *) { font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; }
            [data-display], [data-display] * { font-family: "Archivo_800ExtraBold", "Inter", sans-serif !important; }
            [data-display="heavy"], [data-display="heavy"] * { font-family: "Archivo_900Black", "Inter", sans-serif !important; }
            body { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
            input::placeholder { opacity: 1; }`}</style>
        </Head>
      )}
      <StatusBar style="auto" />
      {Platform.OS !== "web" && <NotificationRouter />}
      <PlayerSync />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bg },
          title: "Turnout",
          // Just the arrow: the previous screen's title (e.g. the welcome page's long one) makes a huge back button.
          headerBackButtonDisplayMode: "minimal",
          // On the web the site header (components/SiteHeader) is the only header.
          headerShown: Platform.OS !== "web",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false, title: "Turnout: stop asking who's playing" }} />
        {/* Home, Groups, Activity, Account: a tab bar in the app, plain pages on the web. */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "Turnout" }} />
        <Stack.Screen name="new" options={{ title: "New group", presentation: "modal" }} />
        <Stack.Screen name="edit/[slug]" options={{ title: "Edit group", presentation: "modal" }} />
        <Stack.Screen name="g/[slug]" options={{ title: "", headerShown: Platform.OS !== "web" }} />
        {/* Sheets over the group page: the organizer's tools, and a player's reminder settings. */}
        <Stack.Screen name="manage/[slug]" options={{ title: "Manage", presentation: "formSheet", sheetAllowedDetents: [0.7, 1], sheetGrabberVisible: true, headerShown: false }} />
        <Stack.Screen name="remind/[slug]" options={{ title: "Reminders", presentation: "formSheet", sheetAllowedDetents: [0.55, 1], sheetGrabberVisible: true, headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ title: "" }} />
        <Stack.Screen name="stats" options={{ title: "Your stats" }} />
        <Stack.Screen name="email" options={{ title: "Email reminders" }} />
        <Stack.Screen name="restore" options={{ title: "New phone" }} />
        <Stack.Screen name="members/[slug]" options={{ title: "Members", presentation: "modal" }} />
        <Stack.Screen name="teams/[slug]" options={{ title: "Make teams", presentation: "modal" }} />
        <Stack.Screen name="schedule/[slug]" options={{ title: "Schedule", presentation: "modal" }} />
        <Stack.Screen name="insights/[slug]" options={{ title: "Insights", presentation: "modal" }} />
        <Stack.Screen name="history/[slug]" options={{ title: "History", presentation: "modal" }} />
        <Stack.Screen name="admin" options={{ title: "Metrics" }} />
        <Stack.Screen name="demo" options={{ title: "Demo" }} />
        <Stack.Screen name="feedback" options={{ title: "Suggest an improvement" }} />
        <Stack.Screen name="founding" options={{ title: "Founding organizers", headerShown: Platform.OS !== "web" }} />
        <Stack.Screen name="organizers/[slug]" options={{ title: "Organizers", presentation: "modal" }} />
        <Stack.Screen name="organize" options={{ title: "Help run a group" }} />
        <Stack.Screen name="privacy" options={{ title: "Privacy", headerShown: Platform.OS !== "web" }} />
        <Stack.Screen name="terms" options={{ title: "Terms", headerShown: Platform.OS !== "web" }} />
        <Stack.Screen name="support" options={{ title: "Support", headerShown: Platform.OS !== "web" }} />
        <Stack.Screen name="compare" options={{ title: "Compare", headerShown: Platform.OS !== "web" }} />
        <Stack.Screen name="for/[activity]" options={{ title: "", headerShown: Platform.OS !== "web" }} />
      </Stack>
    </AuthProvider>
  );
}
