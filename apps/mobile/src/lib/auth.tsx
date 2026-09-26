import * as AuthSession from "expo-auth-session";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { config } from "./config";
import { storage } from "./storage";

interface Tokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
}

interface AuthState {
  status: "loading" | "signedOut" | "signedIn";
  /** False until the sign-in page can be opened (Entra discovery loaded). */
  ready: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Headers that identify the organizer to the API, or {} when signed out. */
  authHeaders: () => Promise<Record<string, string>>;
}

const AuthContext = createContext<AuthState | null>(null);
const STORAGE_KEY = "auth";
const redirectUri = AuthSession.makeRedirectUri({ scheme: "turnout", path: "auth" });

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
  const [request, , promptAsync] = AuthSession.useAuthRequest(
    { clientId: entra.clientId, redirectUri, scopes: ["openid", "profile", "offline_access", entra.apiScope], usePKCE: true },
    discovery,
  );

  useEffect(() => {
    storage.get(STORAGE_KEY).then((raw) => setTokens(raw ? (JSON.parse(raw) as Tokens) : null));
  }, []);

  const save = useCallback(async (t: Tokens | null) => {
    setTokens(t);
    await (t ? storage.set(STORAGE_KEY, JSON.stringify(t)) : storage.remove(STORAGE_KEY));
  }, []);

  const signIn = useCallback(async () => {
    if (!request || !discovery) return;
    // promptAsync must run straight from the tap so web browsers don't block the popup.
    const result = await promptAsync();
    if (result.type !== "success") return;
    const response = await AuthSession.exchangeCodeAsync(
      { clientId: entra.clientId, code: result.params.code!, redirectUri, extraParams: { code_verifier: request.codeVerifier! } },
      discovery,
    );
    await save(toTokens(response));
  }, [request, discovery, promptAsync, entra.clientId, save]);

  const validTokens = useCallback(async (): Promise<Tokens | null> => {
    if (!tokens) return null;
    if (tokens.expiresAt - 60_000 > Date.now()) return tokens;
    if (!tokens.refreshToken || !discovery) return null;
    refreshing.current ??= AuthSession.refreshAsync({ clientId: entra.clientId, refreshToken: tokens.refreshToken }, discovery)
      .then(async (r) => {
        const next = { ...toTokens(r), refreshToken: r.refreshToken ?? tokens.refreshToken };
        await save(next);
        return next;
      })
      .catch(async () => {
        await save(null);
        return null;
      })
      .finally(() => {
        refreshing.current = null;
      });
    return refreshing.current;
  }, [tokens, discovery, entra.clientId, save]);

  const value = useMemo<AuthState>(
    () => ({
      status: tokens === undefined ? "loading" : tokens ? "signedIn" : "signedOut",
      ready: !!request && !!discovery,
      signIn,
      signOut: () => save(null),
      authHeaders: async () => {
        const t = await validTokens();
        return t ? { authorization: `Bearer ${t.accessToken}` } : ({} as Record<string, string>);
      },
    }),
    [tokens, request, discovery, signIn, save, validTokens],
  );
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
      signIn: async () => {
        const next = Math.random().toString(36).slice(2);
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
