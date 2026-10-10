import { Link } from "expo-router";
import { Email, H, LegalPage, Li, P } from "@/components/LegalPage";

export default function Terms() {
  return (
    <LegalPage title="Terms of service" updated="October 10, 2026">
      <P>
        These terms cover your use of Turnout (turnout.dataeaver.ca), operated by Data Eaver Inc. (“we”). By using Turnout, as an organizer or a player,
        you agree to them. If you don't agree, please don't use Turnout.
      </P>

      <H>The service</H>
      <P>
        Turnout lets organizers set up recurring groups and lets players say whether they're in or out each week. Turnout is free to use right now.
        If we introduce paid features, we'll tell you first, and you won't be charged without agreeing.
      </P>

      <H>Accounts</H>
      <Li>Organizers sign in with an email code, Google, Microsoft or Apple. Keep access to that account secure; you're responsible for what happens in your groups.</Li>
      <Li>Players don't need an account. Anyone with a group's link can join it, so share links only with people you want in the group.</Li>
      <Li>You must be 16 or older to create an organizer account.</Li>

      <H>Organizers' responsibilities</H>
      <Li>Only add information you have the right to share, and use players' information only to run your group.</Li>
      <Li>Owners can invite co-organizers, who can manage the group the same way. Invite only people you trust.</Li>
      <Li>
        Turnout helps you track costs and who has paid, but it doesn't handle money. Payments happen between you and your players,
        and we're not responsible for them.
      </Li>
      <Li>You're responsible for the games themselves, including venues, safety, and any disputes between participants.</Li>

      <H>Acceptable use</H>
      <P>Don't use Turnout to:</P>
      <Li>Break the law, or harass, threaten or impersonate anyone.</Li>
      <Li>Send spam, or put offensive or misleading content in group names, notes or player names.</Li>
      <Li>Try to break, overload or get around the security of the service, or access groups or data that aren't yours.</Li>
      <P>
        There is no tolerance for objectionable content or abusive users. Turnout filters offensive words in names, and anyone can report a
        group or a person with “Report a problem” at the bottom of any group page. We review reports within 24 hours and remove content,
        groups or accounts that break these rules. Organizers can also remove players from their group, and players can leave any group.
      </P>

      <H>Your content</H>
      <P>
        You keep ownership of what you put into Turnout. You give us permission to store and display it only as needed to run the service,
        as described in our <Link href="/privacy" style={{ textDecorationLine: "underline" }}>privacy policy</Link>.
      </P>

      <H>Availability and changes</H>
      <P>
        We work to keep Turnout running, but we can't promise it will always be available or error-free. Reminders and notifications depend on email
        and browser services outside our control. Don't rely on Turnout as the only way to reach your players in an emergency. We may change or
        discontinue features. If we shut Turnout down, we'll give organizers reasonable notice.
      </P>

      <H>Disclaimer and liability</H>
      <P>
        Turnout is provided “as is”, without warranties of any kind, to the extent the law allows. To the extent the law allows, we're not liable
        for indirect or consequential losses, or for anything that happens at a game organized through Turnout. Nothing in these terms limits
        rights you have under consumer protection laws that can't be waived.
      </P>

      <H>Ending your use</H>
      <P>You can stop using Turnout at any time. To delete your organizer account and its data, email <Email />.</P>

      <H>Changes to these terms</H>
      <P>If we make significant changes, we'll update the date above and let organizers know. Continuing to use Turnout means you accept the new terms.</P>

      <H>Governing law</H>
      <P>These terms are governed by the laws of the Province of Ontario and the federal laws of Canada that apply there.</P>

      <H>Contact</H>
      <P>Questions about these terms: <Email />.</P>
    </LegalPage>
  );
}
