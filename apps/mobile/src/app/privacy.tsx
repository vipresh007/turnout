import { Link } from "expo-router";
import { Email, H, LegalPage, Li, P } from "@/components/LegalPage";

export default function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated="September 27, 2026">
      <P>
        Turnout (turnout.dataeaver.ca) helps people run recurring games: organizers set up a group, and players tap “I'm in” or “I'm out” each week.
        Turnout is operated by Dataeaver (“we”). This policy explains what we collect, why, and the choices you have. We collect as little as we can.
      </P>

      <H>What we collect</H>
      <P>If you organize a group (you sign in):</P>
      <Li>Your name and email address, from the sign-in method you choose (email code, Google, Microsoft or Apple). We never see your passwords.</Li>
      <Li>The groups you create or help run: name, activity, place, schedule, player limit, reminder settings, and any cost and payment note you add.</Li>
      <Li>What you record about players in your group: who has paid, skill ratings for team making, and saved teams.</Li>
      <P>If you play (no account needed):</P>
      <Li>The name you type when you join a group, and your in/out answers each week, with when you answered.</Li>
      <Li>A random code stored on your device so Turnout remembers you. We keep only a scrambled (hashed) copy.</Li>
      <Li>Optional: an email address, if you ask for reminder emails, and a browser notification subscription, if you turn on notifications.</Li>
      <P>Everyone:</P>
      <Li>Basic technical logs (such as IP address, browser type, errors and timings) to keep Turnout running and secure.</Li>

      <H>How we use it</H>
      <Li>To run the service: show who's in, manage the waitlist, and let organizers manage their groups.</Li>
      <Li>To send the reminders and notices you or your organizer turned on, such as reminders before a game, “a spot opened up”, or a sign-in code.</Li>
      <Li>To keep Turnout secure, prevent abuse, and fix problems.</Li>
      <P>
        We don't sell your information, show ads, or use it for advertising. We don't send marketing email. Reminder emails go only to people who ask for them,
        and every one has a link to stop them.
      </P>

      <H>Who can see what</H>
      <Li>Anyone with a group's link can see the group's details and the names and answers of its players. Share the link only with your group.</Li>
      <Li>Organizers of a group can also see payment status and skill ratings, and whether a player has reminder emails on. They never see players' email addresses.</Li>
      <Li>Players never see organizers' email addresses.</Li>

      <H>Services we rely on</H>
      <P>We use trusted providers to run Turnout. They process data on our behalf, only to provide their service:</P>
      <Li>Microsoft Azure: hosting, database, email delivery, live updates, sign-in (Microsoft Entra External ID) and diagnostics. Our servers are in Canada.</Li>
      <Li>Google, Microsoft and Apple, if you choose to sign in with them. They share your name and email address with us.</Li>
      <Li>
        Azure OpenAI, only when an organizer uses “describe your group in a sentence”. That sentence is sent to the AI model to fill in the form,
        and may be processed in the United States. Don't include personal details in it.
      </Li>
      <Li>Your browser's push service (for example Google, Apple or Mozilla) delivers notifications, if you turn them on.</Li>

      <H>Cookies and storage</H>
      <P>
        Turnout stores a few items on your device: your sign-in session (organizers), your player code for each group you join, and small preferences.
        We don't use advertising or tracking cookies.
      </P>

      <H>How long we keep it</H>
      <Li>Group data stays while the group exists. An organizer can remove a player at any time, which deletes that player's answers for the group.</Li>
      <Li>Reminder email addresses are deleted when you stop reminders.</Li>
      <Li>Technical logs are kept for up to 90 days.</Li>
      <Li>You can ask us to delete your account or data at any time (see below).</Li>

      <H>Your choices and rights</H>
      <P>
        You can ask to see, correct or delete the personal information we hold about you, or ask questions about how we handle it, by emailing <Email />.
        We'll respond within 30 days. Players can stop reminder emails with the link in any email, and turn off notifications on the group page.
        If you're not satisfied with our answer, you can contact the Office of the Privacy Commissioner of Canada.
      </P>

      <H>Security</H>
      <P>
        Data is encrypted in transit (HTTPS) and at rest. Access is limited to what's needed to run the service. No system is perfectly secure,
        and we'll tell affected users promptly if a breach puts their information at risk.
      </P>

      <H>Children</H>
      <P>Organizer accounts are for people 16 and older. Players join by name only; a parent or coach can manage a youth group's sign-ups.</P>

      <H>Changes</H>
      <P>If we make significant changes, we'll update the date above and let organizers know in the app or by email.</P>

      <H>Contact</H>
      <P>
        Questions or requests: <Email />. See also our <Link href="/terms" style={{ textDecorationLine: "underline" }}>terms of service</Link>.
      </P>
    </LegalPage>
  );
}
