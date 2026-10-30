import { buildRoster, type Rsvp } from "@turnout/shared";
import { Link, router } from "expo-router";
import Head from "expo-router/head";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Pressable, type ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { wakeApi } from "@/lib/api";
import { useTheme, type Theme } from "@/lib/theme";
import { Bump, Glow, Marquee, Pop, Pulse, Reveal, RevealScrollView } from "./motion";
import { activities, faqs, features, steps, uses } from "@/content/site";
import { AppStoreBadge } from "./AppStoreBadge";
import { Icon, type IconName } from "./Icon";
import { SiteHeader } from "./SiteHeader";
import { Display, ProgressBar, Ring, webTransition } from "./ui";


const chat: { who: string; text: string; own?: boolean }[] = [
  { who: "Maya", text: "in" },
  { who: "Jordan", text: "+1" },
  { who: "Sam", text: "maybe? depends on work" },
  { who: "Priya", text: "wait how many do we have" },
  { who: "Luis", text: "who's bringing the ball 😅" },
  { who: "Jordan", text: "actually can't make it sorry" },
  { who: "You", text: "ok so that's… 9? 10?", own: true },
];

const demoNames = ["Maya", "Jordan", "Priya", "Sam", "Luis", "Aisha", "Chen"];
// Ink and paper for the solid colour panels (the same in light and dark mode).
const INK = "#07210F";
const PAPER = "#F7FDF9";

