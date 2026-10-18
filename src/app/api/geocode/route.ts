// Server route: finds a society venue on the map with Google Places text search.
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { query } = (await req.json()) as { query: string };
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key || !query?.trim()) return NextResponse.json({ error: "no key" }, { status: 404 });
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.location,places.formattedAddress,places.displayName",
      },
      body: JSON.stringify({
        textQuery: `${query}, London`,
        maxResultCount: 1,
        locationBias: { circle: { center: { latitude: 51.5136, longitude: -0.1235 }, radius: 5000 } },
      }),
    });
    const data = await res.json();
    const p = data.places?.[0];
    if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ lat: p.location.latitude, lng: p.location.longitude, address: p.formattedAddress });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
