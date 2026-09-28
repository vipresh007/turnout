import { buildRoster, type Rsvp } from "@turnout/shared";
import { Link, router } from "expo-router";
import Head from "expo-router/head";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, type ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { wakeApi } from "@/lib/api";
import { useTheme, type Theme } from "@/lib/theme";
import { Bump, Glow, Marquee, Pop, Pulse, Reveal, RevealScrollView } from "./motion";
import { SiteHeader } from "./SiteHeader";
import { webTransition } from "./ui";


const chat: { who: string; text: string; own?: boolean }[] = [
  { who: "Maya", text: "in" },
  { who: "Jordan", text: "+1" },
  { who: "Sam", text: "maybe? depends on work" },
  { who: "Priya", text: "wait how many do we have" },
  { who: "Luis", text: "who's bringing the ball 😅" },
  { who: "Jordan", text: "actually can't make it sorry" },
  { who: "You", text: "ok so that's… 9? 10?", own: true },
];

const steps = [
  { n: "1", title: "Describe your game", body: "“Tuesday soccer at Riverside, 7:30pm, 14 players.” One sentence and Turnout sets up the group." },
  { n: "2", title: "Share one link", body: "Drop it in the group chat once. Players tap it, type their name, done. No app, no account." },
  { n: "3", title: "Watch it fill up", body: "The headcount updates live. When it's full a waitlist forms, and people move up automatically." },
];

const features = [
  { icon: "⚡️", title: "Live headcount", body: "Everyone sees who's in the second it changes. No more counting thumbs-up emojis." },
  { icon: "🔁", title: "Self-running waitlist", body: "Set a cap. When someone drops, the next person moves up without you lifting a finger." },
  { icon: "🔗", title: "No app for players", body: "Players tap a link in any browser. Only the organizer signs in." },
  { icon: "📣", title: "“We need 2 more”", body: "Short on players? Share a ready-made message with the live count and a join link." },
  { icon: "⏰", title: "Reminders that land", body: "Players can turn on a game-day reminder by email or notification. Still no account, and one tap to stop." },
  { icon: "🤝", title: "Run it together", body: "Add co-organizers, split the court fee, track who's paid, make balanced teams, and see who you can count on." },
];

const uses = ["⚽️ Pickup soccer", "🏀 Basketball runs", "🏐 Volleyball", "🏃 Run clubs", "🃏 Poker nights", "🧘 Yoga classes", "🤝 Volunteer shifts", "🎲 Board game nights", "🏸 Badminton", "🥏 Ultimate", "🎾 Pickleball", "🏒 Shinny"];

const faqs = [
  { q: "Do players need to download an app or make an account?", a: "No. Players open the link in any browser, type their name once, and tap in or out. Only organizers sign in." },
  { q: "Is it free?", a: "Yes, everything is free right now, and players will always be free. We're planning an optional Organizer plan ($49/year founding price). You'll hear from us well before anything changes." },
  { q: "What happens when the game is full?", a: "New players join a waitlist. If someone drops out, the next person moves up automatically and gets a heads-up." },
  { q: "How do reminders work without an account?", a: "On the group page, players can ask for a reminder by email or turn on browser notifications. Every email has a one-tap stop link." },
  { q: "Can someone else help run the group?", a: "Yes. Invite co-organizers with a private link. They can remind, cancel or move a week, make teams, and mark payments." },
  { q: "Does Turnout collect money?", a: "No. You can set a cost per player or split a total, and tick off who's paid. The money itself goes however your group already pays." },
];

const demoNames = ["Maya", "Jordan", "Priya", "Sam", "Luis", "Aisha", "Chen"];

