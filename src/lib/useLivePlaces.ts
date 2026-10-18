// Hook: fetches live Google places for the open gap and keeps the ones open during it.
"use client";
import { useEffect, useMemo, useState } from "react";
import type { TravelMode } from "./geo";
import { openDuringGap, searchArea, type LiveResult } from "./livePlaces";
import type { Place } from "./types";

// One request per area for this visit (the server keeps them for a few hours too). null = failed, so try again later.
const cache = new Map<string, Promise<LiveResult[] | null>>();

function fetchArea(area: { lat: number; lng: number; radius: number; key: string }) {
  if (!cache.has(area.key)) {
    const req = fetch("/api/places", {
      method: "POST",
      body: JSON.stringify({ lat: area.lat, lng: area.lng, radius: area.radius }),
      signal: AbortSignal.timeout(15_000),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { places?: LiveResult[] } | null) => d?.places ?? null)
      .catch(() => null);
    cache.set(area.key, req);
    req.then((list) => !list && cache.delete(area.key));
  }
  return cache.get(area.key)!;
}

type Args = {
  from: { lat: number; lng: number };
  gapMinutes: number;
  mode: TravelMode;
  date: string;
  start: string;
  end: string;
  enabled: boolean; // off in demo mode
};

/** Places open during this gap, live from Google. Empty while loading, offline, without a key, or in demo mode. */
export function useLivePlaces({ from, gapMinutes, mode, date, start, end, enabled }: Args): Place[] {
  const area = searchArea(from, gapMinutes, mode);
  const [result, setResult] = useState<{ key: string; list: LiveResult[] } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    fetchArea(area).then((list) => current && list && setResult({ key: area.key, list }));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, area.key]);

  const list = enabled && result?.key === area.key ? result.list : null;
  return useMemo(
    () => (list ? list.map((p) => openDuringGap(p, date, start, end)).filter((p): p is Place => p !== null) : []),
    [list, date, start, end],
  );
}
