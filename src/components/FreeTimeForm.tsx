// "Free right now?" form on the home screen: plan any free time by hand.
"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BUILDINGS, HERE, NOWHERE, STATIONS } from "@/data/buildings";
import { loadHomeStation, saveHomeStation } from "@/lib/storage";
import { isoDate, shortDate, toMin } from "@/lib/time";

export default function FreeTimeForm({ dates, date }: { dates: string[]; date: string }) {
  const router = useRouter();
  const [mStart, setMStart] = useState("12:00");
  const [mEnd, setMEnd] = useState("15:00");
  const [mFrom, setMFrom] = useState("bush-house");
  const [mTo, setMTo] = useState("strand");
  const [mDate, setMDate] = useState<string | null>(null); // null = the day selected in the tabs
  const [mError, setMError] = useState("");
  const [homeStation, setHomeStation] = useState<string | null>(null);
  useEffect(() => setHomeStation(loadHomeStation()), [mTo]);
  // Your usual home station is remembered on this device and picked for you next time.
  useEffect(() => {
    const home = loadHomeStation();
    if (home) setMTo(home);
  }, []);

  return (
  <section className="mt-8 rounded-2xl bg-card p-4 shadow-card">
    <h2 className="font-display text-xl font-bold">Free right now?</h2>
    <p className="mb-3 text-sm text-ink-soft">Plan any free time: between classes, before them, or after you&apos;re done.</p>
    <div className="grid grid-cols-2 gap-3 text-sm">
      <label className="col-span-2 flex flex-col gap-1">
        Day
        <select value={mDate ?? date} onChange={(e) => setMDate(e.target.value)} className="rounded-lg border border-rail p-2">
          <option value={isoDate(new Date())}>Today ({shortDate(isoDate(new Date()))})</option>
          {dates.filter((d) => d !== isoDate(new Date())).map((d) => (
            <option key={d} value={d}>
              {shortDate(d)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        From
        <input type="time" value={mStart} onChange={(e) => setMStart(e.target.value)} className="rounded-lg border border-rail p-2" />
      </label>
      <label className="flex flex-col gap-1">
        Until
        <input type="time" value={mEnd} onChange={(e) => setMEnd(e.target.value)} className="rounded-lg border border-rail p-2" />
      </label>
      <label className="col-span-2 flex flex-col gap-1">
        I&apos;m at
        <select value={mFrom} onChange={(e) => setMFrom(e.target.value)} className="rounded-lg border border-rail p-2">
          <option value="here">I&apos;m here (use my location)</option>
          {BUILDINGS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>
      <label className="col-span-2 flex flex-col gap-1">
        After this I need to be at
        <select
          value={mTo}
          onChange={(e) => {
            setMTo(e.target.value);
            if (STATIONS.some((s) => s.id === e.target.value)) saveHomeStation(e.target.value);
          }}
          className="rounded-lg border border-rail p-2"
        >
          <optgroup label="Campus">
            {BUILDINGS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </optgroup>
          <optgroup label="Home / a station">
            {STATIONS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {homeStation === b.id ? " (home)" : ""}
              </option>
            ))}
            <option value={HERE}>Back to where I am (use my location)</option>
          </optgroup>
          <option value={NOWHERE}>Nowhere, I&apos;m done for the day</option>
        </select>
      </label>
    </div>
    {mError && <p className="mt-3 text-sm font-bold text-event" role="alert">{mError}</p>}
    <button
      onClick={() => {
        const d = mDate ?? date;
        if (!/^\d{2}:\d{2}$/.test(mStart) || !/^\d{2}:\d{2}$/.test(mEnd)) return setMError("Pick a From and an Until time.");
        if (toMin(mEnd) - toMin(mStart) < 15) return setMError("Until needs to be at least 15 minutes after From.");
        setMError("");
        const q = new URLSearchParams({ day: String(new Date(`${d}T12:00:00`).getDay()), date: d, start: mStart, end: mEnd, from: mFrom, to: mTo });
        if (mFrom === "here") q.set("fallback", "bush-house");
        router.push(`/explore?${q.toString()}`);
      }}
      className="platform-edge press mt-4 w-full rounded-xl px-4 py-3 font-bold text-[#1a2238]"
    >
      Explore this gap
    </button>
  </section>
  );
}
