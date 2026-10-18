// Timeline for one day, drawn like a Tube line: classes are stations, free gaps the yellow platform edge.
"use client";
import Link from "next/link";
import { useState } from "react";
import { BUILDINGS, buildingById } from "@/data/buildings";
import type { DayNote } from "@/lib/calendar";
import { OTHER_LABEL } from "./ClassForm";
import { setClassBuilding, setNotAClass } from "@/lib/classPrefs";
import { freeMinutes, plansInGap, usePlans } from "@/lib/plans";
import { duration, toHHMM, toMin } from "@/lib/time";
import { DAY_END, DAY_START, MIN_GAP, findGaps } from "@/lib/timetable";
import type { ClassBlock, Gap } from "@/lib/types";

type Props = { classes: ClassBlock[]; hidden: ClassBlock[]; notes: DayNote[]; date: string; onEdit?: (c: ClassBlock) => void };

/** "Location unknown" until you pick a building; your pick applies to every repeat of that event. */
function Where({ c }: { c: ClassBlock }) {
  const [picking, setPicking] = useState(false);
  if (c.buildingId && !picking) return <p className="text-sm text-ink-soft">{buildingById(c.buildingId).name}</p>;
  if (c.location === OTHER_LABEL && !picking) return <p className="text-sm text-ink-soft">{OTHER_LABEL}</p>;
  if (!picking) {
    return (
      <button onClick={() => setPicking(true)} className="text-sm font-bold text-ink-soft underline" title={c.location}>
        Location unknown{c.location ? ` (${c.location})` : ""}: pick building
      </button>
    );
  }
  return (
    <select
      autoFocus
      aria-label={`Building for ${c.title}`}
      defaultValue=""
      onChange={(e) => {
        if (e.target.value) setClassBuilding(c, e.target.value);
        setPicking(false);
      }}
      onBlur={() => setPicking(false)}
      className="mt-1 rounded-lg border border-rail bg-card p-1.5 text-sm"
    >
      <option value="" disabled>
        Pick the building…
      </option>
      {BUILDINGS.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}

/** A free stretch of time (yellow edge + card), with any plans you've added shown as stops inside it. */
function GapCard({ date, start, end, title, subtitle, href }: { date: string; start: string; end: string; title: string; subtitle: string; href: string }) {
  const plans = usePlans();
  const stops = plansInGap(plans, date, toMin(start), toMin(end));
  const free = freeMinutes(stops, toMin(start), toMin(end));
  return (
    <li className="flex gap-4">
      <div className="flex w-6 justify-center">
        <span className="platform-edge w-3.5 rounded-sm" aria-hidden />
      </div>
      <Link href={href} className="group mb-5 flex-1 rounded-2xl bg-slab p-4 text-on-slab transition-transform active:scale-[0.98]">
        <p className="font-display text-4xl font-extrabold leading-none text-edge">{title}</p>
        <p className="mt-1 font-display text-[0.95rem] font-medium text-on-slab/80">{subtitle}</p>
        {stops.length > 0 && (
          <>
            <ol className="mt-3 space-y-2 border-l-2 border-on-slab/30 pl-3" aria-label="Your plans in this gap">
              {stops.map((s) => (
                <li key={s.id} className="relative text-sm">
                  <span className="absolute -left-[19px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-slab bg-on-slab" aria-hidden />
                  <b className="time">{toHHMM(s.startAt)}</b> {s.name}
                  <span className="block text-xs text-on-slab/70 tabular-nums">
                    leave {toHHMM(s.leaveAt)} · {s.toId === "none" ? "done" : "back"} by {toHHMM(s.backAt)}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-sm font-bold text-edge">{free > 0 ? `${duration(free)} still free` : "Gap filled"}</p>
          </>
        )}
        <p className="mt-3 inline-block rounded-full bg-edge px-4 py-2 text-sm font-bold text-[#1a2238] group-hover:bg-on-slab">
          {stops.length ? "Find something else" : "Find something to do"}
        </p>
      </Link>
    </li>
  );
}

const EVENING_END = "20:00"; // "Free after your last class" runs until this by default (editable on the explore page)
const MORNING_START = "09:00"; // "Free before your first class" starts here
const LATE_FIRST_CLASS = 11 * 60; // only offer "Free before" when the first class starts at 11:00 or later

export default function DayLine({ classes, hidden, notes, date, onEdit }: Props) {
  const [showHidden, setShowHidden] = useState(false);
  const today = classes.filter((c) => c.date === date).sort((a, b) => toMin(a.start) - toMin(b.start));
  const hiddenToday = hidden.filter((c) => c.date === date);
  const notesToday = notes.filter((n) => n.date === date);
  const gaps = findGaps(today, date);
  const weekday = new Date(`${date}T12:00:00`).getDay();
  // Free time before a late first class (from wherever you are) and after the last class (done for the day).
  const daytime = today.filter((c) => toMin(c.end) > DAY_START && toMin(c.start) < DAY_END);
  const firstClass = daytime[0];
  const lastEnd = daytime.reduce((m, c) => Math.max(m, toMin(c.end)), 0);
  const lastClass = daytime.find((c) => toMin(c.end) === lastEnd);
  const freeBefore = firstClass && toMin(firstClass.start) >= LATE_FIRST_CLASS ? firstClass : null;
  const freeAfter = lastClass && lastEnd <= toMin(EVENING_END) - MIN_GAP ? lastClass : null;
  // Classes and gaps in time order (a gap starts when the classes before it end).
  const items: ({ kind: "class"; c: ClassBlock } | { kind: "gap"; g: Gap })[] = [
    ...today.map((c) => ({ kind: "class" as const, c })),
    ...gaps.map((g) => ({ kind: "gap" as const, g })),
  ].sort((a, b) => {
    const ta = toMin(a.kind === "class" ? a.c.start : a.g.start);
    const tb = toMin(b.kind === "class" ? b.c.start : b.g.start);
    return ta - tb || (a.kind === "class" ? -1 : 1);
  });

  return (
    <div>
      {notesToday.length > 0 && (
        <ul className="mb-4 flex flex-wrap gap-2" aria-label="All-day events">
          {notesToday.map((n, i) => (
            <li key={i} className="rounded-full border border-rail bg-card px-3 py-1 text-sm">
              {n.title}
            </li>
          ))}
        </ul>
      )}

      {today.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-rail p-6 text-ink-soft">
          No classes on this day. Pick another day, upload your timetable, or add a free slot below.
        </div>
      ) : (
        <ol className="relative">
          {freeBefore && (
            <GapCard
              date={date}
              start={MORNING_START}
              end={freeBefore.start}
              title={`Free before ${freeBefore.start}`}
              subtitle="Before your first class"
              href={`/explore?day=${weekday}&date=${date}&start=${MORNING_START}&end=${freeBefore.start}&from=here&fallback=${freeBefore.buildingId ?? "bush-house"}&to=${freeBefore.buildingId ?? "bush-house"}`}
            />
          )}
          {items.map((it, i) => {
            if (it.kind === "class") {
              const c = it.c;
              const last = !items.slice(i + 1).some((x) => x.kind === "class");
              return (
                <li key={c.id} className="flex gap-4">
                  <div className="flex w-6 flex-col items-center">
                    <span className="mt-1 h-5 w-5 rounded-full border-[5px] border-ink bg-card" aria-hidden />
                    {!last && <span className="w-1.5 flex-1 bg-ink" aria-hidden />}
                  </div>
                  <div className="min-w-0 flex-1 pb-5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="time text-sm text-ink-soft">
                        {c.start}–{c.end}
                      </p>
                      <button
                        onClick={() => setNotAClass(c, true)}
                        className="-my-3 -mr-3 shrink-0 p-3 text-xs text-ink-soft underline"
                        aria-label={`${c.title} is not a class: hide it`}
                      >
                        Not a class
                      </button>
                    </div>
                    {onEdit ? (
                      <button onClick={() => onEdit(c)} className="block text-left font-display text-lg font-bold leading-tight hover:underline" aria-label={`Edit ${c.title}`}>
                        {c.title}
                        {c.manualId && <span className="ml-1.5 align-middle text-xs font-normal text-ink-soft">(added by you)</span>}
                      </button>
                    ) : (
                      <p className="font-display text-lg font-bold leading-tight">{c.title}</p>
                    )}
                    <Where c={c} />
                  </div>
                </li>
              );
            }
            const g = it.g;
            return (
              <GapCard
                key={`gap-${g.start}`}
                date={date}
                start={g.start}
                end={g.end}
                title={duration(toMin(g.end) - toMin(g.start))}
                subtitle={`free from ${g.start} until ${g.end}`}
                href={`/explore?day=${g.day}&date=${date}&start=${g.start}&end=${g.end}&from=${g.fromId}&to=${g.toId}`}
              />
            );
          })}
          {freeAfter && (
            <GapCard
              date={date}
              start={toHHMM(lastEnd)}
              end={EVENING_END}
              title={`Free after ${toHHMM(lastEnd)}`}
              subtitle={`Done with classes · until ${EVENING_END} (you can change it)`}
              href={`/explore?day=${weekday}&date=${date}&start=${toHHMM(lastEnd)}&end=${EVENING_END}&from=${freeAfter.buildingId ?? "bush-house"}&to=none`}
            />
          )}
        </ol>
      )}

      {hiddenToday.length > 0 && (
        <div className="mt-1 text-sm text-ink-soft">
          <button onClick={() => setShowHidden((s) => !s)} className="underline" aria-expanded={showHidden}>
            {hiddenToday.length} hidden ({hiddenToday.length === 1 ? "not a class" : "not classes"}) · {showHidden ? "hide list" : "show"}
          </button>
          {showHidden && (
            <ul className="mt-2 space-y-1">
              {hiddenToday.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-2">
                  <span className="min-w-0 truncate">
                    <span className="tabular-nums">{c.start}</span> {c.title}
                  </span>
                  <button onClick={() => setNotAClass(c, false)} className="shrink-0 font-bold underline">
                    It is a class
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
