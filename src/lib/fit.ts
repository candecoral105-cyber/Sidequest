// The fit rule (does a place fit in the gap?), plus filters and ranking.
import { buildingById } from "@/data/buildings";
import { walkMinutes, type TravelMode } from "./geo";
import { OPEN_TO_ALL, isOpenToAll } from "./places";
import { nextDateFor, toMin } from "./time";
import type { Filters, Gap, MoodFilters, Place } from "./types";

export const BUFFER_MIN = 5; // safety margin before the next class
const DROP_IN_MIN = 120; // events longer than this (a bake sale, a display) are drop-in: come any time, stay a while
const DROP_IN_STAY = 45;

/** Is this place on at all on the gap's date? Real dates win; otherwise the old weekday field. */
export function happensOn(place: Place, date: string, weekday: number) {
  if (place.dates) return place.dates.includes(date);
  if (place.dateFrom && date < place.dateFrom) return false;
  if (place.dateTo && date > place.dateTo) return false;
  if (place.days) return place.days.includes(weekday);
  if (place.dateFrom || place.dateTo) return true;
  return place.day === null || place.day === weekday;
}

export type Fit = {
  place: Place;
  fits: boolean;
  reason?: string; // why it doesn't fit
  walkThere: number; // minutes to get there (walking, or by Tube/bus if thereBy is "transit")
  walkBack: number; // minutes from there to the next class
  thereBy: TravelMode;
  backBy: TravelMode;
  leaveAt: number; // minutes since midnight
  arriveAt: number;
  startAt: number; // when the activity starts (arrive, or event start)
  endAt: number;
  backAt: number; // arrival at next class building (or, with no destination, when you're done)
  noReturn?: boolean; // "Nowhere, I'm done for the day": no trip back, so backAt = when it ends
  spareMin: number; // minutes left over before next class
  score: number;
};

/**
 * THE RULE: walk there + time needed + walk to next class + buffer must fit before the next class.
 * `now` lets the demo slider pretend it's later in the gap.
 */
export type Travel = { there: number; back: number; thereBy: TravelMode; backBy: TravelMode };

export function checkFit(place: Place, gap: Gap, now: number, travel?: Travel): Fit {
  const from = gap.fromPoint ?? buildingById(gap.fromId);
  const noReturn = gap.toId === "none";
  const to = gap.toPoint ?? buildingById(gap.toId);
  const gapEnd = toMin(gap.end);
  const buffer = noReturn ? 0 : BUFFER_MIN; // nothing to be on time for
  const walkThere = travel?.there ?? walkMinutes(from, place);
  const walkBack = noReturn ? 0 : (travel?.back ?? walkMinutes(place, to));
  const thereBy: TravelMode = travel?.thereBy ?? "walk";
  const backBy: TravelMode = travel?.backBy ?? "walk";
  const open = toMin(place.open);
  const close = toMin(place.close);
  const dropIn = place.type === "event" && close - open > DROP_IN_MIN;
  const isEvent = place.type === "event" && !dropIn;
  const stay = dropIn ? Math.min(place.minutesNeeded, DROP_IN_STAY) : place.minutesNeeded;

  const base = { place, walkThere, walkBack, thereBy, backBy, noReturn };

  if (!happensOn(place, gap.date ?? nextDateFor(gap.day), gap.day)) {
    return { ...base, fits: false, reason: "Not on this day", leaveAt: now, arriveAt: 0, startAt: 0, endAt: 0, backAt: 0, spareMin: 0, score: 0 };
  }

  if (open >= gapEnd) {
    const reason = place.type === "event" ? "Starts after this gap" : "Opens after this gap";
    return { ...base, fits: false, reason, leaveAt: now, arriveAt: 0, startAt: open, endAt: close, backAt: 0, spareMin: 0, score: 0 };
  }

  let leaveAt = now;
  let arriveAt = now + walkThere;
  let startAt: number;
  let endAt: number;

  if (isEvent) {
    // You need to arrive by the start (10 min grace) and stay for minutesNeeded (or until it ends).
    if (arriveAt > open + 10) {
      return { ...base, fits: false, reason: "Already started", leaveAt, arriveAt, startAt: open, endAt: close, backAt: 0, spareMin: 0, score: 0 };
    }
    // Leave just in time to arrive at the start.
    if (arriveAt < open) {
      leaveAt = open - walkThere;
      arriveAt = open;
    }
    startAt = Math.max(arriveAt, open);
    endAt = Math.min(close, startAt + stay);
  } else {
    startAt = Math.max(arriveAt, open);
    endAt = startAt + stay;
    if (endAt > close) {
      return { ...base, fits: false, reason: arriveAt >= close ? "Closed by then" : "Closes too soon", leaveAt, arriveAt, startAt, endAt, backAt: 0, spareMin: 0, score: 0 };
    }
  }

  const backAt = endAt + walkBack;
  const spareMin = gapEnd - buffer - backAt;
  if (spareMin < 0) {
    return { ...base, fits: false, reason: walkThere + walkBack > gapEnd - now ? "Too far for this gap" : "Not enough time", leaveAt, arriveAt, startAt, endAt, backAt, spareMin, score: 0 };
  }
  return { ...base, fits: true, leaveAt, arriveAt, startAt, endAt, backAt, spareMin, score: 0 };
}

