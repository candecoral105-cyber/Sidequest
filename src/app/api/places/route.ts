// Server route: live places near a gap from Google Places, with their opening hours.
import { NextResponse } from "next/server";
import { metres } from "@/lib/geo";
import { LIVE_CATEGORIES, snapArea, type DayHours, type LiveResult } from "@/lib/livePlaces";

// Results are kept for a few hours per area, so moving the time slider, changing filters or reopening the gap
// doesn't call Google again. If this fails, the app uses the saved snapshot.

const KEEP_MS = 3 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; places: LiveResult[] }>();
// Only the fields we use (each extra field can move a request into a pricier tier).
const FIELDS =
  "places.id,places.displayName,places.location,places.regularOpeningHours,places.priceLevel,places.primaryType,places.googleMapsUri";
const PRICE: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 4,
  PRICE_LEVEL_MODERATE: 8,
  PRICE_LEVEL_EXPENSIVE: 15,
  PRICE_LEVEL_VERY_EXPENSIVE: 25,
};

type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  location: { latitude: number; longitude: number };
  regularOpeningHours?: { periods?: { open: Point; close?: Point }[] };
  priceLevel?: string;
  primaryType?: string;
  googleMapsUri?: string;
};
type Point = { day: number; hour: number; minute: number };

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (p: Point) => `${pad(p.hour)}:${pad(p.minute)}`;
const ALL_WEEK = (open: string, close: string): DayHours[] => [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open, close }));

/** Google's weekly opening periods -> one entry per day. No hours at all -> [] (unknown), unless `alwaysOpen`. */
function weekHours(g: GooglePlace, alwaysOpen?: boolean): DayHours[] {
  const periods = g.regularOpeningHours?.periods;
  if (!periods?.length) return alwaysOpen ? ALL_WEEK("00:00", "23:59") : [];
  if (periods.length === 1 && !periods[0].close) return ALL_WEEK("00:00", "23:59"); // open 24 hours
  return periods.map((p) => ({
    day: p.open.day,
    open: hhmm(p.open),
    close: p.close && p.close.day === p.open.day ? hhmm(p.close) : "23:59", // open past midnight
  }));
}

async function search(key: string, area: { lat: number; lng: number; radius: number }, cat: (typeof LIVE_CATEGORIES)[number]) {
  const circle = { center: { latitude: area.lat, longitude: area.lng }, radius: area.radius };
  const res = await fetch(`https://places.googleapis.com/v1/places:${cat.text ? "searchText" : "searchNearby"}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
    body: JSON.stringify(
      cat.text
        ? { textQuery: cat.text, pageSize: 10, locationBias: { circle } }
        : { includedTypes: cat.googleTypes, maxResultCount: 20, rankPreference: "POPULARITY", locationRestriction: { circle } },
    ),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Places API error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { places?: GooglePlace[] };
  return (data.places ?? [])
    .filter((g) => !cat.text || metres(area, { lat: g.location.latitude, lng: g.location.longitude }) <= area.radius) // text search only leans towards the area
    .filter((g) => !cat.mainTypes || cat.mainTypes.includes(g.primaryType ?? ""))
    .filter((g) => !cat.nameMatch || cat.nameMatch.test(g.displayName?.text ?? ""));
}

export async function POST(req: Request) {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json({ error: "No Google key" }, { status: 503 });
  let body: { lat: number; lng: number; radius: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (![body?.lat, body?.lng, body?.radius].every(Number.isFinite)) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  // Snap again here, so the cache key can't be dodged with slightly different numbers.
  const area = snapArea(body.lat, body.lng, body.radius);
  const hit = cache.get(area.key);
  if (hit && Date.now() - hit.at < KEEP_MS) return NextResponse.json({ places: hit.places, cached: true });

  const found = new Map<string, LiveResult>();
  const results = await Promise.allSettled(LIVE_CATEGORIES.map((cat) => search(key, area, cat).then((list) => ({ cat, list }))));
  for (const r of results) if (r.status === "rejected") console.error("Live places search failed:", r.reason);
  // A place can turn up in several searches (a gallery with a café): Google's main category for it decides first.
  const hits = results
    .flatMap((r) => (r.status === "fulfilled" ? r.value.list.map((g) => ({ cat: r.value.cat, g })) : []))
    .map((h) => ({ ...h, exact: [...(h.cat.googleTypes ?? []), ...(h.cat.mainTypes ?? [])].includes(h.g.primaryType ?? "") }))
    .sort((a, b) => Number(b.exact) - Number(a.exact));
  for (const { cat, g } of hits) {
    const id = `g-${g.id}`;
    const hours = weekHours(g, cat.alwaysOpen);
    if (found.has(id) || !hours.length) continue; // no opening hours: we can't tell if it's open in the gap
    const price = g.priceLevel && g.priceLevel in PRICE ? PRICE[g.priceLevel] : (cat.price ?? 0);
    found.set(id, {
      id,
      name: g.displayName?.text ?? "Unnamed place",
      type: cat.type,
      lat: g.location.latitude,
      lng: g.location.longitude,
      price,
      tags: price === 0 && !cat.tags.includes("free") ? [...cat.tags, "free"] : cat.tags,
      minutesNeeded: cat.minutes,
      mapsUrl: g.googleMapsUri,
      hours,
    });
  }

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed === results.length) return NextResponse.json({ error: "Google Places didn't answer" }, { status: 502 });
  const places = [...found.values()];
  if (!failed) cache.set(area.key, { at: Date.now(), places }); // a partly failed search is tried again next time
  return NextResponse.json({ places, cached: false });
}
