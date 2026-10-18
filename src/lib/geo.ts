// Distances, walking and Tube/bus estimates, and the reach zone (ellipse or circle).
// Straight-line distance x 1.3 (streets aren't straight) at 80 m per minute (~4.8 km/h).
const WALK_M_PER_MIN = 80;
const DETOUR = 1.3;

type LatLng = { lat: number; lng: number };

export function metres(a: LatLng, b: LatLng) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const walkMinutes = (a: LatLng, b: LatLng) => Math.max(1, Math.round((metres(a, b) * DETOUR) / WALK_M_PER_MIN));

export type TravelMode = "walk" | "transit";

// Tube/bus estimate for when Google's Routes API can't answer:
// 10 min getting to and from stations, then straight-line distance at 400 m per minute.
const STATION_MIN = 10;
const TRANSIT_M_PER_MIN = 400;
export const transitEstimate = (a: LatLng, b: LatLng) => Math.round(STATION_MIN + metres(a, b) / TRANSIT_M_PER_MIN);
/** How far (straight line, metres) you can get in this many minutes: walking, or the bigger of walking and Tube/bus. */
export function reachRadius(minutes: number, mode: TravelMode = "walk") {
  const walk = (minutes * WALK_M_PER_MIN) / DETOUR;
  return mode === "transit" ? Math.max(walk, (minutes - STATION_MIN) * TRANSIT_M_PER_MIN) : walk;
}

/** Places closer than this are always walked, even in "Walk + Tube/bus" mode. */
export const WALK_ONLY_MIN = 15;

/**
 * The "reach zone": every point P where walk(A→P) + walk(P→B) ≤ budget.
 * Geometrically that's an ELLIPSE whose two foci are A (where you are) and B (your next class).
 * Returns polygon points to draw on the map, or null if the budget is too small.
 */
/**
 * "Nowhere, I'm done for the day": no trip back, so the reach zone is a CIRCLE around you whose radius is how far you
 * can get in the time left (walking, or the bigger of walking and the Tube/bus estimate).
 */
export function reachCircle(a: LatLng, budgetMinutes: number, mode: TravelMode = "walk", steps = 72): [number, number][] | null {
  const walkR = (budgetMinutes * WALK_M_PER_MIN) / DETOUR;
  const r = mode === "transit" ? Math.max(walkR, (budgetMinutes - STATION_MIN) * TRANSIT_M_PER_MIN) : walkR;
  if (r < 20) return null;
  const mPerDegLng = 111320 * Math.cos((a.lat * Math.PI) / 180);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = (i / steps) * 2 * Math.PI;
    return [a.lat + (r * Math.sin(t)) / 111320, a.lng + (r * Math.cos(t)) / mPerDegLng] as [number, number];
  });
}

export function reachEllipse(a: LatLng, b: LatLng, budgetMinutes: number, mode: TravelMode = "walk", steps = 72): [number, number][] | null {
  // Straight-line distance allowed for A→P→B. With Tube/bus, each leg costs STATION_MIN plus distance at
  // TRANSIT_M_PER_MIN, so the zone is the bigger of the walking and the transit ellipse (an estimate).
  const walkSum = (budgetMinutes * WALK_M_PER_MIN) / DETOUR;
  const transitSum = (budgetMinutes - 2 * STATION_MIN) * TRANSIT_M_PER_MIN;
  const sumMetres = mode === "transit" ? Math.max(walkSum, transitSum) : walkSum;
  const lat0 = (a.lat + b.lat) / 2;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((lat0 * Math.PI) / 180);
  // Work in a flat x/y metre grid centred between the foci.
  const ax = (a.lng - (a.lng + b.lng) / 2) * mPerDegLng;
  const ay = (a.lat - lat0) * mPerDegLat;
  const c = Math.hypot(ax, ay); // half the distance between foci
  const semiMajor = sumMetres / 2;
  if (semiMajor <= c + 10) return null;
  const semiMinor = Math.sqrt(semiMajor ** 2 - c ** 2);
  const angle = Math.atan2(ay, ax);
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const x = semiMajor * Math.cos(t);
    const y = semiMinor * Math.sin(t);
    const rx = x * Math.cos(angle) - y * Math.sin(angle);
    const ry = x * Math.sin(angle) + y * Math.cos(angle);
    pts.push([lat0 + ry / mPerDegLat, (a.lng + b.lng) / 2 + rx / mPerDegLng]);
  }
  return pts;
}
