import { buildRoster, type Rsvp } from "@turnout/shared";
import { router } from "expo-router";
import Head from "expo-router/head";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useAuth } from "@/lib/auth";
import { useTheme, type Theme } from "@/lib/theme";

const steps = [
  { n: "1", title: "Describe your game", body: "“Tuesday soccer at Riverside, 7:30pm, 14 players.” Turnout sets up the group from that one sentence." },
  { n: "2", title: "Share one link", body: "Drop it in the group chat once. Players open it, type their name, and never need an account." },
  { n: "3", title: "Everyone taps in or out", body: "The headcount updates live. When it's full, a waitlist forms and moves people up automatically." },
];

const features = [
  { title: "Live headcount", body: "Everyone sees who's in the moment it changes. No more scrolling a chat to count names." },
  { title: "Waitlist that runs itself", body: "Set a cap. When someone drops, the next person moves up without anyone doing a thing." },
  { title: "No app for players", body: "Players tap a link in any browser. Only the organizer signs in." },
  { title: "“We need 2 more”", body: "Short a few players? Share a ready-made message with the live count and a link to join." },
  { title: "Organizer controls", body: "Cancel a week, change the cap, remove someone. Everyone's page updates instantly." },
  { title: "Reminders & teams", body: "Coming soon: game-day reminders, balanced teams, and tracking who's paid." },
];

const uses = ["Pickup soccer", "Basketball runs", "Volleyball", "Run clubs", "Poker nights", "Yoga classes", "Volunteer shifts", "Board game nights"];

const demoNames = ["Maya", "Jordan", "Priya", "Sam", "Luis", "Aisha", "Chen"];

export function Landing() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const s = styles(t);
  const { status } = useAuth();
  const start = () => router.push(status === "signedIn" ? "/new" : "/dashboard");

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ alignItems: "center" }}>
      <Head>
        <title>Turnout: who's in this week?</title>
        <meta name="description" content="One link for your weekly game. Players tap in or out, the headcount updates live, and the waitlist runs itself. Free for organizers." />
      </Head>

      {/* Nav */}
      <View style={[s.section, s.nav]}>
        <Text style={s.logo}>
          turnout<Text style={{ color: t.accent }}>.</Text>
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable accessibilityRole="link" onPress={() => router.push("/dashboard")} style={s.navLink}>
            <Text style={{ color: t.text, fontWeight: "600" }}>{status === "signedIn" ? "Your groups" : "Sign in"}</Text>
          </Pressable>
        </View>
      </View>

      {/* Hero */}
      <View style={[s.section, { flexDirection: wide ? "row" : "column", gap: 48, alignItems: "center", paddingTop: wide ? 56 : 24, paddingBottom: 56 }]}>
        <View style={{ flex: wide ? 1.1 : undefined, gap: 20 }}>
          <Text style={[s.eyebrow]}>For pickup games, clubs & anything weekly</Text>
          <Text style={[s.h1, { fontSize: wide ? 64 : 42, lineHeight: wide ? 68 : 46 }]}>Who's in{"\n"}this week?</Text>
          <Text style={s.lead}>
            Turnout replaces the group-chat headcount. Share one link, everyone taps <Text style={{ fontWeight: "700", color: t.text }}>I'm in</Text> or{" "}
            <Text style={{ fontWeight: "700", color: t.text }}>I'm out</Text>, and the waitlist runs itself.
          </Text>
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            <CTA label="Start a group, it's free" onPress={start} />
          </View>
          <Text style={{ color: t.muted, fontSize: 14 }}>Set up in under a minute. Players don't need an account.</Text>
        </View>
        <View style={{ flex: wide ? 0.9 : undefined, width: wide ? undefined : "100%", alignItems: "center" }}>
          <DemoCard />
        </View>
      </View>

      {/* How it works */}
      <View style={[s.band, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={[s.section, { gap: 32, paddingVertical: 64 }]}>
          <Text style={s.h2}>How it works</Text>
          <View style={{ flexDirection: wide ? "row" : "column", gap: 24 }}>
            {steps.map((step) => (
              <View key={step.n} style={{ flex: 1, gap: 10 }}>
                <View style={s.stepBadge}>
                  <Text style={{ color: t.accentText, fontWeight: "800" }}>{step.n}</Text>
                </View>
                <Text style={s.h3}>{step.title}</Text>
                <Text style={s.body}>{step.body}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Features */}
      <View style={[s.section, { gap: 32, paddingVertical: 64 }]}>
        <Text style={s.h2}>Everything the group chat can't do</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          {features.map((f) => (
            <View key={f.title} style={[s.feature, { flexBasis: wide ? "31%" : "100%" }]}>
              <Text style={s.h3}>{f.title}</Text>
              <Text style={s.body}>{f.body}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Uses */}
      <View style={[s.section, { gap: 20, paddingBottom: 64 }]}>
        <Text style={s.h2}>Not just sports</Text>
        <Text style={s.lead}>If it happens every week and has limited spots, Turnout keeps the count.</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {uses.map((u) => (
            <View key={u} style={s.chip}>
              <Text style={{ color: t.text, fontWeight: "600" }}>{u}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Final CTA */}
      <View style={[s.band, { backgroundColor: t.soft, borderColor: t.border }]}>
        <View style={[s.section, { alignItems: "center", gap: 16, paddingVertical: 72 }]}>
          <Text style={[s.h2, { textAlign: "center" }]}>Your next game, sorted in one link.</Text>
          <Text style={[s.lead, { textAlign: "center" }]}>Free for organizers. No app needed for players.</Text>
          <CTA label="Start a group" onPress={start} />
        </View>
      </View>

      <View style={[s.section, { paddingVertical: 32, flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }]}>
        <Text style={{ color: t.muted }}>© {new Date().getFullYear()} Turnout</Text>
        <Text style={{ color: t.muted }}>Made for people who organize the game.</Text>
      </View>
    </ScrollView>
  );
}

function CTA({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        backgroundColor: t.accent, paddingVertical: 16, paddingHorizontal: 24, borderRadius: 14,
        opacity: pressed ? 0.85 : 1, transform: [{ translateY: hovered ? -1 : 0 }],
      })}
    >
      <Text style={{ color: t.accentText, fontSize: 17, fontWeight: "800" }}>{label} →</Text>
    </Pressable>
  );
}

