// Live Google places: the search area, the opening-hours check and merging with our own data.
import { reachRadius, type TravelMode } from "./geo";
import { toMin } from "./time";
import type { Place, PlaceType } from "./types";

/** Opening hours for one weekday (0 = Sunday), "HH:MM". A place open past midnight closes at "23:59" here. */
export type DayHours = { day: number; open: string; close: string };

/** What /api/places sends back: a place with its whole week of opening hours, so any gap can be checked. */
export type LiveResult = {
  id: string; // same "g-<Google id>" as the snapshot, so duplicates are easy to spot
  name: string;
  type: PlaceType;
  lat: number;
  lng: number;
  price: number;
  tags: string[];
  minutesNeeded: number;
  mapsUrl?: string;
  hours: DayHours[];
};

// Google place types -> our types, tags and how long a visit takes (the same as scripts/import-google-places.mjs).
export const LIVE_CATEGORIES: {
  googleTypes?: string[];
  text?: string; // Google has no "climbing wall" type, so that one is a text search
  type: PlaceType;
  tags: string[];
  minutes: number;
  price?: number; // used when Google doesn't know the price
  mainTypes?: string[]; // keep only places whose MAIN category is one of these (drops hotels with a gym, etc.)
  nameMatch?: RegExp;
  alwaysOpen?: boolean; // Google often has no hours for parks: treat them as open
}[] = [
  { googleTypes: ["cafe", "coffee_shop"], type: "cafe", tags: ["food", "social"], minutes: 30, price: 4 },
  { googleTypes: ["library"], type: "study", tags: ["study", "quiet", "free"], minutes: 45, price: 0 },
  {
    googleTypes: ["park"], type: "activity", tags: ["outdoors", "quiet", "free"], minutes: 20, price: 0, alwaysOpen: true,
    mainTypes: ["park", "garden", "botanical_garden", "national_park", "city_park"], // not Winter Wonderland or a playground
  },
  {
    googleTypes: ["museum", "art_gallery"], type: "activity", tags: ["creative"], minutes: 45, price: 0,
    mainTypes: ["museum", "art_gallery", "art_museum", "history_museum", "cultural_center", "historical_landmark"],
  },
  {
    googleTypes: ["gym", "fitness_center"], type: "activity", tags: ["sport"], minutes: 60, price: 10,
    mainTypes: ["gym", "fitness_center", "sports_complex", "sports_club", "yoga_studio"],
  },
  { text: "climbing wall", type: "activity", tags: ["sport"], minutes: 60, price: 15, nameMatch: /climb|boulder/i },
];

const GRID = 0.005; // searches are snapped to a ~500 m grid, so nearby starting points share one cached search
const RADIUS_STEP = 500;

/** The search circle for a gap: centred on where you start, as far as you could go and still get back. */
export function searchArea(from: { lat: number; lng: number }, gapMinutes: number, mode: TravelMode) {
  const oneWay = Math.max(0, (gapMinutes - 25) / 2); // half of what's left after a short stop and the buffer
  return snapArea(from.lat, from.lng, Math.min(mode === "transit" ? 5000 : 2500, reachRadius(oneWay, mode)));
}

/** Rounds a search circle to the grid (and the radius to 500 m steps, 500 m–5 km), with a key for caching it. */
export function snapArea(lat: number, lng: number, radius: number) {
  const r = Math.min(5000, Math.max(RADIUS_STEP, Math.round(radius / RADIUS_STEP) * RADIUS_STEP));
  const la = (Math.round(lat / GRID) * GRID).toFixed(3);
  const ln = (Math.round(lng / GRID) * GRID).toFixed(3);
  return { lat: Number(la), lng: Number(ln), radius: r, key: `${la},${ln}|${r}` };
}

/** A live place as it is on one date, or null if it isn't open at any point during the gap. */
export function openDuringGap(p: LiveResult, date: string, start: string, end: string): Place | null {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const s = toMin(start);
  const e = toMin(end);
  const overlap = (h: DayHours) => Math.min(e, toMin(h.close)) - Math.max(s, toMin(h.open));
  const best = p.hours.filter((h) => h.day === weekday && overlap(h) > 0).sort((a, b) => overlap(b) - overlap(a))[0];
  if (!best) return null;
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    uni: null,
    society: null,
    day: null,
    open: best.open,
    close: best.close,
    lat: p.lat,
    lng: p.lng,
    price: p.price,
    tags: p.tags,
    minutesNeeded: p.minutesNeeded,
    address: "",
    link: "",
    deal: null,
    source: "google",
    live: true,
    mapsUrl: p.mapsUrl,
  };
}

/**
 * Our events, society events and the snapshot, plus the live places. A live place replaces its snapshot copy (its hours
 * are fresher), and is dropped if it has the same name as one of our own listings (those always stay).
 */
export function mergeLive(base: Place[], live: Place[]): Place[] {
  if (!live.length) return base;
  const liveIds = new Set(live.map((p) => p.id));
  const kept = base.filter((p) => p.source !== "google" || !liveIds.has(p.id));
  const ourNames = new Set(kept.filter((p) => p.source !== "google").map((p) => p.name.toLowerCase()));
  return [...kept, ...live.filter((p) => !ourNames.has(p.name.toLowerCase()))];
}
