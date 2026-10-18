// Reads the Explore address (day, times, from, to), falling back to defaults if a link is broken.
import { nextDateFor, toHHMM, toMin } from "./time";

type Params = { get: (key: string) => string | null };

function hhmm(v: string | null, fallback: string) {
  const m = v?.match(/^(\d{1,2}):(\d{2})$/);
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? v!.padStart(5, "0") : fallback;
}

export function readGapParams(sp: Params) {
  const dateParam = sp.get("date");
  const validDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && !Number.isNaN(Date.parse(dateParam)) ? dateParam : null;
  const dayParam = Number(sp.get("day"));
  const day = validDate
    ? new Date(`${validDate}T12:00:00`).getDay()
    : Number.isInteger(dayParam) && dayParam >= 0 && dayParam <= 6
      ? dayParam
      : 2;
  const from = sp.get("from") ?? "bush-house";
  // "none" = done for the day (no trip back), "here" = back to where you started.
  const to = sp.get("to") ?? "strand";
  const noReturn = to === "none";
  const start = hhmm(sp.get("start"), "11:00");
  let end = hhmm(sp.get("end"), noReturn ? "20:00" : "14:10");
  // An end before the start (a mistyped link) would leave no time at all: give it an hour instead.
  if (toMin(end) <= toMin(start)) end = toHHMM(Math.min(toMin(start) + 60, 23 * 60 + 59));
  return {
    day,
    date: validDate ?? nextDateFor(day),
    start,
    end,
    from,
    wantsHere: from === "here",
    fallback: sp.get("fallback") ?? "bush-house",
    to,
    noReturn,
    backToStart: to === "here",
    demoLocation: sp.get("demoLocation"),
    focus: sp.get("focus"),
  };
}