export function Landing() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const s = styles(t);
  const scrollRef = useRef<ScrollView>(null);
  // Section links scroll to the element itself: positions measured at load go stale as the page above them
  // changes height (fonts, the animated chat), and the web doesn't re-report a position that only moved.
  const howRef = useRef<View>(null);
  const featuresRef = useRef<View>(null);
  const pricingRef = useRef<View>(null);
  const scrollTo = (ref: RefObject<View | null>) => (ref.current as unknown as HTMLElement | null)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
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
        <Glow color="rgba(34,197,94,0.22)" size={wide ? 820 : 500} style={{ top: -260, left: wide ? -160 : -220 }} />
        <Glow color="rgba(251,146,60,0.14)" size={wide ? 620 : 380} style={{ top: 80, right: wide ? -160 : -220 }} duration={11000} drift={60} />

        <SiteHeader
          sections={[
            { label: "How it works", onPress: () => scrollTo(howRef) },
            { label: "Features", onPress: () => scrollTo(featuresRef) },
            { label: "Demo", onPress: () => router.push("/demo") },
            { label: "Pricing", onPress: () => scrollTo(pricingRef) },
          ]}
        />

        <View style={[s.section, { flexDirection: wide ? "row" : "column", gap: wide ? 56 : 40, alignItems: "center", paddingTop: wide ? 48 : 16, paddingBottom: wide ? 96 : 64 }]}>
          <View style={{ flex: wide ? 1.15 : undefined, gap: 22, width: wide ? undefined : "100%" }}>
            <Pop>
              <View style={s.pill}>
                <View style={s.pillDot} />
                <Text style={{ color: t.text, fontWeight: "500", fontSize: 13 }}>Free for organizers · No app for players</Text>
              </View>
            </Pop>
            <View>
              <Display level="display" role="heading" aria-level={1} style={[s.h1, { fontSize: wide ? 72 : 46, lineHeight: wide ? 76 : 50 }]}>
                Stop asking{"\n"}<Text style={{ color: t.accent }}>who's playing.</Text>
              </Display>
            </View>
            <Text style={s.lead}>
              One link for your weekly game. Players tap <Text style={s.leadStrong}>I'm in</Text>. Turnout handles the count, the waitlist,
              reminders, dropouts and teams.
            </Text>
            <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
              <CTA label="Start a group, it's free" onPress={start} />
              <CTA label="Try the demo, no sign-up" secondary onPress={() => router.push("/demo")} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
              <AppStoreBadge height={44} />
              <Text style={{ color: t.muted, fontSize: 14, flexShrink: 1 }}>Drop-out alerts and reminders on your iPhone.</Text>
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
          <Display level="h1" style={[s.h2, { textAlign: "center" }]}>Your group chat wasn't built for headcounts</Display>
        </Reveal>
        <View style={{ flexDirection: wide ? "row" : "column", gap: 24, alignItems: wide ? "stretch" : "center" }}>
          <ChatMess />
          <Reveal delay={200} style={wide ? { flex: 1, width: "100%" } : { width: "100%", maxWidth: 520 }}>
            <View style={[s.panel, { backgroundColor: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.3)", gap: 14, overflow: "hidden" }, wide && { flex: 1 }]}>
              <Text style={[s.panelLabel, { color: t.accent }]}>With Turnout</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
                <Ring value={12} max={14} size={112} tone={t.energy}><Display level="stat" style={{ fontSize: 40, lineHeight: 44 }}>12</Display></Ring>
                <View style={{ gap: 4 }}>
                  <Text style={{ color: t.text, fontSize: 22, fontWeight: "600", letterSpacing: -0.3 }}>of 14 in</Text>
                  <Text style={{ color: t.energy, fontWeight: "600", fontSize: 15 }}>2 spots left · updated just now</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {["Maya", "Priya", "Luis", "Aisha", "Chen", "Sam", "Noor", "Ben", "Kai", "Ivy", "Omar", "Zoe"].map((n) => (
                  <View key={n} style={[s.chip, { paddingVertical: 5, paddingHorizontal: 11 }]}>
                    <Text style={{ color: t.text, fontSize: 13, fontWeight: "500" }}>{n}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ color: t.muted, fontSize: 15 }}>Always accurate. Nobody has to count.</Text>
            </View>
          </Reveal>
        </View>
      </View>

      {/* ── How it works ── */}
      <View ref={howRef} style={[s.band, { backgroundColor: "rgba(255,255,255,0.025)", borderColor: t.border }]}>
        <View style={[s.section, { gap: 40, paddingVertical: 80 }]}>
          <Reveal style={{ gap: 12 }}>
            <Text style={s.kicker}>How it works</Text>
            <Display level="h1" style={s.h2}>Set up once. Runs every week.</Display>
          </Reveal>
          <View style={{ flexDirection: wide ? "row" : "column", gap: 20 }}>
            {steps.map((step, i) => (
              <Reveal key={step.n} delay={i * 140} style={{ flex: 1 }}>
                <HoverCard>
                  <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: i === 1 ? t.energySoft : t.soft, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: i === 1 ? t.energy : t.accent, fontWeight: "700", fontSize: 16 }}>{step.n}</Text>
                  </View>
                  <Text style={s.h3}>{step.title}</Text>
                  <Text style={s.body}>{step.body}</Text>
                </HoverCard>
              </Reveal>
            ))}
          </View>
        </View>
      </View>

      {/* ── Features ── */}
      <View ref={featuresRef} style={[s.section, { gap: 40, paddingVertical: 80 }]}>
        <Reveal style={{ gap: 12 }}>
          <Text style={s.kicker}>Features</Text>
          <Display level="h1" style={s.h2}>Everything the group chat can't do</Display>
        </Reveal>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          {features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 110} style={{ flexBasis: wide ? "31%" : "100%", flexGrow: 1 }}>
              <HoverCard>
                <View style={[s.iconBubble, i % 2 === 1 && { backgroundColor: t.energySoft }]}>
                  <Icon name={f.icon as IconName} size={24} color={i % 2 === 1 ? t.energy : t.accent} />
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
          <Display level="h1" style={s.h2}>If it's weekly and has limited spots</Display>
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
      <View ref={pricingRef} style={[s.section, { gap: 28, paddingVertical: 64, maxWidth: 960 }]}>
        <Reveal style={{ gap: 12, alignItems: "center" }}>
          <Text style={s.kicker}>Pricing</Text>
          <Display level="h1" style={[s.h2, { textAlign: "center" }]}>Free while we're getting started</Display>
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
      <View style={[s.section, { gap: 28, paddingVertical: 64, maxWidth: 820 }]}>
        <Reveal style={{ gap: 12, alignItems: "center" }}>
          <Text style={s.kicker}>FAQ</Text>
          <Display level="h1" style={[s.h2, { textAlign: "center" }]}>Questions organizers ask</Display>
        </Reveal>
        <View style={{ gap: 10 }}>
          {faqs.map((f) => <Faq key={f.q} q={f.q} a={f.a} />)}
        </View>
      </View>

      {/* ── Final CTA ── */}
      <View style={[s.section, { paddingBottom: 80 }]}>
        <Reveal>
          <View style={[s.ctaBand, { backgroundColor: "rgba(34,197,94,0.08)", borderWidth: 1, borderColor: "rgba(34,197,94,0.3)" }]}>
            <Glow color="rgba(34,197,94,0.25)" size={520} style={{ top: -200, right: -120 }} duration={8000} />
            <Display level="display" style={[s.h2, { textAlign: "center", fontSize: wide ? 48 : 32, lineHeight: wide ? 52 : 36 }]}>Your next game, sorted in one link.</Display>
            <Text style={{ color: t.muted, fontSize: 18, textAlign: "center" }}>Free for organizers. Set up in under a minute.</Text>
            <Pulse>
              <Pressable accessibilityRole="button" onPress={start} style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [s.ctaInverse, { backgroundColor: t.accent }, webTransition, hovered && { transform: [{ translateY: -2 }], boxShadow: `0 12px 28px ${t.accentShadow}` }, pressed && { opacity: 0.9 }]}>
                <Text style={{ color: t.accentText, fontSize: 18, fontWeight: "700" }}>Start a group →</Text>
              </Pressable>
            </Pulse>
            <AppStoreBadge height={44} />
          </View>
        </Reveal>
      </View>

      <Footer
        wide={wide}
        links={[
          {
            title: "Product",
            items: [
              { label: "How it works", onPress: () => scrollTo(howRef) },
              { label: "Features", onPress: () => scrollTo(featuresRef) },
              { label: "Pricing", onPress: () => scrollTo(pricingRef) },
              { label: "Try the demo", onPress: () => router.push("/demo") },
              { label: "Compare", onPress: () => router.push("/compare") },
            ],
          },
          {
            title: "Use cases",
            items: activities.slice(0, 5).map((a) => ({ label: a.name[0]!.toUpperCase() + a.name.slice(1), onPress: () => router.push({ pathname: "/for/[activity]", params: { activity: a.slug } }) })),
          },
          {
            title: "Help",
            items: [
              { label: "Support", onPress: () => router.push("/support") },
              { label: "Contact us", onPress: () => router.push("/support") },
              { label: "Start a group", onPress: start },
            ],
          },
          {
            title: "Legal",
            items: [
              { label: "Privacy policy", onPress: () => router.push("/privacy") },
              { label: "Terms of service", onPress: () => router.push("/terms") },
            ],
          },
        ]}
      />
    </RevealScrollView>
  );
}

