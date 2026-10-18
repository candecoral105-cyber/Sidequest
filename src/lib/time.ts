// Time and date helpers. Times are minutes since midnight to keep the maths simple.
export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const toHHMM = (min: number) => {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export const duration = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

// Calendar dates are "YYYY-MM-DD" strings in London time, so comparing them as text works.
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The next date (today included) that falls on this weekday (0 = Sunday). */
export function nextDateFor(weekday: number, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
  return isoDate(d);
}

/**
 * Monday to Friday of the week to show: this week, or next week if it's already the weekend.
 * `offset` 1 = the week after that ("Next week").
 */
export function schoolWeek(offset = 0, today = new Date()) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow) + offset * 7);
  return Array.from({ length: 5 }, (_, i) => isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + i)));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-10-19" -> "Mon 19 Oct" */
export function shortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${SHORT_DAYS[date.getDay()]} ${d} ${MONTHS[m - 1]}`;
}

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
