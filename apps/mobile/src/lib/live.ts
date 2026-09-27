import { useEffect, useRef } from "react";
import type { Api } from "./api";

const FALLBACK_POLL_MS = 15_000;
const SAFETY_POLL_MS = 60_000;

/** Calls onChange whenever the group's roster changes (see useLive). */
export function useLiveGroup(api: Api, slug: string, active: boolean, onChange: () => void) {
  useLive(api.liveUrl, slug, active, onChange);
}

/**
 * Calls onChange whenever something on the channel changes. Uses the Azure Web PubSub connection
 * the API hands out (`getUrl(key)`), otherwise polls. A slow poll keeps running either way in case
 * a message is missed. `key` identifies the channel (a group slug, or "dashboard").
 */
export function useLive(getUrl: (key: string) => Promise<{ url: string | null }>, key: string, active: boolean, onChange: () => void) {
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!active) return;
    let closed = false;
    let socket: WebSocket | null = null;
    let poll = setInterval(() => callback.current(), FALLBACK_POLL_MS);
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = async () => {
      try {
        const { url } = await getUrl(key);
        if (!url || closed) return;
        socket = new WebSocket(url, "json.webpubsub.azure.v1");
        socket.onopen = () => {
          clearInterval(poll);
          poll = setInterval(() => callback.current(), SAFETY_POLL_MS);
          callback.current(); // catch up on anything missed while connecting
        };
        socket.onmessage = (e) => {
          const msg = JSON.parse(String(e.data)) as { type: string; data?: { type?: string } };
          if (msg.type === "message" && msg.data?.type === "changed") callback.current();
        };
        socket.onclose = () => {
          if (closed) return;
          clearInterval(poll);
          poll = setInterval(() => callback.current(), FALLBACK_POLL_MS);
          retry = setTimeout(connect, 5_000); // tokens expire after an hour; reconnect with a fresh one
        };
      } catch {
        // stay on polling
      }
    };
    connect();

    return () => {
      closed = true;
      clearInterval(poll);
      clearTimeout(retry);
      socket?.close();
    };
  }, [getUrl, key, active]);
}
