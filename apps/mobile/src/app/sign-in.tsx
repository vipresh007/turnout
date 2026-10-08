import { Redirect, useLocalSearchParams, type Href } from "expo-router";
import { SignInGate } from "@/components/SignInGate";

// The sign-in screen, opened from the welcome screen or a "sign in to keep your stats" prompt. It sits outside the
// tab bar, and hands over to Home (or wherever `next` says) as soon as sign-in finishes.
export default function SignIn() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const target = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return (
    <SignInGate reason={target === "/stats" ? "Keep your games and stats on every device." : "Set up your group in about a minute."}>
      <Redirect href={target as Href} />
    </SignInGate>
  );
}
