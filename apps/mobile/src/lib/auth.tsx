import * as AuthSession from "expo-auth-session";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { config } from "./config";
import { storage } from "./storage";

interface Tokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
}

export type Provider = "email" | "microsoft" | "google" | "apple";

/** domain_hint values that send the user straight to a provider instead of the chooser page. */
const domainHints: Record<Provider, string | undefined> = {
  email: undefined,
  microsoft: "login.microsoftonline.com", // custom OIDC: the issuer's domain
  google: "Google", // built-in social provider: its type name
  apple: "apple",
};

interface AuthState {
  status: "loading" | "signedOut" | "signedIn";
  /** False until the sign-in page can be opened (Entra discovery loaded). */
  ready: boolean;
  /** Sign-in buttons to show, in order. */
  providers: Provider[];
  signIn: (provider?: Provider) => Promise<void>;
  /**
   * Web only: finishes a full-page sign-in on the /auth page. Resolves to the path to go back to,
   * or throws with a message to show.
   */
  completeRedirect: () => Promise<string>;
  signOut: () => Promise<void>;
  /** Headers that identify the organizer to the API, or {} when signed out. */
  authHeaders: () => Promise<Record<string, string>>;
}

const AuthContext = createContext<AuthState | null>(null);
const STORAGE_KEY = "auth";
// What a full-page sign-in needs to remember while the tab is away at the sign-in page.
const REDIRECT_KEY = "auth.redirect";
interface PendingRedirect {
  codeVerifier: string;
  state: string;
  returnTo: string;
}
const redirectUri = AuthSession.makeRedirectUri({ scheme: "ca.dataeaver.turnout", path: "auth" });

