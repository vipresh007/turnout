// A basic filter for text other people will see (group names, player names, places). It catches obvious slurs and
// profanity, including simple disguises like "f u c k" or "sh1t"; anything it misses can be reported from the group page.

const BLOCKED = [
  "fuck", "fuk", "shit", "cunt", "bitch", "whore", "slut", "dick", "cock", "pussy", "asshole", "bastard", "wanker", "twat",
  "nigger", "nigga", "faggot", "fag", "retard", "spic", "chink", "kike", "wetback", "tranny", "dyke", "paki", "gook",
  "rape", "rapist", "nazi", "hitler", "kkk", "porn", "nude", "nudes", "sex", "penis", "vagina",
];

// Words that contain a blocked word but are fine ("Scunthorpe", "Dickson", "Sussex", "Grapes", "Essex").
const ALLOWED = ["scunthorpe", "dickson", "dickens", "sussex", "essex", "middlesex", "wessex", "grape", "therapist", "cockburn", "hancock", "peacock", "shitake", "assessment", "pakistan"];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i" };

const normalize = (text: string) =>
  text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[013457@$!]/g, (c) => LEET[c] ?? c);

// Roots that are offensive inside any longer word too ("motherfucker", "bullshit").
const ROOTS = ["fuck", "shit", "cunt", "nigg", "fagg", "bitch", "whore", "rapist", "pussy", "asshole", "retard"];

const blockedWord = (w: string) =>
  !ALLOWED.some((a) => w.includes(a)) && (BLOCKED.some((b) => w === b || w === `${b}s`) || ROOTS.some((r) => w.includes(r)));

/** True when the text contains a blocked word, as a whole word or spelled out letter by letter ("f u c k"). */
export function isOffensive(text: string): boolean {
  const words = normalize(text).split(/[^a-z]+/).filter(Boolean);
  if (words.some(blockedWord)) return true;
  // Runs of single letters ("f u c k", "f.u.c.k") joined back into a word.
  const runs: string[] = [];
  let run = "";
  for (const w of words) {
    if (w.length === 1) run += w;
    else {
      if (run) runs.push(run);
      run = "";
    }
  }
  if (run) runs.push(run);
  return runs.some((r) => r.length >= 3 && BLOCKED.some((b) => r.includes(b)));
}

export const OFFENSIVE_MESSAGE = "Please choose different words: that looks offensive.";
