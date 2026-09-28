import { Link, router, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useAccount } from "@/lib/account";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Glow, Pop } from "./motion";
import { webTransition } from "./ui";

/** The same width on every page, so the logo and nav never jump when you move between pages. */
export const SITE_WIDTH = 1140;
export const SITE_GUTTER = 20;

export interface SectionLink {
  label: string;
  onPress: () => void;
}

/**
 * The site's one header, on every web page: logo home on the left; on the right, section links (landing page)
 * or Your groups / + New group, and the account menu when signed in. Native apps use their own headers.
 */
export function SiteHeader({ sections, signInLabel = "Sign in" }: { sections?: SectionLink[]; signInLabel?: string }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const pathname = usePathname();
  const { status } = useAuth();
  const signedIn = status === "signedIn";
  if (Platform.OS !== "web") return null;

  return (
    <View style={[styles.bar, { zIndex: 50 }]}>
      <Link href="/" accessibilityLabel="Turnout home page">
        <Text style={[styles.logo, { color: t.text }]}>
          turnout<Text style={{ color: t.accent }}>.</Text>
        </Text>
      </Link>
      <View style={{ flexDirection: "row", alignItems: "center", gap: wide ? 6 : 8 }}>
        {wide && sections?.map((s) => <NavText key={s.label} label={s.label} onPress={s.onPress} />)}
        {signedIn ? (
          <>
            <NavText label="Your groups" active={pathname === "/dashboard"} onPress={() => router.push("/dashboard")} />
            {!sections && <NavButton label={wide ? "+ New group" : "+ New"} primary onPress={() => router.push("/new")} />}
            <AccountMenu />
          </>
        ) : (
          <NavButton label={signInLabel} onPress={() => router.push("/dashboard")} />
        )}
      </View>
    </View>
  );
}

function NavText({ label, onPress, active }: { label: string; onPress: () => void; active?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) => ({ paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, backgroundColor: hovered ? t.soft : "transparent", ...webTransition })}
    >
      {({ hovered }: { hovered?: boolean }) => <Text style={{ color: active || hovered ? t.text : t.muted, fontWeight: active ? "800" : "600" }}>{label}</Text>}
    </Pressable>
  );
}

function NavButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) => [
        styles.navButton,
        webTransition,
        primary ? { backgroundColor: t.accent, borderColor: t.accent, opacity: hovered ? 0.9 : 1 } : { borderColor: hovered ? t.accent : t.border, backgroundColor: hovered ? t.soft : "transparent" },
      ]}
    >
      <Text style={{ color: primary ? t.accentText : t.text, fontWeight: primary ? "800" : "600" }}>{label}</Text>
    </Pressable>
  );
}

function AccountMenu() {
  const t = useTheme();
  const { signOut } = useAuth();
  const account = useAccount();
  const [open, setOpen] = useState(false);
  const initial = (account?.name ?? account?.email ?? "").trim()[0]?.toUpperCase() ?? "👤";
  // Escape closes the menu too.
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const go = (href: "/" | "/dashboard" | "/admin") => {
    setOpen(false);
    router.push(href);
  };
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Account"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={({ hovered }: { hovered?: boolean }) => [styles.avatar, { backgroundColor: t.accent }, webTransition, hovered && { opacity: 0.85, transform: [{ scale: 1.05 }] }]}
      >
        <Text style={{ color: t.accentText, fontWeight: "900", fontSize: 16 }}>{initial}</Text>
      </Pressable>
      {open && (
        // A click anywhere outside the menu closes it.
        <Pressable accessibilityLabel="Close menu" onPress={() => setOpen(false)} style={styles.backdrop} />
      )}
      {open && (
        <Pop style={[styles.menu, { backgroundColor: t.card, borderColor: t.border }]}>
          {account?.email && <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={1}>{account.email}</Text>}
          <MenuItem label="Your groups" onPress={() => go("/dashboard")} />
          {account?.isAdmin && <MenuItem label="📈 Metrics" onPress={() => go("/admin")} />}
          <MenuItem label="Home page" onPress={() => go("/")} />
          <MenuItem
            label="Sign out"
            danger
            onPress={async () => {
              setOpen(false);
              await signOut();
              router.replace("/");
            }}
          />
        </Pop>
      )}
    </View>
  );
}

function MenuItem({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ hovered }: { hovered?: boolean }) => [styles.menuItem, hovered && { backgroundColor: t.bg }]}>
      <Text style={{ color: danger ? t.danger : t.text, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

/** The soft green (and a hint of blue) glow the landing page opens with, behind the top of every page. */
export function PageGlow({ strong }: { strong?: boolean }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  return (
    <View pointerEvents="none" style={styles.glow}>
      <Glow color={t.glowA} size={wide ? (strong ? 720 : 620) : 440} style={{ top: -240, left: wide ? -120 : -200, opacity: strong ? 1 : 0.8 }} />
      <Glow color={t.glowB} size={wide ? (strong ? 620 : 520) : 360} style={{ top: 40, right: wide ? -160 : -220, opacity: strong ? 1 : 0.7 }} duration={11000} drift={60} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { width: "100%", maxWidth: SITE_WIDTH, paddingHorizontal: SITE_GUTTER, paddingVertical: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center", alignSelf: "center" },
  logo: { fontSize: 26, fontWeight: "900", letterSpacing: -1.2 },
  navButton: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  menu: { position: "absolute", top: 48, right: 0, width: 220, borderWidth: 1, borderRadius: 14, padding: 12, gap: 8, zIndex: 60, boxShadow: "0 16px 40px rgba(0,0,0,0.25)" },
  menuItem: { paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8 },
  // Fixed to the viewport on web, so it covers the whole page behind the open menu.
  backdrop: { position: "fixed" as "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 55, cursor: "default" } as object,
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 700, overflow: "hidden" },
});
