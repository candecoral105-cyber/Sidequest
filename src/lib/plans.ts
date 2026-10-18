// My plans: what you've added to your day, saved on this device only and never sent anywhere.
"use client";
import { useSyncExternalStore } from "react";
import type { Fit } from "./fit";
import type { TravelMode } from "./geo";
import { toHHMM } from "./time";
import type { Gap, PlaceType } from "./types";

export type Plan = {
  id: string; // place + date + gap, so the same place can be planned on different days
  placeId: string;
  name: string;
  type: PlaceType;
  address: string;
  lat: number;
  lng: number;
  mapsUrl?: string;
  date: string; // "YYYY-MM-DD"
  day: number;
  gapStart: string; // the gap it belongs to, "HH:MM"
  gapEnd: string;
  fromId: string;
  toId: string;
  leaveAt: number; // minutes since midnight
  startAt: number;
  endAt: number;
  backAt: number;
  thereBy: TravelMode;
  source?: "ours" | "google" | "community"; // "google" plans show Google Maps attribution
};

const KEY = "sq-plans-v1";
const listeners = new Set<() => void>();
let cache: { raw: string | null; plans: Plan[] } = { raw: null, plans: [] };

function read(): Plan[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  if (raw !== cache.raw) {
    let plans: Plan[] = [];
    try {
      plans = raw ? JSON.parse(raw) : [];
    } catch {}
    cache = { raw, plans };
  }
  return cache.plans;
}

function write(plans: Plan[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(plans));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => e.key === KEY && fn();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

const EMPTY: Plan[] = [];
export function usePlans(): Plan[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export const planId = (placeId: string, gap: Gap) => `${placeId}@${gap.date}@${gap.start}-${gap.end}`;

export function planFromFit(fit: Fit, gap: Gap): Plan {
  const p = fit.place;
  return {
    id: planId(p.id, gap),
    placeId: p.id,
    name: p.name,
    type: p.type,
    address: p.address,
    lat: p.lat,
    lng: p.lng,
    mapsUrl: p.mapsUrl,
    date: gap.date!,
    day: gap.day,
    gapStart: gap.start,
    gapEnd: gap.end,
    fromId: gap.fromId,
    toId: gap.toId,
    leaveAt: fit.leaveAt,
    startAt: fit.startAt,
    endAt: fit.endAt,
    backAt: fit.backAt,
    thereBy: fit.thereBy,
    source: p.source,
  };
}

export function addPlan(plan: Plan) {
  const rest = read().filter((p) => p.id !== plan.id);
  write([...rest, plan].sort((a, b) => a.date.localeCompare(b.date) || a.leaveAt - b.leaveAt));
}

export function removePlan(id: string) {
  write(read().filter((p) => p.id !== id));
}

/** Plans on the same date that overlap this one's time away (leave → back). */
export function clashesWith(plan: Plan, plans: Plan[]) {
  return plans.filter((p) => p.id !== plan.id && p.date === plan.date && p.leaveAt < plan.backAt && plan.leaveAt < p.backAt);
}

export const clashText = (p: Plan) => `${p.name} ${toHHMM(p.startAt)}–${toHHMM(p.endAt)}`;

/** Plans that sit inside a timetable gap on a given date. */
export function plansInGap(plans: Plan[], date: string, start: number, end: number) {
  return plans.filter((p) => p.date === date && p.leaveAt >= start && p.backAt <= end + 5);
}

/** Minutes of the gap not taken by any plan (overlapping plans aren't counted twice). */
export function freeMinutes(plans: Plan[], start: number, end: number) {
  const spans = plans.map((p) => [Math.max(start, p.leaveAt), Math.min(end, p.backAt)] as const).sort((a, b) => a[0] - b[0]);
  let used = 0;
  let cursor = start;
  for (const [a, b] of spans) {
    const from = Math.max(a, cursor);
    if (b > from) {
      used += b - from;
      cursor = b;
    }
  }
  return Math.max(0, end - start - used);
}

export function directionsUrl(p: { lat: number; lng: number; thereBy: TravelMode }, from?: { lat: number; lng: number }) {
  const origin = from ? `&origin=${from.lat},${from.lng}` : "";
  return `https://www.google.com/maps/dir/?api=1${origin}&destination=${p.lat},${p.lng}&travelmode=${p.thereBy === "transit" ? "transit" : "walking"}`;
}
