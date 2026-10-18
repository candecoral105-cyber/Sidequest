// Server route: turns text into speech with ElevenLabs (only used when Read aloud is on).
import { NextResponse } from "next/server";
import { hasElevenLabs, speak } from "@/lib/elevenlabs";

const MAX_CHARS = 1500;

export async function POST(req: Request) {
  if (!hasElevenLabs()) return NextResponse.json({ error: "Voice is not set up" }, { status: 503 });
  try {
    const { text } = (await req.json()) as { text?: string };
    if (!text?.trim()) return NextResponse.json({ error: "No text" }, { status: 400 });
    const audio = await speak(text.slice(0, MAX_CHARS));
    return new Response(audio.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("Text-to-speech failed:", e);
    return NextResponse.json({ error: "Couldn't speak that" }, { status: 502 });
  }
}