const toTokens = (r: AuthSession.TokenResponse): Tokens => ({
  accessToken: r.accessToken,
  refreshToken: r.refreshToken,
  expiresAt: (r.issuedAt + (r.expiresIn ?? 3600)) * 1000,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  return config.entra ? <EntraAuthProvider entra={config.entra}>{children}</EntraAuthProvider> : <DevAuthProvider>{children}</DevAuthProvider>;
}

function EntraAuthProvider({ entra, children }: { entra: NonNullable<typeof config.entra>; children: ReactNode }) {
  const discovery = AuthSession.useAutoDiscovery(entra.authority);
  const [tokens, setTokens] = useState<Tokens | null | undefined>(undefined);
  const refreshing = useRef<Promise<Tokens | null> | null>(null);
  // One prepared request per provider, so sign-in starts straight from the tap with no await first.
  // The number of hooks is fixed, as the rules of hooks require.
  const base = { clientId: entra.clientId, redirectUri, scopes: ["openid", "profile", "offline_access", entra.apiScope], usePKCE: true };
  const requests = {
    email: AuthSession.useAuthRequest(base, discovery),
    microsoft: AuthSession.useAuthRequest({ ...base, extraParams: { domain_hint: domainHints.microsoft! } }, discovery),
    google: AuthSession.useAuthRequest({ ...base, extraParams: { domain_hint: domainHints.google! } }, discovery),
    apple: AuthSession.useAuthRequest({ ...base, extraParams: { domain_hint: domainHints.apple! } }, discovery),
  };
  const providers: Provider[] = [...(["microsoft", "google", "apple"] as const).filter((p) => entra.providers.includes(p)), "email"];

  useEffect(() => {
    storage.get(STORAGE_KEY).then((raw) => setTokens(raw ? (JSON.parse(raw) as Tokens) : null));
  }, []);

  const save = useCallback(async (t: Tokens | null) => {
    setTokens(t);
    await (t ? storage.set(STORAGE_KEY, JSON.stringify(t)) : storage.remove(STORAGE_KEY));
  }, []);

  const exchange = async (code: string, codeVerifier: string) => {
    if (!discovery) throw new Error("Sign-in isn't ready yet. Try again.");
    const response = await AuthSession.exchangeCodeAsync(
      { clientId: entra.clientId, code, redirectUri, extraParams: { code_verifier: codeVerifier } },
      discovery,
    );
    await save(toTokens(response));
  };

  const signIn = async (provider: Provider = "email") => {
    const [request, , promptAsync] = requests[provider];
    if (!request || !discovery) return;
    if (Platform.OS === "web") {
      // Full-page redirect instead of a popup: nothing to block, and it works the same on phones.
      if (!request.url || !request.codeVerifier) return;
      const pending: PendingRedirect = {
        codeVerifier: request.codeVerifier,
        state: request.state,
        returnTo: window.location.pathname + window.location.search,
      };
      sessionStorage.setItem(REDIRECT_KEY, JSON.stringify(pending));
      window.location.assign(request.url);
      return;
    }
    // Native: the system's in-app browser sheet. Ephemeral, so no sign-in cookie outlives it: signing out really
    // signs out, and Entra never shows its "only continue if you trust this app" page for a remembered session.
    const result = await promptAsync({ preferEphemeralSession: true });
    if (result.type !== "success") return;
    await exchange(result.params.code!, request.codeVerifier!);
  };

  const completeRedirect = async (): Promise<string> => {
    const params = new URLSearchParams(window.location.search);
    const raw = sessionStorage.getItem(REDIRECT_KEY);
    sessionStorage.removeItem(REDIRECT_KEY); // one use only
    const pending = raw ? (JSON.parse(raw) as PendingRedirect) : null;
    if (params.get("error")) {
      // The user cancelled, or the provider refused. Send them back where they were.
      if (params.get("error") === "access_denied") return pending?.returnTo ?? "/dashboard";
      throw new Error(params.get("error_description")?.split("\n")[0] ?? "Sign-in failed. Please try again.");
    }
    const code = params.get("code");
    if (!code || !pending) throw new Error("This sign-in link has expired. Please try again.");
    if (params.get("state") !== pending.state) throw new Error("Sign-in couldn't be verified. Please try again.");
    await exchange(code, pending.codeVerifier);
    return pending.returnTo;
  };

  const validTokens = useCallback(async (): Promise<Tokens | null> => {
    if (!tokens) return null;
    if (tokens.expiresAt - 60_000 > Date.now()) return tokens;
    if (!tokens.refreshToken) return null;
    const refreshToken = tokens.refreshToken;
    // Right after launch the sign-in service's settings may still be loading; fetch them rather than give up
    // (which sent requests without a token and showed "Sign in required").
    refreshing.current ??= (async () => AuthSession.refreshAsync({ clientId: entra.clientId, refreshToken }, discovery ?? (await AuthSession.fetchDiscoveryAsync(entra.authority))))()
      .then(async (r) => {
        const next = { ...toTokens(r), refreshToken: r.refreshToken ?? refreshToken };
        await save(next);
        return next;
      })
      .catch(async (e: { code?: string }) => {
        // Only a refused refresh token means signed out; a network blip keeps you signed in for the next try.
        if (e?.code === "invalid_grant") await save(null);
        return null;
      })
      .finally(() => {
        refreshing.current = null;
      });
    return refreshing.current;
  }, [tokens, discovery, entra.clientId, entra.authority, save]);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const t = await validTokens();
    return t ? { authorization: `Bearer ${t.accessToken}` } : {};
  }, [validTokens]);

  const value: AuthState = {
    status: tokens === undefined ? "loading" : tokens ? "signedIn" : "signedOut",
    ready: !!requests.email[0] && !!discovery,
    providers,
    signIn,
    completeRedirect,
    signOut: () => save(null),
    authHeaders, // stable, so useApi() doesn't rebuild on every render
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Local development without Entra: a random per-device organizer ID, accepted only when the API has ALLOW_DEV_AUTH=true. */
function DevAuthProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    storage.get("devOrganizerId").then(setId);
  }, []);
  const value = useMemo<AuthState>(
    () => ({
      status: id === undefined ? "loading" : id ? "signedIn" : "signedOut",
      ready: true,
      providers: ["email"],
      completeRedirect: async () => "/dashboard",
      signIn: async () => {
        const next = process.env.EXPO_PUBLIC_DEV_USER || Math.random().toString(36).slice(2); // a fixed one to reuse seed data
        await storage.set("devOrganizerId", next);
        setId(next);
      },
      signOut: async () => {
        await storage.remove("devOrganizerId");
        setId(null);
      },
      authHeaders: async (): Promise<Record<string, string>> => (id ? { "x-dev-user": id } : {}),
    }),
    [id],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
