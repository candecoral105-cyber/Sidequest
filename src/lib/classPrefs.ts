// Your fixes to imported classes (Not a class, buildings, edits), saved on this device.
"use client";
import { useSyncExternalStore } from "react";
import type { ClassBlock } from "./types";

// Kept apart from the import so re-importing doesn't undo them.
// "Not a class" and picked buildings apply to the whole series; edits and deletions to one day.

type ClassEdit = Pick<ClassBlock, "title" | "date" | "day" | "start" | "end" | "buildingId" | "location">;
type ClassPrefs = { hidden: string[]; building: Record<string, string>; edits: Record<string, ClassEdit>; deleted: string[] };
const KEY = "sq-class-prefs-v1";
const EMPTY: ClassPrefs = { hidden: [], building: {}, edits: {}, deleted: [] };
const listeners = new Set<() => void>();
let cache: { raw: string | null; prefs: ClassPrefs } = { raw: null, prefs: EMPTY };

function read(): ClassPrefs {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  if (raw !== cache.raw) {
    let prefs = EMPTY;
    try {
      prefs = raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
    } catch {}
    cache = { raw, prefs };
  }
  return cache.prefs;
}

function write(p: ClassPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
  listeners.forEach((l) => l());
}

export function useClassPrefs(): ClassPrefs {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    read,
    () => EMPTY,
  );
}

export const seriesOf = (c: ClassBlock) => c.seriesId ?? c.id;

export function setNotAClass(c: ClassBlock, hidden: boolean) {
  const p = read();
  const s = seriesOf(c);
  write({ ...p, hidden: hidden ? [...new Set([...p.hidden, s])] : p.hidden.filter((x) => x !== s) });
}

export function setClassBuilding(c: ClassBlock, buildingId: string) {
  const p = read();
  write({ ...p, building: { ...p.building, [seriesOf(c)]: buildingId } });
}

/** Edit one imported class (just this occurrence). */
export function editImportedClass(c: ClassBlock, e: ClassEdit) {
  const p = read();
  write({ ...p, edits: { ...p.edits, [c.id]: e } });
}

/** Delete one imported class (just this occurrence). */
export function deleteImportedClass(c: ClassBlock) {
  const p = read();
  write({ ...p, deleted: [...new Set([...p.deleted, c.id])] });
}

export function applyPrefs(classes: ClassBlock[], p: ClassPrefs) {
  const fixed = classes
    .filter((c) => !p.deleted.includes(c.id))
    .map((c) => (p.edits[c.id] ? { ...c, ...p.edits[c.id] } : c))
    .map((c) => (!p.edits[c.id] && p.building[seriesOf(c)] ? { ...c, buildingId: p.building[seriesOf(c)] } : c));
  return { visible: fixed.filter((c) => !p.hidden.includes(seriesOf(c))), hidden: fixed.filter((c) => p.hidden.includes(seriesOf(c))) };
}

export function loadClassPrefs() {
  return read();
}
