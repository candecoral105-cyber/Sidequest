// With a university chip on: its other events this week, and why they're not in the list.
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Fit } from "@/lib/fit";
import { checkFit, happensOn } from "@/lib/fit";
import { applyPrefs, loadClassPrefs } from "@/lib/classPrefs";
import { loadManualClasses, manualBetween } from "@/lib/manualClasses";
import { loadTimetable } from "@/lib/storage";
import { findGaps, timetableBetween } from "@/lib/timetable";
import { isoDate, shortDate, toMin } from "@/lib/time";
import type { ClassBlock, Gap, Place } from "@/lib/types";
import { TYPE_COLOR } from "./PlaceCard";

type Entry = { place: Place; date: string; why: string; key: string };

export function weekDates(from = new Date()) {
  return Array.from({ length: 7 }, (_, i) => isoDate(new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)));
}
const weekdayOf = (iso: string) => new Date(`${iso}T12:00:00`).getDay();

export default function MoreThisWeek({ title, places, gap, notFitting, googleTimes = false }: {
  title: string; places: Place[]; gap: Gap; notFitting: Fit[]; googleTimes?: boolean; // Tube/bus times came from Google
}) {
  const [classes, setClasses] = useState<ClassBlock[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const d = weekDates();
    try {
      const all = [...timetableBetween(loadTimetable(), d[0], d[6]).classes, ...manualBetween(loadManualClasses(), d[0], d[6])];
      setClasses(applyPrefs(all, loadClassPrefs()).visible);
    } catch {
      setClasses([]);
    }
  }, []);

  const dates = weekDates();
  const missed = new Map(notFitting.map((f) => [f.place.id, f]));
  const entries: Entry[] = [];
  for (const p of places) {
    const f = missed.get(p.id);
    if (f && happensOn(p, gap.date!, gap.day)) {
      const by = f.thereBy === "transit" ? "by Tube/bus" : "walk";
      const why =
        f.reason === "Too far for this gap" || f.reason === "Not enough time"
          ? `${f.reason}, ${f.walkThere} min ${by}${googleTimes && f.thereBy === "transit" ? " (Google Maps)" : ""}`
          : `${f.reason} (${p.open}–${p.close})`;
      entries.push({ place: p, date: gap.date!, why, key: `${p.id}@${gap.date}` });
    }
    // Other days this week: every date for one-off events, otherwise just the next day it's on.
    const other = dates.filter((d) => d !== gap.date && happensOn(p, d, weekdayOf(d)));
    for (const d of p.dates ? other : other.slice(0, f || happensOn(p, gap.date!, gap.day) ? 0 : 1)) {
      entries.push({ place: p, date: d, why: `${p.open}–${p.close}`, key: `${p.id}@${d}` });
    }
  }
  entries.sort((a, b) => a.date.localeCompare(b.date) || toMin(a.place.open) - toMin(b.place.open));
  if (!entries.length) return null;

  // A gap in your timetable on that date that overlaps the event (not the one you're looking at),
  // preferring one where it really fits; `fit` says whether it does (walking, from the start of the gap).
  function gapFor(e: Entry) {
    const options = findGaps(classes, e.date)
      .filter((g) => !(e.date === gap.date && g.start === gap.start && g.end === gap.end))
      .filter((g) => toMin(g.start) < toMin(e.place.close) && toMin(e.place.open) < toMin(g.end))
      .map((g) => ({ ...g, fit: checkFit(e.place, { ...g, date: e.date }, toMin(g.start)) }));
    return options.find((g) => g.fit.fits) ?? options[0];
  }

  return (
    <section className="mt-6">
      <h2 className="mb-2 font-display text-lg font-bold">{title} ({entries.length})</h2>
      <ul className="space-y-2">
        {entries.map((e) => {
          const g = open === e.key ? gapFor(e) : undefined;
          return (
            <li key={e.key} className="rounded-2xl bg-card p-3 shadow-card">
              <button onClick={() => setOpen(open === e.key ? null : e.key)} aria-expanded={open === e.key} className="flex w-full items-start gap-3 text-left">
                <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: TYPE_COLOR[e.place.type] }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold leading-snug">{e.place.name}</span>
                  <span className="block text-sm text-ink-soft">
                    <b className="text-ink">{shortDate(e.date)}</b> · {e.why}
                  </span>
                </span>
              </button>
              {open === e.key && (
                <div className="mt-2 pl-6 text-sm">
                  {g ? (
                    <>
                      <Link
                        href={`/explore?day=${g.day}&date=${e.date}&start=${g.start}&end=${g.end}&from=${g.fromId}&to=${g.toId}&focus=${encodeURIComponent(e.place.id)}`}
                        className="inline-block rounded-xl bg-action px-3 py-2 font-bold text-on-action"
                      >
                        Open your {shortDate(e.date)} gap ({g.start}–{g.end})
                      </Link>
                      <p className="mt-1 text-ink-soft">
                        {g.fit.fits ? "It fits that gap on foot." : `It doesn't fit that gap on foot (${g.fit.reason?.toLowerCase()}). Try Walk + Tube/bus there.`}
                      </p>
                    </>
                  ) : (
                    <p className="text-ink-soft">
                      {e.date === gap.date ? "None of your other gaps that day fit it." : "You have no gap at that time in your timetable."} You can add a
                      gap by hand on the home screen.
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
