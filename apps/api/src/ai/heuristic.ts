import type { GroupDraft } from "@turnout/shared";

const weekdays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const activities = [
  "soccer", "football", "basketball", "volleyball", "hockey", "tennis", "pickleball", "badminton",
  "cricket", "ultimate", "frisbee", "softball", "baseball", "futsal", "run", "running", "poker", "yoga",
];

/** Rule-based parser for "Tuesday soccer at 7pm, 12 players, Riverside Park". Used when no AI model is configured. */
export function parseGroupSentence(sentence: string): GroupDraft {
  const s = sentence.toLowerCase();
  const draft: GroupDraft = {};

  // Every day mentioned ("tuesdays and thursdays"), in week order.
  const days = [...s.matchAll(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/g)].map((m) => weekdays.indexOf(m[1]!));
  if (days.length) draft.weekdays = [...new Set(days)].sort();
  if (/\b(every other|biweekly|every 2 weeks|every two weeks)\b/.test(s)) draft.intervalWeeks = 2;

  // A range first ("8-10pm", "7:30pm to 9:30pm", "20:00-22:00"): start time and length.
  const range = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (range && (range[3] || range[6] || range[2] || range[5])) {
    const endMeridiem = range[6] ?? range[3];
    const toHour = (h: number, m?: string) => (m === "pm" && h < 12 ? h + 12 : m === "am" && h === 12 ? 0 : h);
    const endHour = toHour(Number(range[4]), endMeridiem);
    let startHour = toHour(Number(range[1]), range[3] ?? endMeridiem);
    if (!range[3] && startHour > endHour) startHour = Number(range[1]); // "11-1pm" starts at 11am
    const start = startHour * 60 + Number(range[2] ?? 0);
    const end = endHour * 60 + Number(range[5] ?? 0);
    const minutes = end > start ? end - start : end + 24 * 60 - start;
    if (startHour < 24 && endHour < 24 && minutes >= 15 && minutes <= 12 * 60) {
      draft.startTime = `${String(startHour).padStart(2, "0")}:${range[2] ?? "00"}`;
      draft.durationMinutes = minutes;
    }
  }

  const time = draft.startTime ? null : s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) ?? s.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (time) {
    let hour = Number(time[1]);
    if (time[3] === "pm" && hour < 12) hour += 12;
    if (time[3] === "am" && hour === 12) hour = 0;
    draft.startTime = `${String(hour).padStart(2, "0")}:${time[2] ?? "00"}`;
  }

  const cap = s.match(/\b(?:max|cap|up to)\s*(\d{1,3})\b/) ?? s.match(/(?<![:\d])(\d{1,3})\s*(?:players|people|spots|ppl)\b/);
  if (cap) draft.cap = Number(cap[1]);

  // Money: "$2500 for the season", "$10 each", "$150 court split".
  const amount = s.match(/\$\s?(\d[\d,]*(?:\.\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s?(?:\$|dollars|bucks)/)
    ?? (/\b(cost|costs|fee|price|pay|split)\b/.test(s) ? s.match(/\b(?:cost|costs|fee|price|pay|is|of)\s+(?:is\s+)?\$?(\d[\d,]*(?:\.\d{1,2})?)\b(?!\s*(?:people|players|spots|ppl|pm|am))/) : null);
  if (amount) {
    const cents = Math.round(Number((amount[1] ?? amount[2])!.replace(/,/g, "")) * 100);
    if (cents > 0) {
      if (/\b(season|up ?front|whole term|for the term)\b/.test(s)) draft.seasonFeeCents = cents;
      else if (/\b(split|court|rental|per game|each game|per session|a game)\b/.test(s) && !/\b(each|per person|per player|a head|pp)\b/.test(s)) {
        draft.feeCents = cents;
        draft.feeSplit = true;
      } else draft.feeCents = cents;
    }
  }

  const activity = activities.find((a) => new RegExp(`\\b${a}\\b`).test(s));
  if (activity) draft.activity = activity;

  const location = sentence.match(/\b(?:at|@)\s+((?!\d)[^,.]+?)\s*(?:[,.]|$)/i);
  if (location) draft.location = location[1]!.trim();

  if (activity) {
    const dayName = draft.weekdays?.length === 1 ? `${weekdayNames[draft.weekdays[0]!]} ` : "";
    draft.name = `${dayName}${activity[0]!.toUpperCase()}${activity.slice(1)}`;
  }
  return draft;
}