function CTA({ label, onPress, secondary, inverse }: { label: string; onPress: () => void; secondary?: boolean; inverse?: boolean }) {
  const t = useTheme();
  // On a solid green panel the primary button is ink and the secondary is paper.
  const bg = inverse ? (secondary ? PAPER : INK) : secondary ? (undefined as string | undefined) : t.accent;
  const fg = inverse ? (secondary ? INK : PAPER) : secondary ? t.text : t.accentText;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        backgroundColor: bg ?? (hovered ? t.card : "transparent"),
        borderWidth: 1,
        borderColor: inverse ? bg : secondary ? t.border : t.accent,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 14,
        transform: [{ translateY: hovered && !pressed ? -2 : 0 }, { scale: pressed ? 0.97 : 1 }],
        boxShadow: secondary && !inverse ? undefined : hovered ? "0 12px 30px rgba(0,0,0,0.25)" : "0 6px 18px rgba(0,0,0,0.18)",
      })}
    >
      <Text style={{ color: fg, fontSize: 17, fontWeight: "800" }}>
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
        backgroundColor: hovered ? "rgba(255,255,255,0.07)" : t.card,
        borderColor: hovered ? t.borderStrong : t.border,
        borderWidth: 1,
        borderRadius: 22,
        padding: 22,
        gap: 10,
        height: "100%",
        transform: [{ translateY: hovered ? -3 : 0 }],
        boxShadow: t.shadow.card,
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
    // Side by side on desktop the two panels share a height; stacked on a phone this one grows to fit its messages.
    <Reveal onReveal={() => setStarted(true)} style={width >= 900 ? { flex: 1, width: "100%" } : { width: "100%", maxWidth: 520 }}>
      <View style={[s.panel, { gap: 8, minHeight: 420 }, width >= 900 && { flex: 1 }]}>
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
            <Text style={{ color: t.energy, fontSize: 12, fontWeight: "800" }}>LIVE</Text>
          </View>
        </View>
        <Text style={{ color: t.text, fontSize: 24, fontWeight: "800", marginTop: 4 }}>Tuesday Soccer</Text>
        <Text style={{ color: t.muted }}>Tue 7:30 PM · Riverside Park</Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 10 }}>
          <Bump value={roster.confirmed.length}>
            <Display level="stat">{String(roster.confirmed.length)}</Display>
          </Bump>
          <Text style={{ color: t.muted, fontSize: 22, fontWeight: "700" }}>/ {cap} in</Text>
        </View>
        <View style={{ marginTop: 4 }}>
          <ProgressBar value={roster.confirmed.length} max={cap} tone={roster.confirmed.length >= cap ? t.accent : t.energy} />
        </View>
        <Text style={{ color: youIn ? t.accent : ready ? t.energy : t.muted, fontWeight: "700", marginTop: 4 }}>{status}</Text>
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
    kicker: { color: t.accent, fontWeight: "600", fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase" },
    h1: { color: t.text, letterSpacing: -2 },
    h2: { color: t.text, fontSize: 36, letterSpacing: -1.2, lineHeight: 42, fontWeight: "600" },
    h3: { color: t.text, fontSize: 18, fontWeight: "600", letterSpacing: -0.2 },
    lead: { color: t.muted, fontSize: 20, lineHeight: 30, maxWidth: 560 },
    leadStrong: { color: t.text, fontWeight: "800" },
    body: { color: t.muted, fontSize: 16, lineHeight: 24 },
    stepNumber: { color: t.energy, fontSize: 56, lineHeight: 60 },
    iconBubble: { width: 48, height: 48, borderRadius: 14, backgroundColor: t.soft, alignItems: "center", justifyContent: "center" },
    chip: { borderWidth: 1, borderColor: t.border, backgroundColor: t.card, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
    panel: { backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 24, padding: 24, boxShadow: t.shadow.card },
    panelLabel: { color: t.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
    bubble: { backgroundColor: t.bg, borderRadius: 18, paddingVertical: 9, paddingHorizontal: 14, gap: 2 },
    demo: {
      width: "100%", backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 28, padding: 24,
      boxShadow: "0 30px 80px rgba(0,0,0,0.25)",
    },
    liveBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: t.energySoft },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.energy },
    ctaBand: {
      borderRadius: 32, paddingVertical: 64, paddingHorizontal: 24, alignItems: "center", gap: 18, overflow: "hidden",

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
        <Display level="stat" style={{ fontSize: 44, lineHeight: 48 }}>{price}</Display>
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

/** The site footer: what Turnout is, links by topic, and who makes it. */
function Footer({ wide, links }: { wide: boolean; links: { title: string; items: { label: string; onPress: () => void }[] }[] }) {
  const t = useTheme();
  return (
    <View style={{ width: "100%", alignItems: "center", backgroundColor: t.card, borderTopWidth: 1, borderColor: t.border }}>
      <View style={{ width: "100%", maxWidth: 1140, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 28, gap: 40 }}>
        <View style={{ flexDirection: wide ? "row" : "column", gap: wide ? 48 : 32 }}>
          <View style={{ flex: wide ? 1.4 : undefined, gap: 12, maxWidth: 360 }}>
            <Text style={{ color: t.text, fontSize: 24, fontWeight: "900", letterSpacing: -1 }}>
              turnout<Text style={{ color: t.accent }}>.</Text>
            </Text>
            <Text style={{ color: t.muted, fontSize: 15, lineHeight: 22 }}>One link for your weekly game. Players tap I'm in, and Turnout handles the count, the waitlist and the reminders.</Text>
            <Text style={{ color: t.muted, fontSize: 15 }}>
              Questions? <Link href="/support"><Text style={{ color: t.accent, fontWeight: "700" }}>Get in touch</Text></Link>
            </Text>
            <View style={{ marginTop: 4 }}>
              <AppStoreBadge height={40} />
            </View>
          </View>
          <View style={{ flex: wide ? 2 : undefined, flexDirection: "row", flexWrap: "wrap", gap: 32 }}>
            {links.map((col) => (
              <View key={col.title} style={{ flexGrow: 1, flexBasis: wide ? 0 : "40%", gap: 12 }}>
                <Text style={{ color: t.text, fontSize: 13, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" }}>{col.title}</Text>
                {col.items.map((item) => (
                  <Pressable key={item.label} accessibilityRole="link" onPress={item.onPress} style={({ hovered }: { hovered?: boolean }) => ({ opacity: hovered ? 0.7 : 1, ...webTransition })}>
                    <Text style={{ color: t.muted, fontSize: 15 }}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </View>
        <View style={{ flexDirection: wide ? "row" : "column", justifyContent: "space-between", gap: 8, borderTopWidth: 1, borderColor: t.border, paddingTop: 20 }}>
          <Text style={{ color: t.muted, fontSize: 13 }}>© {new Date().getFullYear()} Data Eaver Inc. All rights reserved.</Text>
          <Text style={{ color: t.muted, fontSize: 13 }}>Made in Ontario, Canada · Free for organizers</Text>
        </View>
      </View>
    </View>
  );
}
