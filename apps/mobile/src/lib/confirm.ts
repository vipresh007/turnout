import { Alert, Platform } from "react-native";

/** Asks before a destructive action. Resolves true if the user confirms. */
export function confirm(title: string, message: string, confirmLabel = "Remove"): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: confirmLabel, style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}
