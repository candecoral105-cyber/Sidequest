// Pop-up form to add a class by hand, or edit or delete any class.
"use client";
import { useState } from "react";
import { BUILDINGS } from "@/data/buildings";
import { deleteImportedClass, editImportedClass } from "@/lib/classPrefs";
import { deleteManualClass, loadManualClasses, saveManualClass } from "@/lib/manualClasses";
import { shortDate, toMin } from "@/lib/time";
import type { ClassBlock } from "@/lib/types";

const OTHER = "other";
const UNKNOWN = "unknown"; // an imported class whose building we couldn't work out
export const OTHER_LABEL = "Other / online";

type Props = {
  editing: ClassBlock | null; // null = add a new one
  dates: string[];
  defaultDate: string;
  others: ClassBlock[]; // to warn about clashes
  onClose: () => void;
};

const weekdayOf = (iso: string) => new Date(`${iso}T12:00:00`).getDay();

export default function ClassForm({ editing, dates, defaultDate, others, onClose }: Props) {
  const manual = editing?.manualId ? loadManualClasses().find((m) => m.id === editing.manualId) : undefined;
  const [title, setTitle] = useState(editing?.title ?? "");
  const [date, setDate] = useState(editing?.date ?? defaultDate);
  const [start, setStart] = useState(editing?.start ?? "10:00");
  const [end, setEnd] = useState(editing?.end ?? "11:00");
  const [building, setBuilding] = useState(
    editing ? (editing.buildingId ?? (editing.location === OTHER_LABEL ? OTHER : UNKNOWN)) : "bush-house",
  );
  const [repeats, setRepeats] = useState(manual ? !manual.date : false);
  const [error, setError] = useState("");
  const imported = Boolean(editing && !editing.manualId);

  const timesOk = /^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end) && toMin(end) > toMin(start);
  const clashes = timesOk
    ? others.filter(
        (o) =>
          o.date === date &&
          o.id !== editing?.id &&
          (!editing?.manualId || o.manualId !== editing.manualId) &&
          toMin(o.start) < toMin(end) &&
          toMin(start) < toMin(o.end),
      )
    : [];

  function save() {
    if (!title.trim()) return setError("Give the class a name.");
    if (!timesOk) return setError("The end time needs to be after the start time.");
    const where = {
      buildingId: building === OTHER || building === UNKNOWN ? null : building,
      location: building === OTHER ? OTHER_LABEL : building === UNKNOWN ? editing?.location : undefined,
    };
    if (imported) {
      editImportedClass(editing!, { title: title.trim(), date, day: weekdayOf(date), start, end, ...where });
    } else {
      saveManualClass({
        id: editing?.manualId ?? `man-${Date.now().toString(36)}`,
        title: title.trim(),
        day: weekdayOf(date),
        date: repeats ? undefined : date, // repeating classes have no date: they show on that weekday every week
        start,
        end,
        ...where,
      });
    }
    onClose();
  }

  function remove() {
    if (!editing) return;
    if (editing.manualId) deleteManualClass(editing.manualId);
    else deleteImportedClass(editing);
    onClose();
  }

  const input = "rounded-lg border border-rail bg-card p-2";
  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={editing ? `Edit ${editing.title}` : "Add a class"}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="w-full max-w-md space-y-3 rounded-t-2xl bg-paper p-4 text-sm shadow-xl sm:rounded-2xl"
      >
        <h2 className="font-display text-xl font-bold">{editing ? "Edit class" : "Add a class"}</h2>
        {imported && <p className="text-xs text-ink-soft">Changes apply to this class on this day only, and stay if you import again.</p>}
        <label className="flex flex-col gap-1">
          Class name
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Thermodynamics lecture" className={input} />
        </label>
        <label className="flex flex-col gap-1">
          Day
          <select value={date} onChange={(e) => setDate(e.target.value)} className={input}>
            {[...new Set([...dates, date])].sort().map((d) => (
              <option key={d} value={d}>
                {shortDate(d)}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            Start
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            End
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={input} />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          Building
          <select value={building} onChange={(e) => setBuilding(e.target.value)} className={input}>
            {BUILDINGS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
            <option value={OTHER}>{OTHER_LABEL}</option>
            {building === UNKNOWN && <option value={UNKNOWN}>Location unknown{editing?.location ? ` (${editing.location})` : ""}</option>}
          </select>
        </label>
        {!imported && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={repeats} onChange={(e) => setRepeats(e.target.checked)} className="h-4 w-4" />
            Repeats every week (every {shortDate(date).slice(0, 3)})
          </label>
        )}

        {!timesOk && start && end && <p className="font-bold text-event" role="alert">The end time needs to be after the start time.</p>}
        {clashes.length > 0 && (
          <p className="rounded-lg border-2 border-event p-2" role="status">
            This clashes with {clashes.map((c) => `${c.title} ${c.start}–${c.end}`).join(" and ")}. You can still save it.
          </p>
        )}
        {error && timesOk && <p className="font-bold text-event" role="alert">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="submit" className="flex-1 rounded-xl bg-action px-4 py-2.5 font-bold text-on-action">
            Save
          </button>
          <button type="button" onClick={onClose} className="rounded-xl bg-card px-4 py-2.5 font-bold">
            Cancel
          </button>
          {editing && (
            <button type="button" onClick={remove} className="rounded-xl bg-card px-4 py-2.5 font-bold text-event">
              {manual && !manual.date ? "Delete (every week)" : "Delete"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
