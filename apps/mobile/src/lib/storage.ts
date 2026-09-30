import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// SecureStore is native-only; web falls back to localStorage.
const web = Platform.OS === "web";
/** SecureStore keys may only contain letters, digits, ".", "-" and "_" ("membership:abc" would throw). */
const nativeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, "_");

export const storage = {
  async get(key: string): Promise<string | null> {
    if (web) return globalThis.localStorage?.getItem(key) ?? null;
    return SecureStore.getItemAsync(nativeKey(key));
  },
  async set(key: string, value: string): Promise<void> {
    if (web) return globalThis.localStorage?.setItem(key, value);
    return SecureStore.setItemAsync(nativeKey(key), value);
  },
  async remove(key: string): Promise<void> {
    if (web) return globalThis.localStorage?.removeItem(key);
    return SecureStore.deleteItemAsync(nativeKey(key));
  },
};
