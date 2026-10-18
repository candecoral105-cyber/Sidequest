// Server route: turns how you feel into search filters with Gemini, or keyword rules without it.
import { NextResponse } from "next/server";
import { askGemini, hasGemini } from "@/lib/gemini";
import { ALL_TAGS, ALL_TYPES, cleanMood, moodFallback } from "@/lib/mood";
import type { MoodFilters } from "@/lib/types";

export async function POST(req: Request) {
  const { text, demo } = (await req.json()) as { text: string; demo?: boolean };
  if (!hasGemini() || demo || !text?.trim()) {
    return NextResponse.json({ ...moodFallback(text ?? ""), source: "offline" });
  }

  const prompt = `A university student in London has a free gap between classes. They said: "${text}".
Convert this into search filters. Only use these tags: ${ALL_TAGS.join(", ")}. Only use these types: ${ALL_TYPES.join(", ")}.
Pick 1-3 tags that best match their mood and needs (e.g. tired -> quiet; lonely -> social; hungry -> food).
Add the type "event" when they want to meet people or try something new (society events are the best way to meet people).
primaryTag is the ONE tag from your list that matters most for what they said (never "free" unless that's all they said).
required lists tags or types ONLY when their words clearly name a kind of place or activity
(e.g. "sports" or "gym" -> sport; "study" or "library" -> study; "coffee" -> cafe; "museum" or "gallery" -> creative).
For feelings like "tired" or "lonely", required is empty.
maxPrice is the most they want to spend in pounds (0 if they're broke or want free, -1 if they didn't say).
summary is one short, warm sentence (max 12 words) saying what you'll look for, addressed to them.`;

  try {
    const out = await askGemini<MoodFilters & { maxPrice: number }>([{ text: prompt }], {
      type: "OBJECT",
      properties: {
        tags: { type: "ARRAY", items: { type: "STRING", enum: ALL_TAGS } },
        types: { type: "ARRAY", items: { type: "STRING", enum: ALL_TYPES } },
        primaryTag: { type: "STRING", enum: ALL_TAGS },
        required: { type: "ARRAY", items: { type: "STRING", enum: [...ALL_TAGS, ...ALL_TYPES] } },
        maxPrice: { type: "NUMBER" },
        summary: { type: "STRING" },
      },
      required: ["tags", "types", "primaryTag", "required", "maxPrice", "summary"],
    });
    return NextResponse.json({ ...cleanMood({ ...out, maxPrice: out.maxPrice < 0 ? null : out.maxPrice }), source: "gemini" });
  } catch (e) {
    console.error("Mood search fell back to offline mode:", e);
    return NextResponse.json({ ...moodFallback(text), source: "offline" });
  }
}
