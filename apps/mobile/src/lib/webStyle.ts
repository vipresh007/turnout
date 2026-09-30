import { Platform } from "react-native";

/** Smooth hover/press changes on web; an empty style on iOS/Android. */
export const webTransition = (Platform.OS === "web" ? { transitionProperty: "background-color, border-color, color, opacity, transform, box-shadow", transitionDuration: "150ms" } : {}) as object;
