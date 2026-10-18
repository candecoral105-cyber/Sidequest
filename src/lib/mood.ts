// Mood search: tidies Gemini's answer, and keyword rules for when Gemini isn't available.
import type { MoodFilters } from "./types";

export const ALL_TAGS = ["social", "quiet", "study", "learning", "food", "outdoors", "sport", "creative", "free"];
export const ALL_TYPES = ["event", "cafe", "study", "activity", "deal"];

/** Keeps Gemini's (or our) answer consistent: the main tag is one of the tags, and "free" is only main if it's alone. */
export function cleanMood(m: MoodFilters): MoodFilters {
  const tags = [...new Set(m.tags.filter((t) => ALL_TAGS.includes(t)))];
  let primary = m.primaryTag && ALL_TAGS.includes(m.primaryTag) ? m.primaryTag : null;
  if (primary === "free" && tags.some((t) => t !== "free")) primary = null;
  primary ??= tags.find((t) => t !== "free") ?? tags[0] ?? null;
  if (primary && !tags.includes(primary)) tags.unshift(primary);
  const required = [...new Set((m.required ?? []).filter((r) => ALL_TAGS.includes(r) || ALL_TYPES.includes(r)))];
  return { ...m, tags, primaryTag: primary, required };
}

// Keyword rules for the offline fallback. `require` marks words that clearly NAME a kind of place or activity.
const RULES: { words: string[]; tags?: string[]; types?: string[]; require?: string }[] = [
  { words: ["sport", "gym", "climb", "boulder", "swim", "football", "tennis", "yoga", "workout", "run "], tags: ["sport"], require: "sport" },
  { words: ["move", "exercise", "active", "energy"], tags: ["sport"] },
  { words: ["study", "revise", "revision", "library", "essay", "deadline"], tags: ["study"], types: ["study"], require: "study" },
  { words: ["work", "focus"], tags: ["study"] },
  { words: ["coffee", "café", "cafe"], tags: ["food"], types: ["cafe"], require: "cafe" },
  { words: ["hungry", "eat", "food", "lunch", "snack"], tags: ["food"], types: ["cafe"] },
  { words: ["museum", "gallery", "exhibition"], tags: ["creative"], require: "creative" },
  { words: ["creative", "art", "photo", "draw", "inspired"], tags: ["creative"] },
  { words: ["lecture", "talk", "science", "learn", "curious", "history", "seminar"], tags: ["learning"] },
  { words: ["tired", "drained", "exhausted", "chill", "calm", "quiet", "alone", "recharge", "stressed"], tags: ["quiet"] },
  { words: ["people", "friends", "meet", "social", "lonely", "chat", "bored"], tags: ["social"], types: ["event"] },
  { words: ["outside", "fresh air", "sun", "walk", "park"], tags: ["outdoors"] },
  { words: ["event", "society", "something new", "try"], types: ["event"] },
  { words: ["deal", "discount", "offer"], types: ["deal"] },
];

/** Keyword fallback when Gemini isn't available. The main tag comes from the first words that match. */
export function moodFallback(text: string): MoodFilters {
  const t = ` ${text.toLowerCase()} `;
  const tags = new Set<string>();
  const types = new Set<string>();
  const required = new Set<string>();
  let maxPrice: number | null = null;
  let primary: { tag: string; at: number } | null = null;

  for (const r of RULES) {
    const at = Math.min(...r.words.map((w) => t.indexOf(w)).filter((i) => i >= 0));
    if (!Number.isFinite(at)) continue;
    r.tags?.forEach((x) => tags.add(x));
    r.types?.forEach((x) => types.add(x));
    if (r.require) required.add(r.require);
    if (r.tags?.[0] && (!primary || at < primary.at)) primary = { tag: r.tags[0], at };
  }
  if (["broke", "free", "no money", "skint", "cheap", "poor"].some((w) => t.includes(w))) {
    maxPrice = 0;
    tags.add("free");
  }
  const fiver = t.match(/(?:£|under |about |a )(\d+|fiver|tenner)/);
  if (fiver) maxPrice = fiver[1] === "fiver" ? 5 : fiver[1] === "tenner" ? 10 : Number(fiver[1]);

  const bits = [...tags].filter((x) => x !== "free").slice(0, 3).join(", ");
  return cleanMood({
    tags: [...tags],
    types: [...types],
    maxPrice,
    primaryTag: primary?.tag ?? null,
    required: [...required],
    summary: bits
      ? `Looking for: ${bits}${maxPrice === 0 ? ", free only" : maxPrice !== null ? `, up to £${maxPrice}` : ""}`
      : "Showing the best fits for your gap",
  });
}
