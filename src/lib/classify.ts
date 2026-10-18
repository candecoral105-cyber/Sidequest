// Spots which calendar events look like classes (lectures, labs, module codes).
import type { ClassBlock } from "./types";

// Only used to point you to weeks that have classes, never to hide anything: every timed event stays on the timeline.

const CLASS_WORDS =
  /\b(lectures?|tutorials?|workshops?|labs?|laborator\w*|seminars?|inductions?|practicals?|classes|class|lessons?|modules?)\b/i;
// KCL-style module codes, e.g. 5CCE2HMT, 4CCS1PRP, 7CCEMEMI (a level digit, letters, then more letters/digits).
const MODULE_CODE = /\b[4-7][A-Z]{2,4}[0-9][A-Z0-9]{2,5}\b/;

export function isClassLike(c: Pick<ClassBlock, "title" | "location">) {
  const text = `${c.title} ${c.location ?? ""}`;
  return CLASS_WORDS.test(text) || MODULE_CODE.test(text);
}
