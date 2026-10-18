// Timetable upload on the home screen: a screenshot (read by Gemini), an .ics file, or the sample week.
"use client";
import { useRef, useState } from "react";
import { expandCalendar, readCalendar } from "@/lib/calendar";
import { fileToSmallDataUrl } from "@/lib/image";
import { resetTimetable, saveCalendar, saveWeekly, type TimetableSource } from "@/lib/storage";
import { isoDate, schoolWeek, shortDate } from "@/lib/time";
import { SAMPLE_TIMETABLE } from "@/lib/timetable";
import type { ClassBlock } from "@/lib/types";

type Props = {
  isSample: boolean;
  setSource: (s: TimetableSource) => void;
  setMessage: (m: string) => void;
  setWeekOffset: (n: number) => void;
};

export default function TimetableUpload({ isSample, setSource, setMessage, setWeekOffset }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const shotRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    try {
      const events = readCalendar(text);
      const [w0, w1] = [schoolWeek(0), schoolWeek(1)];
      const now = expandCalendar(events, w0[0], w0[4]);
      const next = expandCalendar(events, w1[0], w1[4]);
      if (!saveCalendar(text)) {
        setMessage("That calendar is too big to keep in this browser. Try exporting just your timetable.");
        return;
      }
      setSource({ kind: "calendar", ics: text });
      setWeekOffset(0);
      const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
      const range = `${Number(w0[0].slice(8))}–${shortDate(w0[4]).slice(4)}`; // "19–23 Oct"
      setMessage(
        `Imported ${plural(now.stats.classes, "event", "events")} for ${range} · ` +
          `skipped ${now.stats.allDay} all-day · ignored ${now.stats.past + now.stats.later} outside this week` +
          (next.stats.classes ? ` (${next.stats.classes} next week)` : ""),
      );
    } catch {
      setMessage("Couldn't read that file. Check it's an .ics calendar export.");
    }
  }

  async function onScreenshot(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setReading(true);
    setMessage("Reading your timetable with Gemini… this can take up to a minute.");
    try {
      const image = await fileToSmallDataUrl(file, 2400); // keep small dates readable in multi-week screenshots
      const res = await fetch("/api/timetable", { method: "POST", body: JSON.stringify({ image }) });
      const data = await res.json();
      if (!res.ok || !data.classes?.length) {
        setMessage(data.error ?? "Couldn't find any classes in that image. Try a clearer screenshot.");
        return;
      }
      const classes = data.classes as ClassBlock[];
      saveWeekly(classes);
      setSource({ kind: "weekly", classes });
      const dated = classes.filter((c) => c.date).map((c) => c.date!).sort();
      if (dated.length) {
        // Open the week of the first dated class from this week on (or the last week shown, if they're all past).
        const today = isoDate(new Date());
        const target = dated.find((d) => d >= schoolWeek(0)[0]) ?? dated[dated.length - 1];
        // Weeks between the shown week's Monday and a date ("YYYY-MM-DD" strings parse as UTC midnight, so this is exact).
        const weekOf = (d: string) => Math.floor((Date.parse(d) - Date.parse(schoolWeek(0)[0])) / (7 * 864e5));
        setWeekOffset(weekOf(target));
        const weeks = new Set(dated.map(weekOf)).size;
        const undated = classes.length - dated.length;
        setMessage(
          `Gemini found ${classes.length} classes across ${weeks} ${weeks === 1 ? "week" : "weeks"} (${shortDate(dated[0])} – ${shortDate(dated[dated.length - 1])})` +
            (undated ? `, plus ${undated} without a date that repeat every week` : "") +
            `. Today is ${shortDate(today)}. Check they look right.`,
        );
      } else {
        setMessage(`Gemini found ${classes.length} classes (no dates in the image, so they repeat every week). Check they look right.`);
      }
    } catch (err) {
      // TypeError = no internet; SyntaxError = the server sent back an error page instead of an answer.
      const offline = err instanceof TypeError || err instanceof SyntaxError;
      setMessage(offline ? "Couldn't reach the server. Check your internet and try again." : err instanceof Error ? err.message : "Something went wrong reading that image.");
    } finally {
      setReading(false);
    }
  }

  return (
  <section className="mt-8 space-y-3">
    <h2 className="font-display text-xl font-bold">Your timetable</h2>
    {isSample && <p className="text-sm text-ink-soft">You&apos;re looking at a sample week. Upload yours to see your own gaps.</p>}
    <input ref={fileRef} type="file" accept=".ics,text/calendar" className="hidden" onChange={onUpload} />
    <input ref={shotRef} type="file" accept="image/*" className="hidden" onChange={onScreenshot} />
    <button
      onClick={() => shotRef.current?.click()}
      disabled={reading}
      className="w-full rounded-xl border-2 border-ink bg-card px-4 py-3 font-bold disabled:opacity-60"
    >
      {reading ? "Reading…" : "Upload a screenshot of your timetable"}
    </button>
    <div className="flex gap-2">
      <button onClick={() => fileRef.current?.click()} className="flex-1 rounded-xl bg-action px-4 py-3 font-bold text-on-action">
        Upload .ics file
      </button>
      <button
        onClick={() => {
          resetTimetable();
          setSource({ kind: "sample", classes: SAMPLE_TIMETABLE });
          setMessage("Back to the sample week.");
        }}
        className="rounded-xl bg-card px-4 py-3 font-bold"
      >
        Use sample
      </button>
    </div>
    <p className="text-xs text-ink-soft">
      Your timetable is saved only on this device. Screenshots are read by Gemini and not stored.
    </p>
  </section>
  );
}
