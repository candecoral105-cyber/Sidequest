// The sample week, your classes for any week, and finding the free gaps between them.
import { expandCalendar, readCalendar, type DayNote } from "./calendar";
import { isClassLike } from "./classify";
import type { TimetableSource } from "./storage";
import { schoolWeek, toHHMM, toMin } from "./time";
import type { ClassBlock, Gap } from "./types";

// Demo week: the gaps are timed to land on real events in places.json for 19–22 Oct 2026
// (Mon: UCL bake sale, Wed: KCLSU food market, Thu: Sip & Swap; Tue has none on purpose).
export const SAMPLE_TIMETABLE: ClassBlock[] = [
  { id: "s1", title: "Thermodynamics lecture", day: 1, start: "09:00", end: "11:00", buildingId: "bush-house" },
  { id: "s2", title: "Fluids lab", day: 1, start: "14:30", end: "16:00", buildingId: "strand" },
  { id: "s3", title: "Engineering maths", day: 2, start: "09:00", end: "11:00", buildingId: "bush-house" },
  { id: "s4", title: "Materials tutorial", day: 2, start: "14:10", end: "15:30", buildingId: "strand" },
  { id: "s5", title: "Maths tutorial", day: 3, start: "10:00", end: "12:00", buildingId: "strand" },
  { id: "s6", title: "Design studio", day: 3, start: "15:00", end: "17:00", buildingId: "waterloo" },
  { id: "s7", title: "Programming lecture", day: 4, start: "13:00", end: "15:00", buildingId: "bush-house" },
  { id: "s8", title: "Evening seminar", day: 4, start: "19:15", end: "20:30", buildingId: "strand" },
];

export const MIN_GAP = 45; // shorter gaps aren't worth exploring
export const DAY_START = 7 * 60; // gaps are only found between 07:00...
export const DAY_END = 22 * 60; // ...and 22:00, so a 03:00 event can't make a "03:00 until 09:45" gap

/** Every class between two dates (inclusive), each with its real date. Weekly timetables repeat on every matching weekday. */
export function timetableBetween(src: TimetableSource, from: string, to: string): { classes: ClassBlock[]; notes: DayNote[] } {
  if (src.kind === "calendar") {
    const { classes, notes } = expandCalendar(calendarEvents(src.ics), from, to);
    return { classes, notes };
  }
  const classes: ClassBlock[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const weekday = new Date(`${d}T12:00:00`).getDay();
    for (const c of src.classes) {
      // A dated class (e.g. from a multi-week screenshot) only appears on its own date; undated ones repeat weekly.
      if (c.date ? c.date !== d : c.day !== weekday) continue;
      classes.push({ ...c, id: `${c.id}@${d}`, seriesId: c.seriesId ?? c.id, date: d });
    }
  }
  return { classes, notes: [] };
}

/** The nearest other week (schoolWeek offset) with classes, looking 26 weeks either way. */
export function nearestClassWeek(src: TimetableSource, current: number, isHidden: (c: ClassBlock) => boolean = () => false) {
  // A calendar mixes classes with everything else; a timetable list (screenshot/sample) is all classes.
  const isClass = src.kind === "calendar" ? isClassLike : () => true;
  const RANGE = 26;
  const { classes } = timetableBetween(src, schoolWeek(-RANGE)[0], schoolWeek(RANGE)[4]);
  const counts = new Map<number, number>();
  for (const c of classes) {
    if (!isClass(c) || isHidden(c)) continue;
    for (let o = -RANGE; o <= RANGE; o++) {
      const w = schoolWeek(o);
      if (c.date! >= w[0] && c.date! <= w[4]) counts.set(o, (counts.get(o) ?? 0) + 1);
    }
  }
  const best = [...counts.keys()]
    .filter((o) => o !== current)
    .sort((a, b) => Math.abs(a - current) - Math.abs(b - current) || b - a)[0];
  return best === undefined ? null : { offset: best, count: counts.get(best)! };
}

// Parsing a big calendar is the slow part, so keep the last one.
let parsed: { ics: string; events: ReturnType<typeof readCalendar> } | null = null;
function calendarEvents(ics: string) {
  if (parsed?.ics !== ics) parsed = { ics, events: readCalendar(ics) };
  return parsed.events;
}

function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Overlapping classes count as one block. Unknown buildings count as Bush House until you pick one. */
export function findGaps(classes: ClassBlock[], date: string): Gap[] {
  const day = new Date(`${date}T12:00:00`).getDay();
  const blocks = classes
    .filter((c) => c.date === date)
    .map((c) => ({ s: Math.max(DAY_START, toMin(c.start)), e: Math.min(DAY_END, toMin(c.end)), b: c.buildingId }))
    .filter((x) => x.e > x.s)
    .sort((a, b) => a.s - b.s);
  const gaps: Gap[] = [];
  let cur = blocks[0];
  for (const next of blocks.slice(1)) {
    if (next.s - cur.e >= MIN_GAP) {
      gaps.push({ day, date, start: toHHMM(cur.e), end: toHHMM(next.s), fromId: cur.b ?? "bush-house", toId: next.b ?? "bush-house" });
    }
    if (next.e >= cur.e) cur = next.s <= cur.e ? { ...next, s: cur.s } : next;
  }
  return gaps;
}