export function Landing() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const s = styles(t);
  const scrollRef = useRef<ScrollView>(null);
  const howY = useRef(0);
  const featuresY = useRef(0);
  const faqY = useRef(0);
  const pricingY = useRef(0);
  const scrollTo = (y: number) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
  // Signed out, /new asks for sign-in first and comes back to the form; "Sign in" goes to the dashboard.
  const start = () => router.push("/new");
  useEffect(() => wakeApi(), []); // most visitors head to sign-in next

  return (
    <RevealScrollView ref={scrollRef} style={{ backgroundColor: t.bg }} contentContainerStyle={{ alignItems: "center" }}>
      <Head>
        <title>Turnout: stop asking who's playing</title>
        <meta name="description" content="One link for your weekly game. Players tap I'm in. Turnout handles the count, the waitlist, reminders, dropouts and teams. Free for organizers." />
      </Head>

      {/* ── Hero ── */}
      <View style={s.heroWrap}>
        <Glow color={t.glowA} size={wide ? 720 : 460} style={{ top: -220, left: wide ? -120 : -200 }} />
        <Glow color={t.glowB} size={wide ? 620 : 380} style={{ top: 60, right: wide ? -140 : -220 }} duration={11000} drift={60} />
        <Glow color={t.glowC} size={wide ? 480 : 300} style={{ bottom: 0, left: "35%" }} duration={13000} drift={30} />

        <SiteHeader
          sections={[
            { label: "How it works", onPress: () => scrollTo(howY.current) },
            { label: "Features", onPress: () => scrollTo(featuresY.current) },
            { label: "Pricing", onPress: () => scrollTo(pricingY.current) },
            { label: "FAQ", onPress: () => scrollTo(faqY.current) },
          ]}
        />

        <View style={[s.section, { flexDirection: wide ? "row" : "column", gap: wide ? 56 : 40, alignItems: "center", paddingTop: wide ? 48 : 16, paddingBottom: wide ? 96 : 64 }]}>
          <View style={{ flex: wide ? 1.15 : undefined, gap: 22, width: wide ? undefined : "100%" }}>
            <Pop>
              <View style={s.pill}>
                <View style={s.pillDot} />
                <Text style={{ color: t.text, fontWeight: "600", fontSize: 13 }}>Free for organizers · No app for players</Text>
              </View>
            </Pop>
            <View>
              <Text role="heading" aria-level={1} style={[s.h1, { fontSize: wide ? 68 : 44, lineHeight: wide ? 74 : 50 }]}>
                Stop asking <Text style={{ color: t.accent }}>who's playing.</Text>
              </Text>
            </View>
            <Text style={s.lead}>
              One link for your weekly game. Players tap <Text style={s.leadStrong}>I'm in</Text>. Turnout handles the count, the waitlist,
              reminders, dropouts and teams.
            </Text>
            <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
              <CTA label="Start a group, it's free" onPress={start} />
              <CTA label="See how it works" secondary onPress={() => scrollRef.current?.scrollTo({ y: howY.current - 24, animated: true })} />
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
              {["No app for players", "Free for organizers", "Set up in a minute"].map((x) => (
                <Text key={x} style={{ color: t.muted, fontSize: 14 }}>
                  <Text style={{ color: t.accent, fontWeight: "800" }}>✓ </Text>
                  {x}
                </Text>
              ))}
            </View>
          </View>
          <View style={{ flex: wide ? 0.85 : undefined, width: wide ? undefined : "100%", alignItems: "center" }}>
            <DemoCard />
          </View>
        </View>
      </View>

      {/* ── Before / after ── */}
      <View style={[s.section, { gap: 36, paddingVertical: 80 }]}>
        <Reveal style={{ gap: 12, alignItems: "center" }}>
          <Text style={s.kicker}>The problem</Text>
          <Text style={[s.h2, { textAlign: "center" }]}>Your group chat wasn't built for headcounts</Text>
        </Reveal>
        <View style={{ flexDirection: wide ? "row" : "column", gap: 24, alignItems: wide ? "stretch" : "center" }}>
          <ChatMess />
          <Reveal delay={200} style={{ flex: 1, width: "100%", maxWidth: wide ? undefined : 520 }}>
            <View style={[s.panel, { borderColor: t.accent, gap: 14, flex: 1 }]}>
              <Text style={s.panelLabel}>With Turnout</Text>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                <Text style={{ color: t.text, fontSize: 64, fontWeight: "900", letterSpacing: -3 }}>12</Text>
                <Text style={{ color: t.muted, fontSize: 24, fontWeight: "700" }}>/ 14 in</Text>
              </View>
              <Text style={{ color: t.accent, fontWeight: "700", fontSize: 16 }}>2 spots left · updated just now</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {["Maya", "Priya", "Luis", "Aisha", "Chen", "Sam", "Noor", "Ben", "Kai", "Ivy", "Omar", "Zoe"].map((n) => (
                  <View key={n} style={[s.chip, { paddingVertical: 5, paddingHorizontal: 11 }]}>
                    <Text style={{ color: t.text, fontSize: 13, fontWeight: "600" }}>{n}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ color: t.muted, fontSize: 15 }}>Always accurate. Nobody has to count.</Text>
            </View>
          </Reveal>
        </View>
      </View>

      {/* ── How it works ── */}
      <View onLayout={(e) => (howY.current = e.nativeEvent.layout.y)} style={[s.band, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={[s.section, { gap: 40, paddingVertical: 80 }]}>
          <Reveal style={{ gap: 12 }}>
            <Text style={s.kicker}>How it works</Text>
            <Text style={s.h2}>Set up once. Runs every week.</Text>
          </Reveal>
          <View style={{ flexDirection: wide ? "row" : "column", gap: 28 }}>
            {steps.map((step, i) => (
              <Reveal key={step.n} delay={i * 140} style={{ flex: 1, gap: 12 }}>
                <Text style={s.stepNumber}>{step.n}</Text>
                <Text style={s.h3}>{step.title}</Text>
                <Text style={s.body}>{step.body}</Text>
              </Reveal>
            ))}
          </View>
        </View>
      </View>

      {/* ── Features ── */}
      <View onLayout={(e) => (featuresY.current = e.nativeEvent.layout.y)} style={[s.section, { gap: 40, paddingVertical: 80 }]}>
        <Reveal style={{ gap: 12 }}>
          <Text style={s.kicker}>Features</Text>
          <Text style={s.h2}>Everything the group chat can't do</Text>
        </Reveal>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          {features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 110} style={{ flexBasis: wide ? "31%" : "100%", flexGrow: 1 }}>
              <HoverCard>
                <View style={s.iconBubble}>
                  <Text style={{ fontSize: 22 }}>{f.icon}</Text>
                </View>
                <Text style={s.h3}>{f.title}</Text>
                <Text style={s.body}>{f.body}</Text>
              </HoverCard>
            </Reveal>
          ))}
        </View>
      </View>

      {/* ── Uses ── */}
      <View style={{ width: "100%", gap: 24, paddingBottom: 80, alignItems: "center" }}>
        <Reveal style={[s.section, { gap: 12 }]}>
          <Text style={s.kicker}>Not just sports</Text>
          <Text style={s.h2}>If it's weekly and has limited spots</Text>
        </Reveal>
        <Marquee speed={36}>
          {uses.map((u) => (
            <View key={u} style={[s.chip, { marginRight: 10, paddingVertical: 12, paddingHorizontal: 18 }]}>
              <Text style={{ color: t.text, fontWeight: "700", fontSize: 16 }}>{u}</Text>
            </View>
          ))}
        </Marquee>
      </View>

      {/* ── Pricing ── */}
      <View onLayout={(e) => (pricingY.current = e.nativeEvent.layout.y)} style={[s.section, { gap: 28, paddingVertical: 64, maxWidth: 960 }]}>
        <Reveal style={{ gap: 12, alignItems: "center" }}>
          <Text style={s.kicker}>Pricing</Text>
          <Text style={[s.h2, { textAlign: "center" }]}>Free while we're getting started</Text>
          <Text style={[s.body, { textAlign: "center", maxWidth: 620 }]}>
            Everything is free right now. We're planning an Organizer plan and would love to know if it's worth it to you. Nothing is charged, and you'll hear from us before anything changes.
          </Text>
        </Reveal>
        <View style={{ flexDirection: wide ? "row" : "column", gap: 16 }}>
          <PriceCard
            name="Free"
            price="$0"
            per="for everyone, today"
            items={["Live headcount and waitlist", "No app or account for players", "Share cards and link previews", "Every Organizer feature too, while we're new"]}
          />
          <PriceCard
            name="Organizer"
            price="$49"
            per="per year · founding price"
            featured
            items={["Multiple groups", "Reminders and autopilot heads-ups", "Insights and game history", "Co-organizers", "Payment tracking and team maker"]}
            cta="I'd pay for this"
            onPress={() => router.push("/founding")}
          />
        </View>
      </View>

      {/* ── FAQ ── */}
      <View onLayout={(e) => (faqY.current = e.nativeEvent.layout.y)} style={[s.section, { gap: 28, paddingVertical: 64, maxWidth: 820 }]}>
        <Reveal style={{ gap: 12, alignItems: "center" }}>
          <Text style={s.kicker}>FAQ</Text>
          <Text style={[s.h2, { textAlign: "center" }]}>Questions organizers ask</Text>
        </Reveal>
        <View style={{ gap: 10 }}>
          {faqs.map((f) => <Faq key={f.q} q={f.q} a={f.a} />)}
        </View>
      </View>

      {/* ── Final CTA ── */}
      <View style={[s.section, { paddingBottom: 80 }]}>
        <Reveal>
          <View style={s.ctaBand}>
            <Glow color="rgba(255,255,255,0.18)" size={420} style={{ top: -160, right: -80 }} duration={8000} />
            <Text style={[s.h2, { color: "#fff", textAlign: "center", fontSize: wide ? 44 : 32 }]}>Your next game, sorted in one link.</Text>
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 18, textAlign: "center" }}>Free for organizers. Set up in under a minute.</Text>
            <Pulse>
              <Pressable accessibilityRole="button" onPress={start} style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [s.ctaInverse, webTransition, hovered && { transform: [{ translateY: -2 }], boxShadow: "0 12px 28px rgba(0,0,0,0.25)" }, pressed && { opacity: 0.9 }]}>
                <Text style={{ color: "#0B3D1E", fontSize: 18, fontWeight: "800" }}>Start a group →</Text>
              </Pressable>
            </Pulse>
          </View>
        </Reveal>
      </View>

      <View style={[s.section, { paddingVertical: 32, flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 12, borderTopWidth: 1, borderColor: t.border }]}>
        <Text style={s.logoSmall}>
          turnout<Text style={{ color: t.accent }}>.</Text>
        </Text>
        <View style={{ flexDirection: "row", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <Text style={{ color: t.muted }}>© {new Date().getFullYear()} Turnout · Made for people who organize the game.</Text>
          <Link href="/privacy"><Text style={{ color: t.muted, textDecorationLine: "underline" }}>Privacy</Text></Link>
          <Link href="/terms"><Text style={{ color: t.muted, textDecorationLine: "underline" }}>Terms</Text></Link>
        </View>
      </View>
    </RevealScrollView>
  );
}

