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

  const day = s.match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/);
  if (day) draft.weekday = weekdays.indexOf(day[1]!);

  const time = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) ?? s.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (time) {
    let hour = Number(time[1]);
    if (time[3] === "pm" && hour < 12) hour += 12;
    if (time[3] === "am" && hour === 12) hour = 0;
    draft.startTime = `${String(hour).padStart(2, "0")}:${time[2] ?? "00"}`;
  }

  const cap = s.match(/\b(?:max|cap|up to)\s*(\d{1,3})\b/) ?? s.match(/(?<![:\d])(\d{1,3})\s*(?:players|people|spots|ppl)\b/);
  if (cap) draft.cap = Number(cap[1]);

  const activity = activities.find((a) => new RegExp(`\\b${a}\\b`).test(s));
  if (activity) draft.activity = activity;

  const location = sentence.match(/\b(?:at|@)\s+((?!\d)[^,.]+?)\s*(?:[,.]|$)/i);
  if (location) draft.location = location[1]!.trim();

  if (activity) {
    const dayName = draft.weekday !== undefined ? `${weekdayNames[draft.weekday]} ` : "";
    draft.name = `${dayName}${activity[0]!.toUpperCase()}${activity.slice(1)}`;
  }
  return draft;
}
