// Server route: turns a mic recording into text with ElevenLabs.
import { NextResponse } from "next/server";
import { hasElevenLabs, transcribe } from "@/lib/elevenlabs";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  if (!hasElevenLabs()) return NextResponse.json({ error: "Voice is not set up" }, { status: 503 });
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) return NextResponse.json({ error: "No audio" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Recording too long" }, { status: 413 });
    const name = file instanceof File && file.name ? file.name : "speech.webm";
    return NextResponse.json({ text: await transcribe(file, name) });
  } catch (e) {
    console.error("Speech-to-text failed:", e);
    return NextResponse.json({ error: "Couldn't understand that" }, { status: 502 });
  }
}
