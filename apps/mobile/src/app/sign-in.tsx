import { Redirect } from "expo-router";
import { SignInGate } from "@/components/SignInGate";

// The app's sign-in screen, opened from the welcome screen. It sits outside the tab bar,
// and hands over to Home as soon as sign-in finishes.
export default function SignIn() {
  return (
    <SignInGate reason="Sign in to start your group.">
      <Redirect href="/dashboard" />
    </SignInGate>
  );
}
