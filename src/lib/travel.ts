// Walk + Tube/bus times, fetched once per gap (never on slider moves) to keep Routes API calls down.
"use client";
import { useEffect, useMemo, useState } from "react";
import type { Building } from "@/data/buildings";
import type { Travel } from "./fit";
import { WALK_ONLY_MIN, transitEstimate, walkMinutes, type TravelMode } from "./geo";
import type { Place } from "./types";

const MODE_KEY = "sq-travel-mode-v1";

export function loadTravelMode(): TravelMode {
  try {
    return localStorage.getItem(MODE_KEY) === "transit" ? "transit" : "walk";
  } catch {
    return "walk";
  }
}

export function saveTravelMode(mode: TravelMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {}
}

type Google = { there: Record<string, number>; back: Record<string, number> };
const cache = new Map<string, Promise<Google | null>>();

function fetchGoogle(from: Building, to: Building, date: string, time: string, places: Place[]) {
  const key = `${from.id}|${to.id}|${date}|${time}|${places.length}`;
  if (!cache.has(key)) {
    const req = fetch("/api/travel", {
      method: "POST",
      body: JSON.stringify({
        from: { lat: from.lat, lng: from.lng },
        to: { lat: to.lat, lng: to.lng },
        places: places.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng })),
        date,
        time,
      }),
    })
      .then((r) => (r.ok ? (r.json() as Promise<Google>) : null))
      .catch(() => null);
    cache.set(key, req);
    req.then((g) => !g && cache.delete(key)); // try again next time if it failed
  }
  return cache.get(key)!;
}

/** One leg: walk if it's short; otherwise the quicker of walking and transit (Google's time, or the estimate). */
function leg(walk: number, google: number | undefined, estimate: number): { min: number; by: TravelMode } {
  if (walk <= WALK_ONLY_MIN) return { min: walk, by: "walk" };
  const transit = google ?? estimate;
  return transit < walk ? { min: transit, by: "transit" } : { min: walk, by: "walk" };
}

type TravelInfo = { times: Record<string, Travel> | null; source: "walk" | "google" | "estimate" | "loading" };

export function useTravelTimes(mode: TravelMode, from: Building, to: Building, date: string, start: string, places: Place[]): TravelInfo {
  const far = useMemo(
    () => places.filter((p) => walkMinutes(from, p) > WALK_ONLY_MIN || walkMinutes(p, to) > WALK_ONLY_MIN),
    [places, from, to],
  );
  const [google, setGoogle] = useState<{ key: string; data: Google | null } | null>(null);
  const key = `${from.id}|${to.id}|${date}|${start}|${far.length}`;

  useEffect(() => {
    if (mode !== "transit" || far.length === 0) return;
    let live = true;
    fetchGoogle(from, to, date, start, far).then((data) => live && setGoogle({ key, data }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, key]);

  return useMemo(() => {
    if (mode === "walk") return { times: null, source: "walk" as const };
    const ready = google?.key === key || far.length === 0;
    const g = ready ? google?.data : undefined;
    const times: Record<string, Travel> = {};
    for (const p of places) {
      const there = leg(walkMinutes(from, p), g?.there[p.id], transitEstimate(from, p));
      const back = leg(walkMinutes(p, to), g?.back[p.id], transitEstimate(p, to));
      times[p.id] = { there: there.min, back: back.min, thereBy: there.by, backBy: back.by };
    }
    return { times, source: !ready ? "loading" : g ? "google" : "estimate" };
  }, [mode, google, key, far.length, places, from, to]);
}