function CTA({ label, onPress, secondary }: { label: string; onPress: () => void; secondary?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        backgroundColor: secondary ? (hovered ? t.card : "transparent") : t.accent,
        borderWidth: 1,
        borderColor: secondary ? t.border : t.accent,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 14,
        transform: [{ translateY: hovered && !pressed ? -2 : 0 }, { scale: pressed ? 0.97 : 1 }],
        boxShadow: secondary ? undefined : hovered ? `0 12px 30px ${t.accentShadow}` : `0 6px 18px ${t.accentShadow}`,
      })}
    >
      <Text style={{ color: secondary ? t.text : t.accentText, fontSize: 17, fontWeight: "800" }}>
        {label}
        {secondary ? "" : " →"}
      </Text>
    </Pressable>
  );
}

function HoverCard({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <Pressable
      accessible={false}
      focusable={false}
      style={({ hovered }: { hovered?: boolean }) => ({
        backgroundColor: t.card,
        borderColor: hovered ? t.accent : t.border,
        borderWidth: 1,
        borderRadius: 20,
        padding: 22,
        gap: 10,
        height: "100%",
        transform: [{ translateY: hovered ? -4 : 0 }],
        boxShadow: hovered ? "0 18px 40px rgba(0,0,0,0.18)" : "0 1px 2px rgba(0,0,0,0.04)",
      })}
    >
      {children}
    </Pressable>
  );
}

