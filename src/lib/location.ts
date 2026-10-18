// Live location for Explore: the blue dot, and where planning starts from.
"use client";
// Privacy: your position is never saved; it only leaves the device in the journey-time request (/api/travel).
import { useEffect, useRef, useState } from "react";
import { BUILDINGS, type Building } from "@/data/buildings";
import { metres } from "./geo";

export type Position = { lat: number; lng: number; accuracy: number };
type LocationStatus = "off" | "asking" | "on" | "demo" | "denied" | "unavailable";

const MOVE_M = 50; // recalculate when you've moved this far...
const EVERY_MS = 30_000; // ...or after this long (if you've moved a little)
const DRIFT_M = 15; // GPS jitter smaller than this is ignored

/**
 * Demo location from the address, for poor indoor GPS during judging:
 * ?demoLocation=bush-house (any building id) or ?demoLocation=51.5129,-0.1174
 */
export function demoPosition(param: string | null): Position | null {
  if (!param) return null;
  const b = BUILDINGS.find((x) => x.id === param);
  if (b) return { lat: b.lat, lng: b.lng, accuracy: 15 };
  const m = param.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  return m ? { lat: Number(m[1]), lng: Number(m[2]), accuracy: 15 } : null;
}

/**
 * `live` is every GPS update (the blue dot); `used` only moves after 50 m (or 30 s and 15 m), so results don't
 * flicker and we don't call the journey-time API on every wobble.
 */
export function useLocation(enabled: boolean, demo: Position | null) {
  const [status, setStatus] = useState<LocationStatus>("off");
  const [live, setLive] = useState<Position | null>(null);
  const [used, setUsed] = useState<Position | null>(null);
  const accepted = useRef<{ pos: Position; at: number } | null>(null);

  useEffect(() => {
    accepted.current = null;
    if (!enabled) {
      setStatus("off");
      setLive(null);
      setUsed(null);
      return;
    }
    if (demo) {
      setStatus("demo");
      setLive(demo);
      setUsed(demo);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    setStatus("asking");
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) };
        setStatus("on");
        setLive(pos);
        const last = accepted.current;
        const moved = last ? metres(last.pos, pos) : Infinity;
        if (!last || moved > MOVE_M || (Date.now() - last.at >= EVERY_MS && moved > DRIFT_M)) {
          accepted.current = { pos, at: Date.now() };
          setUsed(pos);
        }
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
        setLive(null);
        setUsed(null);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled, demo?.lat, demo?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return { status, live, used };
}

/** Your position as a stand-in "building", so the rest of the app can plan from it. */
export function hereAsBuilding(p: Position): Building {
  // The id changes only when the planning position does, so cached journey times are reused until you move.
  return { id: `here@${p.lat.toFixed(4)},${p.lng.toFixed(4)}`, name: "Your location", uni: "Other", lat: p.lat, lng: p.lng };
}
