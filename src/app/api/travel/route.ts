// Server route: Tube/bus journey times from Google's Routes API.
import { NextResponse } from "next/server";

// Cached while the server runs, so reopening a gap costs nothing. On failure the browser falls back to its estimate.

type LatLng = { lat: number; lng: number };
type Body = { from: LatLng; to: LatLng; places: ({ id: string } & LatLng)[]; date: string; time: string };

const MAX_PLACES = 300;
const CHUNK = 100; // Google's limit for transit: 100 origin × destination pairs per request
const cache = new Map<string, number | null>(); // "lat,lng>lat,lng@date hour" -> minutes (null = no route)
const pt = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
const waypoint = (p: LatLng) => ({ waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } } });

/** "2026-10-19" + "11:00" in London time -> RFC 3339 with the right offset (BST or GMT). */
function londonTime(date: string, time: string) {
  const guess = new Date(`${date}T${time}:00Z`);
  const offset = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", timeZoneName: "longOffset" })
    .formatToParts(guess)
    .find((p) => p.type === "timeZoneName")!.value.replace("GMT", "") || "+00:00";
  return `${date}T${time}:00${offset}`;
}

async function matrix(key: string, origins: LatLng[], destinations: LatLng[], departureTime: string) {
  const res = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "originIndex,destinationIndex,duration,condition",
    },
    body: JSON.stringify({ origins: origins.map(waypoint), destinations: destinations.map(waypoint), travelMode: "TRANSIT", departureTime }),
  });
  if (!res.ok) throw new Error(`Routes API error ${res.status}: ${await res.text()}`);
  return (await res.json()) as { originIndex?: number; destinationIndex?: number; duration?: string; condition?: string }[];
}

export async function POST(req: Request) {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json({ error: "No Google key" }, { status: 503 });
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    // The page was closed or moved on while sending (or sent junk): nothing to answer.
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const { from, to, places, date, time } = body;
  if (!from || !to || !Array.isArray(places) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const list = places.slice(0, MAX_PLACES);
  const departure = londonTime(date, time);
  const hour = `${date} ${time.slice(0, 2)}`;
  const k = (a: LatLng, b: LatLng) => `${pt(a)}>${pt(b)}@${hour}`;

  const there: Record<string, number> = {};
  const back: Record<string, number> = {};
  const toFetchThere = list.filter((p) => !cache.has(k(from, p)));
  const toFetchBack = list.filter((p) => !cache.has(k(p, to)));

  try {
    for (let i = 0; i < toFetchThere.length; i += CHUNK) {
      const chunk = toFetchThere.slice(i, i + CHUNK);
      const rows = await matrix(key, [from], chunk, departure);
      chunk.forEach((p) => cache.set(k(from, p), null));
      for (const r of rows) {
        if (r.condition === "ROUTE_EXISTS" && r.duration && r.destinationIndex !== undefined) {
          cache.set(k(from, chunk[r.destinationIndex]), Math.ceil(parseInt(r.duration) / 60));
        }
      }
    }
    for (let i = 0; i < toFetchBack.length; i += CHUNK) {
      const chunk = toFetchBack.slice(i, i + CHUNK);
      const rows = await matrix(key, chunk, [to], departure);
      chunk.forEach((p) => cache.set(k(p, to), null));
      for (const r of rows) {
        if (r.condition === "ROUTE_EXISTS" && r.duration && r.originIndex !== undefined) {
          cache.set(k(chunk[r.originIndex], to), Math.ceil(parseInt(r.duration) / 60));
        }
      }
    }
  } catch (e) {
    console.error("Transit times failed, the browser will estimate:", e);
    return NextResponse.json({ error: "Routes API failed" }, { status: 502 });
  }

  for (const p of list) {
    const a = cache.get(k(from, p));
    const b = cache.get(k(p, to));
    if (a != null) there[p.id] = a;
    if (b != null) back[p.id] = b;
  }
  return NextResponse.json({ there, back });
}
