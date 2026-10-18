// Saves your timetable and settings in this browser.
import { SAMPLE_TIMETABLE } from "./timetable";
import type { ClassBlock } from "./types";

// The timetable never leaves the browser. A calendar file is kept whole and expanded per week; a list (sample or
// screenshot) shows dated classes on their date and repeats undated ones weekly.
const WEEKLY_KEY = "sq-weekly-timetable-v3";
const CALENDAR_KEY = "sq-calendar-ics-v2";
// Old saves held weekday-only imports, which put every past Monday's events on this Monday: drop them.
const OLD_KEYS = ["mtg-timetable-v1", "sq-calendar-ics-v1", "sq-weekly-timetable-v2"];

function dropOldSaves() {
  for (const k of OLD_KEYS) localStorage.removeItem(k);
}

export type TimetableSource = { kind: "sample" | "weekly"; classes: ClassBlock[] } | { kind: "calendar"; ics: string };

export function loadTimetable(): TimetableSource {
  try {
    dropOldSaves();
    const ics = localStorage.getItem(CALENDAR_KEY);
    if (ics) return { kind: "calendar", ics };
    const raw = localStorage.getItem(WEEKLY_KEY);
    if (raw) {
      const classes = JSON.parse(raw) as ClassBlock[];
      if (Array.isArray(classes)) return { kind: "weekly", classes };
    }
  } catch {}
  return { kind: "sample", classes: SAMPLE_TIMETABLE };
}

export function saveWeekly(classes: ClassBlock[]) {
  try {
    localStorage.removeItem(CALENDAR_KEY);
    localStorage.setItem(WEEKLY_KEY, JSON.stringify(classes));
  } catch {}
}

export function saveCalendar(ics: string) {
  try {
    localStorage.removeItem(WEEKLY_KEY);
    localStorage.setItem(CALENDAR_KEY, ics);
    return true;
  } catch {
    return false; // too big for this browser's storage
  }
}

export function resetTimetable() {
  try {
    localStorage.removeItem(WEEKLY_KEY);
    localStorage.removeItem(CALENDAR_KEY);
    dropOldSaves();
  } catch {}
}

// Your usual home station ("After this I need to be at"), remembered on this device.
const HOME_STATION_KEY = "sq-home-station-v1";

export function loadHomeStation(): string | null {
  try {
    return localStorage.getItem(HOME_STATION_KEY);
  } catch {
    return null;
  }
}

export function saveHomeStation(id: string) {
  try {
    localStorage.setItem(HOME_STATION_KEY, id);
  } catch {}
}