/** A working mini group page, so visitors can feel the product before signing up. */
function DemoCard() {
  const t = useTheme();
  const s = styles(t);
  const cap = 8;
  const [youIn, setYouIn] = useState<boolean | null>(null);
  const base: Rsvp[] = demoNames.map((name, i) => ({
    memberId: name, name, status: "in", respondedAt: new Date(Date.UTC(2026, 0, 1, 12, i)).toISOString(),
  }));
  const rsvps = youIn === null ? base : [...base, { memberId: "you", name: "You", status: youIn ? "in" : "out", respondedAt: new Date(Date.UTC(2026, 0, 1, 13)).toISOString() } as Rsvp];
  const roster = buildRoster(rsvps, cap);

  return (
    <View style={[s.demo]}>
      <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" }}>Try it</Text>
      <Text style={{ color: t.text, fontSize: 22, fontWeight: "800" }}>Tuesday Soccer</Text>
      <Text style={{ color: t.muted }}>Tue 7:30 PM · Riverside Park</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 8 }}>
        <Text style={{ color: t.text, fontSize: 48, fontWeight: "800", letterSpacing: -2 }}>{roster.confirmed.length}</Text>
        <Text style={{ color: t.muted, fontSize: 20, fontWeight: "600" }}>/ {cap} in</Text>
      </View>
      <Text style={{ color: roster.spotsLeft ? t.muted : t.accent, fontWeight: "600" }}>
        {roster.spotsLeft ? `${roster.spotsLeft} spot left` : youIn ? "You got the last spot 🎉" : "Full"}
      </Text>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
        <DemoButton label="I'm in" primary active={youIn === true} onPress={() => setYouIn(true)} />
        <DemoButton label="I'm out" active={youIn === false} onPress={() => setYouIn(false)} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {roster.confirmed.map((r) => (
          <View key={r.memberId} style={[s.chip, r.memberId === "you" && { borderColor: t.accent, backgroundColor: t.soft }, { paddingVertical: 4, paddingHorizontal: 10 }]}>
            <Text style={{ color: r.memberId === "you" ? t.accent : t.text, fontSize: 13, fontWeight: "600" }}>{r.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function DemoButton({ label, primary, active, onPress }: { label: string; primary?: boolean; active: boolean; onPress: () => void }) {
  const t = useTheme();
  const filled = primary ? true : active;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 12, borderWidth: 1,
        backgroundColor: primary ? t.accent : filled ? t.text : t.card,
        borderColor: primary ? t.accent : t.border,
        opacity: primary && active ? 0.6 : 1,
      }}
    >
      <Text style={{ color: primary ? t.accentText : filled ? t.bg : t.text, fontWeight: "800", fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    section: { width: "100%", maxWidth: 1120, paddingHorizontal: 20 },
    band: { width: "100%", alignItems: "center", borderTopWidth: 1, borderBottomWidth: 1 },
    nav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 20 },
    logo: { color: t.text, fontSize: 24, fontWeight: "900", letterSpacing: -1 },
    navLink: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: t.border },
    eyebrow: { color: t.accent, fontWeight: "700", fontSize: 14, letterSpacing: 0.3, textTransform: "uppercase" },
    h1: { color: t.text, fontWeight: "900", letterSpacing: -2 },
    h2: { color: t.text, fontSize: 32, fontWeight: "800", letterSpacing: -1 },
    h3: { color: t.text, fontSize: 18, fontWeight: "700" },
    lead: { color: t.muted, fontSize: 19, lineHeight: 28, maxWidth: 560 },
    body: { color: t.muted, fontSize: 16, lineHeight: 23 },
    stepBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" },
    feature: { backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 16, padding: 20, gap: 8, flexGrow: 1 },
    chip: { borderWidth: 1, borderColor: t.border, backgroundColor: t.card, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
    demo: {
      width: "100%", maxWidth: 400, backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 24, padding: 24, gap: 4,
      shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 30, shadowOffset: { width: 0, height: 12 },
    },
  });
