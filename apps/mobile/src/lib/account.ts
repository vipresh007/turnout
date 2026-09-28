import { useEffect, useState } from "react";
import { type Account, useApi } from "./api";
import { useAuth } from "./auth";

// One fetch per signed-in session, shared by every page's header.
let cached: { key: string; account: Promise<Account | null> } | null = null;

/** The signed-in organizer's name, email and admin flag; null while loading or signed out. */
export function useAccount(): Account | null {
  const { status, authHeaders } = useAuth();
  const api = useApi();
  const [account, setAccount] = useState<Account | null>(null);
  useEffect(() => {
    if (status !== "signedIn") {
      cached = null;
      return;
    }
    let live = true;
    authHeaders().then((headers) => {
      const key = JSON.stringify(headers);
      if (cached?.key !== key) cached = { key, account: api.me().catch(() => null) };
      cached.account.then((a) => live && setAccount(a));
    });
    return () => {
      live = false;
    };
  }, [status, api, authHeaders]);
  return status === "signedIn" ? account : null;
}
