// Server route: reads a society event poster with Gemini to fill in the event form.
import { NextResponse } from "next/server";
import { askGemini, hasGemini, imagePart } from "@/lib/gemini";
import { ALL_TAGS } from "@/lib/mood";

export async function POST(req: Request) {
  const { image } = (await req.json()) as { image: string };
  if (!hasGemini()) {
    return NextResponse.json({ error: "Add GEMINI_API_KEY to .env.local to read posters." }, { status: 400 });
  }
  const today = new Date().toISOString().slice(0, 10);
  const prompt = `This is a poster for a London university society event. Today is ${today}.
Extract the event details. Use 24h "HH:MM" times. date as YYYY-MM-DD (assume the next upcoming date if no year).
price in pounds (0 if free or not mentioned as paid). uni is one of KCL, UCL, Imperial, or "" if unclear.
tags: choose 1-4 from ${ALL_TAGS.join(", ")}. address: the venue as written.
Use "" for anything you can't find.`;

  try {
    const out = await askGemini(
      [{ text: prompt }, imagePart(image)],
      {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          society: { type: "STRING" },
          uni: { type: "STRING" },
          date: { type: "STRING" },
          open: { type: "STRING" },
          close: { type: "STRING" },
          address: { type: "STRING" },
          price: { type: "NUMBER" },
          tags: { type: "ARRAY", items: { type: "STRING", enum: ALL_TAGS } },
        },
        required: ["name", "society", "uni", "date", "open", "close", "address", "price", "tags"],
      },
    );
    return NextResponse.json(out);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Couldn't read that poster. Try a clearer image." }, { status: 500 });
  }
}
