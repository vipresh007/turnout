// The public website's words, in one place: the landing page and the use-case and comparison pages render them,
// and scripts/prerender.ts turns the same copy into plain HTML for search engines and AI crawlers (which don't
// run JavaScript). Plain data only: this file is also run directly by Node, so no imports.

export const SITE = {
  name: "Turnout",
  url: "https://turnout.dataeaver.ca",
  tagline: "Stop asking who's playing.",
  description:
    "One link for your weekly game. Players tap I'm in, and Turnout handles the headcount, the waitlist, reminders, dropouts, teams and who's paid. Free for organizers; players need no app or account.",
  appStoreUrl: "https://apps.apple.com/app/id6820230750",
  company: "Data Eaver Inc.",
  contact: "contact@dataeaver.ca",
};

export const steps = [
  { n: "1", title: "Describe your game", body: "“Tuesday soccer at Riverside, 7:30pm, 14 players.” One sentence and Turnout sets up the group." },
  { n: "2", title: "Share one link", body: "Drop it in the group chat once. Players tap it, type their name, done. No app, no account." },
  { n: "3", title: "Watch it fill up", body: "The headcount updates live. When it's full a waitlist forms, and people move up automatically." },
];

/** `icon` names an icon in components/Icon.tsx. */
export const features = [
  { icon: "bolt", title: "Live headcount", body: "Everyone sees who's in the second it changes. No more counting thumbs-up emojis." },
  { icon: "refresh", title: "Self-running waitlist", body: "Set a cap. When someone drops, the next person moves up without you lifting a finger." },
  { icon: "link", title: "No app for players", body: "Players tap a link in any browser. Only the organizer signs in." },
  { icon: "megaphone", title: "“We need 2 more”", body: "Short on players? Share a ready-made message with the live count and a join link." },
  { icon: "bell", title: "Reminders that land", body: "Players can turn on a game-day reminder by email or notification. Still no account, and one tap to stop." },
  { icon: "people", title: "Run it together", body: "Add co-organizers, split the court fee, track who's paid, make balanced teams, and see who you can count on." },
] as const;

export const uses = ["⚽️ Pickup soccer", "🏀 Basketball runs", "🏐 Volleyball", "🏃 Run clubs", "🃏 Poker nights", "🧘 Yoga classes", "🤝 Volunteer shifts", "🎲 Board game nights", "🏸 Badminton", "🥏 Ultimate", "🎾 Pickleball", "🏒 Shinny"];

export const faqs = [
  { q: "Do players need to download an app or make an account?", a: "No. Players open the link in any browser, type their name once, and tap in or out. Only organizers sign in. There's an optional iPhone app for anyone who wants their games and reminders in one place." },
  { q: "Is it free?", a: "Yes, everything is free right now, and players will always be free. We're planning an optional Organizer plan ($49/year founding price). You'll hear from us well before anything changes." },
  { q: "What happens when the game is full?", a: "New players join a waitlist. If someone drops out, the next person moves up automatically and gets a heads-up." },
  { q: "How do reminders work without an account?", a: "On the group page, players can ask for a reminder by email or turn on notifications. Every email has a one-tap stop link." },
  { q: "Does it work for a one-time event, not just weekly games?", a: "Yes. Pick One-time instead of Repeats when you set it up: one date, the same live headcount, waitlist and reminders." },
  { q: "Can someone else help run the group?", a: "Yes. Invite co-organizers with a private link. They can remind, cancel or move a week, make teams, and mark payments." },
  { q: "Does Turnout collect money?", a: "No. You can set a cost per player, split a total, or set a season fee, and tick off who's paid. The money itself goes however your group already pays." },
  { q: "Is there an app?", a: "Yes, Turnout is on the App Store for iPhone, and everything also works in any web browser. Organizers get notifications when someone drops out; players can get game reminders." },
];

export interface Activity {
  slug: string;
  /** "pickup soccer" */
  name: string;
  emoji: string;
  title: string;
  intro: string;
  points: string[];
  example: string;
}

