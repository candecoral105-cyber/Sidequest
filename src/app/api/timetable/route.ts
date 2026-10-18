// Server route: reads a timetable screenshot with Gemini and returns each class with its date.
import { NextResponse } from "next/server";
import { BUILDINGS, matchBuilding } from "@/data/buildings";
import { askGemini, hasGemini, imagePart } from "@/lib/gemini";
import type { ClassBlock } from "@/lib/types";

/** Today in UK time, "YYYY-MM-DD" and the weekday name, so Gemini can work out missing years. */
function ukToday() {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now); // en-CA gives YYYY-MM-DD
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long" }).format(now);
  return { date, weekday };
}

/** A real calendar date? (rejects things like 2026-02-30) */
function validDate(d: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const [y, m, day] = d.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, day));
  return x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === day;
}

// Classes keep their exact date when the image shows one, so different weeks never pile up on one weekday.
export async function POST(req: Request) {
  const { image } = (await req.json()) as { image: string };
  if (!hasGemini()) {
    return NextResponse.json({ error: "Add GEMINI_API_KEY to .env.local to read timetable screenshots." }, { status: 400 });
  }
  const today = ukToday();
  const prompt = `This is a university timetable (screenshot or photo). List every class you can see, once per occurrence.
Today is ${today.weekday} ${today.date} (UK).
date: the exact calendar date of that occurrence as "YYYY-MM-DD", whenever the image shows dates in any form
(column or row headers like "Mon 19/10" or "19 October", a month grid, a list with dates, a week range like "19–23 Oct").
Work out each class's date from its column/row header. If the image shows the year, use it; if not, use the year that puts
the date closest to today. If several weeks are shown, each class gets its own week's date (never merge weeks).
Only leave date as "" when the image shows no dates at all (a plain weekly timetable).
day: weekday of the class, 1=Monday ... 7=Sunday. start/end in 24h "HH:MM".
location: the building/room text exactly as shown (empty string if none).
Known buildings: ${BUILDINGS.map((b) => b.name).join(", ")}.`;

  try {
    const out = await askGemini<{ classes: { title: string; date: string; day: number; start: string; end: string; location: string }[] }>(
      [{ text: prompt }, imagePart(image)],
      {
        type: "OBJECT",
        properties: {
          classes: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                title: { type: "STRING" },
                date: { type: "STRING" },
                day: { type: "INTEGER" },
                start: { type: "STRING" },
                end: { type: "STRING" },
                location: { type: "STRING" },
              },
              required: ["title", "date", "day", "start", "end", "location"],
            },
          },
        },
        required: ["classes"],
      },
    );
    const classes: ClassBlock[] = out.classes
      .filter((c) => /^\d{1,2}:\d{2}$/.test(c.start) && /^\d{1,2}:\d{2}$/.test(c.end))
      .map((c, i) => {
        const date = validDate((c.date ?? "").trim()) ? c.date.trim() : undefined;
        // With a date, the weekday comes from the date itself, so they can never disagree.
        const day = date ? new Date(`${date}T12:00:00Z`).getUTCDay() : c.day % 7;
        return {
          id: `img-${i}`,
          seriesId: `img:${c.title.trim().toLowerCase()}`, // "Not a class" / building picks apply to every week of it
          title: c.title.trim(),
          day,
          date,
          start: c.start.padStart(5, "0"),
          end: c.end.padStart(5, "0"),
          buildingId: matchBuilding(c.location)?.id ?? null,
          location: c.location || undefined,
        };
      });
    return NextResponse.json({ classes });
  } catch (e) {
    console.error(e);
    const msg = String(e);
    const error = /Gemini error (500|502|503)/.test(msg)
      ? "Gemini is very busy right now. Try again in a minute."
      : /Gemini error 429/.test(msg)
        ? "Gemini's free daily limit is used up. Try again later, or add a few classes by hand."
        : "Couldn't read that image. Try a clearer screenshot.";
    return NextResponse.json({ error }, { status: 502 });
  }
}
