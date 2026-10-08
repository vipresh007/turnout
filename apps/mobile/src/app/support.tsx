import { Link } from "expo-router";
import { ContactForm } from "@/components/ContactForm";
import { Email, H, LegalPage, Li, P } from "@/components/LegalPage";

// The App Store's support URL (turnout.dataeaver.ca/support): how to reach us, and answers to common questions.
export default function Support() {
  return (
    <LegalPage title="Support" updated="October 7, 2026">
      <P>
        Need a hand with Turnout? Send us a message below or email <Email />. A real person reads every message, and we usually reply within one business day.
      </P>
      <ContactForm />
      <P>It helps if you include your group's link or name, what you were trying to do, what happened instead, and whether you're on the iPhone app or a browser.</P>

      <H>For players</H>
      <Li>Do I need the app or an account? No. Open the link your organizer shared, type your name once and tap I'm in or I'm out. The app and signing in are optional.</Li>
      <Li>Changing your answer: open the group link again and tap the other button. You can change it as often as you like before the game.</Li>
      <Li>Reminders: on the group page, turn on notifications or add your email. Every reminder email has a link to stop them, and notifications can be turned off on the same page.</Li>
      <Li>New phone: sign in on the new phone (the same way you did before) and your games come back. Not signed in? Type your name on the group page and tap That's me: if you added a reminder email, we'll send you a link to carry on as you. Otherwise ask your organizer to merge your old and new entries.</Li>
      <Li>Wrong name, or showing up twice? Ask your organizer. They can merge duplicate entries or remove one for their group.</Li>
      <Li>Your stats (games played, attendance, streaks) are only visible to you, on the group page and under Your stats.</Li>

      <H>For organizers</H>
      <Li>Starting a group: sign in, tap New group and describe your game in a sentence, or fill in the form. Then share the link in your group chat.</Li>
      <Li>Skipping or moving a week: open the group, then Schedule. To call off this week's game, use Cancel this week's game at the bottom of the group page.</Li>
      <Li>Sharing the work: open the group, then Organizers, and send a co-organizer invite link.</Li>
      <Li>Costs and payments: set a cost per player, a total to split, or a season fee in Edit group, then tick off who has paid.</Li>
      <Li>Notifications in the app: Account, then Notifications. You'll hear when someone drops out or a game looks short.</Li>

      <H>Your account and data</H>
      <Li>Sign in with an email code, Google, Microsoft or Apple. We never see your passwords.</Li>
      <Li>Delete your account any time in the app under Account, then Delete account, or email us and we'll do it for you.</Li>
      <Li>To see, correct or remove your information, email us. We respond within 30 days.</Li>
      <P>
        More detail in our <Link href="/privacy" style={{ textDecorationLine: "underline" }}>privacy policy</Link> and{" "}
        <Link href="/terms" style={{ textDecorationLine: "underline" }}>terms of service</Link>.
      </P>

      <H>About</H>
      <P>Turnout is made by Data Eaver Inc. in Ontario, Canada. Contact: <Email />.</P>
    </LegalPage>
  );
}
