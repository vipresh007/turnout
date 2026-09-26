export const config = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000",
  /** Base URL for share links: the web build of this app. */
  webUrl: process.env.EXPO_PUBLIC_WEB_URL ?? "http://localhost:8081",
  entra: process.env.EXPO_PUBLIC_ENTRA_AUTHORITY
    ? {
        authority: process.env.EXPO_PUBLIC_ENTRA_AUTHORITY,
        clientId: process.env.EXPO_PUBLIC_ENTRA_CLIENT_ID ?? "",
        apiScope: process.env.EXPO_PUBLIC_ENTRA_API_SCOPE ?? "",
        /** Social providers switched on in the tenant, e.g. "microsoft,google". Email is always available. */
        providers: (process.env.EXPO_PUBLIC_ENTRA_PROVIDERS ?? "").split(",").map((p) => p.trim()).filter(Boolean),
      }
    : null,
};
