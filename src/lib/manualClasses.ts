// Classes you add by hand, saved on this device.
"use client";
// Hand-added classes are kept in their own list so importing a timetable again never removes them.
import { useSyncExternalStore } from "react";
import type { ClassBlock } from "./types";

const KEY = "sq-manual-classes-v1";
const listeners = new Set<() => void>();
const EMPTY: ClassBlock[] = [];
let cache: { raw: string | null; list: ClassBlock[] } = { raw: null, list: EMPTY };

function read(): ClassBlock[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  if (raw !== cache.raw) {
    let list: ClassBlock[] = EMPTY;
    try {
      list = raw ? JSON.parse(raw) : EMPTY;
    } catch {}
    cache = { raw, list };
  }
  return cache.list;
}

function write(list: ClassBlock[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
  listeners.forEach((l) => l());
}

export function useManualClasses(): ClassBlock[] {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    read,
    () => EMPTY,
  );
}

export const loadManualClasses = read;

/** A one-off class has a `date`; a weekly one has only `day` and shows on that weekday every week. */
export function saveManualClass(c: ClassBlock) {
  const list = read();
  write(list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? c : x)) : [...list, c]);
}

export function deleteManualClass(id: string) {
  write(read().filter((x) => x.id !== id));
}

/** Your hand-added classes between two dates, one entry per day they happen (like an imported timetable). */
export function manualBetween(list: ClassBlock[], from: string, to: string): ClassBlock[] {
  const out: ClassBlock[] = [];
  for (let d = from; d <= to; d = nextDay(d)) {
    const weekday = new Date(`${d}T12:00:00`).getDay();
    for (const m of list) {
      if (m.date ? m.date !== d : m.day !== weekday) continue;
      out.push({ ...m, id: `${m.id}@${d}`, manualId: m.id, seriesId: m.id, date: d });
    }
  }
  return out;
}

function nextDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}