export function passesFilters(p: Place, f: Filters) {
  if (f.types.length && !f.types.includes(p.type)) return false;
  if (f.tags.length && !f.tags.some((t) => p.tags.includes(t))) return false;
  if (f.maxPrice !== null && p.price > f.maxPrice) return false;
  if (f.unis.length && !f.unis.some((u) => (u === OPEN_TO_ALL ? isOpenToAll(p) : p.uni === u))) return false;
  return true;
}

/** Closer first: every minute of travel costs a point. Then small bonuses for starting soon, events and free. */
export function fitScore(fit: Fit, now: number): number {
  let s = 60 - (fit.walkThere + fit.walkBack);
  s += Math.max(0, 15 - (fit.startAt - now) / 6);
  if (fit.place.type === "event") s += 10;
  if (fit.place.price === 0) s += 3;
  if (fit.spareMin < 10) s -= 5;
  return Math.round(s);
}

/** Rare tags count more (ln of places / places with it), so "learning" beats "free", which almost everything has. */
export function tagWeights(places: Place[]): Record<string, number> {
  const count: Record<string, number> = {};
  for (const p of places) {
    for (const t of new Set(p.tags)) count[t] = (count[t] ?? 0) + 1;
    count[`type:${p.type}`] = (count[`type:${p.type}`] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(count).map(([k, n]) => [k, Math.max(0.1, Math.log(places.length / n))]));
}

type MoodMatch = { matches: boolean; primary: boolean; relevance: number };

/** Matching only "free" doesn't count (almost everything is free) unless that's all they asked for. */
export function moodMatch(p: Place, mood: MoodFilters, weights: Record<string, number>): MoodMatch {
  const none = { matches: false, primary: false, relevance: 0 };
  if (mood.maxPrice !== null && p.price > mood.maxPrice) return none;
  const has = (x: string) => p.tags.includes(x) || p.type === x;
  if (mood.required?.length && !mood.required.some(has)) return none;
  if (!mood.tags.length && !mood.types.length) return { matches: true, primary: false, relevance: 0 };

  let relevance = 0;
  let meaningful = Boolean(mood.required?.length);
  for (const t of mood.tags) {
    if (!p.tags.includes(t)) continue;
    relevance += (weights[t] ?? 1) * (t === mood.primaryTag ? 3 : 1);
    if (t !== "free") meaningful = true;
  }
  if (mood.types.includes(p.type)) {
    relevance += weights[`type:${p.type}`] ?? 1;
    meaningful = true;
  }
  const onlyFree = mood.tags.every((t) => t === "free") && !mood.types.length;
  const primary = Boolean(mood.primaryTag && has(mood.primaryTag));
  return { matches: meaningful || (onlyFree && relevance > 0), primary, relevance };
}

/** Mood ranking: main tag first, then relevance (rounded, so nearly-equal matches tie), then fitScore breaks ties. */
export function byMood(a: { match: MoodMatch; score: number }, b: { match: MoodMatch; score: number }) {
  return (
    Number(b.match.primary) - Number(a.match.primary) ||
    Math.round(b.match.relevance * 2) - Math.round(a.match.relevance * 2) ||
    b.score - a.score
  );
}