/** One page per kind of game, for people searching "app to organize <their game>". */
export const activities: Activity[] = [
  {
    slug: "pickup-soccer", name: "pickup soccer", emoji: "⚽️",
    title: "The easy way to organize pickup soccer",
    intro: "Stop counting thumbs-up emojis in the group chat. Share one link, players tap I'm in, and you always know if you have enough for a game, and who's bringing the extra ball.",
    points: [
      "Set a cap (say 14 for 7-a-side) and late sign-ups join a waitlist that moves up on its own when someone drops.",
      "Split the field rental between whoever shows up, and tick off who's paid.",
      "Make balanced teams from skill ratings in one tap, and share them to the chat.",
    ],
    example: "Sunday soccer at Lakeshore Field 2, 10am, 16 players, $8 each",
  },
  {
    slug: "basketball", name: "basketball runs", emoji: "🏀",
    title: "Organize your weekly basketball run",
    intro: "Gym booked, 12 spots, and a group chat full of “maybe”. Turnout gives your run one link: players say in or out, the count updates live, and the waitlist fills spots when someone bails.",
    points: [
      "Know exactly who's coming before you drive to the gym.",
      "Autopilot warns you a day ahead if you're short, and suggests the regulars most likely to say yes.",
      "Split the court fee automatically and see who still owes.",
    ],
    example: "Tuesday basketball 8-10pm at the community centre, 12 players, $10 each",
  },
  {
    slug: "volleyball", name: "volleyball", emoji: "🏐",
    title: "Fill your volleyball court every week",
    intro: "Whether it's indoor 6s or beach doubles, Turnout keeps the headcount straight. One link for the group, a live count, and a waitlist so the court is never short.",
    points: [
      "Season groups: split a season fee between members, and let subs drop in for a per-game price.",
      "Reminders the day before and two hours before, so people actually show up.",
      "See who you can count on with each player's attendance record.",
    ],
    example: "Wednesday volleyball 8pm at David Suzuki School, 14 players, season fee $2,800",
  },
  {
    slug: "pickleball", name: "pickleball", emoji: "🎾",
    title: "Organize pickleball sessions without the back-and-forth",
    intro: "Courts fill fast and spots matter. Share one Turnout link and players claim a spot with a tap; when the session is full, everyone else waits in line automatically.",
    points: [
      "Cap the session at the number of courts you have.",
      "Players get a notification the moment a spot opens.",
      "Works for open play, ladders and weekly drop-ins.",
    ],
    example: "Saturday pickleball 9am, 3 courts, 12 players",
  },
  {
    slug: "hockey", name: "pickup hockey and shinny", emoji: "🏒",
    title: "Run your shinny or beer-league hockey headcount",
    intro: "Ice time is expensive and a short bench hurts. Turnout tells you who's in, who's out and who's on the waitlist, and splits the ice fee between everyone who plays.",
    points: [
      "Cap the skaters, and anyone extra waits in line for a spot.",
      "Late dropouts are flagged so you can plan for them next time.",
      "Cancel or move a week in one tap and everyone sees it.",
    ],
    example: "Friday shinny 10pm at the arena, 20 skaters, $15 each",
  },
  {
    slug: "ultimate", name: "ultimate frisbee", emoji: "🥏",
    title: "Organize pickup ultimate frisbee",
    intro: "Get enough for 7 on 7 every week. Players tap in from one link, you watch the count climb, and Turnout nudges the regulars who haven't answered.",
    points: [
      "Balanced teams from skill ratings, so games stay close.",
      "Reminders by notification or email, with no accounts for players.",
      "Game history shows turnout over the season.",
    ],
    example: "Thursday ultimate 6:30pm at the park, 14 players",
  },
  {
    slug: "badminton", name: "badminton", emoji: "🏸",
    title: "Organize badminton drop-ins and club nights",
    intro: "Book the courts, share one link, and let players sign themselves up. Turnout caps the night at your court count and runs the waitlist for you.",
    points: [
      "Split the hall booking between everyone who plays.",
      "One-time events for tournaments, weekly groups for club nights.",
      "Co-organizers can help run it, remind people and mark payments.",
    ],
    example: "Monday badminton 7-9pm, 4 courts, 16 players, $12 each",
  },
  {
    slug: "run-club", name: "run clubs", emoji: "🏃",
    title: "A simple RSVP for your run club",
    intro: "Know how many are coming to the Saturday long run without polls or spreadsheets. Members tap in from one link, and you can see who shows up week after week.",
    points: [
      "No cap needed: set a target and see how close you are.",
      "Members can turn on reminders, with no account.",
      "Attendance and streaks for every member.",
    ],
    example: "Saturday long run 8am from the coffee shop",
  },
];

/** The comparison page, for "alternative to TeamSnap / Spond / Doodle" questions. Kept factual and fair. */
export const comparison = {
  title: "Turnout vs group chats, polls, TeamSnap and Spond",
  intro:
    "Turnout is built for one job: the weekly headcount for a recurring game, where players come and go and nobody wants another account. Here's how it compares to what most groups use today.",
  rows: [
    { option: "Group chat (WhatsApp, iMessage)", good: "Everyone's already there.", gap: "No real count, no waitlist, and the answers get buried. Someone has to tally thumbs-ups every week." },
    { option: "Chat polls", good: "Quick to start.", gap: "A new poll every week, no cap or waitlist, no reminders, and no record of who actually played." },
    { option: "Doodle and scheduling polls", good: "Good for picking a date once.", gap: "Not built for the same game every week, a player limit or a waitlist." },
    { option: "Team apps (TeamSnap, Spond, Heja)", good: "Rich features for organized teams and leagues.", gap: "Usually every player needs the app or an account, which is heavy for a drop-in game." },
    { option: "Turnout", good: "One link per group, players tap in with no app or account, a live count, an automatic waitlist, reminders, payments and teams.", gap: "Focused on recurring games and events, not full league management." },
  ],
};
