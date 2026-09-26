import * as Clipboard from "expo-clipboard";
import { Platform, Share } from "react-native";

/** Opens the native share sheet, or copies to the clipboard where sharing isn't available (desktop web). Returns true if it copied. */
export async function shareText(message: string): Promise<boolean> {
  if (Platform.OS !== "web" || typeof navigator.share === "function") {
    try {
      await Share.share({ message });
      return false;
    } catch {
      // fall through to clipboard
    }
  }
  await Clipboard.setStringAsync(message);
  return true;
}
