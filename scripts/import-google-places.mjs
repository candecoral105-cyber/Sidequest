// Refreshes our saved snapshot of Google places (src/data/google-places.json): npm run import-places.
import { writeFileSync } from "node:fs";

// Needs GOOGLE_MAPS_API_KEY in .env.local with "Places API (New)" enabled.

const KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
if (!KEY) {
  console.error("No Google key found. Add GOOGLE_MAPS_API_KEY=... to .env.local");
  process.exit(1);
}

// Areas around the campuses (edit or add more).
const AREAS = [
  { name: "Strand & Aldwych", lat: 51.512, lng: -0.117 },
  { name: "Covent Garden", lat: 51.5125, lng: -0.1235 },
  { name: "South Bank & Waterloo", lat: 51.5055, lng: -0.115 },
  { name: "Bloomsbury", lat: 51.522, lng: -0.13 },
  { name: "South Kensington (Imperial, V&A)", lat: 51.4975, lng: -0.1745 },
  { name: "Hyde Park", lat: 51.5073, lng: -0.1657 },
  { name: "King's Cross & Euston (British Library, Crick, Wellcome)", lat: 51.5285, lng: -0.1295 },
  { name: "Westminster & Millbank (Tate Britain)", lat: 51.4955, lng: -0.1285 },
  { name: "London Bridge & Guy's", lat: 51.504, lng: -0.088 },
  { name: "Waterloo", lat: 51.5025, lng: -0.1135 },
];

// Google place types -> our types, tags and how long a visit takes.
const CATEGORIES = [
  { googleTypes: ["cafe", "coffee_shop"], type: "cafe", tags: ["food", "social"], minutes: 30 },
  { googleTypes: ["library"], type: "study", tags: ["study", "quiet", "free"], minutes: 45 },
  { googleTypes: ["park"], type: "activity", tags: ["outdoors", "quiet", "free"], minutes: 20 },
  { googleTypes: ["museum", "art_gallery"], type: "activity", tags: ["creative"], minutes: 45, mainTypes: ["museum", "art_gallery", "art_museum", "history_museum", "cultural_center", "historical_landmark"] },
  // Sports: Google rarely knows gym prices, so we use a typical drop-in price instead of calling them free.
  // Hotels and bars with a gym also match these types, so `mainTypes` keeps only places whose main category is sport.
  { googleTypes: ["gym", "fitness_center", "sports_complex", "swimming_pool", "sports_activity_location"], type: "activity", tags: ["sport"], minutes: 60, price: 10,
    mainTypes: ["gym", "fitness_center", "sports_complex", "swimming_pool", "sports_activity_location", "sports_club", "sports_coaching", "yoga_studio", "athletic_field", "tennis_court", "ice_skating_rink"] },
  // Google has no "climbing wall" type, so search for it by name.
  { text: "climbing wall", type: "activity", tags: ["sport"], minutes: 60, price: 15, nameMatch: /climb|boulder/i },
];

// Google results that aren't really places to go in a gap (checked by hand). Add names here to hide them.
const EXCLUDE = new Set(["IMAX Gap", "APK.MOM"]);

const PRICE = { PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 4, PRICE_LEVEL_MODERATE: 8, PRICE_LEVEL_EXPENSIVE: 15, PRICE_LEVEL_VERY_EXPENSIVE: 25 };
const pad = (n) => String(n).padStart(2, "0");

// Our data has one opening time per place, so use Tuesday's hours (or the first weekday listed).
function hours(opening) {
  const periods = opening?.periods;
  if (!periods?.length) return { open: "09:00", close: "18:00" };
  if (periods.length === 1 && !periods[0].close) return { open: "00:00", close: "23:59" }; // open 24 hours
  const p = periods.find((x) => x.open?.day === 2) ?? periods.find((x) => x.open?.day >= 1 && x.open?.day <= 5) ?? periods[0];
  const close = p.close && p.close.day === p.open.day ? `${pad(p.close.hour)}:${pad(p.close.minute)}` : "23:59";
  return { open: `${pad(p.open.hour)}:${pad(p.open.minute)}`, close };
}

const FIELDS =
  "places.id,places.displayName,places.location,places.priceLevel,places.regularOpeningHours,places.formattedAddress,places.googleMapsUri,places.businessStatus,places.primaryType";
const RADIUS = 700;

function metres(a, b) {
  const R = 6371000, rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function nearby(area, cat) {
  const circle = { center: { latitude: area.lat, longitude: area.lng }, radius: RADIUS };
  const res = await fetch(`https://places.googleapis.com/v1/places:${cat.text ? "searchText" : "searchNearby"}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": FIELDS },
    body: JSON.stringify(
      cat.text
        ? { textQuery: cat.text, pageSize: 10, locationBias: { circle } }
        : { includedTypes: cat.googleTypes, maxResultCount: 12, rankPreference: "POPULARITY", locationRestriction: { circle } },
    ),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data.error ?? data)}`);
  // Text search only leans towards the area, so drop results that are far from it.
  return (data.places ?? [])
    .filter((g) => !cat.text || metres(area, { lat: g.location.latitude, lng: g.location.longitude }) < RADIUS * 1.5)
    .filter((g) => !cat.mainTypes || cat.mainTypes.includes(g.primaryType))
    .filter((g) => !cat.nameMatch || cat.nameMatch.test(g.displayName?.text ?? ""));
}

const seen = new Map();
for (const area of AREAS) {
  for (const cat of CATEGORIES) {
    try {
      const results = await nearby(area, cat);
      for (const g of results) {
        if (seen.has(g.id) || (g.businessStatus && g.businessStatus !== "OPERATIONAL") || EXCLUDE.has(g.displayName?.text)) continue;
        const price = g.priceLevel in PRICE ? PRICE[g.priceLevel] : (cat.price ?? (cat.type === "cafe" ? 4 : 0));
        seen.set(g.id, {
          id: `g-${g.id}`,
          name: g.displayName?.text ?? "Unnamed place",
          type: cat.type,
          uni: null,
          society: null,
          day: null,
          ...hours(g.regularOpeningHours),
          lat: g.location.latitude,
          lng: g.location.longitude,
          price,
          tags: price === 0 && !cat.tags.includes("free") ? [...cat.tags, "free"] : cat.tags,
          minutesNeeded: cat.minutes,
          address: g.formattedAddress ?? "",
          link: "",
          deal: null,
          source: "google",
          mapsUrl: g.googleMapsUri,
        });
      }
      console.log(`${area.name} · ${cat.text ?? cat.googleTypes.join("/")}: ${results.length} found`);
    } catch (e) {
      console.error(`${area.name} · ${cat.text ?? cat.googleTypes.join("/")} failed:`, e.message);
    }
  }
}

const out = [...seen.values()];
writeFileSync(new URL("../src/data/google-places.json", import.meta.url), JSON.stringify(out, null, 2));
console.log(`\nSaved ${out.length} real places to src/data/google-places.json`);
