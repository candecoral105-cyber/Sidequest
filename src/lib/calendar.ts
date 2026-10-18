// .ics calendar import (ical.js): real dates, repeats and time zones, all shown in UK time.
import ICAL from "ical.js";
import { matchBuilding } from "../data/buildings";
import type { ClassBlock } from "./types";

export type DayNote = { date: string; title: string };
type CalendarStats = { classes: number; allDay: number; past: number; later: number };
type Expanded = { classes: ClassBlock[]; notes: DayNote[]; stats: CalendarStats };

const MAX_REPEATS = 5000; // safety stop for very long or endless repeats

/** A moment as UK date, time and weekday ("2026-10-19", "09:00", 1). */
const ukFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});
const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
function uk(d: Date) {
  const p = Object.fromEntries(ukFormat.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, weekday: WEEKDAY[p.weekday] };
}

/** An all-day ICAL.Time as "YYYY-MM-DD" (all-day dates have no time zone). */
const dayOf = (t: ICAL.Time) => `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + n));
  return x.toISOString().slice(0, 10);
}

/** Parses the file once and registers its time zones so times convert correctly. */
export function readCalendar(text: string) {
  const root = new ICAL.Component(ICAL.parse(text));
  for (const tz of root.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(tz);
  const all = root.getAllSubcomponents("vevent").map((c) => new ICAL.Event(c));
  // Moved or edited single instances of a repeating event are attached to their series.
  const masters = new Map<string, ICAL.Event>();
  for (const e of all) if (!e.isRecurrenceException()) masters.set(e.uid ?? Math.random().toString(36), e);
  for (const e of all) if (e.isRecurrenceException() && e.uid && masters.has(e.uid)) masters.get(e.uid)!.relateException(e);
  return [...masters.values()];
}

/** Every event happening between two dates (inclusive), in UK time, plus counts for the import summary. */
export function expandCalendar(events: ICAL.Event[], from: string, to: string): Expanded {
  const classes: ClassBlock[] = [];
  const notes: DayNote[] = [];
  const stats: CalendarStats = { classes: 0, allDay: 0, past: 0, later: 0 };

  for (const ev of events) {
    const title = (ev.summary || "Untitled").trim();
    const allDay = ev.startDate?.isDate;
    if (!ev.startDate) continue;
    if (allDay) stats.allDay++;

    let inRange = false;
    let beforeOnly = true;
    const occurrences = ev.isRecurring() ? ev.iterator() : null;
    for (let i = 0; i < MAX_REPEATS; i++) {
      const next = occurrences ? occurrences.next() : i === 0 ? ev.startDate : null;
      if (!next) break;
      const { startDate, endDate } = occurrences ? ev.getOccurrenceDetails(next) : { startDate: ev.startDate, endDate: ev.endDate };

      if (allDay) {
        // All-day: one note per day it covers (DTEND is the day after the last day).
        const first = dayOf(startDate);
        const last = endDate ? addDays(dayOf(endDate), -1) : first;
        if (first > to) break;
        for (let d = first; d <= last && d <= to; d = addDays(d, 1)) if (d >= from) notes.push({ date: d, title });
        continue;
      }

      const s = uk(startDate.toJSDate());
      if (s.date > to) {
        beforeOnly = false;
        break;
      }
      if (s.date < from) continue;
      beforeOnly = false;
      inRange = true;
      const e = endDate ? uk(endDate.toJSDate()) : s;
      const loc = ev.location?.trim() || undefined;
      classes.push({
        id: `${ev.uid}@${s.date}T${s.time}`,
        seriesId: ev.uid ?? title,
        title,
        date: s.date,
        day: s.weekday,
        start: s.time,
        end: e.date === s.date ? e.time : "23:59", // ends after midnight: stop at the end of the day
        buildingId: matchBuilding(loc)?.id ?? null,
        location: loc,
      });
    }
    if (!allDay) {
      if (inRange) stats.classes++;
      else if (beforeOnly) stats.past++;
      else stats.later++;
    }
  }
  classes.sort((a, b) => (a.date! + a.start).localeCompare(b.date! + b.start));
  stats.classes = classes.length;
  return { classes, notes, stats };
}