/** The messy group chat: bubbles pop in one by one once it scrolls into view. */
function ChatMess() {
  const t = useTheme();
  const s = styles(t);
  const { width } = useWindowDimensions();
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started || count >= chat.length) return;
    const timer = setTimeout(() => setCount((c) => c + 1), count === 0 ? 150 : 520);
    return () => clearTimeout(timer);
  }, [started, count]);

  return (
    <Reveal onReveal={() => setStarted(true)} style={{ flex: 1, width: "100%", maxWidth: width >= 900 ? undefined : 520 }}>
      <View style={[s.panel, { gap: 8, minHeight: 420, flex: 1 }]}>
        <Text style={s.panelLabel}>The group chat</Text>
        {chat.slice(0, count).map((m, i) => (
          <Pop key={i} style={{ alignSelf: m.own ? "flex-end" : "flex-start", maxWidth: "85%" }}>
            <View style={[s.bubble, m.own ? { backgroundColor: t.accent, borderBottomRightRadius: 4 } : { borderBottomLeftRadius: 4 }]}>
              {!m.own && <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700" }}>{m.who}</Text>}
              <Text style={{ color: m.own ? t.accentText : t.text, fontSize: 15 }}>{m.text}</Text>
            </View>
          </Pop>
        ))}
      </View>
    </Reveal>
  );
}

