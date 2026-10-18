// Home screen (My day): your week, the timeline of classes and gaps, plans and timetable upload.
"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ClassForm from "@/components/ClassForm";
import DayLine from "@/components/DayLine";
import FreeTimeForm from "@/components/FreeTimeForm";
import MyPlans from "@/components/MyPlans";
import ReadAloudToggle from "@/components/ReadAloudToggle";
import { ThemeButton, ThemeChoices } from "@/components/ThemeSwitch";
import TimetableUpload from "@/components/TimetableUpload";
import Wordmark from "@/components/Wordmark";
import { applyPrefs, seriesOf, useClassPrefs } from "@/lib/classPrefs";
import { isClassLike } from "@/lib/classify";
import { manualBetween, useManualClasses } from "@/lib/manualClasses";
import { loadTimetable, type TimetableSource } from "@/lib/storage";
import { SHORT_DAYS, isoDate, schoolWeek, shortDate } from "@/lib/time";
import { SAMPLE_TIMETABLE, nearestClassWeek, timetableBetween } from "@/lib/timetable";
import type { ClassBlock } from "@/lib/types";

export default function MyDay() {
  const [source, setSource] = useState<TimetableSource>({ kind: "sample", classes: SAMPLE_TIMETABLE });
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week (or next, at the weekend), 1 = the week after
  const dates = useMemo(() => schoolWeek(weekOffset), [weekOffset]);
  const [date, setDate] = useState(dates[0]);
  const [message, setMessage] = useState("");
  const isSample = source.kind === "sample";
  const prefs = useClassPrefs();

  const week = useMemo(() => {
    try {
      return timetableBetween(source, dates[0], dates[4]);
    } catch {
      return { classes: [], notes: [] };
    }
  }, [source, dates]);
  const manual = useManualClasses();
  const { visible, hidden } = useMemo(
    () => applyPrefs([...week.classes, ...manualBetween(manual, dates[0], dates[4])], prefs),
    [week, manual, dates, prefs],
  );
  const [form, setForm] = useState<{ editing: ClassBlock | null } | null>(null);
  // Only used to spot weeks with no classes (e.g. reading week); it never hides anything.
  const hasClasses = source.kind === "calendar" ? visible.some(isClassLike) : visible.length > 0;
  const nearest = useMemo(() => {
    if (hasClasses) return null;
    try {
      return nearestClassWeek(source, weekOffset, (c) => prefs.hidden.includes(seriesOf(c)));
    } catch {
      return null;
    }
  }, [source, weekOffset, hasClasses, prefs]);
  const weekLabel = weekOffset === 0 ? "this week" : weekOffset === 1 ? "next week" : "that week";

  useEffect(() => setSource(loadTimetable()), []);
  // Open on today if it has classes, otherwise the first day of the week that does.
  useEffect(() => {
    const today = isoDate(new Date());
    const has = (d: string) => visible.some((c) => c.date === d);
    setDate(dates.includes(today) && has(today) ? today : (dates.find(has) ?? dates[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates, source]);

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-6">
      <header className="mb-7">
        <div className="flex items-start justify-between gap-3">
          <Wordmark />
          <ThemeButton />
        </div>
        <p className="mt-3 max-w-[34ch] text-ink-soft">Find things worth doing between your classes, and still make it back on time.</p>
        <Link href="/societies" className="mt-2 inline-block text-sm font-bold underline decoration-2 underline-offset-4 hover:text-study">
          Run a society? Add your event
        </Link>
      </header>

      <div className="mb-3 flex items-center justify-between gap-2 text-sm">
        <div className="flex overflow-hidden rounded-full border-2 border-ink" role="radiogroup" aria-label="Which week">
          {(["This week", "Next week"] as const).map((label, i) => (
            <button
              key={label}
              role="radio"
              aria-checked={weekOffset === i}
              onClick={() => setWeekOffset(i)}
              className={`press px-3.5 py-1.5 font-bold ${weekOffset === i ? "bg-action text-on-action" : "bg-card text-ink hover:bg-paper"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="time text-ink-soft">
          {shortDate(dates[0]).slice(4)} – {shortDate(dates[4]).slice(4)}
        </span>
      </div>
      {weekOffset !== 0 && weekOffset !== 1 && (
        <p className="mb-3 text-sm">
          Showing the week of <b>{shortDate(dates[0])}</b> ·{" "}
          <button onClick={() => setWeekOffset(0)} className="font-bold underline">
            back to this week
          </button>
        </p>
      )}
      {(visible.length === 0 || (source.kind === "calendar" && !hasClasses)) && (
        <div className="mb-4 rounded-2xl border-2 border-dashed border-rail p-4 text-sm" role="status">
          <p className="font-bold">
            {visible.length === 0 ? "No events found" : "No lectures, tutorials, labs or seminars found"} {weekLabel}.
          </p>
          <p className="mt-1 text-ink-soft">
            {visible.length > 0 && `${visible.length} other ${visible.length === 1 ? "event is" : "events are"} still on the timeline. `}
            {hidden.length > 0 && `${hidden.length} marked "Not a class". `}
            {source.kind === "calendar" && !nearest && "Your calendar has no classes within 6 months of this week, so check you exported the calendar with your timetable. "}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {nearest && (
              <button onClick={() => setWeekOffset(nearest.offset)} className="rounded-xl bg-action px-3 py-2 font-bold text-on-action">
                Go to the nearest week with classes ({shortDate(schoolWeek(nearest.offset)[0])}, {nearest.count}{" "}
                {nearest.count === 1 ? "class" : "classes"})
              </button>
            )}
            {!nearest && visible.length === 0 && (
              <button onClick={() => setWeekOffset(weekOffset === 0 ? 1 : 0)} className="rounded-xl bg-action px-3 py-2 font-bold text-on-action">
                {weekOffset === 0 ? "Show next week" : "Show this week"}
              </button>
            )}
          </div>
        </div>
      )}
      <nav className="mb-7 grid grid-cols-5 divide-x-2 divide-ink overflow-hidden rounded-2xl border-2 border-ink shadow-card" aria-label="Day">
        {dates.map((d) => (
          <button
            key={d}
            onClick={() => setDate(d)}
            aria-pressed={date === d}
            className={`press flex flex-col items-center pb-2 pt-1.5 ${date === d ? "bg-action text-on-action" : "bg-card text-ink hover:bg-paper"}`}
          >
            <span className="text-xs font-bold">{SHORT_DAYS[new Date(`${d}T12:00:00`).getDay()]}</span>
            <span className="font-display text-[1.75rem] font-extrabold leading-none tabular-nums">{Number(d.slice(8))}</span>
          </button>
        ))}
      </nav>

      <h2 className="sr-only">{shortDate(date)}</h2>
      <DayLine classes={visible} hidden={hidden} notes={week.notes} date={date} onEdit={(c) => setForm({ editing: c })} />
      <button onClick={() => setForm({ editing: null })} className="mt-1 w-full rounded-xl border-2 border-dashed border-rail px-4 py-2.5 text-sm font-bold">
        + Add class
      </button>
      {form && (
        <ClassForm editing={form.editing} dates={dates} defaultDate={date} others={visible} onClose={() => setForm(null)} />
      )}

      {message && <p className="mt-2 rounded-xl bg-card p-3 text-sm" role="status">{message}</p>}

      <MyPlans />

      <TimetableUpload isSample={isSample} setSource={setSource} setMessage={setMessage} setWeekOffset={setWeekOffset} />

      <FreeTimeForm dates={dates} date={date} />

      <section className="mt-8 rounded-2xl bg-card p-4 shadow-card">
        <h2 className="font-display text-xl font-bold">Accessibility</h2>
        <div className="mt-3">
          <ThemeChoices />
        </div>
        <div className="mt-4 border-t border-rail pt-4">
          <ReadAloudToggle hint="Reads your top 3 picks out loud after each search, and adds a Read aloud button to every card. Off means SideQuest stays silent." />
        </div>
      </section>
    </main>
  );
}