/** A working mini group page: names fill in on load, then the visitor can take the last spot. */
function DemoCard() {
  const t = useTheme();
  const s = styles(t);
  const cap = 8;
  const [shown, setShown] = useState(0);
  const [youIn, setYouIn] = useState<boolean | null>(null);

  useEffect(() => {
    if (shown >= demoNames.length) return;
    const timer = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 600 : 280);
    return () => clearTimeout(timer);
  }, [shown]);

  const base: Rsvp[] = demoNames.slice(0, shown).map((name, i) => ({
    memberId: name, name, status: "in", respondedAt: new Date(Date.UTC(2026, 0, 1, 12, i)).toISOString(),
  }));
  const rsvps: Rsvp[] = youIn === null ? base : [...base, { memberId: "you", name: "You", status: youIn ? "in" : "out", respondedAt: new Date(Date.UTC(2026, 0, 1, 13)).toISOString() }];
  const roster = buildRoster(rsvps, cap);
  const ready = shown >= demoNames.length;
  const status = !ready
    ? "Filling up…"
    : youIn
      ? "You got the last spot 🎉"
      : youIn === false
        ? "No worries, see you next week"
        : `${roster.spotsLeft} spot left. Grab it!`;

  return (
    <Pop delay={250} style={{ width: "100%", maxWidth: 420 }}>
      <View style={s.demo}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={s.panelLabel}>Try it</Text>
          <View style={s.liveBadge}>
            <View style={s.liveDot} />
            <Text style={{ color: t.accent, fontSize: 12, fontWeight: "800" }}>LIVE</Text>
          </View>
        </View>
        <Text style={{ color: t.text, fontSize: 24, fontWeight: "800", marginTop: 4 }}>Tuesday Soccer</Text>
        <Text style={{ color: t.muted }}>Tue 7:30 PM · Riverside Park</Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 10 }}>
          <Bump value={roster.confirmed.length}>
            <Text style={{ color: t.text, fontSize: 56, fontWeight: "900", letterSpacing: -3 }}>{roster.confirmed.length}</Text>
          </Bump>
          <Text style={{ color: t.muted, fontSize: 22, fontWeight: "700" }}>/ {cap} in</Text>
        </View>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${(roster.confirmed.length / cap) * 100}%` }]} />
        </View>
        <Text style={{ color: youIn ? t.accent : t.muted, fontWeight: "700", marginTop: 4 }}>{status}</Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
          <Pulse active={ready && youIn === null} style={{ flex: 1 }}>
            <DemoButton label="I'm in" primary active={youIn === true} onPress={() => setYouIn(true)} />
          </Pulse>
          <View style={{ flex: 1 }}>
            <DemoButton label="I'm out" active={youIn === false} onPress={() => setYouIn(false)} />
          </View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12, minHeight: 64 }}>
          {roster.confirmed.map((r) => (
            <Pop key={r.memberId}>
              <View style={[s.chip, { paddingVertical: 5, paddingHorizontal: 11 }, r.memberId === "you" && { borderColor: t.accent, backgroundColor: t.soft }]}>
                <Text style={{ color: r.memberId === "you" ? t.accent : t.text, fontSize: 13, fontWeight: "700" }}>{r.name}</Text>
              </View>
            </Pop>
          ))}
        </View>
      </View>
    </Pop>
  );
}

function DemoButton({ label, primary, active, onPress }: { label: string; primary?: boolean; active: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        alignItems: "center",
        paddingVertical: 15,
        borderRadius: 14,
        borderWidth: 1,
        backgroundColor: primary ? t.accent : active ? t.text : t.card,
        borderColor: primary || hovered ? t.accent : t.border,
        opacity: primary && active ? 0.65 : hovered && primary ? 0.9 : 1,
        transform: [{ translateY: hovered && !pressed ? -1 : 0 }, { scale: pressed ? 0.96 : 1 }],
        ...webTransition,
      })}
    >
      <Text style={{ color: primary ? t.accentText : active ? t.bg : t.text, fontWeight: "800", fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    heroWrap: { width: "100%", alignItems: "center", overflow: "hidden" },
    section: { width: "100%", maxWidth: 1140, paddingHorizontal: 20 },
    band: { width: "100%", alignItems: "center", borderTopWidth: 1, borderBottomWidth: 1 },
    nav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 20 },
    logo: { color: t.text, fontSize: 26, fontWeight: "900", letterSpacing: -1.2 },
    logoSmall: { color: t.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.8 },
    navLink: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: t.border },
    pill: {
      flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start",
      paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: t.border, backgroundColor: t.card,
    },
    pillDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.accent },
    kicker: { color: t.accent, fontWeight: "800", fontSize: 14, letterSpacing: 1, textTransform: "uppercase" },
    h1: { color: t.text, fontWeight: "900", letterSpacing: -2.5 },
    h2: { color: t.text, fontSize: 36, fontWeight: "900", letterSpacing: -1.4, lineHeight: 42 },
    h3: { color: t.text, fontSize: 19, fontWeight: "800" },
    lead: { color: t.muted, fontSize: 20, lineHeight: 30, maxWidth: 560 },
    leadStrong: { color: t.text, fontWeight: "800" },
    body: { color: t.muted, fontSize: 16, lineHeight: 24 },
    stepNumber: { color: t.accent, fontSize: 56, fontWeight: "900", letterSpacing: -3, lineHeight: 60 },
    iconBubble: { width: 48, height: 48, borderRadius: 14, backgroundColor: t.soft, alignItems: "center", justifyContent: "center" },
    chip: { borderWidth: 1, borderColor: t.border, backgroundColor: t.card, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
    panel: { backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 24, padding: 24 },
    panelLabel: { color: t.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
    bubble: { backgroundColor: t.bg, borderRadius: 18, paddingVertical: 9, paddingHorizontal: 14, gap: 2 },
    demo: {
      width: "100%", backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 28, padding: 24,
      boxShadow: "0 30px 80px rgba(0,0,0,0.25)",
    },
    liveBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: t.soft },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.accent },
    progressTrack: { height: 8, borderRadius: 4, backgroundColor: t.border, overflow: "hidden", marginTop: 4 },
    progressFill: { height: "100%", borderRadius: 4, backgroundColor: t.accent },
    ctaBand: {
      borderRadius: 32, paddingVertical: 64, paddingHorizontal: 24, alignItems: "center", gap: 18, overflow: "hidden",
      backgroundImage: "linear-gradient(135deg, #16A34A 0%, #0E7A5F 55%, #0B5E7A 100%)",
    },
    ctaInverse: { backgroundColor: "#fff", paddingVertical: 17, paddingHorizontal: 30, borderRadius: 16, marginTop: 8 },
  });


function Faq({ q, a }: { q: string; a: string }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={() => setOpen((o) => !o)}
      style={({ hovered }: { hovered?: boolean }) => ({ backgroundColor: t.card, borderColor: open || hovered ? t.accent : t.border, borderWidth: 1, borderRadius: 16, padding: 18, gap: 8 })}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: "800", flex: 1 }}>{q}</Text>
        <Text style={{ color: t.accent, fontSize: 20, fontWeight: "800" }}>{open ? "−" : "+"}</Text>
      </View>
      {open && <Text style={{ color: t.muted, fontSize: 16, lineHeight: 24 }}>{a}</Text>}
    </Pressable>
  );
}

function PriceCard({ name, price, per, items, featured, cta, onPress }: { name: string; price: string; per: string; items: string[]; featured?: boolean; cta?: string; onPress?: () => void }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.card, borderColor: featured ? t.accent : t.border, borderWidth: featured ? 2 : 1, borderRadius: 20, padding: 24, gap: 14 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: featured ? t.accent : t.muted, fontWeight: "800", fontSize: 14, letterSpacing: 1, textTransform: "uppercase" }}>{name}</Text>
        <Text style={{ color: t.text, fontSize: 44, fontWeight: "900", letterSpacing: -1.5 }}>{price}</Text>
        <Text style={{ color: t.muted }}>{per}</Text>
      </View>
      <View style={{ gap: 8 }}>
        {items.map((i) => (
          <Text key={i} style={{ color: t.text, fontSize: 15 }}>
            <Text style={{ color: t.accent, fontWeight: "800" }}>✓ </Text>
            {i}
          </Text>
        ))}
      </View>
      {cta && onPress && (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => ({ marginTop: "auto", alignItems: "center", paddingVertical: 14, borderRadius: 14, backgroundColor: t.accent, opacity: hovered ? 0.9 : 1, transform: [{ translateY: hovered && !pressed ? -1 : 0 }, { scale: pressed ? 0.97 : 1 }], ...webTransition })}
        >
          <Text style={{ color: t.accentText, fontWeight: "800", fontSize: 16 }}>{cta}</Text>
        </Pressable>
      )}
    </View>
  );
}
